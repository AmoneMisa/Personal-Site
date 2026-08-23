import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')

test('legacy all-source web request includes persisted social housing', () => {
  assert.match(route, /ALL_FEED_SOURCES = \['olx', 'telegram', 'facebook', 'threads'\]/)
  assert.match(route, /legacyAllSources/)
  assert.match(route, /if \(legacyAllSources\) upstreamParams\.delete\('sources'\)/)
})

test('long social reposts dedupe across networks without touching OLX', () => {
  assert.match(route, /SOCIAL_FEED_SOURCES = new Set\(\['telegram', 'facebook', 'threads'\]\)/)
  assert.match(route, /if \(!SOCIAL_FEED_SOURCES\.has\(source\)\) return null/)
  assert.match(route, /Source is deliberately omitted/)
  assert.match(route, /data\.listings = dedupeFeedListings\(shaped\)/)
})
