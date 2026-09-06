import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, ref } from 'vue';
import { useFlatMeta } from '../app/composables/flats/useFlatMeta.ts';

test('metadata loads backend labels for the locale and ignores an older locale response', async (t) => {
  const originalFetch = globalThis.$fetch;
  const requests = [];
  globalThis.$fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  const scope = effectScope();
  t.after(() => { scope.stop(); globalThis.$fetch = originalFetch; });
  const locale = ref('ru');
  const countries = ref(['UZ']);
  const city = ref('City');
  const meta = scope.run(() => useFlatMeta({ countries, city, locale, t: key => key, preferredCountry: () => 'UZ' }));
  const oldLoad = meta.loadMeta();
  locale.value = 'en';
  assert.equal(requests[0].options.signal.aborted, true);
  assert.equal(requests[1].url, '/flats-meta');
  assert.deepEqual(requests[1].options.params, { locale: 'en' });
  requests[1].resolve([{ code: 'UZ', name: 'Country from backend', cities: ['City'], cityLabels: { City: 'City from backend' } }]);
  await new Promise(resolve => setImmediate(resolve));
  requests[0].resolve([{ code: 'UZ', name: 'Obsolete', cities: [] }]);
  await oldLoad;
  assert.deepEqual(meta.countryItems.value, [{ value: 'UZ', label: 'Country from backend' }]);
  assert.deepEqual(meta.cityItems.value[1], { value: 'City', label: 'City from backend' });
  assert.deepEqual(countries.value, ['UZ']);
  assert.equal(city.value, 'City');
});
