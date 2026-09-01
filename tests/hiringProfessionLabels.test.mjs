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

test('unknown backend values pass through without client-side interpretation', () => {
  assert.equal(hiringProfessionLabel('Backend-owned role', 'ru'), 'Backend-owned role')
  assert.equal(hiringProfessionLabel('Backend-owned role', 'en'), 'Backend-owned role')
})
