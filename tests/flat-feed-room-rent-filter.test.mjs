import assert from 'node:assert/strict'
import test from 'node:test'

import { useFlatFilters } from '../app/composables/flats/useFlatFilters.ts'

test('flat feed sends roomRent as a first-class deal type', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.dealType.value = 'roomRent'

  const params = filters.buildFeedParams({
    limit: 20,
    append: false,
    loadedCount: 0,
    nextCursor: null,
    sources: ['olx', 'telegram'],
  })

  assert.equal(params.countries, 'UZ')
  assert.equal(params.dealType, 'roomRent')
  assert.equal(params.roomOnly, undefined)
  assert.equal(params.includeStats, '1')
})

test('explicit room-only filter remains available independently', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.dealType.value = 'any'
  filters.roomOnlyFilter.value = true

  const params = filters.buildFeedParams({
    limit: 20,
    append: false,
    loadedCount: 0,
    nextCursor: null,
    sources: ['olx'],
  })

  assert.equal(params.dealType, undefined)
  assert.equal(params.roomOnly, '1')
})
