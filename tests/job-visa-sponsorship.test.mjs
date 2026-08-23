import assert from 'node:assert/strict'
import test from 'node:test'

import {
  keepUsaForeignerCandidate,
  TEMPORARY_WORK_AUTH_RE,
  visaSponsorshipStatus,
} from '../server/utils/jobVisaSponsorship.ts'

function job(overrides = {}) {
  return {
    title: 'Software Engineer',
    description: '',
    tags: [],
    ...overrides,
  }
}

test('explicit sponsorship wording is accepted', () => {
  const posting = job({ description: 'We will sponsor eligible candidates for an H-1B visa.' })
  assert.equal(visaSponsorshipStatus(posting), 'explicit')
  assert.equal(keepUsaForeignerCandidate(posting), true)
})

test('explicit negative wording wins over sponsor history', () => {
  const posting = job({
    description: 'Candidates must be authorized to work in the United States without current or future sponsorship.',
    sponsorshipConfidence: 'historical',
    sponsorshipEvidence: ['Employer has prior H-1B filings'],
  })
  assert.equal(visaSponsorshipStatus(posting), 'not_offered')
  assert.equal(keepUsaForeignerCandidate(posting), false)
})

test('generic work authorization alone remains unknown', () => {
  const posting = job({ description: 'Candidates must be legally authorized to work in the United States.' })
  assert.equal(visaSponsorshipStatus(posting), 'unknown')
  assert.equal(keepUsaForeignerCandidate(posting), true)
})

test('historical sponsor feed is kept but not promoted to explicit', () => {
  const posting = job({
    sponsorshipConfidence: 'historical',
    sponsorshipEvidence: ['Employer has H-1B sponsorship history'],
  })
  assert.equal(visaSponsorshipStatus(posting), 'historical')
  assert.equal(keepUsaForeignerCandidate(posting), true)
})

test('unknown sponsorship is kept for broad USA foreigner filter', () => {
  const posting = job({ description: 'Build reliable distributed systems with our platform team.' })
  assert.equal(visaSponsorshipStatus(posting), 'unknown')
  assert.equal(keepUsaForeignerCandidate(posting), true)
})

test('OPT/CPT/STEM OPT alone is not treated as H-1B sponsorship', () => {
  const posting = job({ description: 'Applicants on STEM OPT or CPT are welcome to apply.' })
  assert.equal(TEMPORARY_WORK_AUTH_RE.test(posting.description), true)
  assert.equal(visaSponsorshipStatus(posting), 'unknown')
})

test('verified visa-board metadata is kept', () => {
  const posting = job({ sponsorshipConfidence: 'verified' })
  assert.equal(visaSponsorshipStatus(posting), 'verified')
  assert.equal(keepUsaForeignerCandidate(posting), true)
})
