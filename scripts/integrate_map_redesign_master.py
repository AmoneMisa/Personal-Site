from __future__ import annotations

from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "app/components/flats/FlatMap.client.vue"
INTERACTION_TEST = ROOT / "tests/flat-map-interaction-modes.test.mjs"
SELECTION_TEST = ROOT / "tests/flat-map-selection-sync.test.mjs"
RESPONSIVE_TEST = ROOT / "tests/flat-map-responsive-overlays.test.mjs"


def from_develop(path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"origin/develop:{path}"],
        cwd=ROOT,
        text=True,
    )


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return source.replace(old, new, 1)


def sub_once(source: str, pattern: str, repl: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, repl, source, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one regex match, found {count}")
    return updated


source = from_develop("app/components/flats/FlatMap.client.vue")

# Preserve the current-master route-key and safe DOM helpers while taking the
# redesigned controls/layers from develop.
source = replace_once(
    source,
    'import { primaryBoundaryGeometry } from "~/utils/mapBoundaryFocus";\nimport { priceToneFromRatio, type FlatPriceTone } from "~/utils/flats/priceTone";',
    'import { primaryBoundaryGeometry } from "~/utils/mapBoundaryFocus";\nimport { stableQueryKey } from "~/utils/stableQueryKey";\nimport { mapText, districtLabel } from "~/utils/flats/mapContent";\nimport { priceToneFromRatio, type FlatPriceTone } from "~/utils/flats/priceTone";',
    "imports",
)

source = replace_once(
    source,
    '  const key = new URLSearchParams(query).toString();',
    '  const key = stableQueryKey(query);',
    "stable map-feed key",
)

old_rendered = '''const renderedPoints = computed<FlatPoint[]>(() => {
  const merged = new Map<string, FlatPoint>();
  for (const point of remotePoints.value) merged.set(pointKey(point), point);
  for (const point of props.points) {
    const exactKey = pointKey(point);
    const remote = remotePoints.value.find((candidate) => candidate.id === point.id && (!point.source || candidate.source === point.source));
    merged.set(remote ? pointKey(remote) : exactKey, { ...remote, ...point });
  }
  return [...merged.values()];
});'''
new_rendered = '''const renderedPoints = computed<FlatPoint[]>(() => {
  const merged = new Map<string, FlatPoint>();
  const remoteByIdentity = new Map<string, FlatPoint>();
  for (const point of remotePoints.value) {
    merged.set(pointKey(point), point);
    remoteByIdentity.set(`${point.source || ""}:${point.id}`, point);
  }
  // Loaded cards win: they carry localized titles, converted price labels and
  // photos, while the compact map feed fills in district/price analytics.
  for (const point of props.points) {
    const exactKey = pointKey(point);
    if (point.country || !point.source) {
      merged.set(exactKey, point);
      continue;
    }
    const remote = remoteByIdentity.get(`${point.source || ""}:${point.id}`);
    merged.set(remote ? pointKey(remote) : exactKey, { ...remote, ...point });
  }
  return [...merged.values()];
});'''
source = replace_once(source, old_rendered, new_rendered, "map-point merge")

source = replace_once(
    source,
    'let lastFitSig = "";\nlet metroShapePath: any = null;',
    'let lastFitSig = "";\nlet preserveCamera = false;\nlet expandedSizeTimers: ReturnType<typeof setTimeout>[] = [];\nlet focusTimer: number | undefined;\nlet metroShapePath: any = null;',
    "camera state",
)

old_expand = '''async function setExpanded(value: boolean) {
  expanded.value = value;
  menuOpen.value = null;
  scrollActive.value = false;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  if (value) map?.scrollWheelZoom?.enable();
  else map?.scrollWheelZoom?.disable();
  await nextTick();
  requestAnimationFrame(() => map?.invalidateSize());
  setTimeout(() => map?.invalidateSize(), 260);
  setTimeout(() => map?.invalidateSize(), 600);
}'''
new_expand = '''async function setExpanded(value: boolean) {
  expanded.value = value;
  menuOpen.value = null;
  scrollActive.value = false;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  if (value) map?.scrollWheelZoom?.enable();
  else map?.scrollWheelZoom?.disable();
  await nextTick();
  requestAnimationFrame(() => map?.invalidateSize());
  expandedSizeTimers.forEach((timer) => clearTimeout(timer));
  expandedSizeTimers = [
    setTimeout(() => map?.invalidateSize(), 260),
    setTimeout(() => map?.invalidateSize(), 600),
  ];
}'''
source = replace_once(source, old_expand, new_expand, "expanded resize cleanup")

old_focus = '''function focusOnPoint(detail: MapFocusDetail) {
  const lat = Number(detail?.lat); const lng = Number(detail?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  focusedPoint.value = { ...detail, lat, lng };
  renderFocusedPoint();
  const shell = el.value?.closest(".flat-map-shell") as HTMLElement | null;
  shell?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!map) return;
  window.setTimeout(() => {
    map?.invalidateSize?.();
    map?.flyTo?.([lat, lng], FOCUS_ZOOM, { animate: true, duration: .75 });
    renderFocusedPoint();
  }, 180);
}'''
new_focus = '''function focusOnPoint(detail: MapFocusDetail) {
  const lat = Number(detail?.lat); const lng = Number(detail?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  preserveCamera = true;
  focusedPoint.value = { ...detail, lat, lng };
  renderFocusedPoint();
  const shell = el.value?.closest(".flat-map-shell") as HTMLElement | null;
  shell?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!map) return;
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = window.setTimeout(() => {
    focusTimer = undefined;
    map?.invalidateSize?.();
    map?.flyTo?.([lat, lng], FOCUS_ZOOM, { animate: true, duration: .75 });
    renderFocusedPoint();
  }, 180);
}'''
source = replace_once(source, old_focus, new_focus, "focus timer")

source = replace_once(
    source,
    '''function openCluster(c: Cluster) {
  const L = Leaflet;
  if (c.items.length === 1) { openPoint(c.items[0]); return; }''',
    '''function openCluster(c: Cluster) {
  const L = Leaflet;
  if (!L || !map || !c.items.length) return;
  if (c.items.length === 1) { openPoint(c.items[0]); return; }''',
    "cluster guard",
)

source = replace_once(
    source,
    '''function fitToPoints() {
  if (!map || focusedPoint.value) return;''',
    '''function fitToPoints() {
  if (!map || focusedPoint.value || preserveCamera || props.cityZone || selectedZoneFromProps()) return;''',
    "camera preservation",
)

# Tooltip content coming from catalog/listing data must remain text, not HTML.
source = source.replace('shape.bindTooltip(zone.label, { direction: "top" })', 'shape.bindTooltip(mapText(zone.label), { direction: "top" })')
source = source.replace('circle.bindTooltip(zone.label, { direction: "top" })', 'circle.bindTooltip(mapText(zone.label), { direction: "top" })')
source = source.replace('marker.bindTooltip(zone.label, { direction: "top", offset: [0, -12] })', 'marker.bindTooltip(mapText(zone.label), { direction: "top", offset: [0, -12] })')
source = source.replace('marker.bindTooltip(`${stop.label}${refs}`, { direction: "top", offset: [0, -11] })', 'marker.bindTooltip(mapText(`${stop.label}${refs}`), { direction: "top", offset: [0, -11] })')
source = source.replace('outline.bindTooltip(`${station.label} · ${metroShapeTooltip()}`, { direction: "top" })', 'outline.bindTooltip(mapText(`${station.label} · ${metroShapeTooltip()}`), { direction: "top" })')
source = source.replace('marker.bindTooltip(`${ui.value.metro} · ${station.label}${line}${stationSelected ? ` · ${metroShapeTooltip()}` : ""}`, { direction: "top", offset: [0, -13] })', 'marker.bindTooltip(mapText(`${ui.value.metro} · ${station.label}${line}${stationSelected ? ` · ${metroShapeTooltip()}` : ""}`), { direction: "top", offset: [0, -13] })')

raw_district_label = '''const label = L.divIcon({ className: "flat-zone-label-wrap", html: `<span class="flat-zone-label${dimmed ? " flat-zone-label_dim" : ""}" style="border-color:${safeColor(zone.color, "#e0679a")}">${zone.label}</span>`, iconSize: [0, 0] });'''
safe_district_label = '''const label = L.divIcon({
      className: "flat-zone-label-wrap",
      html: districtLabel(zone.label, safeColor(zone.color, "#e0679a"), dimmed),
      iconSize: [0, 0],
    });'''
source = replace_once(source, raw_district_label, safe_district_label, "safe district label")

old_route_watch = 'watch(() => new URLSearchParams(normalizedRouteQuery()).toString(), () => { void loadFullMapFeed(); void loadExtraGeo(); });'
new_route_watch = '''watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  preserveCamera = true;
  void loadFullMapFeed();
  void loadExtraGeo();
});'''
source = replace_once(source, old_route_watch, new_route_watch, "route watcher")

old_selection_watch = '''watch(() => [props.selectedDistrict, props.selectedMicrodistrict, props.selectedQuartal, props.selectedArea, selectedMetros.value.join(","), props.selectedMetroRadiusM, props.metroBearingFrom, props.metroBearingTo], (next, previous) => {
  if (next.some((value, index) => value !== previous?.[index])) syncSelectionFromProps(Boolean(selectedZoneFromProps()));
});'''
new_selection_watch = '''watch(() => [props.selectedDistrict, props.selectedMicrodistrict, props.selectedQuartal, props.selectedArea, selectedMetros.value.join(","), props.selectedMetroRadiusM, props.metroBearingFrom, props.metroBearingTo], (next, previous) => {
  const changed = next.some((value, index) => value !== previous?.[index]);
  const previousMetros = String(previous?.[4] || "").split(",").filter(Boolean);
  const removedMetro = previousMetros.some((name) => !selectedMetros.value.includes(name));
  if (changed) syncSelectionFromProps(!removedMetro && Boolean(selectedZoneFromProps()));
});'''
source = replace_once(source, old_selection_watch, new_selection_watch, "selection watcher")

old_unmount = '''onBeforeUnmount(() => {
  mapFeedSequence += 1; extraGeoSequence += 1;
  window.removeEventListener("keydown", onKeydown); window.removeEventListener("scroll", closeRadial); window.removeEventListener("flat-map-focus", onMapFocus as EventListener);
  document.removeEventListener("click", closeMenus); el.value?.removeEventListener("mouseleave", deactivateScroll); document.body.style.overflow = "";
  map?.remove?.(); map = null;
  layer = areaLayer = focusLayer = districtLayer = microdistrictLayer = quartalLayer = metroLayer = universityLayer = shoppingMallLayer = parkLayer = schoolLayer = residentialLayer = airportLayer = railwayLayer = busStationLayer = parkingLayer = transportStopLayer = zoneAreaLayer = cityLayer = null;
});'''
new_unmount = '''onBeforeUnmount(() => {
  mapFeedSequence += 1; extraGeoSequence += 1;
  expandedSizeTimers.forEach((timer) => clearTimeout(timer));
  expandedSizeTimers = [];
  if (focusTimer) clearTimeout(focusTimer);
  focusTimer = undefined;
  window.removeEventListener("keydown", onKeydown); window.removeEventListener("scroll", closeRadial); window.removeEventListener("flat-map-focus", onMapFocus as EventListener);
  document.removeEventListener("click", closeMenus); el.value?.removeEventListener("mouseleave", deactivateScroll); document.body.style.overflow = "";
  map?.remove?.(); map = null;
  layer = areaLayer = focusLayer = districtLayer = microdistrictLayer = quartalLayer = metroLayer = universityLayer = shoppingMallLayer = parkLayer = schoolLayer = residentialLayer = airportLayer = railwayLayer = busStationLayer = parkingLayer = transportStopLayer = zoneAreaLayer = cityLayer = null;
});'''
source = replace_once(source, old_unmount, new_unmount, "unmount cleanup")

source = replace_once(
    source,
    '''onBeforeUnmount(() => {
  mapFeedSequence += 1; extraGeoSequence += 1;''',
    '''onBeforeUnmount(() => {
  mapFeedSequence += 1; extraGeoSequence += 1;''',
    "unmount marker",
)

source = replace_once(
    source,
    '''});
</script>''',
    '''});

function preserveUserCamera() {
  preserveCamera = true;
}
</script>''',
    "preserve camera handler",
)

source = replace_once(
    source,
    '''<div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }" @click.stop>''',
    '''<div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }" @click.stop @pointerdown.capture="preserveUserCamera" @wheel.capture.passive="preserveUserCamera" @keydown.capture="preserveUserCamera">''',
    "map shell camera ownership",
)

# Keep all text UI below the control strip. This is intentionally global, not
# just mobile: no hint/card text can sit underneath a hovered/active button.
source = replace_once(
    source,
    '.flat-map__scroll-hint { position: absolute; z-index: 400; left: 50%; top: 12px;',
    '.flat-map__scroll-hint { position: absolute; z-index: 400; left: 50%; top: 56px;',
    "scroll hint safe top",
)
source = source.replace(
    '.flat-map__menu { position: absolute; top: 43px; left: 0; width: 286px;',
    '.flat-map__menu { position: absolute; top: 43px; left: 0; width: 286px; max-width: calc(100vw - 16px);',
)

responsive_block = '''
@media (max-width: 1024px) {
  .flat-map__tools { left: 48px; right: 8px; gap: 4px; }
  .flat-map__tool { height: 34px; min-width: 34px; padding-inline: 8px; }
  .flat-map__tool-label,
  .flat-map__tool:hover .flat-map__tool-label,
  .flat-map__tool:focus-visible .flat-map__tool-label,
  .flat-map__tool_active .flat-map__tool-label {
    max-width: 0;
    margin-left: 0;
    opacity: 0;
  }
  .flat-map__menu {
    position: fixed;
    top: max(52px, calc(env(safe-area-inset-top) + 44px));
    left: 8px;
    right: auto;
    width: min(318px, calc(100vw - 16px));
    max-width: calc(100vw - 16px);
  }
  .flat-map__scroll-hint { top: max(54px, calc(env(safe-area-inset-top) + 46px)); }
  .flat-map__district-card { top: max(58px, calc(env(safe-area-inset-top) + 50px)); }
}

'''
source = replace_once(source, '\n@include bp-down(sm) {', '\n' + responsive_block + '@include bp-down(sm) {', "tablet responsive block")

old_mobile = '''  .flat-map__tools { top: max(8px, env(safe-area-inset-top)); left: 48px; right: 8px; gap: 4px; }
  .flat-map__tool { height: 34px; min-width: 34px; padding-inline: 8px; }.flat-map__tool:hover .flat-map__tool-label, .flat-map__tool:focus-visible .flat-map__tool-label, .flat-map__tool_active .flat-map__tool-label { max-width: 0; margin-left: 0; opacity: 0; }
  .flat-map__menu { position: fixed; top: 52px; left: 8px; right: 8px; width: auto; max-height: 68vh; }
  .flat-map__price-legend { left: 8px; right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); width: auto; }'''
new_mobile = '''  .flat-map__tools { top: max(8px, env(safe-area-inset-top)); left: 48px; right: 8px; gap: 4px; }
  .flat-map__tool { height: 34px; min-width: 34px; padding-inline: 8px; }
  .flat-map__menu { top: max(52px, calc(env(safe-area-inset-top) + 44px)); left: 8px; right: 8px; width: auto; max-height: min(68vh, calc(100dvh - 64px)); }
  .flat-map__scroll-hint { top: max(52px, calc(env(safe-area-inset-top) + 44px)); max-width: calc(100% - 24px); text-align: center; }
  .flat-map__price-legend { left: 8px; right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); width: auto; max-height: 42vh; overflow: auto; }
  .flat-map__hint { left: 8px; right: 8px; width: auto; transform: none; text-align: center; }'''
source = replace_once(source, old_mobile, new_mobile, "mobile safe overlays")

MAP_PATH.write_text(source)
INTERACTION_TEST.write_text(from_develop("tests/flat-map-interaction-modes.test.mjs"))
SELECTION_TEST.write_text(from_develop("tests/flat-map-selection-sync.test.mjs"))

RESPONSIVE_TEST.write_text('''import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst source = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");\n\ntest("map overlays reserve a safe band below the top controls", () => {\n  assert.match(source, /flat-map__scroll-hint[^}]*top: 56px/u);\n  assert.match(source, /flat-map__district-card[^}]*top: 62px/u);\n  assert.match(source, /@media \(max-width: 1024px\)/u);\n  assert.match(source, /flat-map__menu \{[\\s\\S]*position: fixed;[\\s\\S]*top: max\(52px/u);\n});\n\ntest("compact breakpoints never expand toolbar labels over map text", () => {\n  assert.match(source, /@media \(max-width: 1024px\)[\\s\\S]*flat-map__tool-label[\\s\\S]*max-width: 0;[\\s\\S]*opacity: 0;/u);\n  assert.match(source, /@include bp-down\(sm\)[\\s\\S]*flat-map__scroll-hint[\\s\\S]*max-width: calc\(100% - 24px\)/u);\n});\n''')

print("Integrated develop map redesign with master camera/safety/adaptive guards")
