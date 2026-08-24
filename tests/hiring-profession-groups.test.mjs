import assert from 'node:assert/strict'
import test from 'node:test'

import {
  collapseHiringProfessionFilterValues,
  expandHiringProfessionFilters,
  normalizeHiringProfessionFilterSelections,
} from '../shared/hiringProfessionGroups.ts'

test('distinct professions stay individually selectable', () => {
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Frontend Developer', 'Backend Developer', 'Mobile Developer']),
    ['Frontend Developer', 'Backend Developer', 'Mobile Developer'],
  )
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Accountant', 'Chief Accountant', 'Finance / Banking Specialist']),
    ['Accountant', 'Chief Accountant', 'Finance / Banking Specialist'],
  )
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Waiter', 'Barista', 'Cook / Chef']),
    ['Waiter', 'Barista', 'Cook / Chef'],
  )
})

test('filter option normalization only removes duplicates', () => {
  assert.deepEqual(
    collapseHiringProfessionFilterValues(['Frontend Developer', 'Frontend Developer', 'Backend Developer']),
    ['Frontend Developer', 'Backend Developer'],
  )
})

test('legacy grouped links expand into explicit multi-select values', () => {
  assert.deepEqual(
    normalizeHiringProfessionFilterSelections(['group:software-development']),
    ['Full-stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile Developer', 'Software Developer'],
  )

  const support = expandHiringProfessionFilters(['group:support-contact-center'])
  assert.ok(support.includes('Customer Support'))
  assert.ok(support.includes('Chat Operator'))
  assert.ok(support.includes('Call Center Operator'))
})

test('multiple explicit professions remain an OR-search list', () => {
  assert.deepEqual(
    expandHiringProfessionFilters(['Frontend Developer', 'Mobile Developer']),
    ['Frontend Developer', 'Mobile Developer'],
  )
})
