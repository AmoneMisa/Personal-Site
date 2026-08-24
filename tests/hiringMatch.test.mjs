import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalHiringSkill,
  scoreHiringCandidate,
  tagMatchesHiringFilters,
} from '../app/utils/hiringMatch.ts'

test('candidate match is absent without role or skill criteria', () => {
  assert.equal(scoreHiringCandidate(
    { professions: ['Salesperson'], skills: ['1C'] },
    { professions: [], skills: [] },
  ), null)
})

test('candidate match scores selected roles and canonical skill aliases independently', () => {
  const match = scoreHiringCandidate(
    { professions: ['Salesperson'], skills: ['1С:Предприятие', 'Customer Service'] },
    { professions: ['Salesperson', 'Cashier'], skills: ['1c'] },
  )

  assert.ok(match)
  assert.equal(match.matched, 2)
  assert.equal(match.total, 3)
  assert.equal(match.score, 67)
  assert.equal(tagMatchesHiringFilters('1С:Предприятие', match), true)
  assert.equal(tagMatchesHiringFilters('Customer Service', match), false)
})

test('grouped profession filters match any canonical group member', () => {
  const match = scoreHiringCandidate(
    { professions: ['Cashier'] },
    { professions: ['group:retail-service'], skills: [] },
  )

  assert.ok(match)
  assert.equal(match.score, 100)
  assert.equal(canonicalHiringSkill('1С'), '1C')
})
