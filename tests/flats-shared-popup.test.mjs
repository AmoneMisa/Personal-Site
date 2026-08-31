import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const feedLookup = await readFile(new URL('../server/flats/feedLookup.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
const safeFetch = await readFile(new URL('../app/utils/safeFetch.ts', import.meta.url), 'utf8')

test('shared OLX lookup opens from PostgreSQL and reserves source waits for explicit verification', () => {
  assert.match(route, /upstreamParams\.get\('listingId'\)/)
  assert.match(route, /upstreamParams\.get\('verifyLive'\) === '1'/)
  assert.match(route, /if \(verifyLive && exactListingId && exactSource === 'olx' && exactCountryCode\)/)
  assert.match(route, /return verifyOlxListingLive\(exactListingId, exactCountryCode\)/)
  assert.match(route, /upstreamParams\.delete\('verifyLive'\)/)

  assert.match(feedLookup, /EXACT_LOOKUP_TIMEOUT_MS = 8_000/)
  assert.match(feedLookup, /\/api\/listing\/olx\/\$\{encodeURIComponent\(listingId\)\}/)
  assert.match(feedLookup, /exactListingFallback:\s*'source'/)
  assert.match(feedLookup, /exactListingFallback:\s*'source-inactive'/)
  assert.match(feedLookup, /exactListingFallback:\s*'source-unavailable'/)
  assert.match(safeFetch, /timeout:\s*15000/)
})

test('main feed trusts persisted availability without a second blocking OLX batch', () => {
  assert.doesNotMatch(route, /\/api\/listings\/verify/)
  assert.doesNotMatch(route, /filterPersistedInactiveOlx/)
  assert.doesNotMatch(route, /AVAILABILITY_TIMEOUT_MS/)
  assert.match(route, /const finalize = async \(raw: any\) => withExactListingFallback/)
  assert.match(route, /const url = `\$\{FLAT_API_URL\}\/api\/listings\?\$\{upstreamParams\}`/)

  // Live verification is an explicit exact-listing branch only. The generic
  // persisted feed must remove verifyLive before constructing its upstream URL.
  const liveBranch = route.indexOf("if (verifyLive && exactListingId && exactSource === 'olx' && exactCountryCode)")
  const removeFlag = route.indexOf("upstreamParams.delete('verifyLive')")
  const feedUrl = route.indexOf('const url = `${FLAT_API_URL}/api/listings?${upstreamParams}`')
  assert.ok(liveBranch > -1 && removeFlag > -1 && feedUrl > -1 && removeFlag < liveBranch && liveBranch < feedUrl)
})

test('client opens OLX immediately and performs explicit live verification in the background', () => {
  assert.match(page, /const toast = useToast\(\)/)
  assert.match(page, /async function verifyOlxListing/)
  assert.match(page, /listingId:\s*l\.id/)
  assert.match(page, /sources:\s*"olx"/)
  assert.match(page, /verifyLive:\s*"1"/)
  assert.match(page, /exactListingFallback === "source-inactive"/)
  assert.match(page, /async function openListing/)
  assert.match(page, /!isAvailabilityFresh\(key\)/)
  assert.match(page, /async function verifyOpenOlxListing/)
  assert.match(page, /void verifyOpenOlxListing\(l, key\)/)
  assert.match(page, /class="flat-modal__verification"/)
  assert.doesNotMatch(page, /class="flat-verification"/)
  assert.match(page, /markAvailabilityFresh\(key\)/)
  assert.match(page, /showListingUnavailableToast\(\)/)

  const sharedStart = page.indexOf('async function openSharedListing')
  const sharedEnd = page.indexOf('\nonMounted', sharedStart)
  const shared = page.slice(sharedStart, sharedEnd)
  assert.match(shared, /if \(local\) \{ await openListing\(local\); return; \}/)
  assert.match(shared, /if \(exact\) \{ await openListing\(exact\); return; \}/)
  assert.doesNotMatch(shared, /if \(local\) \{ openListing\(local\); return; \}/)
})
