// Source adapters. Each fetches from a job API/feed and normalizes to Job[].
// Failures in one source never break the others (handled by the route).

import { XMLParser } from 'fast-xml-parser'
import type { Job } from './jobTypes'

const UA = 'jobFinder/1.0 (job aggregator; contact: admin@whiteslove.me)'

function stripHtml(html: string | undefined | null): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Kept long enough that skill/requirement keywords further down a posting
// (e.g. a "Nice to have" or tools list) still reach the enrichment + ATS scan.
// The UI clamps the card to a few lines, so this only affects matching, not layout.
const DESC_MAX = 4000

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return (await res.json()) as T
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.text()
}

// ---------- Remotive (no key) ----------
export async function fetchRemotive(q: string): Promise<Job[]> {
  const url = `https://remotive.com/api/remote-jobs${q ? `?search=${encodeURIComponent(q)}` : ''}`
  const data = await fetchJson<{ jobs: any[] }>(url)
  return (data.jobs || []).map((j) => ({
    id: `remotive-${j.id}`,
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    url: j.url,
    source: 'remotive' as const,
    remote: true,
    tags: (j.tags || []).slice(0, 8),
    postedAt: new Date(j.publication_date).toISOString(),
    employmentType: j.job_type || undefined,
    description: stripHtml(j.description).slice(0, DESC_MAX),
  }))
}

// ---------- RemoteOK (no key) ----------
export async function fetchRemoteOk(_q: string): Promise<Job[]> {
  const data = await fetchJson<any[]>('https://remoteok.com/api')
  return (data || [])
    .filter((j) => j && j.id && j.position)
    .map((j) => ({
      id: `remoteok-${j.id}`,
      title: j.position,
      company: j.company || 'Unknown',
      location: j.location || 'Remote',
      url: j.url || `https://remoteok.com/remote-jobs/${j.slug || j.id}`,
      source: 'remoteok' as const,
      remote: true,
      tags: (j.tags || []).slice(0, 8),
      postedAt: j.date ? new Date(j.date).toISOString() : new Date().toISOString(),
      salaryMin: typeof j.salary_min === 'number' ? j.salary_min : undefined,
      salaryMax: typeof j.salary_max === 'number' ? j.salary_max : undefined,
      salaryCurrency: j.salary_min ? 'USD' : undefined,
      description: stripHtml(j.description).slice(0, DESC_MAX),
    }))
}

// ---------- Arbeitnow (no key) ----------
export async function fetchArbeitnow(_q: string): Promise<Job[]> {
  const data = await fetchJson<{ data: any[] }>('https://www.arbeitnow.com/api/job-board-api')
  return (data.data || []).map((j) => ({
    id: `arbeitnow-${j.slug}`,
    title: j.title,
    company: j.company_name,
    location: j.location || (j.remote ? 'Remote' : 'Unknown'),
    url: j.url,
    source: 'arbeitnow' as const,
    remote: !!j.remote,
    tags: [...(j.tags || []), ...(j.job_types || [])].slice(0, 8),
    postedAt: new Date((j.created_at || 0) * 1000).toISOString(),
    employmentType: (j.job_types || [])[0],
    description: stripHtml(j.description).slice(0, DESC_MAX),
  }))
}

// ---------- HeadHunter / hh (no key) ----------
// Docs: https://api.hh.ru/openapi . Requires a User-Agent header.
// Tuned for CIS: fetches CIS countries and deliberately EXCLUDES Russia (113)
// and Belarus (16). Area ids (verified via api.hh.ru/areas/countries):
// 5=Ukraine, 40=Kazakhstan, 9=Azerbaijan, 28=Georgia, 97=Uzbekistan,
// 13=Armenia, 48=Kyrgyzstan, 62=Moldova, 86=Tajikistan, 93=Turkmenistan.
// Override with HH_AREAS="5,40,..." (or legacy HH_AREA).
const HH_CIS_AREAS = ['5', '40', '9', '28', '97', '13', '48', '62', '86', '93']

function hhAreas(): string[] {
  const env = process.env.HH_AREAS || process.env.HH_AREA
  const list = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : HH_CIS_AREAS
  // Never query Russia (113) or Belarus (16), even if configured.
  return list.filter((a) => a !== '113' && a !== '16')
}

async function fetchHhArea(area: string, q: string): Promise<Job[]> {
  const params = new URLSearchParams({
    per_page: '50',
    order_by: 'publication_time',
    period: '14', // last 14 days
    area,
  })
  if (q) params.set('text', q)
  const data = await fetchJson<{ items: any[] }>(`https://api.hh.ru/vacancies?${params}`)
  return (data.items || []).map((j) => {
    const snippet = [j.snippet?.requirement, j.snippet?.responsibility].filter(Boolean).join(' ')
    return {
      id: `hh-${j.id}`,
      title: j.name,
      company: j.employer?.name || 'Unknown',
      location: j.area?.name || 'Unknown',
      url: j.alternate_url || j.url,
      source: 'headhunter' as const,
      remote: j.schedule?.id === 'remote',
      tags: j.professional_roles?.map((r: any) => r.name).slice(0, 6) || [],
      postedAt: new Date(j.published_at).toISOString(),
      employmentType: j.employment?.name,
      salaryMin: j.salary?.from ?? undefined,
      salaryMax: j.salary?.to ?? undefined,
      salaryCurrency: j.salary?.currency ?? undefined,
      description: stripHtml(snippet).slice(0, DESC_MAX),
    }
  })
}

export async function fetchHeadHunter(q: string): Promise<Job[]> {
  const results = await Promise.all(
    hhAreas().map((area) =>
      fetchHhArea(area, q).catch((err) => {
        console.error(`[jobs] hh area ${area} failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
  )
  return results.flat()
}

// ---------- The Muse (no key; optional MUSE_API_KEY) ----------
export async function fetchTheMuse(q: string): Promise<Job[]> {
  const key = process.env.MUSE_API_KEY
  const jobs: Job[] = []
  for (let page = 0; page < 2; page++) {
    const params = new URLSearchParams({ page: String(page), descending: 'true' })
    if (q) params.set('category', q)
    if (key) params.set('api_key', key)
    const data = await fetchJson<{ results: any[] }>(`https://www.themuse.com/api/public/jobs?${params}`)
    for (const j of data.results || []) {
      const locations = (j.locations || []).map((l: any) => l.name)
      jobs.push({
        id: `themuse-${j.id}`,
        title: j.name,
        company: j.company?.name || 'Unknown',
        location: locations.join(', ') || 'Unknown',
        url: j.refs?.landing_page || '',
        source: 'themuse',
        remote: locations.some((l: string) => /remote|flexible/i.test(l)),
        tags: (j.categories || []).map((c: any) => c.name).slice(0, 6),
        postedAt: new Date(j.publication_date).toISOString(),
        employmentType: j.type,
        description: stripHtml(j.contents).slice(0, DESC_MAX),
      })
    }
    if (!data.results || data.results.length === 0) break
  }
  return jobs
}

// ---------- Jobicy (no key) ----------
export async function fetchJobicy(_q: string): Promise<Job[]> {
  const data = await fetchJson<{ jobs: any[] }>('https://jobicy.com/api/v2/remote-jobs?count=50')
  return (data.jobs || []).map((j) => ({
    id: `jobicy-${j.id}`,
    title: j.jobTitle,
    company: j.companyName || 'Unknown',
    location: j.jobGeo || 'Remote',
    url: j.url,
    source: 'jobicy' as const,
    remote: true,
    tags: [j.jobIndustry, j.jobLevel].flat().filter(Boolean).slice(0, 6),
    postedAt: j.pubDate ? new Date(j.pubDate).toISOString() : new Date().toISOString(),
    employmentType: Array.isArray(j.jobType) ? j.jobType[0] : j.jobType,
    description: stripHtml(j.jobExcerpt || j.jobDescription).slice(0, DESC_MAX),
  }))
}

// ---------- Adzuna (env: ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_COUNTRY) ----------
export async function fetchAdzuna(q: string): Promise<Job[]> {
  const id = process.env.ADZUNA_APP_ID
  const key = process.env.ADZUNA_APP_KEY
  if (!id || !key) return []
  const country = process.env.ADZUNA_COUNTRY || 'pl'
  const params = new URLSearchParams({
    app_id: id,
    app_key: key,
    results_per_page: '50',
    max_days_old: '14',
    sort_by: 'date',
  })
  if (q) params.set('what', q)
  const data = await fetchJson<{ results: any[] }>(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params}`,
  )
  return (data.results || []).map((j) => ({
    id: `adzuna-${j.id}`,
    title: j.title,
    company: j.company?.display_name || 'Unknown',
    location: j.location?.display_name || 'Unknown',
    url: j.redirect_url,
    source: 'adzuna' as const,
    remote: /remote/i.test(j.title + ' ' + (j.location?.display_name || '')),
    tags: j.category?.label ? [j.category.label] : [],
    postedAt: new Date(j.created).toISOString(),
    employmentType: j.contract_time,
    salaryMin: j.salary_min ?? undefined,
    salaryMax: j.salary_max ?? undefined,
    salaryCurrency: j.salary_min ? (country.toUpperCase() === 'PL' ? 'PLN' : 'USD') : undefined,
    description: stripHtml(j.description).slice(0, DESC_MAX),
  }))
}

// ---------- Jooble (env: JOOBLE_KEY, optional JOOBLE_LOCATION) ----------
// Default location tuned for Ukraine (Jooble originates in Ukraine, strong UA coverage).
export async function fetchJooble(q: string): Promise<Job[]> {
  const key = process.env.JOOBLE_KEY
  if (!key) return []
  const body = JSON.stringify({
    keywords: q || 'developer',
    location: process.env.JOOBLE_LOCATION || 'Ukraine',
  })
  const data = await fetchJson<{ jobs: any[] }>(`https://jooble.org/api/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return (data.jobs || []).map((j, i) => ({
    id: `jooble-${j.id || i}-${Date.parse(j.updated || '') || i}`,
    title: j.title,
    company: j.company || 'Unknown',
    location: j.location || 'Unknown',
    url: j.link,
    source: 'jooble' as const,
    remote: /remote/i.test(j.title + ' ' + (j.location || '')),
    tags: j.type ? [j.type] : [],
    postedAt: j.updated ? new Date(j.updated).toISOString() : new Date().toISOString(),
    description: stripHtml(j.snippet).slice(0, DESC_MAX),
  }))
}

// ---------- Company career sites (Greenhouse + Lever + SmartRecruiters APIs) ----
// Many famous companies (incl. game studios) publish their careers pages through
// Greenhouse, Lever or SmartRecruiters, all of which expose a free, official JSON
// API — no scraping. Configure the boards you want; sensible defaults ship built-in.
// NB: custom career sites (most banks/telecoms) have no such API and can't be added.
//   GREENHOUSE_BOARDS="airbnb,figma"            (board tokens; optional "token:Label")
//   LEVER_COMPANIES="ajax,easybrain"            (lever handles; optional "handle:Label")
//   SMARTRECRUITERS_COMPANIES="Wise,Canva"      (SR identifiers; optional "id:Label")
// Set COMPANIES_SOURCE=off to disable, or COMPANIES_DEFAULTS=off to drop the seed list.
// Seeds below were verified (2026-07) to return live postings via their public API.
const DEFAULT_GREENHOUSE = [
  'airbnb:Airbnb', 'adyen:Adyen', 'anthropic:Anthropic', 'asana:Asana', 'block:Block',
  'brex:Brex', 'canonical:Canonical', 'cloudflare:Cloudflare', 'coinbase:Coinbase',
  'coupang:Coupang', 'datadog:Datadog', 'deepmind:DeepMind', 'discord:Discord',
  'dropbox:Dropbox', 'elastic:Elastic', 'fastly:Fastly', 'figma:Figma', 'fxpro:FxPro',
  'gitlab:GitLab', 'grafanalabs:Grafana Labs', 'gusto:Gusto', 'hellofresh:HelloFresh',
  'instacart:Instacart', 'jetbrains:JetBrains', 'lucidmotors:Lucid Motors', 'lyft:Lyft',
  'mongodb:MongoDB', 'monzo:Monzo', 'netlify:Netlify', 'newrelic:New Relic', 'reddit:Reddit',
  'roblox:Roblox', 'scaleai:Scale AI', 'skyscanner:Skyscanner', 'smartsheet:Smartsheet',
  'tripadvisor:Tripadvisor', 'twilio:Twilio', 'twitch:Twitch', 'zscaler:Zscaler',
  // marketplaces / mobility / fintech
  'stockx:StockX', 'getyourguide:GetYourGuide', 'careem:Careem', 'shein:SHEIN',
  'wallapop:Wallapop', 'mirakl:Mirakl', 'cabify:Cabify', 'bird:Bird', 'n26:N26',
  'trustpilot:Trustpilot', 'sumup:SumUp',
].join(',')
const DEFAULT_LEVER = [
  'ajax:Ajax Systems', 'easybrain:Easybrain', 'trendyol:Trendyol',
  'vestiairecollective:Vestiaire Collective', 'qonto:Qonto',
].join(',')
const DEFAULT_SMARTRECRUITERS = [
  'DeliveryHero:Delivery Hero', 'Wise:Wise', 'Canva:Canva', 'ASOS:ASOS',
  'ByteDance:ByteDance', 'Joom:Joom', 'Uber:Uber', 'Wayfair:Wayfair',
  'Grab:Grab', 'BigCommerce:BigCommerce', 'Omio:Omio',
].join(',')

function prettyLabel(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1)
}

// Parse "token,token:Label" env lists into {handle, label} pairs.
function parseBoards(raw: string): { handle: string; label: string }[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [handle = '', label] = entry.split(':')
      return { handle: handle.trim(), label: (label || prettyLabel(handle)).trim() }
    })
    .filter((b) => b.handle)
}

const SEED_BY_KIND = {
  greenhouse: DEFAULT_GREENHOUSE,
  lever: DEFAULT_LEVER,
  smartrecruiters: DEFAULT_SMARTRECRUITERS,
} as const
const ENV_BY_KIND = {
  greenhouse: 'GREENHOUSE_BOARDS',
  lever: 'LEVER_COMPANIES',
  smartrecruiters: 'SMARTRECRUITERS_COMPANIES',
} as const

function companyBoards(kind: keyof typeof SEED_BY_KIND): { handle: string; label: string }[] {
  const seed = process.env.COMPANIES_DEFAULTS === 'off' ? '' : SEED_BY_KIND[kind]
  const env = process.env[ENV_BY_KIND[kind]]
  return parseBoards([seed, env || ''].filter(Boolean).join(','))
}

async function fetchGreenhouseBoard(handle: string, label: string): Promise<Job[]> {
  const data = await fetchJson<{ jobs: any[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(handle)}/jobs?content=true`,
  )
  return (data.jobs || []).map((j) => {
    const loc = j.location?.name || 'See listing'
    return {
      id: `companies-gh-${handle}-${j.id}`,
      title: j.title,
      company: label,
      location: loc,
      url: j.absolute_url,
      source: 'companies' as const,
      remote: /remote|anywhere|distributed/i.test(`${j.title} ${loc}`),
      tags: [label],
      postedAt: new Date(j.updated_at || Date.now()).toISOString(),
      description: stripHtml(j.content).slice(0, DESC_MAX),
    }
  })
}

async function fetchLeverBoard(handle: string, label: string): Promise<Job[]> {
  const data = await fetchJson<any[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(handle)}?mode=json`,
  )
  return (data || []).map((j) => {
    const loc = j.categories?.location || 'See listing'
    return {
      id: `companies-lever-${handle}-${j.id}`,
      title: j.text,
      company: label,
      location: loc,
      url: j.hostedUrl,
      source: 'companies' as const,
      remote: /remote|anywhere|distributed/i.test(`${j.text} ${loc}`),
      tags: [label, j.categories?.team].filter(Boolean),
      postedAt: new Date(j.createdAt || Date.now()).toISOString(),
      employmentType: j.categories?.commitment,
      description: stripHtml(j.descriptionPlain || j.description).slice(0, DESC_MAX),
    }
  })
}

// SmartRecruiters exposes a public postings list (no auth). It returns metadata
// only (no description body) — enough for title/company/location/date; enrich.ts
// still derives skills/country from the title. We take up to 100 recent postings.
async function fetchSmartRecruitersBoard(handle: string, label: string): Promise<Job[]> {
  const data = await fetchJson<{ content: any[] }>(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(handle)}/postings?limit=100`,
  )
  return (data.content || []).map((j) => {
    const loc = j.location?.fullLocation
      || [j.location?.city, j.location?.country?.toUpperCase()].filter(Boolean).join(', ')
      || 'See listing'
    return {
      id: `companies-sr-${handle}-${j.id}`,
      title: j.name,
      company: j.company?.name || label,
      location: loc,
      url: `https://jobs.smartrecruiters.com/${handle}/${j.id}`,
      source: 'companies' as const,
      remote: j.location?.remote === true || /remote|anywhere|distributed/i.test(`${j.name} ${loc}`),
      tags: [label, j.function?.label, j.industry?.label].filter(Boolean),
      postedAt: new Date(j.releasedDate || Date.now()).toISOString(),
      employmentType: j.typeOfEmployment?.label,
    }
  })
}

export async function fetchCompanies(q: string): Promise<Job[]> {
  if (process.env.COMPANIES_SOURCE === 'off') return []
  const tasks: Promise<Job[]>[] = [
    ...companyBoards('greenhouse').map((b) =>
      fetchGreenhouseBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] greenhouse "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...companyBoards('lever').map((b) =>
      fetchLeverBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] lever "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...companyBoards('smartrecruiters').map((b) =>
      fetchSmartRecruitersBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] smartrecruiters "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
  ]
  const all = (await Promise.all(tasks)).flat()
  // These boards have no server-side search, so filter locally when a query is set.
  if (!q) return all
  const needle = q.toLowerCase()
  return all.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(needle))
}

// ---------- Generic RSS (env: RSS_FEEDS = "label|url,label|url") ----------
// Ships with a built-in Ukraine feed (DOU.ua) so UA vacancies work with no config.
// Add more via RSS_FEEDS for niche boards (VueJobs, WeWorkRemotely, etc.), e.g.:
//   RSS_FEEDS="vuejobs|https://vuejobs.com/feed"
// Set RSS_DEFAULTS=off to disable the built-in feeds.
const DEFAULT_RSS_FEEDS = 'dou.ua|https://jobs.dou.ua/vacancies/feeds/'

export async function fetchRss(q: string): Promise<Job[]> {
  const parts: string[] = []
  if (process.env.RSS_DEFAULTS !== 'off') parts.push(DEFAULT_RSS_FEEDS)
  if (process.env.RSS_FEEDS) parts.push(process.env.RSS_FEEDS)
  const raw = parts.join(',')
  if (!raw) return []
  const parser = new XMLParser({ ignoreAttributes: false })
  const feeds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, url] = entry.split('|')
      return { label: (label || 'rss').trim(), url: (url || '').trim() }
    })
    .filter((f) => f.url)

  const all: Job[] = []
  for (const feed of feeds) {
    try {
      const xml = await fetchText(feed.url)
      const parsed = parser.parse(xml)
      const items = parsed?.rss?.channel?.item || parsed?.feed?.entry || []
      const list = Array.isArray(items) ? items : [items]
      for (const it of list) {
        const link = typeof it.link === 'object' ? it.link['@_href'] || it.link['#text'] : it.link
        const title = typeof it.title === 'object' ? it.title['#text'] : it.title
        const dateStr = it.pubDate || it.published || it.updated
        all.push({
          id: `rss-${feed.label}-${it.guid?.['#text'] || it.guid || link || title}`,
          title: String(title || 'Untitled'),
          company: it['dc:creator'] || feed.label,
          location: 'See listing',
          url: String(link || ''),
          source: 'rss',
          remote: /remote/i.test(String(title || '')),
          tags: [feed.label],
          postedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          description: stripHtml(it.description || it.summary || it.content).slice(0, DESC_MAX),
        })
      }
    } catch (err) {
      console.error(`[jobs] rss "${feed.label}" failed:`, (err as Error).message)
    }
  }
  // Basic client-style filter since generic feeds don't support search.
  if (!q) return all
  const needle = q.toLowerCase()
  return all.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(needle))
}
