import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { filterAndPaginate } from '../server/utils/aggregate.ts'
import { ALL_SOURCES } from '../server/utils/jobTypes.ts'

const NOW = new Date().toISOString()

function job(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: 'Frontend Developer',
    company: 'Example',
    location: 'Tashkent, UZ',
    url: overrides.url || `https://example.test/${Math.random()}`,
    source: 'linkedin',
    remote: false,
    tags: [],
    postedAt: NOW,
    country: 'UZ',
    city: 'Tashkent',
    workMode: 'office',
    relocation: 'unknown',
    skillDetails: [],
    niceToHaveDetails: [],
    languages: [],
    skills: [],
    niceToHave: [],
    ...overrides,
  }
}

function query(overrides = {}) {
  return {
    q: '',
    location: '',
    sources: ['linkedin', 'facebook', 'threads'],
    sort: 'date',
    maxAgeDays: 14,
    page: 1,
    pageSize: 20,
    countries: [],
    cities: [],
    excludeLanguages: [],
    skills: [],
    hideRiskyIndustries: true,
    ...overrides,
  }
}

test('LinkedIn, Facebook and Threads are first-class Job Finder sources', () => {
  assert.ok(ALL_SOURCES.includes('linkedin'))
  assert.ok(ALL_SOURCES.includes('facebook'))
  assert.ok(ALL_SOURCES.includes('threads'))

  const linkedinSource = readFileSync(new URL('../server/utils/linkedinSource.ts', import.meta.url), 'utf8')
  assert.match(linkedinSource, /source:\s*'linkedin'/u)
  assert.doesNotMatch(linkedinSource, /source:\s*'companies'/u)

  const refresh = readFileSync(new URL('../server/utils/jobsSourceRefresh.ts', import.meta.url), 'utf8')
  assert.match(refresh, /linkedin:\s*fetchLinkedInJobs/u)
  assert.match(refresh, /facebook:\s*fetchFacebookJobs/u)
  assert.match(refresh, /threads:\s*fetchThreadsJobs/u)
})

test('only-with-salary is a real backend filter for social vacancies too', () => {
  const result = filterAndPaginate([
    job({ id: 'with-pay', url: 'https://example.test/with-pay', salaryMin: 1800, salaryMax: 2400, salaryUsd: 25_200 }),
    job({ id: 'without-pay', url: 'https://example.test/without-pay' }),
  ], query({ hasSalary: true }))

  assert.equal(result.total, 1)
  assert.equal(result.jobs[0]?.id, 'with-pay')
})

test('salary sort remains explicitly high to low', () => {
  const result = filterAndPaginate([
    job({ id: 'lower', url: 'https://example.test/lower', salaryMin: 1000, salaryUsd: 12_000 }),
    job({ id: 'higher', url: 'https://example.test/higher', salaryMin: 3000, salaryUsd: 36_000 }),
  ], query({ sort: 'salary' }))

  assert.deepEqual(result.jobs.map((item) => item.id), ['higher', 'lower'])
})

test('jobs toolbar exposes social pills and keeps salary control near search on desktop', () => {
  const plugin = readFileSync(new URL('../app/plugins/jobs-controls.client.ts', import.meta.url), 'utf8')
  for (const source of ['LinkedIn', 'Facebook', 'Threads']) assert.match(plugin, new RegExp(source))
  assert.match(plugin, /sortTitle:\s*'Заголовок А–Я'/u)
  assert.match(plugin, /sortSalary:\s*'Зарплата: больше → меньше'/u)
  assert.match(plugin, /grid-template-columns:\s*minmax\(420px, 760px\) 280px 220px/u)
  assert.doesNotMatch(plugin, /node\.textContent\s*=/u)
})

test('Facebook and Threads use public social fetcher with candidate rejection and bounded timeouts', () => {
  const source = readFileSync(new URL('../server/utils/socialJobSources.ts', import.meta.url), 'utf8')
  assert.match(source, /HIRING_SOCIAL_API_URL/u)
  assert.match(source, /QUEUE_INTERNAL_KEY/u)
  assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*22_000/u)
  assert.match(source, /VACANCY_RE/u)
  assert.match(source, /CANDIDATE_RE/u)
  assert.match(source, /!VACANCY_RE\.test\(text\)\s*\|\|\s*CANDIDATE_RE\.test\(text\)/u)
})
