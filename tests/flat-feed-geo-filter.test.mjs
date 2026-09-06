import assert from 'node:assert/strict'
import test from 'node:test'

import { useFlatFilters } from '../app/composables/flats/useFlatFilters.ts'

function feedParams(filters) {
  return filters.buildFeedParams({
    limit: 20,
    append: false,
    loadedCount: 0,
    nextCursor: null,
    sources: ['olx', 'telegram'],
  })
}

test('flat feed sends every selected metro, radius and arc upstream', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.city.value = 'Tashkent'
  filters.district.value = 'Chilanzar'
  filters.metro.value = ['Novza', 'Chilonzor', 'Novza']
  filters.metroMaxM.value = 780
  filters.metroBearingFrom.value = 340
  filters.metroBearingTo.value = 20

  const params = feedParams(filters)

  assert.equal(params.countries, 'UZ')
  assert.equal(params.city, 'Tashkent')
  assert.equal(params.district, 'Chilanzar')
  assert.deepEqual(new Set(params.metro.split(',')), new Set(['Novza', 'Chilonzor']))
  assert.equal(params.metroMaxM, '780')
  assert.equal(params.metroArc, '340,20')
})

test('metro geometry is omitted when no station is selected', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.metro.value = []
  filters.metroMaxM.value = 500
  filters.metroBearingFrom.value = 250
  filters.metroBearingTo.value = 290

  const params = feedParams(filters)
  assert.equal(params.metro, undefined)
  assert.equal(params.metroMaxM, undefined)
  assert.equal(params.metroArc, undefined)
})
