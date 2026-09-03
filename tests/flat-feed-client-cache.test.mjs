import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { feedCacheKey } from '~/composables/flats/useFlatFeed.ts';

const feed = await readFile(new URL('../app/composables/flats/useFlatFeed.ts', import.meta.url), 'utf8');
const polling = await readFile(new URL('../app/composables/search/useFeedPolling.ts', import.meta.url), 'utf8');
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8');

test('the cache key does not depend on the order params were built in', () => {
  assert.equal(
    feedCacheKey({ city: 'Tashkent', limit: '20', countries: 'UZ' }),
    feedCacheKey({ limit: '20', countries: 'UZ', city: 'Tashkent' }),
  );
  assert.notEqual(
    feedCacheKey({ countries: 'UZ', city: 'Tashkent' }),
    feedCacheKey({ countries: 'UZ', city: 'Samarkand' }),
  );
});

test('a cached first page is painted before the network, then revalidated', () => {
  assert.match(feed, /const cached = readFeedCache\(params\);/);
  assert.match(feed, /applyFirstPage\(cached\);/);
  // Still checks upstream behind the paint, so a stale answer self-corrects.
  assert.match(feed, /void loadFeed\(params, \{ background: true \}\);/);
  // Only the first page is cacheable; appended pages depend on cursor/offset.
  assert.match(feed, /if \(!append\) writeFeedCache\(params, data\);/);
});

test('a still-warming upstream answer is never cached as if it were final', () => {
  assert.match(feed, /if \(data\.warming\) return;/);
});

test('the flats feed does not debounce twice', () => {
  // The page owns the filter debounce; the shared polling helper must not add
  // its own on top, or the two delays simply sum before anything is sent.
  assert.match(feed, /filterDebounceMs: 0/);
  assert.match(polling, /const filterDebounceMs = options\.filterDebounceMs \?\? FILTER_REQUEST_DEBOUNCE_MS/);
  assert.match(polling, /if \(!filterDebounceMs\) return Promise\.resolve\(true\)/);
  // Feeds that pass nothing keep the original interval.
  assert.match(polling, /const FILTER_REQUEST_DEBOUNCE_MS = 180/);
});

test('an answer already held skips the filter debounce entirely', () => {
  assert.match(page, /function currentFeedParams\(\): Record<string, string>/);
  assert.match(page, /const wait = delay && isFeedCached\(currentFeedParams\(\)\) \? 0 : delay;/);
});

test('deep-linked pages are restored in as few requests as the route allows', () => {
  assert.match(page, /const MAX_FEED_LIMIT = 60;/);
  assert.match(page, /Math\.min\(MAX_FEED_LIMIT, Math\.max\(PAGE_SIZE, missing\)\)/);
});

test('map watchers do not deep-traverse zone boundaries on every tick', async () => {
  const map = await readFile(new URL('../app/components/flats/FlatMap.client.vue', import.meta.url), 'utf8');
  // These props are computeds that rebuild their arrays, so identity is already
  // the signal; deep traversal walked every boundary coordinate for nothing.
  assert.doesNotMatch(map, /\{ deep: true \}/);
  // The map feed keys off what it actually sends, so listing-detail params in
  // the URL cannot trigger a refetch at all.
  assert.match(map, /watch\(\(\) => new URLSearchParams\(normalizedRouteQuery\(\)\)\.toString\(\), \(\) => \{ void loadFullMapFeed\(\); \}\)/);
});
