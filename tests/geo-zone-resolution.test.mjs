import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');
const route = await readFile(new URL('../server/routes/flats-geo-city.get.ts', import.meta.url), 'utf8');

test('map zones resolve through the backend district-zones contract', () => {
  assert.match(source, /useGeoCityCatalog/);
  assert.match(source, /geoZones\.value\.find/);
  assert.match(source, /entity\.name\.toLocaleLowerCase/);
  assert.match(route, /FLAT_API_URL/);
  assert.match(route, /\/api\/district-zones/);
  assert.doesNotMatch(route, /@whiteslove\/geo-catalog/);
});
