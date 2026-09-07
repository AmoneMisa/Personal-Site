import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../app/components/flats/FlatMap.client.vue', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../app/pages/flat-finder/index.vue', import.meta.url),
  'utf8',
);

test('map remains mounted when the active filters return no listings', () => {
  assert.match(page, /<section class="flats__map-wrap"><flat-map/u);
  assert.doesNotMatch(page, /<section v-if="listings\.length" class="flats__map-wrap"/u);
  // Both compact marker data and backend-owned canonical overlays follow the
  // same normalized filter scope. Detail/pagination query keys remain excluded.
  assert.match(
    source,
    /watch\(\(\) => new URLSearchParams\(normalizedRouteQuery\(\)\)\.toString\(\), \(\) => \{ void loadFullMapFeed\(\); void loadExtraGeo\(\); \}\)/u,
  );
});

test('metro exposes one selected radius instead of drawing duplicate preset rings', () => {
  assert.doesNotMatch(source, /METRO_PRESET_RINGS|renderMetroPresetRings/u);
  assert.match(source, /const RADIUS_OPTIONS = \[200, 500, 1000\] as const/u);
  assert.match(source, /<select :value="Math\.round\(shapeRadiusM\)" @change="onMetroRadiusSelect"/u);
  assert.match(source, /function renderMetroSelection\(stations: FlatMapZone\[\]\)/u);
  assert.match(source, /outline\.on\("click", \(event: any\) => handleLayerClick\(event, \(\) => metroToggle\(station\)\)\)/u);
});

test('transport dropdown writes through to real mode state and radius refs', () => {
  assert.match(source, /function setTransportVisible\(mode: TransportMode, visible: boolean\)/u);
  assert.match(source, /function setTransportRadius\(mode: TransportMode, radius: number\)/u);
  assert.match(source, /@change="onTransportToggle\(item\.mode as TransportMode, \$event\)"/u);
  assert.match(source, /@change="onTransportRadiusSelect\(item\.mode as TransportMode, \$event\)"/u);
  assert.doesNotMatch(source, /v-model="item\.model"|v-model\.number="item\.radius"/u);
});

test('draw mode consumes clicks on interactive map overlays before their normal action', () => {
  assert.ok(source.includes('function handleLayerClick(event: any, action: () => void)'));
  assert.ok(source.includes('if (addDrawPoint(event)) return;'));
  assert.ok(source.includes('marker.on("click", (event: any) => handleLayerClick(event, () => openCluster(c)));'));
  assert.ok(source.includes('const onClick = (event: any) => handleLayerClick(event'));
  assert.ok(source.includes('shape.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));'));
});
