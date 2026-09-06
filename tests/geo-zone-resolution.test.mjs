import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const filtersSource = await readFile(new URL('../app/composables/flats/useFlatFilters.ts', import.meta.url), 'utf8');
const catalogSource = await readFile(new URL('../app/composables/flats/useGeoCityCatalog.ts', import.meta.url), 'utf8');
const bffSource = await readFile(new URL('../server/routes/flats-geo-city.get.ts', import.meta.url), 'utf8');
const feedSource = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8');
const mapSource = await readFile(new URL('../server/routes/flats-map.get.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));

test('Flat Finder geo catalog is backend-owned end to end', () => {
  assert.match(filtersSource, /useGeoCityCatalog/);
  assert.match(filtersSource, /geoDescendants\.value\.find/);
  assert.match(catalogSource, /\$fetch<GeoCityCatalogResponse>\("\/flats-geo-city"/);
  assert.doesNotMatch(catalogSource, /@whiteslove\/geo-catalog/);
  assert.match(bffSource, /FLAT_API_URL/);
  assert.match(bffSource, /\/api\/district-zones/);
  assert.doesNotMatch(bffSource, /@whiteslove\/(?:geo-catalog|parsing-lexicon)/);

  // The BFF forwards user geo values; backend-platform owns aliases,
  // canonical station identity, boundaries and result membership.
  assert.doesNotMatch(feedSource, /canonicalMetroValue|@whiteslove\/(?:geo-catalog|parsing-lexicon)/);
  assert.doesNotMatch(mapSource, /canonicalMetroValue|@whiteslove\/(?:geo-catalog|parsing-lexicon)/);

  // Prevent a future dependency update from silently restoring a second copy
  // of canonical geo data to Personal Site.
  assert.equal(packageJson.dependencies?.['@whiteslove/geo-catalog'], undefined);
  assert.equal(packageLock.packages?.['']?.dependencies?.['@whiteslove/geo-catalog'], undefined);
  assert.equal(packageLock.packages?.['node_modules/@whiteslove/geo-catalog'], undefined);
});
