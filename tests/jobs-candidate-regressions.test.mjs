import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { sanitizeFetchedJob } from '../server/utils/jobsSourceRefresh.ts'

test('embedded ad-loader code never reaches vacancy descriptions or enrichment', () => {
  const job = {
    id: 'ish-bor-1',
    title: 'Savdo vakili',
    company: 'ish-bor.uz employer',
    location: 'Tashkent, Uzbekistan',
    url: 'https://ish-bor.uz/ru/ishlar/id/1',
    source: 'companies',
    remote: false,
    tags: ['ish-bor.uz', 'Uzbekistan'],
    postedAt: '2026-08-22T10:00:00.000Z',
    description: 'Savdo vakili - 💵: Savdodan 4% dan 10% gacha. + bonuslar | Вакансии, Вакансия, работа, работа в ташкенте window.yaContextCb=window.yaContextCb||[] window.yaContextCb.push(() => { Ya.Context.AdvManager.render({ blockId: "R-A-516590-29" }) }) JSON',
  }

  const cleaned = sanitizeFetchedJob(job)
  assert.equal(cleaned.description, 'Savdo vakili - 💵: Savdodan 4% dan 10% gacha. + bonuslar')
  assert.doesNotMatch(cleaned.description || '', /window\.yaContextCb|Ya\.Context|JSON/u)
})

test('ish-bor registration-only detail text falls back to the vacancy title', () => {
  const job = {
    id: 'ish-bor-2',
    title: 'Savdo vakili',
    company: 'ish-bor.uz employer',
    location: 'Uzbekistan',
    url: 'https://ish-bor.uz/ru/ishlar/id/2',
    source: 'companies',
    remote: false,
    tags: ['ish-bor.uz'],
    postedAt: '2026-08-22T10:00:00.000Z',
    description: 'Регистрация 22.08.2026 49 0 window.yaContextCb.push(() => { yandex_rtb_R-A-516590-5 JSON })',
  }

  assert.equal(sanitizeFetchedJob(job).description, 'Savdo vakili')
})

test('UzJobs backfill no longer stops on a page with zero recent visits', () => {
  const source = readFileSync(new URL('../server/utils/hiringUzJobsSource.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /recent\.length\s*===\s*0/u)
  assert.match(source, /legacyPrematureComplete/u)
  assert.match(source, /backfillPage:\s*bootstrapComplete[\s\S]*?MAX_INDEX_PAGE\s*\+\s*1/u)
  assert.match(source, /FETCH_CONCURRENCY\s*=\s*4/u)
})
