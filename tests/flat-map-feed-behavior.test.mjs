import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { useFlatMapFeed } from '~/composables/flats/useFlatMapFeed.ts'
import { selectFlatMapPoints } from '~/utils/flats/mapPoints.ts'
import { withVueSetup } from './helpers/vueSetup.mjs'

test('failed map queries clear unrelated pins and remain retryable', async t => {
  let country = 'RO'
  let calls = 0
  globalThis.$fetch = async () => {
    calls++
    if (calls === 2) throw new Error('offline')
    return { mapPoints: [{ id: country }] }
  }
  const { value: feed } = withVueSetup(t, () => useFlatMapFeed({ query: () => ({ country }), enabled: true, shape: data => data.mapPoints }))
  await feed.load()
  country = 'UA'
  await feed.load()
  assert.deepEqual(feed.points.value, [])
  assert.equal(feed.failed.value, true)
  await feed.load()
  assert.equal(calls, 3)
  assert.deepEqual(feed.points.value, [{ id: 'UA' }])
})

test('cached map points paint immediately and still revalidate', async t => {
  let country = 'RO'
  let finish
  globalThis.$fetch = async () => ({ mapPoints: [{ id: country }] })
  const { value: feed } = withVueSetup(t, () => useFlatMapFeed({ query: () => ({ country }), enabled: true, shape: data => data.mapPoints }))
  await feed.load()
  country = 'UA'
  await feed.load()
  country = 'RO'
  globalThis.$fetch = () => new Promise(resolve => { finish = resolve })
  const pending = feed.load()
  assert.deepEqual(feed.points.value, [{ id: 'RO' }])
  finish({ mapPoints: [{ id: 'RO-updated' }] })
  await pending
  assert.deepEqual(feed.points.value, [{ id: 'RO-updated' }])
})

test('switching to a collection aborts and suppresses the search feed', async t => {
  const enabled = ref(true)
  let finish
  let signal
  globalThis.$fetch = (_url, options) => {
    signal = options.signal
    return new Promise(resolve => { finish = resolve })
  }
  const { value: feed } = withVueSetup(t, () => useFlatMapFeed({ query: () => ({ country: 'RO' }), enabled, shape: data => data.mapPoints }))
  const pending = feed.load()
  enabled.value = false
  await feed.load()
  assert.equal(signal.aborted, true)
  finish({ mapPoints: [{ id: 'not-a-favorite' }] })
  await pending
  assert.deepEqual(feed.points.value, [])
  assert.equal(feed.loading.value, false)
})

test('collections show only supplied points and search excludes hidden ids', () => {
  const remote = [{ id: 'unrelated', source: 'olx', country: 'RO' }]
  const supplied = [{ id: 'favorite', source: 'olx', country: 'RO' }]
  assert.deepEqual(selectFlatMapPoints(remote, supplied, { mode: 'collection', excludedIds: new Set() }), supplied)
  assert.deepEqual(selectFlatMapPoints(remote, supplied, { mode: 'search', excludedIds: new Set(['unrelated']) }), supplied)
})
