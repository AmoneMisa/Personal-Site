import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { rumPageLabel, statusClass, upstreamLabel } from '../server/utils/siteMetrics.ts'
import { LEGAL_CONTENT } from '../shared/legal/legalContent.ts'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('Web Vitals page labels accept route names only and stay bounded', () => {
  assert.equal(rumPageLabel('flat-finder-slug'), 'flat-finder-slug')
  assert.equal(rumPageLabel('/jobs?q=secret'), 'other')
  assert.equal(rumPageLabel(42), 'other')
  for (let i = 0; i < 200; i += 1) rumPageLabel(`spam-${i}`)
  assert.equal(rumPageLabel('never-seen-before'), 'other')
  assert.equal(rumPageLabel('flat-finder-slug'), 'flat-finder-slug')
})

test('status and upstream labels have a fixed value set', () => {
  assert.equal(statusClass(204), '2xx')
  assert.equal(statusClass(503), '5xx')
  assert.equal(statusClass(0), 'other')
  process.env.FLAT_API_URL = 'http://flats-api:4000'
  assert.equal(upstreamLabel('http://flats-api:4000'), 'flatApi')
  assert.equal(upstreamLabel('https://tile.openstreetmap.org'), 'external')
})

test('metrics, stats proxy and tracker stay closed until configured', async () => {
  const [metrics, stats, umami] = await Promise.all([
    read('../server/routes/metrics.get.ts'),
    read('../server/routes/stats/[...path].ts'),
    read('../app/plugins/umami.ts'),
  ])
  assert.match(metrics, /if \(!expected\) throw createError\(\{ statusCode: 404 \}\)/)
  assert.match(metrics, /timingSafeEqual/)
  assert.match(stats, /'script\.js': 'GET'/)
  assert.match(stats, /'api\/send': 'POST'/)
  assert.doesNotMatch(stats, /api\/(auth|websites|users)/)
  assert.match(umami, /if \(!websiteId\) return/)
  assert.match(umami, /'data-exclude-search': 'true'/)
})

test('legal pages disclose the cookieless visit statistics', () => {
  for (const locale of ['ru', 'en']) {
    const cookies = JSON.stringify(LEGAL_CONTENT[locale].cookies)
    const privacy = JSON.stringify(LEGAL_CONTENT[locale].privacy)
    assert.match(cookies, /Umami/u)
    assert.match(privacy, locale === 'ru' ? /Статистика посещаемости/u : /Visit and site-speed statistics/u)
  }
})

test('the 90-day visit statistics retention is both promised and enforced', async () => {
  const [sql, compose] = await Promise.all([read('../scripts/umami-retention.sql'), read('../docker-compose.yml')])
  assert.match(JSON.stringify(LEGAL_CONTENT.ru.privacy), /Статистика посещений — 90 дней/u)
  assert.match(JSON.stringify(LEGAL_CONTENT.en.privacy), /Visit statistics — 90 days/u)
  for (const table of ['event_data', 'website_event', 'session_data']) {
    assert.ok(sql.includes(`DELETE FROM ${table} WHERE created_at < now() - interval '90 days'`), table)
  }
  assert.match(compose, /umami-retention\.sql:\/retention\.sql:ro/)
})
