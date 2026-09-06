import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const filtersSource = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');
const catalogSource = await readFile(new URL('../app/composables/flats/useGeoCityCatalog.ts', import.meta.url), 'utf8');
const bffSource = await readFile(new URL('../server/routes/flats-geo-city.get.ts', import.meta.url), 'utf8');

test('Flat Finder geo catalog is backend-owned end to end', () => {
  assert.match(filtersSource, /useGeoCityCatalog/);
  assert.match(filtersSource, /geoDescendants\.value\.find/);
  assert.match(catalogSource, /\$fetch<GeoCityCatalogResponse>\("\/flats-geo-city"/);
  assert.doesNotMatch(catalogSource, /@whiteslove\/geo-catalog/);
  assert.match(bffSource, /FLAT_API_URL/);
  assert.match(bffSource, /\/api\/district-zones/);
  assert.doesNotMatch(bffSource, /@whiteslove\/(?:geo-catalog|parsing-lexicon)/);
});
