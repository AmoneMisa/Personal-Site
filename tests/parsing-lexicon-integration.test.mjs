import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalCityValue } from '../shared/locationCatalog.ts'
import { canonicalMetroValue } from '../server/utils/tashkentMetroLabels.ts'
import { capitalizeFirst } from '../app/utils/text.ts'

test('lexicon-backed adapters keep stable consumer fallback contracts', () => {
  assert.equal(canonicalCityValue('  Exampleville  '), 'Exampleville')
  assert.equal(canonicalMetroValue('Example Station'), 'Example Station')
})

test('candidate relative-date labels start with a capital letter', () => {
  assert.equal(capitalizeFirst('сегодня'), 'Сегодня')
  assert.equal(capitalizeFirst('вчера'), 'Вчера')
  assert.equal(capitalizeFirst('3 дн. назад'), '3 Дн. назад')
})

test('candidate cities use parser-owned canonical values before display', () => {
  assert.equal(canonicalCityValue('Ташкент'), 'Tashkent')
  assert.equal(canonicalCityValue('Toshkent'), 'Tashkent')
})
