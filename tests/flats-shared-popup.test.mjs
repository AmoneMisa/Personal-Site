import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')

test('shared OLX lookup verifies the live source before any cached fallback', () => {
  assert.match(route, /upstreamParams\.get\('listingId'\)/)
  assert.match(route, /\/api\/listing\/olx\/\$\{encodeURIComponent\(listingId\)\}/)
  assert.match(route, /exactListingFallback:\s*'source'/)
  assert.match(route, /exactListingFallback:\s*'source-inactive'/)

  const directLookup = route.indexOf('/api/listing/olx/${encodeURIComponent(listingId)}')
  const cachedLookup = route.indexOf('findCachedExactListing(listingId, source, country)')
  assert.ok(directLookup >= 0)
  assert.ok(cachedLookup > directLookup)
})

test('cached feed filters OLX rows already persisted as inactive', () => {
  assert.match(route, /\/api\/listings\/verify/)
  assert.match(route, /result\?\.status === 'inactive'/)
  assert.match(route, /filterPersistedInactiveOlx/)
  assert.match(route, /availabilityFiltered:\s*removed/)
  assert.match(route, /const finalize = async \(raw: any\) => filterPersistedInactiveOlx/)
})

test('client never trusts a locally loaded OLX row without a live exact lookup', () => {
  assert.match(page, /const toast = useToast\(\)/)
  assert.match(page, /async function verifyOlxListing/)
  assert.match(page, /listingId:\s*l\.id/)
  assert.match(page, /sources:\s*"olx"/)
  assert.match(page, /exactListingFallback === "source-inactive"/)
  assert.match(page, /async function openListing/)
  assert.match(page, /await verifyOlxListing\(l\)/)
  assert.match(page, /showListingUnavailableToast\(\)/)

  const sharedStart = page.indexOf('async function openSharedListing')
  const sharedEnd = page.indexOf('\nfunction timeAgo', sharedStart)
  const shared = page.slice(sharedStart, sharedEnd)
  assert.match(shared, /if \(local\) \{ await openListing\(local\); return; \}/)
  assert.doesNotMatch(shared, /if \(local\) \{ openListing\(local\); return; \}/)
})
