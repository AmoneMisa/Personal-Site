import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');

test('map zones resolve through the canonical city entity', () => {
  // geo-catalog's encrypted data only decrypts server-side, so resolution now
  // goes through useGeoCityCatalog (which calls the server) instead of a
  // direct resolveLexiconGeoEntity import — see server/routes/flats-geo-city.get.ts.
  assert.match(source, /useGeoCityCatalog/);
  assert.match(source, /geoDescendants\.value\.find/);
});
