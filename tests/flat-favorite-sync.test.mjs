import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { flatListingKey, listingKeyParts } from '../app/utils/flats/listingKey.ts'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the item key matches the app and the backend byte for byte', () => {
  // flat-finder app/lib/models/listing_identity.dart builds exactly this, and
  // it is what lands in user_data.saved_items.item_key. Casing differences
  // would sync one flat as two favourites that never dedupe.
  assert.equal(listingKeyParts('OLX', 'uz', '42'), 'olx:UZ:42')
  assert.equal(flatListingKey({ source: 'Olx', country: 'Uz', id: 'abc' }), 'olx:UZ:abc')
  assert.equal(flatListingKey({ source: 'telegram', country: 'UA', id: '7' }), 'telegram:UA:7')
})

test('the installation secret never reaches the browser', async () => {
  const shared = await read('server/flats/savedState.ts')
  // httpOnly: anything holding this credential can rewrite the installation's
  // saved state, so an XSS on the page must not be able to read it.
  assert.match(shared, /httpOnly: true/u)
  assert.match(shared, /secure: !import\.meta\.dev/u)
  // The client composable must never name the cookies or the raw API.
  const client = await read('app/composables/flats/useFlatFavoriteSync.ts')
  assert.doesNotMatch(client, /ff_secret|X-Flat-Finder-Device-Secret|api\/mobile/u)
})

test('the proxy only forwards known ops', async () => {
  const route = await read('server/routes/flats-sync-mutate.post.ts')
  assert.match(route, /const ALLOWED_OPS = new Set\(\[/u)
  for (const op of ['favorite.put', 'favorite.delete']) {
    assert.match(route, new RegExp(`'${op.replace('.', '\\.')}'`, 'u'), op)
  }
  // Presets belong to the app, not the site.
  assert.doesNotMatch(route, /'preset\.put'/u)
})

test('sync never deletes either side, and never blocks the UI', async () => {
  const page = await read('app/pages/flat-finder/[...slug].vue')
  // Union merge: keep what this browser had, add the server's, push the rest.
  assert.match(page, /mergeFavorites\(remote\)/u)
  // Local-only favourites go up in one additive import (an empty server side
  // included), never a mutation per item: the backend allows one mutation per
  // 100 ms per client, so a loop is rate-limited and switches sync off.
  assert.match(page, /await favoriteSync\.seed\(before\.filter\(\(listing\) => !remoteIds\.has\(listing\.id\)\)\)/u)
  assert.doesNotMatch(page, /for \(const listing of before\)/u)
  // The heart applies locally first; the network call is not awaited.
  assert.match(page, /toggleFavoriteLocal\(listing\);\s+void \(wasFavorite/u)
})

test('the proxy survives the backend per-client rate limit', async () => {
  const shared = await read('server/flats/savedState.ts')
  // One retry after the backend's Retry-After, capped, so two quick heart
  // clicks do not switch sync off.
  assert.match(shared, /if \(response\?\.status !== 429\) return null/u)
  assert.match(shared, /Math\.min\(Math\.max\(wait, 0\), RATE_LIMIT_RETRY_CAP_MS\)/u)
  // The browser's address is forwarded so browsers do not share one bucket.
  assert.match(shared, /headers\['X-Forwarded-For'\] = ip/u)
  for (const path of ['server/routes/flats-sync-state.get.ts', 'server/routes/flats-sync-mutate.post.ts', 'server/routes/flats-sync-import.post.ts']) {
    const route = await read(path)
    assert.match(route, /savedStateFetch/u, path)
    assert.match(route, /savedStateHeaders\(credentials, event\)/u, path)
    assert.doesNotMatch(route, /\$fetch\(/u, path)
  }
})

test('a failed sync leaves the page working on local storage alone', async () => {
  const client = await read('app/composables/flats/useFlatFavoriteSync.ts')
  // pull() answers null rather than throwing, and pushes switch off after a
  // failure instead of retrying on every click.
  assert.match(client, /live\.value = false;\s+return null;/u)
  assert.match(client, /if \(!live\.value\) return;/u)
  const state = await read('server/routes/flats-sync-state.get.ts')
  assert.match(state, /return \{ ok: false, state: null \}/u)
})
