import assert from 'node:assert/strict'
import test from 'node:test'

import { hiringProfessionLabel } from '../shared/hiringProfessionLabels.ts'

test('specialized technical professions stay in English in Russian UI', () => {
  assert.equal(hiringProfessionLabel('Data Scientist', 'ru'), 'Data Scientist')
  assert.equal(hiringProfessionLabel('Penetration Tester', 'ru'), 'Pentester')
  assert.equal(hiringProfessionLabel('Data Engineer', 'ru'), 'Data Engineer')
  assert.equal(hiringProfessionLabel('AI / ML Engineer', 'ru'), 'AI / ML Engineer')
  assert.equal(hiringProfessionLabel('Frontend Developer', 'ru'), 'Frontend Developer')
  assert.equal(hiringProfessionLabel('QA Engineer', 'ru'), 'QA Engineer')
  assert.equal(hiringProfessionLabel('DevOps Engineer', 'ru'), 'DevOps Engineer')
})

test('raw Uzbek and typo-heavy resume roles get a normalized display label', () => {
  assert.equal(hiringProfessionLabel('iqtsodchi', 'ru'), 'Экономист')
  assert.equal(hiringProfessionLabel('Iqtisodiy', 'ru'), 'Экономист')
  assert.equal(hiringProfessionLabel('Logist', 'ru'), 'Логист')
  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'ru'), 'Преподаватель английского')
  assert.equal(hiringProfessionLabel('Mobilagraf ITishnik pdf faylla frontet', 'ru'), 'Frontend Developer')
  assert.equal(hiringProfessionLabel('Farqi yo qande ish bulsa hm, bolalarga qarash menga yoqadi', 'ru'), 'Няня')
  assert.equal(hiringProfessionLabel('Onlayn', 'ru'), 'Любая работа')
})

test('the same raw roles have useful English labels', () => {
  assert.equal(hiringProfessionLabel('iqtisodchi', 'en'), 'Economist')
  assert.equal(hiringProfessionLabel('Logist', 'en'), 'Logistics Specialist')
  assert.equal(hiringProfessionLabel('Ingliz tili ustoziman', 'en'), 'English Teacher')
  assert.equal(hiringProfessionLabel('Onlayn', 'en'), 'Any role')
})
