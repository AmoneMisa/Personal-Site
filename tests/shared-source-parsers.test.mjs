import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSecondaryProfile, parseSecondaryChipSalary } from '../server/hiring/sources/secondary/profile.ts'
import { contacts } from '../shared/hiring/webFields.ts'

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
