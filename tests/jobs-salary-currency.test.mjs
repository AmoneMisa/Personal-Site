import test from 'node:test'
import assert from 'node:assert/strict'
import { parseHiringSalary } from '../server/utils/hiringLexicon.ts'
import { toUsd } from '../server/utils/currency.ts'

test('Uzbek salary language does not turn local sums into USD', () => {
  const salary = parseHiringSalary('35 000 000 oylik')
  assert.ok(salary)
  assert.equal(salary.currency, 'UZS')
  assert.equal(salary.period, 'month')
})

test('Kazakh salary language uses KZT when currency is omitted', () => {
  const salary = parseHiringSalary('500 000 айлық')
  assert.ok(salary)
  assert.equal(salary.currency, 'KZT')
})

test('explicit currency still has priority over language inference', () => {
  const salary = parseHiringSalary('$2,000 oylik')
  assert.ok(salary)
  assert.equal(salary.currency, 'USD')
})

test('USD conversion refuses unknown currencies instead of assuming USD', () => {
  assert.equal(toUsd(35_000_000, undefined), undefined)
  assert.equal(toUsd(2_000, 'USD'), 2_000)
  assert.ok((toUsd(35_000_000, 'UZS') ?? 0) < 10_000)
})
