import test from 'node:test'
import assert from 'node:assert/strict'

import {
  nearestBubble,
  popBubbleAt,
  publishBubbleField,
  registerBubblePopper,
  resetBubbleField,
} from '../app/composables/useOceanBubbleField.ts'

test('the nearest bubble is the closest one inside the range', () => {
  resetBubbleField()
  publishBubbleField([
    { x: 500, y: 500, radius: 5 },
    { x: 120, y: 100, radius: 6 },
    { x: 105, y: 100, radius: 4 },
  ])

  const found = nearestBubble(100, 100, 200)
  assert.ok(found)
  assert.equal(found.x, 105)
})

test('bubbles outside the range are not noticed at all', () => {
  resetBubbleField()
  publishBubbleField([{ x: 900, y: 900, radius: 5 }])
  assert.equal(nearestBubble(100, 100, 120), null)
})

test('a shorter publish does not leave stale bubbles behind', () => {
  resetBubbleField()
  publishBubbleField([
    { x: 100, y: 100, radius: 5 },
    { x: 110, y: 100, radius: 5 },
    { x: 120, y: 100, radius: 5 },
  ])
  // The field reuses its backing array between frames, so a frame with fewer
  // bubbles must not leave the dropped ones visible to the mascots.
  publishBubbleField([{ x: 400, y: 400, radius: 5 }])

  assert.equal(nearestBubble(100, 100, 80), null)
  assert.ok(nearestBubble(400, 400, 20))
})

test('an empty publish clears the field, so a stopped bubble layer is not chased', () => {
  resetBubbleField()
  publishBubbleField([{ x: 100, y: 100, radius: 5 }])
  publishBubbleField([])
  assert.equal(nearestBubble(100, 100, 500), null)
})

test('popping is delegated to the bubble layer and reports whether it burst one', () => {
  resetBubbleField()
  const calls = []
  registerBubblePopper((x, y, range) => {
    calls.push({ x, y, range })
    return x === 10
  })

  assert.equal(popBubbleAt(10, 20, 30), true)
  assert.equal(popBubbleAt(99, 20, 30), false)
  assert.deepEqual(calls, [
    { x: 10, y: 20, range: 30 },
    { x: 99, y: 20, range: 30 },
  ])
})

test('popping without a registered bubble layer is a no-op rather than a crash', () => {
  resetBubbleField()
  assert.equal(popBubbleAt(10, 20, 30), false)
})
