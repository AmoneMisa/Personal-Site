import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, ref } from 'vue';
import { useGeoCityCatalog } from '../app/composables/flats/useGeoCityCatalog.ts';

test('invalid backend geometry is rejected without reconstructing geographic data', async (t) => {
  const previousFetch = globalThis.$fetch;
  const base = { id: 'district', name: 'Backend district', label: '<b>Backend label</b>', type: 'district', lat: 41, lng: 69, radiusM: 900, color: '#abcdef' };
  const ring = [[69, 41], [70, 41], [70, 42], [69, 41]];
  globalThis.$fetch = async () => ({ districtZones: [
    { ...base, boundary: { type: 'Polygon', coordinates: [ring] } },
    { ...base, id: 'missing-coordinate', lat: null },
    { ...base, id: 'out-of-range', lng: 190 },
    { ...base, id: 'malformed', boundary: { type: 'Polygon', coordinates: ['invalid'] }, color: 'red; position:fixed', radiusM: -1 },
  ] });
  const scope = effectScope();
  t.after(() => { scope.stop(); globalThis.$fetch = previousFetch; });
  const catalog = scope.run(() => useGeoCityCatalog(ref('UZ'), ref('DTO validation city'), 'ru'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(catalog.districtZones.value.length, 2);
  const [valid, fallback] = catalog.districtZones.value;
  assert.deepEqual(valid.boundary.coordinates, [ring]);
  assert.equal(valid.label, base.label, 'text is retained for safe DOM rendering');
  assert.equal(fallback.boundary, null);
  assert.equal(fallback.color, '#8b5cf6');
  assert.equal(fallback.radiusM, 400);
});
