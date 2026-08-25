import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalCityValue } from '../shared/locationCatalog.ts'
import { canonicalMetroValue } from '../server/utils/tashkentMetroLabels.ts'

test('shared lexicon canonicalizes Kazakh and Uzbek city spellings', () => {
  assert.equal(canonicalCityValue('Қарағанды'), 'Karaganda')
  assert.equal(canonicalCityValue('Ақтөбе'), 'Aktobe')
  assert.equal(canonicalCityValue('Фарғона'), 'Fergana')
})

test('shared Tashkent metro lexicon preserves historical and Uzbek aliases', () => {
  assert.equal(canonicalMetroValue('Максим Горький'), 'Buyuk Ipak Yoli')
  assert.equal(canonicalMetroValue('Қўйлиқ'), 'Qoyliq')
})
