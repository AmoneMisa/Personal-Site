import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { buildHiringStatistics } from '../shared/hiringStatistics.ts'
import { canonicalCityValue, cityDisplayLabel } from '../shared/locationCatalog.ts'
import { normalizeProfessions } from '../server/utils/hiringNormalize.ts'

const now = Date.parse('2026-08-24T12:00:00.000Z')

test('candidate statistics aggregate the full filtered set and merge city aliases', () => {
  const profiles = [
    {
      country: 'UZ', city: 'Tashkent', gender: 'female', createdAt: '2026-08-01T00:00:00.000Z',
      activityAt: '2026-08-23T10:00:00.000Z', salaryMin: 1000, currency: 'USD', experienceYears: 1,
      sourceLabel: 'Telegram', age: 22, professions: ['Waiter'], role: 'Waiter',
    },
    {
      country: 'UZ', city: 'Ташкент', gender: 'male', createdAt: '2026-08-02T00:00:00.000Z',
      activityAt: '2026-08-23T15:00:00.000Z', salaryMax: 2000, currency: 'USD', experienceYears: 3,
      sourceLabel: 'IshBor', age: 31, professions: ['Frontend Developer', 'Chief Technology Officer'], role: 'Chief Technology Officer',
    },
    {
      country: 'UZ', city: 'Toshkent', createdAt: '2026-08-03T00:00:00.000Z',
      activityAt: '2026-08-24T08:00:00.000Z', sourceLabel: 'Telegram', age: null,
      professions: ['Sales Manager', 'Chief Executive Officer'], role: 'Chief Executive Officer',
    },
  ]

  const statistics = buildHiringStatistics(profiles, {
    provider: (profile) => profile.sourceLabel,
    toUsd: (amount) => amount,
    now,
  })

  assert.deepEqual(statistics.locations, [{ label: 'Tashkent', value: 3 }])
  assert.deepEqual(statistics.genders, { female: 1, male: 1, unknown: 1 })
  assert.deepEqual(statistics.ages.filter((item) => item.value), [
    { label: '18–24', value: 1 }, { label: '25–34', value: 1 }, { label: '__unknown__', value: 1 },
  ])
  assert.deepEqual(statistics.platforms, [{ label: 'Telegram', value: 2 }, { label: 'IshBor', value: 1 }])
  assert.deepEqual(statistics.sectors.slice(0, 4), [
    { label: 'management', value: 2 }, { label: 'horeca', value: 1 },
    { label: 'it', value: 1 }, { label: 'sales-retail', value: 1 },
  ])
  assert.deepEqual(statistics.activity, [{ date: '2026-08-23', value: 2 }, { date: '2026-08-24', value: 1 }])
  assert.equal(statistics.salarySamples, 2)
  assert.equal(statistics.salaryByExperience[0], 1000)
  assert.equal(statistics.salaryByExperience[1], 2000)
})

test('CEO and CTO remain distinct canonical hiring professions', () => {
  assert.deepEqual(normalizeProfessions('CEO', 'CEO, chief executive officer'), ['Chief Executive Officer'])
  assert.deepEqual(normalizeProfessions('CTO', 'CTO, chief technology officer'), ['Chief Technology Officer'])
})

test('one location catalog supplies canonical and localized city names across boards', () => {
  assert.equal(canonicalCityValue('Ташкент'), 'Tashkent')
  assert.equal(canonicalCityValue('Toshkent'), 'Tashkent')
  assert.equal(cityDisplayLabel('Tashkent', 'ru'), 'Ташкент')
  assert.equal(cityDisplayLabel('Ташкент', 'en'), 'Tashkent')
})

test('hiring feed returns server statistics instead of page-only client sampling', () => {
  const route = readFileSync(new URL('../server/routes/hiring-feed.get.ts', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../app/components/hiring/StatsPanel.vue', import.meta.url), 'utf8')
  assert.match(route, /statistics:\s*buildHiringStatistics\(statisticsProfiles/u)
  assert.match(panel, /props\.statistics \|\| localStatistics\.value/u)
  assert.match(panel, /experienceSalaryBars/u)
  assert.match(panel, /<UiAnalyticsBars v-if="experienceSalaryBars.length" :items="experienceSalaryBars"/u)
  assert.match(panel, /statsNoSalaryData/u)
})

test('hiring and flats share one UA/UZ regional default without selecting every country', () => {
  const helper = readFileSync(new URL('../app/utils/search/regionalCountry.ts', import.meta.url), 'utf8')
  const hiringMeta = readFileSync(new URL('../app/composables/hiring/useHiringMeta.ts', import.meta.url), 'utf8')
  const hiringPage = readFileSync(new URL('../app/pages/hiring/index.vue', import.meta.url), 'utf8')
  const flatPage = readFileSync(new URL('../app/pages/flat-finder/index.vue', import.meta.url), 'utf8')
  assert.match(helper, /timeZone\.startsWith\("Asia\/"\) \? "UZ" : "UA"/u)
  assert.doesNotMatch(hiringMeta, /data\.map\(\(country\) => country\.code\)/u)
  assert.match(hiringPage, /regionalSearchCountry/u)
  assert.match(flatPage, /regionalSearchCountry/u)
})
