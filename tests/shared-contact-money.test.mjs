import assert from 'node:assert/strict'
import test from 'node:test'

import { compactSalaryText, currencySymbol } from '../app/utils/search/money.ts'
import { extractContacts } from '../server/utils/hiringNormalize.ts'

test('frontend currency formatting uses the shared currency catalog', () => {
  assert.equal(currencySymbol('UAH'), '₴')
  assert.equal(currencySymbol('JPY'), '¥')
  assert.equal(compactSalaryText('10 000 UAH/месяц'), '₴10K/м.')
})

test('candidate normalization uses country-aware shared phone and Telegram parsers', () => {
  assert.deepEqual(
    extractContacts('Телефон: 095 082 01 03, Telegram: t.me/maria_jobs', 'UA'),
    { phone: '+380950820103', telegram: '@maria_jobs' },
  )
  assert.deepEqual(
    extractContacts('Aloqa: 90 123 45 67 @dev_user', 'UZ'),
    { phone: '+998901234567', telegram: '@dev_user' },
  )
})
