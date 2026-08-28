import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
const routeState = await readFile(new URL('../app/composables/flats/useFlatRouteState.ts', import.meta.url), 'utf8')

test('flats-feed resolves a clean ?publicId= link without going through the filtered search', () => {
  assert.match(route, /const publicIdParam = String\(upstreamParams\.get\('publicId'\) \|\| ''\)\.trim\(\)/)
  assert.match(route, /\/api\/listing\/by-public-id\/\$\{encodeURIComponent\(publicIdParam\)\}/)
  assert.match(route, /const data = \{ count: 1, listings: \[shapeListing\(result\.listing\)\] \}/)

  // The publicId branch must return before the filtered-search/exactListingId
  // machinery runs, otherwise a clean link would still need listingId/source/country.
  const publicIdIndex = route.indexOf("upstreamParams.get('publicId')")
  const exactListingIndex = route.indexOf("upstreamParams.get('listingId')")
  assert.ok(publicIdIndex > -1 && exactListingIndex > -1 && publicIdIndex < exactListingIndex)
})

test('a resolved ?publicId= listing is cached briefly so a burst of opens on one shared link is one Postgres round trip', () => {
  assert.match(route, /const PUBLIC_ID_CACHE_TTL_MS = FEED_FRESH_MS/)
  assert.match(route, /const publicIdCache = new Map<string, \{ at: number; data: any \}>\(\)/)
  assert.match(route, /const cached = publicIdCache\.get\(publicIdParam\)/)
  assert.match(route, /if \(cached && Date\.now\(\) - cached\.at < PUBLIC_ID_CACHE_TTL_MS\) return cached\.data/)
  assert.match(route, /publicIdCache\.set\(publicIdParam, \{ at: Date\.now\(\), data \}\)/)

  // A miss (listing not found / still ingesting) must never be cached, or a
  // newly-active listing would stay invisible until the TTL expires.
  assert.match(route, /Not-found stays uncached/)
  const hitIndex = route.indexOf('publicIdCache.set(publicIdParam')
  const notFoundCommentIndex = route.indexOf('Not-found stays uncached')
  assert.ok(hitIndex > -1 && notFoundCommentIndex > -1 && hitIndex < notFoundCommentIndex)
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
  assert.match(page, /function syncPageInUrl\(page: number\)/)
  assert.match(page, /async function restoreToPage\(targetPage: number\)/)
  assert.match(page, /const pageRestoring = ref\(true\)/)

  // The very first (non-append) load on mount must not wipe the requested page
  // out of the URL before restoreToPage has had a chance to load up to it.
  assert.match(page, /if \(import\.meta\.client && !pageRestoring\.value && view\.value === "active"\) syncPageInUrl\(currentPageNumber\(\)\)/)

  const mountedStart = page.indexOf('onMounted(async () => {')
  const mountedEnd = page.indexOf('\nwatch(modalOpen', mountedStart)
  const mounted = page.slice(mountedStart, mountedEnd)
  assert.match(mounted, /await load\(false\);\s*\n\s*if \(requestedPage > 1\) await restoreToPage\(requestedPage\);\s*\n\s*pageRestoring\.value = false;/)
})
