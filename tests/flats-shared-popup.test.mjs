import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
const safeFetch = await readFile(new URL('../app/utils/safeFetch.ts', import.meta.url), 'utf8')

test('shared OLX lookup opens from PostgreSQL and reserves source waits for explicit verification', () => {
  assert.match(route, /upstreamParams\.get\('listingId'\)/)
  assert.match(route, /upstreamParams\.get\('verifyLive'\) === '1'/)
  assert.match(route, /\/api\/listing\/olx\/\$\{encodeURIComponent\(exactListingId\)\}/)
  assert.match(route, /exactListingFallback:\s*'source'/)
  assert.match(route, /exactListingFallback:\s*'source-inactive'/)

  assert.match(route, /if \(verifyLive && exactListingId && exactSource === 'olx' && exactCountryCode\)/)
  assert.match(route, /upstreamParams\.delete\('verifyLive'\)/)
  assert.match(route, /exactListingFallback:\s*'source-unavailable'/)
  assert.match(safeFetch, /timeout:\s*15000/)
})

test('cached feed filters OLX rows already persisted as inactive', () => {
  assert.match(route, /\/api\/listings\/verify/)
  assert.match(route, /result\?\.status !== 'active' && result\?\.status !== 'inactive'/)
  assert.match(route, /filterPersistedInactiveOlx/)
  assert.match(route, /availabilityFiltered:\s*removed/)
  assert.match(route, /ACTIVE_AVAILABILITY_FRESH_MS = 60 \* 60_000/)
  assert.match(route, /cached\?\.status === 'active'/)
  assert.match(route, /availabilityCache\.delete\(key\)/)
  assert.match(route, /Date\.parse\(String\(result\.checkedAt/)
  assert.match(route, /availabilityChecked/)
  assert.match(route, /const finalize = async \(raw: any\) => filterPersistedInactiveOlx/)
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
