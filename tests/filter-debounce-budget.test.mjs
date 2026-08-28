import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// The jobs/hiring/flats feeds share one debounce budget. It used to be declared
// separately in each of them (and could drift); it now lives in the shared
// useFeedPolling primitive, so the budget is asserted in exactly one place.
test('filter debounce budget stays small', async () => {
  const source = await readFile(new URL('../app/composables/search/useFeedPolling.ts', import.meta.url), 'utf8');
  const match = source.match(/FILTER_REQUEST_DEBOUNCE_MS = (\d+)/);
  assert.ok(match, 'useFeedPolling must declare FILTER_REQUEST_DEBOUNCE_MS');
  assert.ok(Number(match[1]) <= 250, `filter debounce ${match[1]}ms should stay at or below 250ms`);
});
