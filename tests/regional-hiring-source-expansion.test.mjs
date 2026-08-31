import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const CANDIDATE_KEYS = [
  'resume-uz',
  'enbek-kz',
  'hh-kz',
  'newjob-kg',
  'hh-kg',
  'robota-ua',
  'jobsua',
  'bestjobs-ro',
]

const VACANCY_KEYS = [
  'resume-uz-vacancies',
  'enbek-kz-vacancies',
  'qsamruk-kz-vacancies',
  'newjob-kg-vacancies',
  'ekyzmat-kg-vacancies',
  'ejobs-ro-vacancies',
  'bestjobs-ro-vacancies',
  'hipo-ro-vacancies',
]

const FALLBACK_HOSTS = [
  'resume.uz',
  'enbek.kz',
  'hh.kz',
  'qsamruk.kz',
  'newjob.kg',
  'headhunter.kg',
  'kyzmat.gov.kg',
  'ejobs.ro',
  'bestjobs.eu',
  'hipo.ro',
]

test('regional public candidate boards are scheduled through the existing CV pipeline', async () => {
  const metadata = await read('shared/hiring/sources/webCvSources.ts')
  const adapters = await read('server/hiring/sources/web/regionalPublicBoards.ts')
  const refresh = await read('server/hiring/sources/webCvRefresh.ts')
  const common = await read('server/hiring/sources/web/common.ts')

  for (const key of CANDIDATE_KEYS) {
    assert.match(metadata, new RegExp(`key: ['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), key)
    assert.match(adapters, new RegExp(`key: ['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), key)
  }

  assert.match(refresh, /isRegionalPublicCvSource/)
  assert.match(refresh, /crawlRegionalPublicCv/)
  assert.match(common, /contactType: hasDirect \? 'direct' : 'platform'/)
  assert.match(common, /block\.href/)
})

test('candidate integrations never attempt recruiter login or gated contact reveal', async () => {
  const adapters = await read('server/hiring/sources/web/regionalPublicBoards.ts')
  const crawler = await read('server/hiring/sources/web/crawler.ts')

  assert.doesNotMatch(adapters, /login|sign[-_ ]?in|password|unlock|reveal|showContact|contactDetails|authorization|cookie/i)
  assert.doesNotMatch(crawler, /login|password|authorization|cookie/i)
})

test('regional vacancy boards are isolated under the companies fan-out', async () => {
  const boards = await read('server/utils/regionalJobBoardSources.ts')
  const fetchers = await read('server/utils/jobSourceFetchers.ts')

  for (const key of VACANCY_KEYS) {
    assert.match(boards, new RegExp(`key: ['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), key)
  }
  assert.match(fetchers, /fetchRegionalJobBoardJobs/)
  assert.match(fetchers, /regional-job-boards/)
  assert.match(boards, /Promise\.allSettled/)
})

test('HH public API covers UZ, KZ and KG without changing the UZ stable id', async () => {
  const hh = await read('server/utils/hhJobSource.ts')

  assert.match(hh, /country: 'UZ'.*area: '2759'.*host: 'hh\.uz'/)
  assert.match(hh, /country: 'KZ'.*area: '40'.*host: 'hh\.kz'/)
  assert.match(hh, /country: 'KG'.*area: '48'.*host: 'headhunter\.kg'/)
  assert.match(hh, /target\.country === 'UZ' \? `hh-\$\{id\}`/)
  assert.match(hh, /host: target\.host/)
})

test('browser impersonation fallback allowlists every new regional board on both sides', async () => {
  const worker = await read('jobs-worker/worker.ts')
  const sidecar = await read('job-browser-fetcher/app.py')

  for (const host of FALLBACK_HOSTS) {
    assert.ok(worker.includes(`'${host}'`), `worker missing ${host}`)
    assert.ok(sidecar.includes(`"${host}"`), `sidecar missing ${host}`)
  }
})

test('source-specific index-card extraction remains part of the common CV crawler', async () => {
  const common = await read('server/hiring/sources/web/common.ts')
  const crawler = await read('server/hiring/sources/web/crawler.ts')
  const audit = await read('server/hiring/sources/webAudit.ts')

  assert.match(common, /extractBlocks\?:/)
  assert.match(common, /export function candidateBlocks/)
  assert.match(crawler, /candidateBlocks\(html, source, page\)/)
  assert.match(audit, /candidateBlocks\(html, source, page\)/)
})
