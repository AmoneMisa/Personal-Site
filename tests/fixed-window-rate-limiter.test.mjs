import test from 'node:test'
import assert from 'node:assert/strict'

import { FixedWindowRateLimiter } from '../server/utils/fixedWindowRateLimiter.ts'

test('fixed-window limiter enforces the configured request limit', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 1_000, maxEntries: 10 })

  assert.equal(limiter.consume('client', 0), true)
  assert.equal(limiter.consume('client', 1), true)
  assert.equal(limiter.consume('client', 2), false)
})

test('fixed-window limiter resets an expired window', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1_000, maxEntries: 10 })

  assert.equal(limiter.consume('client', 0), true)
  assert.equal(limiter.consume('client', 999), false)
  assert.equal(limiter.consume('client', 1_000), true)
})

test('fixed-window limiter evicts old keys when capacity is reached', () => {
  const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 10_000, maxEntries: 2 })

  assert.equal(limiter.consume('a', 0), true)
  assert.equal(limiter.consume('b', 0), true)
  assert.equal(limiter.consume('c', 0), true)

  // `a` was the oldest entry and should have been evicted rather than retained
  // indefinitely. A fresh request therefore starts a new window.
  assert.equal(limiter.consume('a', 1), true)
})
