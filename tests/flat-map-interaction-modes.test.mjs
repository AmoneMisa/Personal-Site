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
  assert.match(source, /watch\(\(\) => route\.query, \(\) => \{ void loadFullMapFeed\(\); \}/u);
});

test('metro proximity rings consume clicks instead of falling through to districts', () => {
  assert.ok(source.includes('ring.on("click", (event: any) => handleLayerClick(event'));
  assert.ok(source.includes('bubblingMouseEvents: false'));
  assert.ok(source.includes('emitZoneSelect("metro", nearest.name, radius);'));
});

test('draw mode consumes clicks on interactive map overlays before their normal action', () => {
  assert.ok(source.includes('function handleLayerClick(event: any, action: () => void)'));
  assert.ok(source.includes('if (addDrawPoint(event)) return;'));
  assert.ok(source.includes('marker.on("click", (event: any) => handleLayerClick(event, () => openCluster(c)));'));
  assert.ok(source.includes('const onClick = (event: any) => handleLayerClick(event'));
  assert.ok(source.includes('shape.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));'));
});
