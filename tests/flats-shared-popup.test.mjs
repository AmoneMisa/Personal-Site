import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')

test('shared flat lookup falls back beyond the rotating feed snapshot', () => {
  assert.match(route, /upstreamParams\.get\('listingId'\)/)
  assert.match(route, /findCachedExactListing\(listingId, source, country\)/)
  assert.match(route, /\/api\/listing\/olx\/\$\{encodeURIComponent\(listingId\)\}/)
  assert.match(route, /exactListingFallback:\s*'source'/)
})
