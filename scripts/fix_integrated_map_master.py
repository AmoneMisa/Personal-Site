from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'app/components/flats/FlatMap.client.vue'
CAMERA_TEST = ROOT / 'tests/flat-map-camera-preservation.test.mjs'
INTERACTION_TEST = ROOT / 'tests/flat-map-interaction-modes.test.mjs'
SELECTION_TEST = ROOT / 'tests/flat-map-selection-sync.test.mjs'


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, found {count}')
    return source.replace(old, new, 1)


source = MAP.read_text()

source = replace_once(
    source,
    '''  } catch {
    // Keep the already-loaded page points/cached map feed as fallback.
  }
}''',
    '''  } catch {
    // The already-loaded page points (or the cached pins painted above) remain
    // available when the compact map request fails; never blank a useful map.
  }
}''',
    'cache fallback comment',
)

old_fit = '''function fitToPoints() {
  if (!map || focusedPoint.value || preserveCamera || props.cityZone || selectedZoneFromProps()) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function renderArea()'''
new_fit = '''function fitToPoints() {
  if (!map || focusedPoint.value || preserveCamera || props.cityZone || selectedZoneFromProps()) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

/** Explicit framing overrides automatic camera guards. */
function fitToPointsNow() {
  if (!map) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  if (!bounds.length) return;
  preserveCamera = true;
  focusedPoint.value = null;
  renderFocusedPoint();
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  lastFitSig = "";
}

function renderArea()'''
source = replace_once(source, old_fit, new_fit, 'manual camera primitive')

old_watch = '''watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  preserveCamera = true;
  void loadFullMapFeed();
  void loadExtraGeo();
});'''
new_watch = '''watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  preserveCamera = true;
  void loadFullMapFeed();
});
watch(() => stableQueryKey(normalizedRouteQuery()), () => {
  void loadExtraGeo();
});'''
source = replace_once(source, old_watch, new_watch, 'split route watchers')

# Keep the explicit “frame results” affordance. On tablet/phone its text label is
# collapsed by the responsive rules, so it never lays text over map annotations.
old_toolbar_tail = '''        <button v-if="area.length" type="button" class="flat-map__tool" :aria-label="props.clearLabel || 'Clear area'" @click="clearArea"><u-icon name="i-lucide-trash-2" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ props.clearLabel || "Clear" }}</span></button>

        <span class="flat-map__tools-spacer" />'''
new_toolbar_tail = '''        <button v-if="area.length" type="button" class="flat-map__tool" :aria-label="props.clearLabel || 'Clear area'" @click="clearArea"><u-icon name="i-lucide-trash-2" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ props.clearLabel || "Clear" }}</span></button>
        <button v-if="renderedPoints.length" type="button" class="flat-map__tool" :aria-label="props.fitResultsLabel || 'Frame results'" @click="fitToPointsNow"><span class="flat-map__tool-glyph" aria-hidden="true">⊙</span><span class="flat-map__tool-label">{{ props.fitResultsLabel || "Frame results" }}</span></button>

        <span class="flat-map__tools-spacer" />'''
source = replace_once(source, old_toolbar_tail, new_toolbar_tail, 'fit results toolbar button')

source = replace_once(
    source,
    '.flat-map__tool-icon { flex: 0 0 auto; width: 17px; height: 17px; }',
    '.flat-map__tool-icon { flex: 0 0 auto; width: 17px; height: 17px; }\n.flat-map__tool-glyph { display: grid; place-items: center; width: 17px; height: 17px; flex: 0 0 auto; font-size: 17px; line-height: 1; }',
    'fit results glyph style',
)

MAP.write_text(source)

CAMERA_TEST.write_text(r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../app/components/flats/FlatMap.client.vue', import.meta.url), 'utf8');
const automaticStart = source.indexOf('function fitToPoints()');
const manualStart = source.indexOf('function fitToPointsNow()', automaticStart);
const renderAreaStart = source.indexOf('function renderArea()', manualStart);
const automatic = source.slice(automaticStart, source.lastIndexOf('/**', manualStart));
const manual = source.slice(manualStart, renderAreaStart);
const filterWatchStart = source.indexOf('watch(() => stableQueryKey(normalizedRouteQuery())');
const secondFilterWatchStart = source.indexOf('watch(() => stableQueryKey(normalizedRouteQuery())', filterWatchStart + 1);
const filterWatch = source.slice(filterWatchStart, secondFilterWatchStart);

function cameraHarness() {
  const calls = [];
  const context = vm.createContext({
    map: { fitBounds: (...args) => calls.push(args) },
    focusedPoint: { value: null },
    props: {},
    preserveCamera: false,
    lastFitSig: '',
    renderedPoints: { value: [{ id: 'near-metro', lat: 41.3, lng: 69.2 }] },
    pointKey: (p) => p.id,
    selectedZoneFromProps: () => null,
    renderFocusedPoint() {},
    stableQueryKey: () => '',
    normalizedRouteQuery: () => ({}),
    watch: (_key, callback) => { context.changeFilters = callback; },
    loadFullMapFeed() {},
  });
  vm.runInContext(ts.transpile(`${automatic}\n${manual}\n${filterWatch}`), context);
  return { context, calls };
}

test('initial map feed can finish framing after the first card page', () => {
  const { context, calls } = cameraHarness();
  context.fitToPoints();
  context.renderedPoints.value.push({ id: 'second', lat: 41.4, lng: 69.3 });
  context.fitToPoints();
  assert.equal(calls.length, 2);
});

test('clearing metro filters preserves the camera when broader results arrive', () => {
  const { context, calls } = cameraHarness();
  context.fitToPoints();
  context.changeFilters();
  context.renderedPoints.value.push({ id: 'far-away', lat: 45, lng: 70 });
  context.fitToPoints();
  assert.equal(calls.length, 1);
  context.fitToPointsNow();
  assert.equal(calls.length, 2);
  assert.equal(calls[1][0].length, 2);
  context.renderedPoints.value.push({ id: 'refresh', lat: 44, lng: 71 });
  context.fitToPoints();
  assert.equal(calls.length, 2);
});

test('initial results do not override a city scope or a user-chosen view', () => {
  const { context, calls } = cameraHarness();
  context.props.cityZone = { id: 'city' };
  context.fitToPoints();
  context.props.cityZone = null;
  context.preserveCamera = true;
  context.fitToPoints();
  assert.equal(calls.length, 0);
});
''')

INTERACTION_TEST.write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/components/flats/FlatMap.client.vue', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8');

test('map remains mounted when the active filters return no listings', () => {
  assert.match(page, /<section class="flats__map-wrap"><flat-map/u);
  assert.doesNotMatch(page, /<section v-if="listings\.length" class="flats__map-wrap"/u);
  assert.match(source, /watch\(\(\) => stableQueryKey\(normalizedRouteQuery\(\)\), \(\) => \{\s+preserveCamera = true;\s+void loadFullMapFeed\(\);\s+\}\)/u);
});

test('metro uses one selected proximity shape instead of three overlapping discovery rings', () => {
  assert.doesNotMatch(source, /renderMetroPresetRings/u);
  assert.match(source, /if \(anyChosen\) renderMetroSelection\(chosen\)/u);
  assert.match(source, /sectorPolygon\(station, shapeRadiusM\.value/u);
  assert.match(source, /outline\.on\("click", \(event: any\) => handleLayerClick\(event, \(\) => metroToggle\(station\)\)\)/u);
});

test('draw mode consumes clicks on interactive map overlays before their normal action', () => {
  assert.ok(source.includes('function handleLayerClick(event: any, action: () => void)'));
  assert.ok(source.includes('if (addDrawPoint(event)) return;'));
  assert.ok(source.includes('marker.on("click", (event: any) => handleLayerClick(event, () => openCluster(c)));'));
  assert.ok(source.includes('const onClick = (event: any) => handleLayerClick(event'));
  assert.ok(source.includes('shape.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));'));
});
''')

SELECTION_TEST.write_text(r'''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mapSource = await readFile(new URL("../app/components/flats/FlatMap.client.vue", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../app/pages/flat-finder/index.vue", import.meta.url), "utf8");

test("map selection is controlled by the same filter state as the selects", () => {
  assert.match(mapSource, /selectedMetros\?: string\[\]/);
  assert.match(mapSource, /selectedMetroRadiusM\?: number/);
  assert.match(mapSource, /metroBearingFrom\?: number/);
  assert.match(mapSource, /metroBearingTo\?: number/);
  assert.match(mapSource, /function syncSelectionFromProps\(focus = false\)/);
  assert.match(pageSource, /:selected-metros="metro"/);
  assert.match(pageSource, /:selected-metro-radius-m="metroMaxM"/);
});

test("clicking a station toggles it, and the last one out clears the shape", () => {
  assert.match(mapSource, /emit\("metro-toggle", station\.name\)/);
  assert.match(pageSource, /metro\.value\.includes\(name\)/);
  assert.match(pageSource, /if \(!next\.length\) \{/);
  assert.match(pageSource, /metroMaxM\.value = undefined;/);
});

test("the radius and arc handles report one settled shape per drag", () => {
  assert.match(mapSource, /handle\.on\("dragend"/);
  assert.match(mapSource, /emit\("metro-shape", \{/);
  assert.match(mapSource, /draftRadiusM\.value = null;/);
  assert.match(mapSource, /function refreshMetroShape\(\)/);
  assert.match(pageSource, /function onMetroShape\(/);
});

test("a metro selection removes overlapping discovery rings but keeps every station tappable", () => {
  assert.doesNotMatch(mapSource, /renderMetroPresetRings/);
  assert.match(mapSource, /for \(const station of stations\)/);
  assert.match(mapSource, /anyChosen && !stationSelected \? " flat-metro-marker_dim" : ""/);
  assert.match(mapSource, /marker\.on\("click", select\)/);
});

test("station dots carry a touch-sized hit target", () => {
  const hit = mapSource.match(/const METRO_MARKER_HIT_RADIUS = (\d+)/);
  assert.ok(hit);
  assert.ok(Number(hit[1]) >= 14);
  assert.match(mapSource, /radius: METRO_MARKER_HIT_RADIUS, opacity: 0, fillOpacity: 0/);
  assert.match(mapSource, /hitTarget\.on\("click", select\)/);
});

test("the map can be framed back onto the results by hand", () => {
  assert.match(mapSource, /function fitToPointsNow\(\)/);
  assert.match(mapSource, /lastFitSig = "";/);
  assert.match(mapSource, /@click="fitToPointsNow"/);
});

test("selected geography keeps its label visible until the second click", () => {
  assert.match(mapSource, /shape\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /circle\.openTooltip\?\.\(\)/);
  assert.match(mapSource, /if \(stationSelected\) marker\.openTooltip\?\.\(\)/);
});
''')

print('Aligned redesigned map with adaptive, camera and modern metro regressions')
