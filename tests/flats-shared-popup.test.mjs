import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')

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
