import assert from 'node:assert/strict'
import test from 'node:test'

import { compactSalaryText, convertSalaryPeriod, currencySymbol } from '../app/utils/search/money.ts'
import { parseHiringSalary, parseSharedHiringContext } from '../server/utils/hiringLexicon.ts'
import { extractContacts } from '../server/utils/hiringNormalize.ts'

test('frontend currency formatting uses the shared currency catalog', () => {
  assert.equal(currencySymbol('UAH'), '₴')
  assert.equal(currencySymbol('JPY'), '¥')
  assert.equal(compactSalaryText('10 000 UAH/месяц'), '₴10K/м.')
})

test('salary periods from source/i18n constructions remain structured', () => {
  const cases = [
    ['$110K/jobs.perProject', 'project'],
    ['$208K/jobs.perWeek', 'week'],
    ['$149K/jobs.perShift', 'shift'],
    ['$341K/jobs.perDay', 'day'],
  ]
  for (const [source, period] of cases) {
    assert.equal(parseHiringSalary(source)?.period, period, source)
  }

  const hourly = parseHiringSalary('Estimated Hourly Pay Range $55 — $65 USD Verkada')
  assert.equal(hourly?.period, 'hour')
  assert.equal(hourly?.currency, 'USD')
  assert.equal(hourly?.min, 55)
  assert.equal(hourly?.max, 65)

  const annual = parseHiringSalary('Annual Salary: $405,000 — $485,000 USD')
  assert.equal(annual?.period, 'year')
  assert.equal(annual?.currency, 'USD')
  assert.equal(annual?.min, 405_000)
  assert.equal(annual?.max, 485_000)

  const vercel = parseHiringSalary('The San Francisco, CA base pay range for this role is $137,000.00 - $207,000.00. This salary range is an estimate. Actual salary will be based on job related skills, experience and location.')
  assert.equal(vercel?.currency, 'USD')
  assert.equal(vercel?.min, 137_000)
  assert.equal(vercel?.max, 207_000)
})

test('explicit positive visa sponsorship copy is preserved despite conditional wording', () => {
  const parsed = parseSharedHiringContext(
    "Visa sponsorship: We do sponsor visas! However, we aren't able to successfully sponsor visas for every role and every candidate.",
    { mode: 'vacancy' },
  )
  assert.ok(parsed.workAuthorization.includes('sponsorshipOffered'))
  assert.ok(!parsed.workAuthorization.includes('noSponsorship'))
})

test('salary conversion provides monthly estimates only for time-based periods', () => {
  assert.equal(convertSalaryPeriod(55, 'hour', 'month'), 8_800)
  assert.equal(convertSalaryPeriod(65, 'hour', 'month'), 10_400)
  assert.equal(convertSalaryPeriod(208_000, 'week', 'month'), 832_000)
  assert.equal(convertSalaryPeriod(341_000, 'day', 'month'), 6_820_000)
  assert.equal(convertSalaryPeriod(110_000, 'project', 'month'), undefined)
  assert.equal(convertSalaryPeriod(149_000, 'shift', 'month'), undefined)
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
