import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseFlagmaVacancies,
  parseFlagmaVacancyDetail,
} from '../server/utils/extraPublicJobSources.ts'
import {
  FLAGMA_JOB_BOARDS,
  FLAGMA_JOB_BOARD_TARGET_PREFIX,
  configuredFlagmaJobBoardTargets,
  isFlagmaJobBoardTarget,
} from '../server/utils/flagmaJobSource.ts'

const summary = {
  id: 'flagma-22245',
  title: 'Оператор чата (удалённо)',
  company: 'Flagma UZ',
  location: 'Ташкент',
  url: 'https://flagma.uz/ru/vakansiya-operator-chata-udalyonno-rv22245.html',
  source: 'companies',
  remote: true,
  tags: ['Flagma UZ', 'UZ'],
  postedAt: '2026-08-19T00:00:00.000Z',
}

const detailHtml = `
<html><head>
  <link rel="canonical" href="https://flagma.uz/ru/vakansiya-operator-chata-udalyonno-rv22245.html">
</head><body>
  <script type="application/ld+json">{
    "@type": "JobPosting",
    "title": "Оператор чата (удалённо)",
    "datePosted": "2026-08-19",
    "employmentType": "REMOTE"
  }</script>
  <h1>Оператор чата (удалённо) в Ташкенте</h1>
  <span itemprop="value" content="7500000">7 500 000</span>
  <span itemprop="currency" content="UZS">сум</span>
  <div id="company-title"><a href="/ru/3087633/"><span>OydinYo‘l, ООО</span></a><span class="terr">Ташкент, UZ</span></div>
  <div id="description-box"><div id="description"><h2>Описание вакансии</h2><div id="description-text">
    <h3>Мы предлагаем:</h3><ul><li>График на выбор 3/2, 4/2, 5/2</li></ul>
    <h3>Чем предстоит заниматься:</h3><ul><li>Вести переписку с клиентами в чатах</li><li>Отвечать по готовым скриптам</li></ul>
  </div></div></div>
  <div class="desc-bottom">Номер вакансии: 22245</div>
  <script>adsbygoogle.push({ navigation: true })</script>
</body></html>`

test('Flagma has one durable jobs-worker queue target per national board', () => {
  const targets = configuredFlagmaJobBoardTargets()
  assert.deepEqual(targets, [
    `${FLAGMA_JOB_BOARD_TARGET_PREFIX}ro`,
    `${FLAGMA_JOB_BOARD_TARGET_PREFIX}uz`,
  ])
  assert.equal(targets.length, FLAGMA_JOB_BOARDS.length)
  assert.ok(targets.every((target) => isFlagmaJobBoardTarget(target)))
})

test('Flagma list parser reads vacancy cards for the shared crawler', () => {
  const html = `
  <article>
    <a href="https://flagma.uz/ru/vakansiya-operator-chata-udalyonno-rv22245.html">Оператор чата (удалённо)</a>
    <div>OydinYo‘l, ООО | Ташкент, UZ</div>
    <div>в Ташкенте, удаленно</div>
  </article>`
  const jobs = parseFlagmaVacancies(html, FLAGMA_JOB_BOARDS[1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].id, 'flagma-22245')
  assert.equal(jobs[0].title, 'Оператор чата (удалённо)')
  assert.equal(jobs[0].remote, true)
  assert.match(jobs[0].url, /-rv22245\.html$/)
})

test('Flagma detail parser reads authoritative vacancy fields without related cards or ads', () => {
  const job = parseFlagmaVacancyDetail(detailHtml, summary)
  assert.ok(job)
  assert.equal(job.title, 'Оператор чата (удалённо)')
  assert.equal(job.company, 'OydinYo‘l, ООО')
  assert.equal(job.location, 'Ташкент, UZ')
  assert.equal(job.salaryMin, 7500000)
  assert.equal(job.salaryMax, 7500000)
  assert.equal(job.salaryCurrency, 'UZS')
  assert.equal(job.employmentType, 'REMOTE')
  assert.match(job.description || '', /Вести переписку с клиентами/)
  assert.doesNotMatch(job.description || '', /Номер вакансии|adsbygoogle/)
})

test('Flagma detail parser rejects a captcha or generic shell', () => {
  assert.equal(parseFlagmaVacancyDetail('<html><title>Flagma</title><div>reCAPTCHA</div></html>', summary), null)
})
