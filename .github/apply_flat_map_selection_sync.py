from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing replacement anchor: {label}")
    return text.replace(old, new, 1)


map_path = Path("app/components/flats/FlatMap.client.vue")
src = map_path.read_text()

src = replace_once(
    src,
    "  cityZone?: FlatMapZone | null;\n",
    "  cityZone?: FlatMapZone | null;\n  selectedDistrict?: string;\n  selectedMicrodistrict?: string;\n  selectedQuartal?: string;\n  selectedArea?: string;\n  selectedMetro?: string;\n  selectedMetroRadiusM?: number;\n",
    "selected map props",
)
src = replace_once(
    src,
    '  (e: "zone-select", payload: { kind: ZoneKind; name: string }): void;\n',
    '  (e: "zone-select", payload: { kind: ZoneKind; name: string; radiusM?: number }): void;\n',
    "zone-select payload",
)

old_emit = '''function emitZoneSelect(kind: ZoneKind, name: string) {
  closeRadial();
  if (kind === "district") {
    selectedDistrictName.value = selectedDistrictName.value === name ? null : name;
    renderDistrictZones();
  }
  // Metro is a proximity/focus overlay, not one of the page's canonical zone
  // events. Keeping it local also prevents the parent area's fallback handler
  // from interpreting a metro station as an administrative area.
  if (kind === "metro") return;
  emit("zone-select", { kind, name });
}
'''
new_emit = '''function selectedName(kind: ZoneKind): string {
  if (kind === "district") return props.selectedDistrict || "";
  if (kind === "microdistrict") return props.selectedMicrodistrict || "";
  if (kind === "quartal") return props.selectedQuartal || "";
  if (kind === "area") return props.selectedArea || "";
  return props.selectedMetro || "";
}

function isZoneSelected(kind: ZoneKind, name: string): boolean {
  return selectedName(kind) === name;
}

function emitZoneSelect(kind: ZoneKind, name: string, radiusM?: number) {
  closeRadial();
  const sameZone = isZoneSelected(kind, name);
  const sameRadius = kind !== "metro" || radiusM == null || Number(props.selectedMetroRadiusM) === radiusM;
  const nextName = sameZone && sameRadius ? "" : name;
  if (kind === "district") {
    selectedDistrictName.value = nextName || null;
    renderDistrictZones();
  }
  emit("zone-select", {
    kind,
    name: nextName,
    ...(kind === "metro" && nextName && radiusM != null ? { radiusM } : {}),
  });
}

function selectedZoneFromProps(): { kind: ZoneKind; zone: FlatMapZone } | null {
  const groups: Array<[ZoneKind, FlatMapZone[] | undefined, string | undefined]> = [
    ["metro", props.metroStations, props.selectedMetro],
    ["area", props.areaZones, props.selectedArea],
    ["quartal", props.quartalMarkers, props.selectedQuartal],
    ["microdistrict", props.microdistrictMarkers, props.selectedMicrodistrict],
    ["district", props.districtZones, props.selectedDistrict],
  ];
  for (const [kind, zones, name] of groups) {
    if (!name) continue;
    const zone = (zones || []).find((candidate) => candidate.name === name);
    if (zone) return { kind, zone };
  }
  return null;
}

function enableLayerFor(kind: ZoneKind) {
  if (kind === "district") showDistricts.value = true;
  else if (kind === "microdistrict") showMicrodistricts.value = true;
  else if (kind === "quartal") showQuartals.value = true;
  else if (kind === "area") showAreas.value = true;
  else showMetro.value = true;
}

function syncSelectionFromProps(focus = false) {
  selectedDistrictName.value = props.selectedDistrict || null;
  const selected = selectedZoneFromProps();
  if (selected) enableLayerFor(selected.kind);
  renderAllZoneLayers();
  if (focus && selected) focusZone(selected.zone);
}
'''
src = replace_once(src, old_emit, new_emit, "selection helpers")

old_render_shape = '''function renderZoneShape(layerGroup: any, zone: FlatMapZone, kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  const onClick = (event: any) => handleLayerClick(event, () => { focusZone(zone); emitZoneSelect(kind, zone.name); });
  if (zone.boundary) {
    const shape = L.geoJSON(zone.boundary as any, { style: () => style, bubblingMouseEvents: false }).addTo(layerGroup);
    shape.on("click", onClick);
    shape.bindTooltip(zone.label, { direction: "top" });
    return shape;
  }
  const circle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, ...style }).addTo(layerGroup);
  circle.on("click", onClick);
  return circle;
}
'''
new_render_shape = '''function renderZoneShape(layerGroup: any, zone: FlatMapZone, kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  const selected = isZoneSelected(kind, zone.name);
  const baseWeight = Number(style.weight ?? 2);
  const baseFillOpacity = Number(style.fillOpacity ?? 0.16);
  const selectedStyle = selected
    ? { ...style, weight: baseWeight + 1.25, opacity: 1, fillOpacity: Math.min(.42, baseFillOpacity + .14) }
    : style;
  const onClick = (event: any) => handleLayerClick(event, () => {
    if (!selected) focusZone(zone);
    emitZoneSelect(kind, zone.name);
  });
  if (zone.boundary) {
    const shape = L.geoJSON(zone.boundary as any, { style: () => selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
    shape.on("click", onClick);
    shape.bindTooltip(zone.label, { direction: "top" });
    if (selected) shape.openTooltip?.();
    return shape;
  }
  const circle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, ...selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
  circle.on("click", onClick);
  circle.bindTooltip(zone.label, { direction: "top" });
  if (selected) circle.openTooltip?.();
  return circle;
}
'''
src = replace_once(src, old_render_shape, new_render_shape, "selected zone render")

src = replace_once(
    src,
    '''    const shape = renderZoneShape(layerGroup, zone, kind, { ...style, color: zone.color, fillColor: zone.color, className: "flat-zone-shape" });
    if (!zone.boundary) shape.bindTooltip(zone.label, { direction: "top" });
''',
    '''    renderZoneShape(layerGroup, zone, kind, { ...style, color: zone.color, fillColor: zone.color, className: "flat-zone-shape" });
''',
    "dedupe zone tooltip",
)

old_metro_handler = '''  const onMetroRingClick = (event: any) => handleLayerClick(event, () => {
    const point = eventLatLng(event);
    const station = point ? nearestMetroStation(point) : null;
    if (!station) return;
    focusZone(station);
    emitZoneSelect("metro", station.name);
  });
  for (const station of props.metroStations || []) {
    for (const [radius, color, opacity] of [[1000, "#8b5cf6", .055], [500, "#22c55e", .08], [200, "#f59e0b", .13]] as const) {
      const ring = L.circle([station.lat, station.lng], { radius, color, weight: 1.25, opacity: .75, fillColor: color, fillOpacity: opacity, bubblingMouseEvents: false }).addTo(metroLayer);
      ring.on("click", onMetroRingClick);
    }
    const marker = L.circleMarker([station.lat, station.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1, bubblingMouseEvents: false });
    marker.bindTooltip(`${station.label} · 200 / 500 / 1000 m`, { direction: "top" });
    marker.on("click", (event: any) => handleLayerClick(event, () => { focusZone(station); emitZoneSelect("metro", station.name); }));
    marker.addTo(metroLayer);
  }
'''
new_metro_handler = '''  for (const station of props.metroStations || []) {
    const stationSelected = isZoneSelected("metro", station.name);
    for (const [radius, color, opacity] of [[1000, "#8b5cf6", .055], [500, "#22c55e", .08], [200, "#f59e0b", .13]] as const) {
      const radiusSelected = stationSelected && Number(props.selectedMetroRadiusM) === radius;
      const ring = L.circle([station.lat, station.lng], {
        radius,
        color,
        weight: radiusSelected ? 3 : 1.25,
        opacity: radiusSelected ? 1 : .75,
        fillColor: color,
        fillOpacity: radiusSelected ? Math.min(.24, opacity + .11) : opacity,
        bubblingMouseEvents: false,
      }).addTo(metroLayer);
      ring.bindTooltip(`${station.label} · ${radius} m`, { direction: "top" });
      if (radiusSelected) ring.openTooltip?.();
      ring.on("click", (event: any) => handleLayerClick(event, () => {
        const point = eventLatLng(event);
        const nearest = point ? nearestMetroStation(point) : station;
        if (!nearest) return;
        const togglingOff = isZoneSelected("metro", nearest.name) && Number(props.selectedMetroRadiusM) === radius;
        if (!togglingOff) focusZone(nearest);
        emitZoneSelect("metro", nearest.name, radius);
      }));
    }
    const marker = L.circleMarker([station.lat, station.lng], {
      radius: stationSelected ? 8 : 6,
      color: "#fff",
      weight: stationSelected ? 3 : 2,
      fillColor: stationSelected ? "#e0679a" : "#2563eb",
      fillOpacity: 1,
      bubblingMouseEvents: false,
    });
    marker.bindTooltip(`${station.label} · 200 / 500 / 1000 m`, { direction: "top" });
    if (stationSelected) marker.openTooltip?.();
    marker.on("click", (event: any) => handleLayerClick(event, () => {
      if (!stationSelected) focusZone(station);
      emitZoneSelect("metro", station.name);
    }));
    marker.addTo(metroLayer);
  }
'''
src = replace_once(src, old_metro_handler, new_metro_handler, "metro radius selection")

src = replace_once(
    src,
    '''  map.on("click", (event: any) => {
    if (addDrawPoint(event)) return;
    closeRadial();
    if (selectedDistrictName.value != null) {
      selectedDistrictName.value = null;
      renderDistrictZones();
    }
  });
''',
    '''  map.on("click", (event: any) => {
    if (addDrawPoint(event)) return;
    closeRadial();
  });
''',
    "map background selection preservation",
)

src = replace_once(
    src,
    '''  renderAllZoneLayers();
  fitToPoints();
});
''',
    '''  renderAllZoneLayers();
  if (selectedZoneFromProps()) syncSelectionFromProps(true);
  else fitToPoints();
});
''',
    "initial selected focus",
)

src = replace_once(
    src,
    '''watch(() => [props.districtZones, props.microdistrictMarkers, props.quartalMarkers, props.metroStations, props.universityZones, props.shoppingMallZones, props.parkZones, props.areaZones, props.cityZone], renderAllZoneLayers, { deep: true });
watch([showDistricts, showMicrodistricts, showQuartals, showMetro, showUniversities, showShoppingMalls, showParks, showAreas, showCity], renderAllZoneLayers);
''',
    '''watch(() => [props.districtZones, props.microdistrictMarkers, props.quartalMarkers, props.metroStations, props.universityZones, props.shoppingMallZones, props.parkZones, props.areaZones, props.cityZone], () => syncSelectionFromProps(false), { deep: true });
watch(
  () => [props.selectedDistrict, props.selectedMicrodistrict, props.selectedQuartal, props.selectedArea, props.selectedMetro, props.selectedMetroRadiusM],
  (next, previous) => {
    const changed = next.some((value, index) => value !== previous?.[index]);
    if (changed) syncSelectionFromProps(Boolean(selectedZoneFromProps()));
  },
);
watch([showDistricts, showMicrodistricts, showQuartals, showMetro, showUniversities, showShoppingMalls, showParks, showAreas, showCity], renderAllZoneLayers);
''',
    "selected props watcher",
)

map_path.write_text(src)

page_path = Path("app/pages/flat-finder/index.vue")
page = page_path.read_text()
old_handler = '''function onZoneSelect({ kind, name }: { kind: "district" | "microdistrict" | "quartal" | "area"; name: string }) {
  if (kind === "district") district.value = name;
  else if (kind === "microdistrict") microdistrict.value = name;
  else if (kind === "quartal") quartal.value = name;
  else mapArea.value = name;
  scheduleLoad();
}
'''
new_handler = '''function onZoneSelect({ kind, name, radiusM }: { kind: "district" | "microdistrict" | "quartal" | "area" | "metro"; name: string; radiusM?: number }) {
  if (kind === "district") district.value = name;
  else if (kind === "microdistrict") microdistrict.value = name;
  else if (kind === "quartal") quartal.value = name;
  else if (kind === "area") mapArea.value = name;
  else {
    metro.value = name;
    if (!name) metroMaxM.value = undefined;
    else if (radiusM != null) metroMaxM.value = radiusM;
  }
  scheduleLoad(0);
}
'''
page = replace_once(page, old_handler, new_handler, "page map selection handler")

old_map = '<section v-if="listings.length" class="flats__map-wrap"><flat-map :points="mapPoints" :draw-label="t(\'drawArea\')" :done-label="t(\'done\')" :clear-label="t(\'clearArea\')" :draw-hint="t(\'drawHint\')" :expand-label="t(\'mapExpand\')" :collapse-label="t(\'mapCollapse\')" :district-zones="districtZones" :microdistrict-markers="microdistrictMarkers" :quartal-markers="quartalMarkers" :metro-stations="metroStations" :university-zones="universityZones" :shopping-mall-zones="shoppingMallZones" :park-zones="parkZones" :area-zones="areaZones" :city-zone="cityZone" :districts-label="t(\'districtsLayer\')" :microdistricts-label="t(\'microdistrictsLayer\')" :quartals-label="t(\'quartalsLayer\')" :metro-label="t(\'metro\')" :universities-label="t(\'universitiesLayer\')" :shopping-malls-label="t(\'shoppingMallsLayer\')" :parks-label="t(\'parksLayer\')" :areas-label="t(\'areasLayer\')" :city-label="t(\'cityLayer\')" @select="openById" @area-change="drawnArea = $event" @zone-select="onZoneSelect" /></section>'
new_map = '<section v-if="listings.length" class="flats__map-wrap"><flat-map :points="mapPoints" :draw-label="t(\'drawArea\')" :done-label="t(\'done\')" :clear-label="t(\'clearArea\')" :draw-hint="t(\'drawHint\')" :expand-label="t(\'mapExpand\')" :collapse-label="t(\'mapCollapse\')" :district-zones="districtZones" :microdistrict-markers="microdistrictMarkers" :quartal-markers="quartalMarkers" :metro-stations="metroStations" :university-zones="universityZones" :shopping-mall-zones="shoppingMallZones" :park-zones="parkZones" :area-zones="areaZones" :city-zone="cityZone" :selected-district="district" :selected-microdistrict="microdistrict" :selected-quartal="quartal" :selected-area="mapArea" :selected-metro="metro" :selected-metro-radius-m="metroMaxM" :districts-label="t(\'districtsLayer\')" :microdistricts-label="t(\'microdistrictsLayer\')" :quartals-label="t(\'quartalsLayer\')" :metro-label="t(\'metro\')" :universities-label="t(\'universitiesLayer\')" :shopping-malls-label="t(\'shoppingMallsLayer\')" :parks-label="t(\'parksLayer\')" :areas-label="t(\'areasLayer\')" :city-label="t(\'cityLayer\')" @select="openById" @area-change="drawnArea = $event" @zone-select="onZoneSelect" /></section>'
page = replace_once(page, old_map, new_map, "page selected props")
page_path.write_text(page)
