import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { filterAndPaginate } from '../server/utils/aggregate.ts'
import { compactSalaryText } from '../app/utils/search/money.ts'

const postedAt = new Date().toISOString()
const base = {
  company: 'Example',
  tags: [],
  postedAt,
  description: '',
  salaryCurrency: 'USD',
  salaryPeriod: 'year',
  niceToHaveDetails: [],
  skills: [],
  niceToHave: [],
  suspicious: false,
}

const jobs = [
  {
    ...base,
    id: 'front-1',
    title: 'Senior Frontend Engineer - Commerce',
    location: 'New York, US',
    url: 'https://example.com/front-1',
    source: 'linkedin',
    remote: false,
    country: 'US',
    city: 'New York',
    workMode: 'hybrid',
    relocation: 'offered',
    employmentKind: 'fulltime',
    salaryUsd: 120_000,
    salaryMin: 120_000,
    experienceMinYears: 3,
    languages: [{ language: 'English', level: 'B2' }],
    skillDetails: [{ name: 'React', category: 'IT', subcategory: 'Frontend' }],
  },
  {
    ...base,
    id: 'front-2',
    title: 'Frontend Developer',
    location: 'San Francisco, US',
    url: 'https://example.com/front-2',
    source: 'linkedin',
    remote: true,
    country: 'US',
    city: 'San Francisco',
    workMode: 'remote',
    relocation: 'none',
    employmentKind: 'fulltime',
    salaryUsd: 100_000,
    salaryMin: 100_000,
    experienceMinYears: 1,
    languages: [{ language: 'English', level: 'B2' }],
    skillDetails: [{ name: 'Vue', category: 'IT', subcategory: 'Frontend' }],
  },
  {
    ...base,
    id: 'back-1',
    title: 'Junior Backend Developer',
    location: 'Tashkent, UZ',
    url: 'https://example.com/back-1',
    source: 'threads',
    remote: false,
    country: 'UZ',
    city: 'Tashkent',
    workMode: 'office',
    relocation: 'unknown',
    employmentKind: 'contract',
    salaryUsd: 36_000,
    salaryMin: 36_000,
    noExperience: true,
    languages: [{ language: 'Russian' }],
    skillDetails: [{ name: 'Node.js', category: 'IT', subcategory: 'Backend' }],
  },
]

const query = {
  q: '',
  location: '',
  sources: ['linkedin', 'threads'],
  sort: 'date',
  maxAgeDays: 14,
  page: 1,
  pageSize: 20,
  countries: [],
  cities: [],
  excludeLanguages: [],
  skills: [],
}

test('job statistics cover platform, relocation, work mode, employment, language, experience and profession geography', () => {
  const { stats } = filterAndPaginate(jobs, query)

  assert.equal(stats.salary.medianUsd, 100_000)
  assert.deepEqual(stats.bySource.linkedin, { count: 2, salaryCount: 2, medianUsd: 110_000 })
  assert.deepEqual(stats.bySource.threads, { count: 1, salaryCount: 1, medianUsd: 36_000 })
  assert.equal(stats.byWorkMode.hybrid, 1)
  assert.equal(stats.byWorkMode.remote, 1)
  assert.equal(stats.byWorkMode.office, 1)
  assert.equal(stats.byRelocation.offered, 1)
  assert.equal(stats.byRelocation.none, 1)
  assert.equal(stats.byRelocation.unknown, 1)
  assert.equal(stats.byEmploymentKind.fulltime, 2)
  assert.equal(stats.byEmploymentKind.contract, 1)
  assert.equal(stats.byLanguage.English, 2)
  assert.equal(stats.byLanguage.Russian, 1)
  assert.equal(stats.experience.noExperience, 1)
  assert.equal(stats.experience.upToOne, 1)
  assert.equal(stats.experience.oneToThree, 1)
  assert.equal(stats.experience.medianYears, 1)

  const frontend = stats.byProfession.find((item) => item.profession === 'Frontend')
  assert.ok(frontend)
  assert.equal(frontend.count, 2)
  assert.equal(frontend.medianUsd, 110_000)
  assert.equal(frontend.medianExperienceYears, 2)
  assert.deepEqual(
    frontend.geographies.find((item) => item.kind === 'country' && item.key === 'US'),
    { kind: 'country', key: 'US', count: 2, salaryCount: 2, medianUsd: 110_000 },
  )
  assert.ok(stats.salaryTrend.every((point) => point.profession))
})

test('salary card text compacts large amounts and Russian period labels without changing the full source string', () => {
  const annual = '$174,000–352,500/год'
  const monthly = '≈ $14,500–29,300/месяц'
  const annualCode = '130,000–280,000 USD/год'
  assert.equal(compactSalaryText(annual), '$174K–352.5K/г.')
  assert.equal(compactSalaryText(monthly), '≈ $14.5K–29.3K/м.')
  assert.equal(compactSalaryText(annualCode), '$130K–280K/г.')
  assert.equal(annual, '$174,000–352,500/год')
  assert.equal(monthly, '≈ $14,500–29,300/месяц')
  assert.equal(annualCode, '130,000–280,000 USD/год')
})

test('listing cards expose only save/hide actions while detail views keep source/share flows', () => {
  const jobCard = readFileSync(new URL('../app/components/jobs/JobCard.vue', import.meta.url), 'utf8')
  const jobGrid = readFileSync(new URL('../app/components/jobs/JobGrid.vue', import.meta.url), 'utf8')
  const statsPanel = readFileSync(new URL('../app/components/jobs/StatsPanel.vue', import.meta.url), 'utf8')
  const flatCard = readFileSync(new URL('../app/components/flats/FlatCard.vue', import.meta.url), 'utf8')
  const jobsPage = readFileSync(new URL('../app/pages/jobs/index.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(jobCard, /i-lucide-share-2/u)
  assert.doesNotMatch(jobCard, /i-lucide-external-link/u)
  assert.doesNotMatch(flatCard, /i-lucide-share-2/u)
  assert.doesNotMatch(flatCard, /i-lucide-external-link/u)
  assert.match(jobCard, /i-lucide-heart/u)
  assert.match(jobCard, /i-lucide-eye/u)
  assert.match(jobCard, /job-card__head-side/u)
  assert.match(jobCard, /job-card__bottom/u)
  assert.match(jobGrid, /align-items:\s*stretch/u)
  assert.match(jobGrid, /job-card__salary-separator[^}]*display:\s*none/su)
  assert.match(statsPanel, /nonProfessionLabels[^\n]*soft skills/u)
  assert.ok(statsPanel.indexOf('stats__card_skills') < statsPanel.indexOf('stats__card_languages'))
  assert.match(jobsPage, /shareActiveJob/u)
  assert.match(jobsPage, /t\("openSource"\)/u)
})
