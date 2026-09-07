import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { shapeMapResponse, shapeResponse } from '../server/flats/feedListingShape.ts'

const route = await readFile(new URL('../server/routes/flats-feed.get.ts', import.meta.url), 'utf8')
const shape = await readFile(new URL('../server/flats/feedListingShape.ts', import.meta.url), 'utf8')

test('social dedupe respects backend city identity instead of collapsing geographic aliases', () => {
  const listing = { source: 'telegram', country: 'UZ', city: 'Tashkent', title: 'Apartment', description: 'Identical long social listing description with sufficient detail for the repost deduplication threshold. '.repeat(2) }
  const result = shapeResponse({ listings: [
    { ...listing, id: 'one' },
    { ...listing, id: 'two', source: 'facebook' },
    { ...listing, id: 'three', city: 'Ташкент' },
    { ...listing, id: 'four', source: 'olx' },
  ] }, [])
  assert.deepEqual(result.listings.map(row => row.id), ['one', 'three', 'four'])
})

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

test('Telegram photos use the same-origin photo proxy in list and compact map feeds', () => {
  const relative = '/api/tg-photo/flat_channel/12345'
  const absolute = `http://flats-api:4000${relative}`
  const proxy = `/flats-photo?path=${encodeURIComponent(relative)}`

  const listings = shapeResponse({ listings: [{ id: 'telegram-listing', photo: absolute, photos: [relative] }] }, [])
  const map = shapeMapResponse({ mapPoints: [{ id: 'telegram-pin', photo: relative }] })

  assert.equal(listings.listings[0].photo, proxy)
  assert.deepEqual(listings.listings[0].photos, [proxy])
  assert.equal(map.mapPoints[0].photo, proxy)
})
