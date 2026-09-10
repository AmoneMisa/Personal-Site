import assert from 'node:assert/strict'
import test from 'node:test'

import { useFlatFilters } from '../app/composables/flats/useFlatFilters.ts'
import { useFlatRouteState } from '../app/composables/flats/useFlatRouteState.ts'

test('customSites narrows the Sites bucket without touching sources', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.source.value = 'custom'
  filters.customSites.value = ['krisha.kz', 'lun.ua']

  const params = filters.buildFeedParams({
    limit: 20,
    append: false,
    loadedCount: 0,
    nextCursor: null,
    sources: ['olx', 'telegram'],
  })

  assert.equal(params.sources, 'custom')
  assert.equal(params.customSites, 'krisha.kz,lun.ua')
})

test('customSites is omitted from the request when empty', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']

  const params = filters.buildFeedParams({
    limit: 20,
    append: false,
    loadedCount: 0,
    nextCursor: null,
    sources: ['olx', 'telegram'],
  })

  assert.equal('customSites' in params, false)
})

test('changing country drops selected sites that may not apply there', () => {
  const filters = useFlatFilters()
  filters.countries.value = ['UZ']
  filters.customSites.value = ['uybor.uz']

  filters.countries.value = ['RO']

  assert.deepEqual(filters.customSites.value, [])
})

test('resetValues clears customSites', () => {
  const filters = useFlatFilters()
  filters.customSites.value = ['krisha.kz']
  filters.resetValues('RO')
  assert.deepEqual(filters.customSites.value, [])
})

test('customSites round-trips through the shareable route state', () => {
  let query = {}
  const router = { replace: async (next) => { query = next.query } }
  const filters = useFlatFilters()
  const routeState = useFlatRouteState({
    router,
    route: { query: {} },
    filters,
    sources: ['olx', 'telegram'],
  })

  filters.customSites.value = ['krisha.kz', 'lun.ua']
  const serialized = routeState.serialize()
  assert.equal(serialized.customSites, 'krisha.kz,lun.ua')

  const restored = useFlatFilters()
  const restoredRouteState = useFlatRouteState({
    router,
    route: { query: {} },
    filters: restored,
    sources: ['olx', 'telegram'],
  })
  restoredRouteState.deserialize(serialized)
  assert.deepEqual(restored.customSites.value, ['krisha.kz', 'lun.ua'])
})
