import assert from 'node:assert/strict'
import test from 'node:test'

import { parseIshBorProfile } from '../shared/hiring/ishBorProfile.ts'

test('IshBor profile assembly stays runtime-neutral', () => {
  const summary = {
    url: 'https://ish-bor.uz/ru/ishchilar/id/118057',
    role: 'Kassir',
    text: 'Kassir\nToshkent',
  }
  const detailHtml = `
    <meta name="description" content="Kassir 💵: 4000000.">
    <h1>Kassir</h1>
    <iconify-icon icon="lucide:user"></iconify-icon><span>Hilola (Женщина)</span>
    <iconify-icon icon="lucide:map-pin"></iconify-icon><span>Toshkent</span>
    <iconify-icon icon="lucide:graduation-cap"></iconify-icon><span>Oliy</span>
    <iconify-icon icon="lucide:clock"></iconify-icon><span>1 год</span>
    <iconify-icon icon="lucide:calendar"></iconify-icon><span>23.08.2026</span>
  `

  const profile = parseIshBorProfile(summary, detailHtml, (candidate) => candidate)

  assert.ok(profile)
  assert.equal(profile.id, 'web-ishbor-uz-118057')
  assert.equal(profile.name, 'Hilola')
  assert.equal(profile.role, 'Kassir')
  assert.equal(profile.city, 'Tashkent')
  assert.equal(profile.experienceYears, 1)
  assert.equal(profile.salaryMin, 4_000_000)
  assert.equal(profile.currency, 'UZS')
  assert.equal(profile.contactType, 'platform')
})
