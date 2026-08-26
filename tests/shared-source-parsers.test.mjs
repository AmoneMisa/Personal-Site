import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { buildSecondaryProfile, parseSecondaryChipSalary } from '../server/hiring/sources/secondary/profile.ts'
import { contacts } from '../shared/hiring/webFields.ts'
import { parseIshBorMetaSalary } from '../shared/hiring/ishBorProfile.ts'

test('web source contacts normalize local phones with source country context', () => {
  assert.deepEqual(
    contacts('Телефон: 095 082 01 03, Telegram: t.me/maria_jobs', 'UA'),
    { phone: '+380950820103', telegram: '@maria_jobs' },
  )
})

test('secondary sources use the shared salary and contact parsers', () => {
  assert.deepEqual(parseSecondaryChipSalary('1200 CAD'), {
    salaryMin: 1200,
    salaryMax: 1200,
    currency: 'CAD',
  })

  const profile = buildSecondaryProfile({
    key: 'novarobota-ua',
    country: 'UA',
    label: 'Test source',
    id: '1',
    role: 'Frontend Developer',
    activity: '2026-08-26T00:00:00.000Z',
    url: 'https://example.com/cv/1',
    text: 'Шукаю роботу Frontend Developer. Телефон: 095 082 01 03. Бажана зарплата 1200 CAD.',
    salaryCurrency: 'UAH',
  })

  assert.equal(profile.contacts?.phone, '+380950820103')
  assert.equal(profile.currency, 'CAD')
  assert.equal(profile.salaryMin, 1200)
  assert.equal(profile.salaryMax, 1200)
})

test('social hiring sources delegate contact parsing to the shared package', async () => {
  const source = await readFile(new URL('../server/hiring/sources/socialRefresh.ts', import.meta.url), 'utf8')
  assert.match(source, /extractCandidateContacts\(text, country\)/u)
  assert.match(source, /contacts\(text, target\.country\)/u)
  assert.doesNotMatch(source, /const phone = text\.match/u)
  assert.doesNotMatch(source, /const telegram = text\.match/u)
})

test('IshBor meta salary delegates amount, multiplier and currency parsing to the shared parser', async () => {
  assert.deepEqual(
    parseIshBorMetaSalary('<meta name="description" content="Frontend developer 💵: 12 mln so\'m. Tashkent">'),
    { salaryMin: 12_000_000, salaryMax: 12_000_000, currency: 'UZS' },
  )
  assert.deepEqual(
    parseIshBorMetaSalary('<meta name="description" content="Frontend developer 💵: $1,500. Tashkent">'),
    { salaryMin: 1500, salaryMax: 1500, currency: 'USD' },
  )

  const source = await readFile(new URL('../shared/hiring/ishBorProfile.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /const usd =/u)
  assert.doesNotMatch(source, /const millions =/u)
})
