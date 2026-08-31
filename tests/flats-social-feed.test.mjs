import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const shape = await readFile(new URL('../server/flats/feedListingShape.ts', import.meta.url), 'utf8')

test('legacy and current all-source web requests use the fast unfiltered feed', () => {
  assert.match(shape, /ALL_FEED_SOURCES = \['olx', 'telegram', 'facebook', 'threads'\]/)
  assert.match(shape, /CURRENT_ALL_SOURCE_TOKENS = \[\.\.\.ALL_FEED_SOURCES, 'custom'\]/)
  assert.match(route, /ALL_FEED_SOURCES/)
  assert.match(route, /CURRENT_ALL_SOURCE_TOKENS/)
  assert.match(route, /legacyAllSources/)
  assert.match(route, /CURRENT_ALL_SOURCE_TOKENS\.every\(\(source\) => requestedSourceTokens\.includes\(source\)\)/)
  assert.match(route, /const allSourcesRequest = legacyAllSources \|\| currentAllSources/)
  assert.match(route, /if \(allSourcesRequest\) upstreamParams\.delete\('sources'\)/)
})

test('long social reposts dedupe across networks without touching OLX', () => {
  assert.match(shape, /SOCIAL_FEED_SOURCES = new Set\(\['telegram', 'facebook', 'threads'\]\)/)
  assert.match(shape, /if \(!SOCIAL_FEED_SOURCES\.has\(source\)\) return null/)
  assert.doesNotMatch(shape, /SOCIAL_FEED_SOURCES = new Set\([^\n]*olx/)
  assert.match(shape, /data\.listings = dedupeFeedListings\(selectedListings\.map\(shapeListing\)\)/)
  assert.match(route, /shapeResponse\(raw, requestedSources\)/)
})
