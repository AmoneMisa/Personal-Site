import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalCityValue } from '../shared/locationCatalog.ts'
import { canonicalMetroValue } from '../server/utils/tashkentMetroLabels.ts'

test('lexicon-backed adapters keep stable consumer fallback contracts', () => {
  assert.equal(canonicalCityValue('  Exampleville  '), 'Exampleville')
  assert.equal(canonicalMetroValue('Example Station'), 'Example Station')
})
