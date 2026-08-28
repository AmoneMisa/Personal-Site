import assert from 'node:assert/strict'
import test from 'node:test'

import { enrichJob } from '../server/utils/enrich.ts'

function baseJob(overrides = {}) {
  return {
    id: 'test-1',
    title: 'Software Engineer',
    company: 'Acme',
    location: 'Remote',
    url: 'https://example.com/job',
    source: 'companies',
    remote: true,
    tags: [],
    postedAt: new Date().toISOString(),
    ...overrides,
  }
}

test('multiple office cities in the vacancy text become officeLocations', () => {
  // The shared lexicon's city catalog is CIS/Europe-focused and doesn't yet
  // cover most US cities (only New York and London among US/UK cities as of
  // 0.2.14) — use cities it does recognize to exercise the wiring itself.
  const job = enrichJob(baseJob({
    location: 'New York, London, or Berlin',
    description: 'This role can be based in our New York, London, or Berlin offices.',
  }))
  assert.ok(job.officeLocations && job.officeLocations.length > 1, JSON.stringify(job.officeLocations))
  assert.ok(job.officeLocations.includes('New York'))
})

test('a single-city vacancy does not get an officeLocations array', () => {
  const job = enrichJob(baseJob({
    location: 'Berlin',
    description: 'This role is based in our Berlin office.',
  }))
  assert.equal(job.officeLocations, undefined)
})

test('Mercor-style funding figure elsewhere in a long posting does not leak into the salary', () => {
  const description = `${'We are building the future of AI-powered hiring. '.repeat(6)}
Our company recently raised $100M in Series C funding at a $2B valuation, and we are growing fast.
${'We work with leading AI labs and enterprises around the world. '.repeat(6)}
Compensation: base salary of $120,000 - $150,000 per year, plus equity.
${'Join our fully remote, globally distributed team. '.repeat(6)}`
  const job = enrichJob(baseJob({ description }))
  assert.equal(job.salaryMin, 120_000)
  assert.equal(job.salaryMax, 150_000)
  assert.equal(job.salaryCurrency, 'USD')
})
