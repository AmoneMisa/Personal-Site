import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const POLLING = '../app/composables/search/useFeedPolling.ts';

// The 180ms debounce used to be copy-pasted into all three feeds, so this suite
// asserted the literal in each file. It now lives once in useFeedPolling; assert
// it there, and assert each feed actually routes through that shared primitive.
test('the shared feed polling primitive owns the debounce and warm-poll timings', async () => {
  const source = await readFile(new URL(POLLING, import.meta.url), 'utf8');
  assert.match(source, /FILTER_REQUEST_DEBOUNCE_MS = 180/);
  assert.match(source, /WARM_POLL_INTERVAL_MS = 1800/);
  assert.match(source, /export function useFeedPolling/);
});

for (const [name, path] of [
  ['jobs', '../app/composables/jobs/useJobFeed.ts'],
  ['hiring', '../app/composables/hiring/useHiringFeed.ts'],
  ['flats', '../app/composables/flats/useFlatFeed.ts'],
]) {
  test(`${name} feed debounces filter requests through the shared primitive`, async () => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /useFeedPolling/);
    assert.match(source, /polling\.debounceFilterRequest\(\)/);
    assert.match(source, /!append && !background/);
    // Each feed must not reintroduce its own copy of the timings.
    assert.doesNotMatch(source, /FILTER_REQUEST_DEBOUNCE_MS = /);
  });
}
