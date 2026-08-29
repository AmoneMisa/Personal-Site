<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { FlatMapFeedResult, FlatMapPoint } from "~/types/flats";
import type * as LeafletNS from "leaflet";

// Bundled from npm (same-origin, cached, no third-party round trip) but imported
// dynamically: Leaflet touches `window` at module-evaluation time, and this file's
// top-level statements still run through Nuxt's SSR module graph even though the
// component itself is client-only, so a static import here would 500 on the server.
let Leaflet: typeof LeafletNS | null = null;
async function loadLeaflet(): Promise<typeof LeafletNS> {
  if (Leaflet) return Leaflet;
  const [mod] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
  Leaflet = mod.default ?? (mod as unknown as typeof LeafletNS);
  return Leaflet;
}

interface FlatPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  priceLabel?: string;
  photo?: string;
  source?: string;
  country?: string;
}

interface MapFocusDetail {
  id: string;
  source?: string;
  country?: string;
  lat: number;
  lng: number;
}

interface FlatMapZone {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  boundary?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

type ZoneKind = "district" | "microdistrict" | "quartal" | "area";

const props = defineProps<{
  points: FlatPoint[];
  drawLabel?: string;
  doneLabel?: string;
  clearLabel?: string;
  drawHint?: string;
  expandLabel?: string;
  collapseLabel?: string;
  districtZones?: FlatMapZone[];
  microdistrictMarkers?: FlatMapZone[];
  quartalMarkers?: FlatMapZone[];
  areaZones?: FlatMapZone[];
  districtsLabel?: string;
  microdistrictsLabel?: string;
  quartalsLabel?: string;
  areasLabel?: string;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "area-change", points: Array<{ lat: number; lng: number }>): void;
  (e: "zone-select", payload: { kind: ZoneKind; name: string }): void;
}>();

const route = useRoute();
const router = useRouter();
const CLUSTER_PX = 38;
// Any cluster with real geographic spread zooms in as far as the map allows before
// falling back to the radial popout — only listings that are still coincident at
// max zoom (same building) can't be separated by zooming and need the popout.
const ZOOM_CLUSTER_THRESHOLD = 1;
const CLUSTER_ZOOM_MAX = 19;
const RADIAL_PAGE_SIZE = 9;
const FOCUS_ZOOM = 18;
const DETAIL_QUERY_KEYS = new Set(["flat", "flatSource", "flatCountry", "shared"]);

const el = ref<HTMLElement | null>(null);
const failed = ref(false);
const drawing = ref(false);
const area = ref<Array<{ lat: number; lng: number }>>([]);
const radial = ref<{ x: number; y: number; items: FlatPoint[]; page: number } | null>(null);
const expanded = ref(false);
const remotePoints = ref<FlatPoint[]>([]);
const focusedPoint = ref<MapFocusDetail | null>(null);
const showDistricts = ref(true);
const showMicrodistricts = ref(false);
const showQuartals = ref(false);
const showAreas = ref(true);
let mapFeedSequence = 0;
let lastMapFeedKey = "";

function pointKey(point: Pick<FlatPoint, "id" | "source" | "country">): string {
  return `${point.source || ""}:${point.country || ""}:${point.id}`;
}

function fallbackPriceLabel(point: FlatMapPoint): string | undefined {
  if (point.price == null || !Number.isFinite(Number(point.price))) return undefined;
  const value = Number(point.price).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return point.currency ? `${value} ${point.currency}` : value;
}

function normalizedRouteQuery(): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, raw] of Object.entries(route.query)) {
    if (DETAIL_QUERY_KEYS.has(key)) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value == null || value === "") continue;
    query[key] = String(value);
  }
  return query;
}

async function loadFullMapFeed() {
  if (!import.meta.client) return;
  const query = normalizedRouteQuery();
  const key = new URLSearchParams(query).toString();
  if (key === lastMapFeedKey && remotePoints.value.length) return;
  lastMapFeedKey = key;
  const sequence = ++mapFeedSequence;
  try {
    const data = await $fetch<FlatMapFeedResult>("/flats-map", { query });
    if (sequence !== mapFeedSequence) return;
    remotePoints.value = (data?.mapPoints || [])
      .filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)))
      .map((point) => ({
        id: String(point.id),
        source: point.source,
        country: point.country,
        lat: Number(point.lat),
        lng: Number(point.lng),
        title: point.title || "",
        priceLabel: fallbackPriceLabel(point),
      }));
  } catch {
    // The already-loaded page points remain a complete fallback when the compact
    // map request is unavailable; never take the map down with the secondary feed.
  }
}

const renderedPoints = computed<FlatPoint[]>(() => {
  const merged = new Map<string, FlatPoint>();
  for (const point of remotePoints.value) merged.set(pointKey(point), point);
  // Loaded cards win: they contain localized titles, converted prices and photos.
  for (const point of props.points) {
    const exactKey = pointKey(point);
    if (point.country || !point.source) {
      merged.set(exactKey, point);
      continue;
    }
    const remote = remotePoints.value.find((candidate) => candidate.id === point.id && candidate.source === point.source);
    merged.set(remote ? pointKey(remote) : exactKey, { ...remote, ...point });
  }
  return [...merged.values()];
});

const radialPageCount = computed(() => {
  const count = radial.value?.items.length ?? 0;
  return Math.max(1, Math.ceil(count / RADIAL_PAGE_SIZE));
});

const visibleRadialItems = computed(() => {
  const current = radial.value;
  if (!current) return [];
  const start = current.page * RADIAL_PAGE_SIZE;
  return current.items.slice(start, start + RADIAL_PAGE_SIZE);
});

const radialPageLabel = computed(() => {
  const current = radial.value;
  if (!current) return "";
  return `${current.page + 1}/${radialPageCount.value}`;
});

let map: any = null;
let layer: any = null;
let areaLayer: any = null;
let focusLayer: any = null;
let districtLayer: any = null;
let microdistrictLayer: any = null;
let quartalLayer: any = null;
let zoneAreaLayer: any = null;
let lastFitSig = "";

async function setExpanded(value: boolean) {
  expanded.value = value;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  // Wheel-zoom stays off while the map is embedded inline so scrolling the page
  // over it doesn't get hijacked; once expanded to full screen it no longer
  // shares scroll with the page, so the wheel can zoom the map as expected.
  if (value) map?.scrollWheelZoom?.enable();
  else map?.scrollWheelZoom?.disable();
  await nextTick();
  requestAnimationFrame(() => map?.invalidateSize());
  setTimeout(() => map?.invalidateSize(), 260);
  setTimeout(() => map?.invalidateSize(), 600);
}

function toggleExpanded() {
  void setExpanded(!expanded.value);
}

function closeRadial() {
  radial.value = null;
}

function changeRadialPage(direction: -1 | 1) {
  const current = radial.value;
  if (!current || radialPageCount.value <= 1) return;
  const next = (current.page + direction + radialPageCount.value) % radialPageCount.value;
  radial.value = { ...current, page: next };
}

function onKeydown(event: KeyboardEvent) {
  if (radial.value) {
    if (event.key === "Escape") {
      closeRadial();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      changeRadialPage(event.key === "ArrowRight" ? 1 : -1);
      event.preventDefault();
      return;
    }
  }
  if (event.key === "Escape" && expanded.value) void setExpanded(false);
}

interface Cluster { lat: number; lng: number; items: FlatPoint[] }

function clusterPoints(): Cluster[] {
  const clusters: Array<{ x: number; y: number; latSum: number; lngSum: number; items: FlatPoint[] }> = [];
  for (const p of renderedPoints.value) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    let placed = false;
    for (const c of clusters) {
      const dx = c.x - pt.x;
      const dy = c.y - pt.y;
      if (dx * dx + dy * dy <= CLUSTER_PX * CLUSTER_PX) {
        c.items.push(p);
        c.latSum += p.lat;
        c.lngSum += p.lng;
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ x: pt.x, y: pt.y, latSum: p.lat, lngSum: p.lng, items: [p] });
  }
  return clusters.map((c) => ({
    lat: c.latSum / c.items.length,
    lng: c.lngSum / c.items.length,
    items: c.items,
  }));
}

function renderMarkers() {
  const L = Leaflet;
  if (!map || !layer || !L) return;
  layer.clearLayers();
  closeRadial();
  for (const c of clusterPoints()) {
    const count = c.items.length;
    const multi = count > 1;
    const size = multi ? 32 : 16;
    const icon = L.divIcon({
      className: "flat-cluster-wrap",
      html: `<span class="flat-cluster${multi ? " flat-cluster_multi" : ""}">${multi ? count : ""}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    const marker = L.marker([c.lat, c.lng], { icon });
    marker.on("click", () => openCluster(c));
    marker.addTo(layer);
  }
}

function renderFocusedPoint() {
  const L = Leaflet;
  if (!focusLayer || !L) return;
  focusLayer.clearLayers();
  const point = focusedPoint.value;
  if (!point) return;
  L.circleMarker([point.lat, point.lng], {
    radius: 12,
    color: "#ffffff",
    weight: 3,
    fillColor: "#e0679a",
    fillOpacity: 0.95,
  }).addTo(focusLayer);
  L.circleMarker([point.lat, point.lng], {
    radius: 20,
    color: "#e0679a",
    weight: 2,
    opacity: 0.58,
    fillOpacity: 0,
  }).addTo(focusLayer);
}

function focusOnPoint(detail: MapFocusDetail) {
  const lat = Number(detail?.lat);
  const lng = Number(detail?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  focusedPoint.value = { ...detail, lat, lng };
  renderFocusedPoint();

  const shell = el.value?.closest(".flat-map-shell") as HTMLElement | null;
  shell?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!map) return;
  window.setTimeout(() => {
    map?.invalidateSize?.();
    map?.flyTo?.([lat, lng], FOCUS_ZOOM, { animate: true, duration: 0.75 });
    renderFocusedPoint();
  }, 180);
}

function onMapFocus(event: Event) {
  const detail = (event as CustomEvent<MapFocusDetail>).detail;
  if (detail) focusOnPoint(detail);
}

function radialRadius(count: number): number {
  const mobile = window.innerWidth <= 640;
  if (mobile) return count <= 4 ? 72 : 94;
  return count <= 4 ? 112 : 142;
}

function clampRadialCoordinate(value: number, clearance: number, viewport: number): number {
  if (viewport <= clearance * 2) return viewport / 2;
  return Math.min(viewport - clearance, Math.max(clearance, value));
}

function openPoint(point: FlatPoint) {
  closeRadial();
  const loaded = props.points.some((candidate) => candidate.id === point.id && (!point.source || candidate.source === point.source));
  if (loaded) {
    emit("select", point.id);
    return;
  }
  if (!point.source || !point.country) return;
  void router.replace({
    query: {
      ...route.query,
      flat: point.id,
      flatSource: point.source,
      flatCountry: point.country,
    },
  });
}

function openCluster(c: Cluster) {
  const L = Leaflet;
  if (c.items.length === 1) {
    openPoint(c.items[0]);
    return;
  }
  // A formed cluster's on-screen spread is small by construction (that's why the
  // points merged), so checking pixel spread mostly missed genuinely distinct
  // addresses. Checking the real lat/lng bounds instead: if the points aren't all
  // literally the same coordinate, zooming in will keep separating them further.
  const bounds = L.latLngBounds(c.items.map((p) => [p.lat, p.lng]) as [number, number][]);
  const hasRealSpread = !bounds.getNorthEast().equals(bounds.getSouthWest());
  if (c.items.length > ZOOM_CLUSTER_THRESHOLD && hasRealSpread && map.getZoom() < CLUSTER_ZOOM_MAX) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: CLUSTER_ZOOM_MAX });
    return;
  }
  const pt = map.latLngToContainerPoint([c.lat, c.lng]);
  const rect = el.value?.getBoundingClientRect();
  if (!rect) return;

  const count = Math.min(c.items.length, RADIAL_PAGE_SIZE);
  const radius = radialRadius(count);
  const mobile = window.innerWidth <= 640;
  const halfTabWidth = mobile ? 39 : 48;
  const halfTabHeight = mobile ? 33 : 43;
  const rawX = rect.left + pt.x;
  const rawY = rect.top + pt.y;
  const x = clampRadialCoordinate(rawX, radius + halfTabWidth + 8, window.innerWidth);
  const y = clampRadialCoordinate(rawY, radius + halfTabHeight + 8, window.innerHeight);
  radial.value = { x, y, items: [...c.items], page: 0 };
}

function slotStyle(i: number, n: number) {
  const radius = radialRadius(n);
  const angle = (-90 + (360 / Math.max(1, n)) * i) * (Math.PI / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
    animationDelay: `${i * 22}ms`,
  };
}

function fitToPoints() {
  if (!map || focusedPoint.value) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function renderArea() {
  const L = Leaflet;
  if (!areaLayer || !L) return;
  areaLayer.clearLayers();
  if (area.value.length >= 2) {
    const points = area.value.map((point) => [point.lat, point.lng]);
    if (area.value.length >= 3) {
      L.polygon(points, { color: "#e0679a", weight: 2, fillColor: "#e0679a", fillOpacity: 0.16 }).addTo(areaLayer);
    } else {
      L.polyline(points, { color: "#e0679a", weight: 2 }).addTo(areaLayer);
    }
  }
  for (const point of area.value) {
    L.circleMarker([point.lat, point.lng], { radius: 5, color: "#fff", weight: 2, fillColor: "#e0679a", fillOpacity: 1 }).addTo(areaLayer);
  }
}

function emitZoneSelect(kind: ZoneKind, name: string) {
  closeRadial();
  emit("zone-select", { kind, name });
}

// Renders a zone as its real boundary polygon when the catalog provides one, falling
// back to an approximated circle (sized upstream to avoid overlap) when it doesn't.
function renderZoneShape(layerGroup: any, zone: FlatMapZone, kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  const onClick = (event: any) => { L.DomEvent.stopPropagation(event); emitZoneSelect(kind, zone.name); };
  if (zone.boundary) {
    const shape = L.geoJSON(zone.boundary as any, { style: () => style }).addTo(layerGroup);
    shape.on("click", onClick);
    shape.bindTooltip(zone.label, { direction: "top" });
    return shape;
  }
  const circle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, ...style }).addTo(layerGroup);
  circle.on("click", onClick);
  return circle;
}

function renderDistrictZones() {
  const L = Leaflet;
  if (!districtLayer || !L) return;
  districtLayer.clearLayers();
  if (!showDistricts.value) return;
  for (const zone of props.districtZones || []) {
    renderZoneShape(districtLayer, zone, "district", { color: zone.color, weight: 2.5, opacity: 0.9, fillColor: zone.color, fillOpacity: 0.22, className: "flat-zone-shape" });
    const label = L.divIcon({
      className: "flat-zone-label-wrap",
      html: `<span class="flat-zone-label" style="border-color:${zone.color}">${zone.label}</span>`,
      iconSize: [0, 0],
    });
    L.marker([zone.lat, zone.lng], { icon: label, interactive: false }).addTo(districtLayer);
  }
}

function renderZoneMarkers(layerGroup: any, zones: FlatMapZone[], kind: ZoneKind, shape: "circle" | "square") {
  const L = Leaflet;
  if (!layerGroup || !L) return;
  layerGroup.clearLayers();
  for (const zone of zones) {
    const icon = L.divIcon({
      className: "flat-zone-marker-wrap",
      html: `<span class="flat-zone-marker flat-zone-marker_${shape}" style="background:${zone.color}" title="${zone.label}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const marker = L.marker([zone.lat, zone.lng], { icon });
    marker.bindTooltip(zone.label, { direction: "top", offset: [0, -8] });
    marker.on("click", () => emitZoneSelect(kind, zone.name));
    marker.addTo(layerGroup);
  }
}

function renderMicrodistricts() {
  if (showMicrodistricts.value) renderZoneMarkers(microdistrictLayer, props.microdistrictMarkers || [], "microdistrict", "circle");
  else microdistrictLayer?.clearLayers();
}

function renderQuartals() {
  if (showQuartals.value) renderZoneMarkers(quartalLayer, props.quartalMarkers || [], "quartal", "square");
  else quartalLayer?.clearLayers();
}

function renderAreaZones() {
  const L = Leaflet;
  if (!zoneAreaLayer || !L) return;
  zoneAreaLayer.clearLayers();
  if (!showAreas.value) return;
  for (const zone of props.areaZones || []) {
    const shape = renderZoneShape(zoneAreaLayer, zone, "area", { color: zone.color, weight: 2, dashArray: "6 5", fillColor: zone.color, fillOpacity: 0.14 });
    if (!zone.boundary) shape.bindTooltip(zone.label, { direction: "top" });
  }
}

function renderAllZoneLayers() {
  renderDistrictZones();
  renderMicrodistricts();
  renderQuartals();
  renderAreaZones();
}

function toggleDrawing() {
  drawing.value = !drawing.value;
}

function clearArea() {
  area.value = [];
  renderArea();
  emit("area-change", []);
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", closeRadial, { passive: true });
  window.addEventListener("flat-map-focus", onMapFocus as EventListener);
  void loadFullMapFeed();
  if (!el.value) return;
  let L: typeof LeafletNS;
  try {
    L = await loadLeaflet();
  } catch {
    failed.value = true;
    return;
  }
  if (!el.value) return;
  try {
    map = L.map(el.value, { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([41.31, 69.24], 5);
  } catch {
    failed.value = true;
    return;
  }
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxNativeZoom: 19,
    maxZoom: 19,
    detectRetina: true,
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  areaLayer = L.layerGroup().addTo(map);
  focusLayer = L.layerGroup().addTo(map);
  districtLayer = L.layerGroup().addTo(map);
  microdistrictLayer = L.layerGroup().addTo(map);
  quartalLayer = L.layerGroup().addTo(map);
  zoneAreaLayer = L.layerGroup().addTo(map);
  map.on("click", (event: any) => {
    if (!drawing.value) {
      closeRadial();
      return;
    }
    area.value = [...area.value, { lat: event.latlng.lat, lng: event.latlng.lng }];
    renderArea();
    emit("area-change", area.value.length >= 3 ? area.value : []);
  });
  map.on("zoomend", renderMarkers);
  map.on("movestart", closeRadial);
  map.on("zoomstart", closeRadial);
  renderMarkers();
  renderFocusedPoint();
  renderAllZoneLayers();
  fitToPoints();
});

watch(renderedPoints, () => { renderMarkers(); fitToPoints(); }, { deep: true });
watch(() => route.query, () => { void loadFullMapFeed(); }, { deep: true });
watch(() => [props.districtZones, props.microdistrictMarkers, props.quartalMarkers, props.areaZones], renderAllZoneLayers, { deep: true });
watch([showDistricts, showMicrodistricts, showQuartals, showAreas], renderAllZoneLayers);

onBeforeUnmount(() => {
  mapFeedSequence += 1;
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", closeRadial);
  window.removeEventListener("flat-map-focus", onMapFocus as EventListener);
  document.body.style.overflow = "";
  map?.remove?.();
  map = null;
  layer = null;
  areaLayer = null;
  focusLayer = null;
  districtLayer = null;
  microdistrictLayer = null;
  quartalLayer = null;
  zoneAreaLayer = null;
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }">
      <div ref="el" class="flat-map" />

      <div class="flat-map__tools">
        <button
          type="button"
          class="flat-map__tool"
          :class="{ 'flat-map__tool_active': expanded }"
          :aria-label="expanded ? (props.collapseLabel || 'Close map') : (props.expandLabel || 'Full screen')"
          @click="toggleExpanded"
        >
          {{ expanded ? "×" : "⤢" }}
          <span>{{ expanded ? (props.collapseLabel || "Close") : (props.expandLabel || "Full screen") }}</span>
        </button>
        <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': drawing }" @click="toggleDrawing">
          {{ drawing ? "✓" : "⌁" }}
          <span>{{ drawing ? (props.doneLabel || "Done") : (props.drawLabel || "Draw area") }}</span>
        </button>
        <button v-if="area.length" type="button" class="flat-map__tool" @click="clearArea">
          × <span>{{ props.clearLabel || "Clear" }}</span>
        </button>
        <button v-if="districtZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showDistricts }" @click="showDistricts = !showDistricts">
          <span>{{ props.districtsLabel || "Districts" }}</span>
        </button>
        <button v-if="microdistrictMarkers?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showMicrodistricts }" @click="showMicrodistricts = !showMicrodistricts">
          <span>{{ props.microdistrictsLabel || "Microdistricts" }}</span>
        </button>
        <button v-if="quartalMarkers?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showQuartals }" @click="showQuartals = !showQuartals">
          <span>{{ props.quartalsLabel || "Quartals" }}</span>
        </button>
        <button v-if="areaZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showAreas }" @click="showAreas = !showAreas">
          <span>{{ props.areasLabel || "Areas" }}</span>
        </button>
      </div>
      <div v-if="drawing" class="flat-map__hint">{{ props.drawHint || "Click points on the map to outline an area." }}</div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="radial" class="flat-radial" @click.self="closeRadial">
      <div class="flat-radial__anchor" :style="{ left: `${radial.x}px`, top: `${radial.y}px` }">
        <div class="flat-radial__hub" role="group" aria-label="Browse apartment pages in this cluster">
          <button
            type="button"
            class="flat-radial__hub-arrow"
            :disabled="radialPageCount <= 1"
            aria-label="Previous apartment page"
            @click.stop="changeRadialPage(-1)"
          >‹</button>
          <span class="flat-radial__hub-count" :title="`${radial.items.length} apartments`">{{ radialPageLabel }}</span>
          <button
            type="button"
            class="flat-radial__hub-arrow"
            :disabled="radialPageCount <= 1"
            aria-label="Next apartment page"
            @click.stop="changeRadialPage(1)"
          >›</button>
        </div>

        <div
          v-for="(item, i) in visibleRadialItems"
          :key="`${radial.page}:${pointKey(item)}`"
          class="flat-radial__slot"
          :style="slotStyle(i, visibleRadialItems.length)"
        >
          <button type="button" class="flat-radial__tab" @click="openPoint(item)">
            <span class="flat-radial__thumb">
              <img v-if="item.photo" :src="item.photo" :alt="item.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
              <img v-else src="/svg/shark.svg" alt="" class="flat-radial__thumb-empty" loading="lazy" />
            </span>
            <span v-if="item.priceLabel" class="flat-radial__price">{{ item.priceLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.flat-map-shell { position: relative; z-index: 0; isolation: isolate; scroll-margin-block: 24px; }
.flat-map-shell_full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  padding: 12px;
  background: var(--bg-primary, #0b0f2a);
}
.flat-map-shell_full .flat-map { height: 100%; border-radius: 8px; }
// Clicking a district/microdistrict/area shape gives its SVG path DOM focus;
// the browser's default focus outline is a rectangle around the shape's
// bounding box, not its actual outline, which reads as a stray square.
.flat-map :deep(.leaflet-interactive) { outline: none; }
.flat-map :deep(.flat-zone-shape) {
  transition: fill-opacity .15s ease, stroke-opacity .15s ease, stroke-width .15s ease;
  cursor: pointer;
}
.flat-map :deep(.flat-zone-shape:hover) { fill-opacity: .4 !important; stroke-width: 3.5px; }
.flat-map {
  width: 100%;
  height: 420px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.flat-map__tools {
  position: absolute; z-index: 500; top: 12px; left: 12px; right: 12px;
  display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px;
}
.flat-map__tool {
  min-height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px;
  background: rgba(13,17,40,0.94); color: var(--text-primary); cursor: pointer;
}
.flat-map__tool_active { color: var(--accent-pink); border-color: var(--accent-pink); }
.flat-map__hint {
  position: absolute; z-index: 500; left: 50%; bottom: 12px; transform: translateX(-50%);
  padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: rgba(13,17,40,0.94); color: var(--text-primary); font-size: 12px;
}

:deep(.flat-cluster) {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: #e0679a; border: 2px solid #fff; box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
:deep(.flat-cluster_multi) {
  width: 32px; height: 32px;
  color: #fff; font-size: 13px; font-weight: 700;
  background: rgba(224,103,154,0.92);
}

.flat-radial { position: fixed; inset: 0; z-index: 9000; }
.flat-radial__anchor { position: absolute; width: 0; height: 0; }
.flat-radial__hub {
  position: absolute; top: 50%; left: 50%; z-index: 3; transform: translate(-50%, -50%);
  display: grid; grid-template-columns: 19px 26px 19px; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 50%; overflow: hidden;
  background: var(--accent-pink, #e0679a); color: #fff;
  border: 2px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,0.5);
}
.flat-radial__hub-arrow {
  display: grid; place-items: center; align-self: stretch; width: 100%; padding: 0;
  border: 0; background: transparent; color: #fff; cursor: pointer;
  font-size: 27px; line-height: 1; transition: background-color 120ms ease, transform 120ms ease;
}
.flat-radial__hub-arrow:hover, .flat-radial__hub-arrow:focus-visible { background: rgba(0,0,0,.16); outline: none; }
.flat-radial__hub-arrow:active { transform: scale(.9); }
.flat-radial__hub-arrow:disabled { opacity: .35; cursor: default; }
.flat-radial__hub-count { text-align: center; font-size: 10px; font-weight: 800; line-height: 1; pointer-events: none; }
.flat-radial__slot {
  position: absolute; top: 0; left: 0; z-index: 1;
  animation: flat-radial-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
@keyframes flat-radial-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
}
.flat-radial__tab {
  display: flex; flex-direction: column; width: 92px; padding: 0;
  border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
  background: rgba(13,17,40,0.97); color: var(--text-primary); cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5); transition: transform 0.12s ease, border-color 0.12s ease;
}
.flat-radial__tab:hover { transform: translateY(-2px) scale(1.05); border-color: var(--accent-pink, #e0679a); }
.flat-radial__thumb { display: block; width: 100%; height: 60px; background: rgba(255,255,255,0.05); }
.flat-radial__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.flat-radial__thumb-empty { display: block; width: 60%; height: 60%; margin: 20% auto; object-fit: contain; opacity: 0.4; }
.flat-radial__price { padding: 4px 6px; font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

:deep(.flat-zone-label-wrap) { pointer-events: none; }
:deep(.flat-zone-label) {
  display: inline-block; transform: translate(-50%, -50%);
  padding: 3px 8px; border: 1.5px solid; border-radius: 999px;
  background: rgba(13,17,40,0.92); color: var(--text-primary, #fff);
  font-size: 11px; font-weight: 700; white-space: nowrap; pointer-events: none;
}
:deep(.flat-zone-marker) {
  display: block; width: 12px; height: 12px; border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5); cursor: pointer;
}
:deep(.flat-zone-marker_circle) { border-radius: 50%; }
:deep(.flat-zone-marker_square) { border-radius: 2px; }

:deep(.leaflet-container) { background: var(--bg-panel); font-family: inherit; }
:deep(.leaflet-popup-content) { font-size: 13px; }

@include bp-down(sm) {
  .flat-map-shell_full { padding: 0; }
  .flat-map-shell_full .flat-map { border: 0; border-radius: 0; }
  .flat-map__tools { top: max(8px, env(safe-area-inset-top)); right: 8px; gap: 5px; }
  .flat-map__tool { min-height: 32px; padding-inline: 8px; font-size: 12px; }
  .flat-radial__hub { width: 52px; height: 52px; grid-template-columns: 15px 22px 15px; }
  .flat-radial__hub-arrow { font-size: 23px; }
  .flat-radial__hub-count { font-size: 9px; }
  .flat-radial__tab { width: 76px; border-radius: 7px; }
  .flat-radial__thumb { height: 46px; }
  .flat-radial__price { padding: 3px 4px; font-size: 10px; }
}
</style>