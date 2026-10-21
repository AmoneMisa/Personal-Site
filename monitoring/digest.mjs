// Daily metrics digest sent to Telegram through the subscription bot.
//
// Runs as the `metrics-digest` compose service from the frontend image (the
// Dockerfile copies this file next to .output). It sleeps until
// METRICS_DIGEST_HOUR_UTC, reads the last 24 hours from Umami's database and
// Prometheus, and sends one HTML message. `node monitoring/digest.mjs --now`
// sends a digest immediately and exits.
import { createRequire } from 'node:module'

// pg is bundled with the Nitro server output, not installed at /app.
const require = createRequire(new URL('../.output/server/index.mjs', import.meta.url))
const { Client } = require('pg')

const env = (name, fallback = '') => String(process.env[name] ?? fallback).trim()
const BOT_TOKEN = env('TELEGRAM_SUBSCRIPTION_BOT_TOKEN')
const CHAT_ID = env('TELEGRAM_METRICS_CHAT_ID')
const UMAMI_DATABASE_URL = env('UMAMI_DATABASE_URL')
const UMAMI_WEBSITE_ID = env('NUXT_PUBLIC_UMAMI_WEBSITE_ID')
const PROMETHEUS_URL = env('PROMETHEUS_URL', 'http://prometheus:9090').replace(/\/$/, '')
const HOUR_UTC = Math.min(23, Math.max(0, Number(env('METRICS_DIGEST_HOUR_UTC', '5')) || 0))

const escapeHtml = (value) => String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
const fmt = (value) => (Number.isFinite(value) ? Math.round(value).toLocaleString('ru-RU') : '—')

function change(current, previous) {
  if (!previous) return ''
  const pct = Math.round(((current - previous) / previous) * 100)
  return ` (${pct >= 0 ? '+' : ''}${pct}%)`
}

async function umamiSection() {
  if (!UMAMI_DATABASE_URL || !UMAMI_WEBSITE_ID) return ['<i>Umami is not configured.</i>']
  const client = new Client({ connectionString: UMAMI_DATABASE_URL })
  await client.connect()
  try {
    const q = (sql) => client.query(sql, [UMAMI_WEBSITE_ID]).then((r) => r.rows)
    const [totals] = await q(`
      select
        count(distinct session_id) filter (where created_at > now() - interval '24 hours') as visitors,
        count(*) filter (where created_at > now() - interval '24 hours') as views,
        count(distinct session_id) filter (where created_at <= now() - interval '24 hours') as prev_visitors,
        count(*) filter (where created_at <= now() - interval '24 hours') as prev_views
      from website_event
      where website_id = $1 and event_type = 1 and created_at > now() - interval '48 hours'`)
    const pages = await q(`
      select url_path, count(*) as n from website_event
      where website_id = $1 and event_type = 1 and created_at > now() - interval '24 hours'
      group by url_path order by n desc limit 5`)
    const referrers = await q(`
      select referrer_domain, count(distinct session_id) as n from website_event
      where website_id = $1 and event_type = 1 and created_at > now() - interval '24 hours'
        and referrer_domain is not null and referrer_domain <> '' and referrer_domain not like '%whiteslove.me'
      group by referrer_domain order by n desc limit 5`)
    const events = await q(`
      select event_name, count(*) as n from website_event
      where website_id = $1 and event_type = 2 and created_at > now() - interval '24 hours'
      group by event_name order by n desc limit 10`)

    const visitors = Number(totals.visitors)
    const views = Number(totals.views)
    const lines = [
      `👥 Visitors: <b>${fmt(visitors)}</b>${change(visitors, Number(totals.prev_visitors))}`,
      `📄 Page views: <b>${fmt(views)}</b>${change(views, Number(totals.prev_views))}`,
    ]
    if (pages.length) lines.push('', '<b>Top pages</b>', ...pages.map((r) => `• ${escapeHtml(r.url_path)} — ${fmt(Number(r.n))}`))
    if (referrers.length) lines.push('', '<b>Referrers</b>', ...referrers.map((r) => `• ${escapeHtml(r.referrer_domain)} — ${fmt(Number(r.n))}`))
    if (events.length) lines.push('', '<b>Events</b>', ...events.map((r) => `• ${escapeHtml(r.event_name)} — ${fmt(Number(r.n))}`))
    return lines
  } finally {
    await client.end()
  }
}

async function promQuery(query) {
  const url = `${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Prometheus HTTP ${response.status}`)
  const body = await response.json()
  return body.data.result.map((r) => ({ labels: r.metric, value: Number(r.value[1]) }))
}

const single = async (query) => (await promQuery(query))[0]?.value ?? NaN

async function prometheusSection() {
  const vital = (metric) => single(
    `histogram_quantile(0.75, sum by (le) (increase(site_web_vitals_milliseconds_bucket{metric="${metric}"}[24h])))`)
  const [lcp, inp, cls, samples, requests, errors5xx, upstream] = await Promise.all([
    vital('LCP'),
    vital('INP'),
    single('histogram_quantile(0.75, sum by (le) (increase(site_web_vitals_cls_bucket[24h])))'),
    single('sum(increase(site_web_vitals_milliseconds_count{metric="LCP"}[24h]))'),
    single('sum(increase(site_http_request_duration_seconds_count[24h]))'),
    promQuery('sum by (route) (increase(site_http_request_duration_seconds_count{status="5xx"}[24h])) > 0.5'),
    promQuery(`sum by (upstream) (increase(site_upstream_request_errors_total{upstream!="external"}[24h]))
      or sum by (upstream) (increase(site_upstream_request_duration_seconds_count{status="5xx", upstream!="external"}[24h]))`),
  ])

  const mark = (value, good, poor) => (!Number.isFinite(value) ? '' : value <= good ? ' 🟢' : value <= poor ? ' 🟡' : ' 🔴')
  const lines = [
    '<b>Web Vitals (p75)</b>',
    `• LCP ${fmt(lcp)} ms${mark(lcp, 2500, 4000)} · INP ${fmt(inp)} ms${mark(inp, 200, 500)} · CLS ${Number.isFinite(cls) ? cls.toFixed(2) : '—'}${mark(cls, 0.1, 0.25)}`,
    `• from ${fmt(samples)} page loads`,
    '',
    `<b>Server</b>: ${fmt(requests)} requests`,
  ]
  const failing = errors5xx.filter((r) => r.value >= 1)
  lines.push(failing.length
    ? `• 5xx: ${failing.map((r) => `${escapeHtml(r.labels.route)} ${fmt(r.value)}`).join(', ')}`
    : '• 5xx: none')
  const upstreamFailing = upstream.filter((r) => r.value >= 1)
  lines.push(upstreamFailing.length
    ? `• Upstream errors: ${upstreamFailing.map((r) => `${escapeHtml(r.labels.upstream)} ${fmt(r.value)}`).join(', ')}`
    : '• Upstream errors: none')
  return lines
}

async function section(name, build) {
  try {
    return await build()
  } catch (error) {
    console.error(`[metrics-digest] ${name} failed:`, error)
    return [`<i>${name} unavailable: ${escapeHtml(error?.message || error)}</i>`]
  }
}

async function sendDigest() {
  const day = new Date().toISOString().slice(0, 10)
  const text = [
    `📊 <b>whiteslove.me — ${day}</b>`,
    '<i>Last 24 hours</i>',
    '',
    ...(await section('Umami', umamiSection)),
    '',
    ...(await section('Prometheus', prometheusSection)),
  ].join('\n')

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}: ${await response.text()}`)
  console.log(`[metrics-digest] sent digest for ${day}`)
}

function msUntilNextRun(now = new Date()) {
  const next = new Date(now)
  next.setUTCHours(HOUR_UTC, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next - now
}

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('[metrics-digest] TELEGRAM_SUBSCRIPTION_BOT_TOKEN and TELEGRAM_METRICS_CHAT_ID are required')
  process.exit(1)
}

if (process.argv.includes('--now')) {
  await sendDigest()
} else {
  for (;;) {
    const wait = msUntilNextRun()
    console.log(`[metrics-digest] next digest in ${Math.round(wait / 60_000)} min`)
    await new Promise((resolve) => setTimeout(resolve, wait))
    await sendDigest().catch((error) => console.error('[metrics-digest] send failed:', error))
  }
}
