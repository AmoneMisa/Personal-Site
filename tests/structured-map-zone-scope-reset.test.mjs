import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick } from 'vue';
import { useFlatFilters } from '../app/composables/flats/useFlatFilters.ts';
import { districtForZone } from '../app/utils/flats/zoneHierarchy.ts';

const zone = (id, type, parentId = null) => ({ id, name: id, label: id, type, parentId, lat: 40, lng: 69, radiusM: 400, color: '#abcdef' });
const districts = [zone('District A', 'district'), zone('District B', 'district')];
const micro = [zone('Micro A', 'microdistrict', 'District A'), zone('Micro B', 'microdistrict', 'District B')];
const quartals = [zone('Quartal A', 'mahalla', 'Micro A')];

test('district changes preserve contained subzones and clear incompatible ones', async (t) => {
  const originalFetch = globalThis.$fetch;
  globalThis.$fetch = async () => ({ districtZones: districts, microdistrictMarkers: micro, quartalMarkers: quartals });
  const scope = effectScope();
  t.after(() => { scope.stop(); globalThis.$fetch = originalFetch; });
  const filters = scope.run(() => useFlatFilters());
  filters.countries.value = ['UZ'];
  filters.city.value = 'Hierarchy test city';
  await nextTick();
  await new Promise(resolve => setImmediate(resolve));

  filters.district.value = 'District B';
  filters.microdistrict.value = 'Micro A';
  assert.equal(filters.district.value, 'District A', 'auto-selects the backend parent');
  assert.equal(filters.microdistrict.value, 'Micro A', 'auto-selecting its parent preserves the new microdistrict');
  filters.quartal.value = 'Quartal A';
  filters.district.value = '';
  filters.district.value = 'District A';
  assert.equal(filters.microdistrict.value, 'Micro A');
  assert.equal(filters.quartal.value, 'Quartal A', 'supports indirect parents');

  filters.district.value = 'District B';
  assert.equal(filters.microdistrict.value, '');
  assert.equal(filters.quartal.value, '');
  filters.microdistrict.value = 'Micro B';
  filters.metro.value = ['Station A', 'Station B'];
  assert.equal(filters.district.value, 'District B', 'metro unions do not silently change district');
  filters.microdistrict.value = 'Unknown backend parent';
  filters.district.value = 'District A';
  assert.equal(filters.microdistrict.value, 'Unknown backend parent', 'missing hierarchy must not be guessed');
  filters.metroMaxM.value = 800;
  filters.metroBearingFrom.value = 20;
  filters.metroBearingTo.value = 60;
  filters.nearbyKind.value = 'park';
  filters.priceMin.value = 300;
  filters.city.value = 'Different city';
  assert.equal(filters.district.value, '');
  assert.equal(filters.microdistrict.value, '');
  assert.deepEqual(filters.metro.value, []);
  assert.equal(filters.metroMaxM.value, undefined);
  assert.equal(filters.metroBearingFrom.value, undefined);
  assert.equal(filters.metroBearingTo.value, undefined);
  assert.equal(filters.nearbyKind.value, '');
  assert.equal(filters.priceMin.value, 300);
});

test('missing or cyclic parents are not replaced with the nearest district', () => {
  const a = zone('A', 'microdistrict', 'B');
  const b = zone('B', 'mahalla', 'A');
  const zones = new Map([...districts, a, b].map(z => [z.id, z]));
  assert.equal(districtForZone(a, zones), null);
  assert.equal(districtForZone(zone('Orphan', 'microdistrict', 'missing'), zones), null);
});
