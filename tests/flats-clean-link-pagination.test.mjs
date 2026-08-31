import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const feedCache = await readFile(new URL('../server/flats/feedCache.ts', import.meta.url), 'utf8')
const feedLookup = await readFile(new URL('../server/flats/feedLookup.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
const routeState = await readFile(new URL('../app/composables/flats/useFlatRouteState.ts', import.meta.url), 'utf8')

test('flats-feed resolves a clean ?publicId= link before the filtered search and delegates upstream IO', () => {
  assert.match(route, /const publicIdParam = String\(upstreamParams\.get\('publicId'\) \|\| ''\)\.trim\(\)/)
  assert.match(route, /const canonicalPublicId = publicIdParam\.replace\(\/\^0\+\(\?=\\d\)\//)
  assert.match(route, /const lookup = await lookupPublicListing\(canonicalPublicId\)/)
  assert.match(route, /if \(lookup\.upstreamFailed\) setResponseStatus\(event, 502\)/)
  assert.match(feedLookup, /\/api\/listing\/by-public-id\/\$\{encodeURIComponent\(publicId\)\}/)
  assert.match(feedLookup, /const data = \{ count: 1, listings: \[shapeListing\(result\.listing\)\] \}/)

  // The publicId branch must return before the filtered-search/exactListingId
  // machinery runs, otherwise a clean link would still need listingId/source/country.
  const publicIdIndex = route.indexOf("upstreamParams.get('publicId')")
  const exactListingIndex = route.indexOf("upstreamParams.get('listingId')")
  assert.ok(publicIdIndex > -1 && exactListingIndex > -1 && publicIdIndex < exactListingIndex)
})

test('a resolved ?publicId= listing uses a bounded TTL cache and never caches misses', () => {
  assert.match(route, /from '\.\.\/flats\/feedLookup'/)
  assert.match(feedLookup, /const cached = getCachedPublicId\(publicId\)/)
  assert.match(feedLookup, /if \(cached\) return \{ data: cached, upstreamFailed: false \}/)
  assert.match(feedLookup, /cachePublicId\(publicId, data\)/)

  assert.match(feedCache, /export const PUBLIC_ID_CACHE_TTL_MS = FEED_FRESH_MS/)
  assert.match(feedCache, /const PUBLIC_ID_CACHE_MAX_ENTRIES = 1_000/)
  assert.match(feedCache, /const publicIdCache = new BoundedTtlCache<string, any>/)
  assert.match(feedCache, /maxEntries: PUBLIC_ID_CACHE_MAX_ENTRIES/)
  assert.match(feedCache, /defaultTtlMs: PUBLIC_ID_CACHE_TTL_MS/)

  // Only the successful lookup branch writes to the public-id cache. A miss or
  // a 404 must return without creating a negative cache entry.
  assert.equal((feedLookup.match(/cachePublicId\(publicId, data\)/g) || []).length, 1)
  const hitWrite = feedLookup.indexOf('cachePublicId(publicId, data)')
  const notFoundHandler = feedLookup.indexOf('if (status === 404)')
  assert.ok(hitWrite > -1 && notFoundHandler > hitWrite)
})

test('flats-feed delegates bounded query caching, normalized keys, and refresh fan-out limits', () => {
  assert.match(route, /from '\.\.\/flats\/feedCache'/)
  assert.match(route, /const key = normalizedSearchKey\(upstreamParams\)/)
  assert.match(route, /const combinedKey = `combined:\$\{normalizedSearchKey\(combinedParams\)\}`/)
  assert.match(route, /const cached = getCachedFeed\(key\)/)
  assert.match(route, /refreshFeed\(key, url\)/)

  assert.match(feedCache, /const FEED_CACHE_MAX_ENTRIES = 750/)
  assert.match(feedCache, /const MAX_INFLIGHT_REFRESHES = 64/)
  assert.match(feedCache, /const feedCache = new BoundedTtlCache<string, FeedCacheEntry>/)
  assert.match(feedCache, /export function normalizedSearchKey\(params: URLSearchParams\): string/)
  assert.match(feedCache, /if \(feedRefreshes\.size >= MAX_INFLIGHT_REFRESHES\)/)
  assert.match(feedCache, /feedCache\.set\(key, entry, staleWindow\(entry\)\)/)
})

test('opening or sharing a listing prefers the bare publicId over the flat/flatSource/flatCountry triple', () => {
  assert.match(page, /async function openSharedListingByPublicId/)
  assert.match(page, /query\.adv = String\(listing\.publicId\)/)
  assert.match(page, /const query = l\.publicId != null\s*\n\s*\? \{ adv: String\(l\.publicId\) \}/)

  // Listings without a publicId yet must still fall back to the old triple so
  // existing shared links keep working.
  assert.match(page, /query\.flat = listing\.id;\s*\n\s*query\.flatSource = listing\.source;\s*\n\s*query\.flatCountry = listing\.country;/)

  assert.match(page, /watch\(\(\) => queryString\(route\.query\.adv\)/)
  assert.match(page, /void openSharedListingByPublicId\(publicId\)/)
})

test('the flat route state preserves adv and page across debounced filter syncs', () => {
  assert.match(routeState, /for \(const key of \["adv", "flat", "flatSource", "flatCountry", "page"\] as const\)/)
})

test('a deep-linked ?page=n restores loaded results before the URL is resynced to page 1', () => {
  assert.match(page, /function currentPageNumber\(\): number/)
  assert.match(page, /async function syncPageInUrl\(page: number\)/)
  assert.match(page, /async function restoreToPage\(targetPage: number\)/)
  assert.match(page, /const pageRestoring = ref\(true\)/)

  // The very first (non-append) load on mount must not wipe the requested page
  // out of the URL before restoreToPage has had a chance to load up to it.
  assert.match(page, /if \(import\.meta\.client && !pageRestoring\.value && view\.value === "active"\) await syncPageInUrl\(currentPageNumber\(\)\)/)
  // The page-bookmark write and the filter-serialize write both call
  // router.replace; sequencing them (await, page before filters) prevents
  // whichever fires second from racing the other and clobbering it.
  assert.match(page, /await syncPageInUrl\(currentPageNumber\(\)\);\s*\n\s*if \(!append\) await syncQueryParams\(\);/)

  const mountedStart = page.indexOf('onMounted(async () => {')
  const mountedEnd = page.indexOf('\nwatch(modalOpen', mountedStart)
  const mounted = page.slice(mountedStart, mountedEnd)
  assert.match(mounted, /await load\(false\);\s*\n\s*if \(requestedPage > 1\) await restoreToPage\(requestedPage\);\s*\n\s*pageRestoring\.value = false;/)
})
