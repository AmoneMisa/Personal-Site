import assert from 'node:assert/strict'
import test from 'node:test'

import {
  detectDetailedJobSeniority,
  normalizeJobSeniority,
} from '../shared/jobs/jobSeniority.ts'

test('keeps principal, staff and lead as distinct levels', () => {
  assert.equal(detectDetailedJobSeniority('Principal Software Engineer'), 'principal')
  assert.equal(detectDetailedJobSeniority('Staff Frontend Engineer'), 'staff')
  assert.equal(detectDetailedJobSeniority('Lead Frontend Developer'), 'lead')
})

test('title seniority wins over unrelated description wording', () => {
  assert.equal(
    detectDetailedJobSeniority('Senior Frontend Engineer', 'You will mentor staff and lead projects.'),
    'senior',
  )
})

test('generic title can fall back to explicit description seniority', () => {
  assert.equal(
    detectDetailedJobSeniority('Software Engineer', 'As a Principal Software Engineer, you will own architecture.'),
    'principal',
  )
})

test('intern remains distinct from junior', () => {
  assert.equal(detectDetailedJobSeniority('Software Engineering Intern'), 'intern')
  assert.equal(detectDetailedJobSeniority('Junior Software Engineer'), 'junior')
})

test('normalizer corrects previously collapsed lead value', () => {
  const job = {
    id: '1',
    title: 'Principal Software Engineer',
    company: 'Example',
    location: 'USA',
    url: 'https://example.com/job',
    source: 'companies',
    remote: false,
    tags: [],
    postedAt: new Date().toISOString(),
    seniority: 'lead',
  }
  assert.equal(normalizeJobSeniority(job).seniority, 'principal')
})