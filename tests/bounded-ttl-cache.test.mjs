import test from 'node:test'
import assert from 'node:assert/strict'

import { BoundedTtlCache } from '../server/utils/boundedTtlCache.ts'

test('bounded TTL cache expires entries without refreshing TTL on read', () => {
  const cache = new BoundedTtlCache({ maxEntries: 3, defaultTtlMs: 100 })

  cache.set('a', 1, undefined, 1_000)
  assert.equal(cache.get('a', 1_050), 1)
  assert.equal(cache.get('a', 1_101), undefined)
  assert.equal(cache.size, 0)
})

test('bounded TTL cache evicts the least-recently-used live key', () => {
  const cache = new BoundedTtlCache({ maxEntries: 2, defaultTtlMs: 1_000 })

  cache.set('a', 1, undefined, 1_000)
  cache.set('b', 2, undefined, 1_000)
  assert.equal(cache.get('a', 1_010), 1)

  cache.set('c', 3, undefined, 1_020)

  assert.equal(cache.peek('a', 1_020), 1)
  assert.equal(cache.peek('b', 1_020), undefined)
  assert.equal(cache.peek('c', 1_020), 3)
  assert.equal(cache.size, 2)
})

test('bounded TTL cache supports per-entry TTLs and sweeps expired values()', () => {
  const cache = new BoundedTtlCache({ maxEntries: 5, defaultTtlMs: 1_000 })

  cache.set('short', 'x', 10, 1_000)
  cache.set('long', 'y', 100, 1_000)

  assert.deepEqual(cache.values(1_011), ['y'])
  assert.equal(cache.size, 1)
})
