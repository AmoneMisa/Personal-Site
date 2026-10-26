import assert from 'node:assert/strict'
import test from 'node:test'
import { withVueSetup } from './helpers/vueSetup.mjs'
import { useFlatFeed } from '~/composables/flats/useFlatFeed.ts'
import { useFlatFavoriteSync } from '~/composables/flats/useFlatFavoriteSync.ts'

const listing = id => ({ id, source: 'olx', country: 'RO', title: id })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('warm completion applies cards and the next cursor', async t => {
  const responses = [
    { listings: [], count: 0, warming: true },
    { listings: [listing('ready')], count: 40, nextCursor: 'next', warming: false },
  ]
  globalThis.$fetch = async () => responses.shift()
  const { value: feed } = withVueSetup(t, () => useFlatFeed())
  await feed.loadFeed({ countries: 'RO' })
  await feed.loadFeed({ countries: 'RO' }, { background: true, warmPoll: true })
  assert.deepEqual(feed.listings.value.map(item => item.id), ['ready'])
  assert.equal(feed.nextCursor.value, 'next')
  assert.equal(feed.warming.value, false)
})

test('cached cards are revalidated visibly without a blocking loader', async t => {
  const responses = [
    { listings: [listing('old')], count: 1 },
    { listings: [listing('fresh')], count: 1 },
  ]
  globalThis.$fetch = async () => responses.shift()
  const { value: feed } = withVueSetup(t, () => useFlatFeed())
  await feed.loadFeed({ countries: 'RO' })
  await feed.loadFeed({ countries: 'RO' })
  assert.equal(feed.loading.value, false)
  await tick()
  assert.deepEqual(feed.listings.value.map(item => item.id), ['fresh'])
})

test('first-page refresh preserves appended cards and their cursor', async t => {
  const responses = [
    { listings: [listing('first')], count: 4, nextCursor: 'page-two' },
    { listings: [listing('second')], count: 4, nextCursor: 'page-three' },
    { listings: [{ ...listing('first'), title: 'updated' }], count: 4, nextCursor: 'page-two' },
  ]
  globalThis.$fetch = async () => responses.shift()
  const { value: feed } = withVueSetup(t, () => useFlatFeed())
  await feed.loadFeed({ countries: 'RO' })
  await feed.loadFeed({ countries: 'RO', cursor: 'page-two' }, { append: true })
  await feed.loadFeed({ countries: 'RO' }, { background: true })
  assert.deepEqual(feed.listings.value.map(item => item.id), ['first', 'second'])
  assert.equal(feed.listings.value[0].title, 'updated')
  assert.equal(feed.nextCursor.value, 'page-three')
})

test('sign-out cancels an old favorites pull before merge or import', async t => {
  let finishPull
  let signal
  const imports = []
  globalThis.$fetch = (url, options) => {
    if (url === '/flats-sync-state') {
      signal = options.signal
      return new Promise(resolve => { finishPull = resolve })
    }
    imports.push(options.body)
    return Promise.resolve({ ok: true })
  }
  const { value: sync } = withVueSetup(t, () => useFlatFavoriteSync())
  const merged = []
  const pending = sync.synchronize([listing('local')], items => merged.push(...items))
  sync.cancelPending()
  assert.equal(signal.aborted, true)
  finishPull({ ok: true, state: { favorites: [{ listing: listing('remote') }] } })
  await pending
  assert.deepEqual(merged, [])
  assert.deepEqual(imports, [])
  assert.equal(sync.live.value, true)
})

test('favorites still merge and seed local-only items in one request', async t => {
  const writes = []
  globalThis.$fetch = async (url, options) => {
    if (url === '/flats-sync-state') return { ok: true, state: { favorites: [{ listing: listing('remote') }] } }
    writes.push(options.body)
    return { ok: true }
  }
  const { value: sync } = withVueSetup(t, () => useFlatFavoriteSync())
  let remote
  await sync.synchronize([listing('local')], items => { remote = items })
  assert.equal(remote[0].id, 'remote')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].favorites[0].key, 'olx:RO:local')
})

test('unmount suppresses a pending favorites response', async t => {
  let finish
  globalThis.$fetch = () => new Promise(resolve => { finish = resolve })
  const { value: sync, unmount } = withVueSetup(t, () => useFlatFavoriteSync())
  let merged = false
  const pending = sync.synchronize([], () => { merged = true })
  unmount()
  finish({ ok: true, state: { favorites: [{ listing: listing('old') }] } })
  await pending
  assert.equal(merged, false)
})
