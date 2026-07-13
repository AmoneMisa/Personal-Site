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

// Ukraine (5) and Uzbekistan (97) are pulled several pages deep so the feed
// carries their full breadth of professions — including non-IT roles — rather
// than only the newest ~50. Other CIS areas take a single page to stay light.
// Since the worker queries HH with an empty text, deeper paging = more industries.
// Depth is overridable via HH_PAGES (applies to the deep areas only).
const HH_DEEP_AREAS = new Set(['5', '97'])
const HH_PAGE_SIZE = 100 // HH allows up to 100 per page (max 2000 results / 20 pages)

function hhPages(area: string): number {
  const env = Number(process.env.HH_PAGES)
  const deep = Number.isFinite(env) && env > 0 ? Math.min(env, 20) : 5
  return HH_DEEP_AREAS.has(area) ? deep : 1
}

function hhAreas(): string[] {
  const env = process.env.HH_AREAS || process.env.HH_AREA
  const list = env ? env.split(',').map((s) => s.trim()).filter(Boolean) : HH_CIS_AREAS
  // Never query Russia (113) or Belarus (16), even if configured.
  return list.filter((a) => a !== '113' && a !== '16')
}

// HH closed anonymous access to /vacancies (the API now answers 403 "forbidden"
// without credentials — verified 2026-07). Register an app at https://dev.hh.ru,
// then set HH_TOKEN to the application token to re-enable this source.
function hhHeaders(): Record<string, string> {
  const token = process.env.HH_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchHhArea(area: string, q: string, page: number): Promise<Job[]> {
  const params = new URLSearchParams({
    per_page: String(HH_PAGE_SIZE),
    page: String(page),
    order_by: 'publication_time',
    period: '14', // last 14 days
    area,
  })
  if (q) params.set('text', q)
  const data = await fetchJson<{ items: any[] }>(`https://api.hh.ru/vacancies?${params}`, {
    headers: hhHeaders(),
  })
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
  const tasks: Promise<Job[]>[] = []
  let forbidden = 0
  for (const area of hhAreas()) {
    for (let page = 0; page < hhPages(area); page++) {
      tasks.push(
        fetchHhArea(area, q, page).catch((err) => {
          if (/-> 403/.test((err as Error).message)) forbidden++
          else console.error(`[jobs] hh area ${area} p${page} failed:`, (err as Error).message)
          return [] as Job[]
        }),
      )
    }
  }
  const results = await Promise.all(tasks)
  if (forbidden) {
    console.error(
      `[jobs] hh: ${forbidden} request(s) rejected with 403. HH requires authorization now — `
      + `register an app at https://dev.hh.ru and set HH_TOKEN${process.env.HH_TOKEN ? ' (current token was rejected)' : ''}.`,
    )
  }
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

// ---------- Company career sites (Greenhouse + Lever + SmartRecruiters + Ashby) --
// Many famous companies (incl. game studios) publish their careers pages through
// Greenhouse, Lever, SmartRecruiters or Ashby, all of which expose a free, official
// JSON API — no scraping. Configure the boards you want; sensible defaults ship in.
// NB: other career sites are handled by the CAREERS_PAGES HTML parser further down.
//   GREENHOUSE_BOARDS="airbnb,figma"            (board tokens; optional "token:Label")
//   LEVER_COMPANIES="ajax,easybrain"            (lever handles; optional "handle:Label")
//   SMARTRECRUITERS_COMPANIES="Wise,Canva"      (SR identifiers; optional "id:Label")
//   ASHBY_COMPANIES="openai,notion"             (ashby handles; optional "handle:Label")
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
  // verified 2026-07 batch: big tech / data / fintech / dev-tools
  'databricks:Databricks', 'stripe:Stripe', 'pinterest:Pinterest', 'robinhood:Robinhood',
  'samsara:Samsara', 'verkada:Verkada', 'wolt:Wolt', 'braze:Braze', 'celonis:Celonis',
  'affirm:Affirm', 'klaviyo:Klaviyo', 'doctolib:Doctolib', 'flexport:Flexport',
  'gongio:Gong', 'faire:Faire', 'chime:Chime', 'sofi:SoFi', 'vercel:Vercel',
  'temporaltechnologies:Temporal', 'bitpanda:Bitpanda', 'attentive:Attentive',
  'amplitude:Amplitude', 'mixpanel:Mixpanel', 'airtable:Airtable', 'betterment:Betterment',
  'raisin:Raisin', 'gocardless:GoCardless', 'dataiku:Dataiku', 'contentful:Contentful',
  'cockroachlabs:Cockroach Labs', 'gemini:Gemini', 'iterable:Iterable', 'squarespace:Squarespace',
  'yotpo:Yotpo', 'calendly:Calendly', 'labelbox:Labelbox', 'truelayer:TrueLayer',
  'planetscale:PlanetScale', 'consensys:ConsenSys',
  // AAA / big game studios (verified 2026-07)
  'riotgames:Riot Games', 'epicgames:Epic Games', 'rockstargames:Rockstar Games',
  'taketwo:Take-Two', 'krafton:KRAFTON', 'scopely:Scopely', 'peak:Peak Games',
  'wildlifestudios:Wildlife Studios', 'wooga:Wooga',
  // Ukraine: N-iX (IT services) + MHP (agri, non-IT)
  'nix:N-iX', 'mhp:MHP',
  'baidu:Baidu',
].join(',')
const DEFAULT_LEVER = [
  'ajax:Ajax Systems', 'easybrain:Easybrain', 'trendyol:Trendyol',
  'vestiairecollective:Vestiaire Collective', 'qonto:Qonto',
  // verified 2026-07
  'palantir:Palantir', 'spotify:Spotify', 'toptal:Toptal',
  // games + Ukraine IT
  'matchgroup:Match Group', 'dreamgames:Dream Games', 'jamcity:Jam City',
  'eleks:ELEKS', 'intellias:Intellias',
].join(',')
const DEFAULT_SMARTRECRUITERS = [
  'DeliveryHero:Delivery Hero', 'Wise:Wise', 'Canva:Canva', 'ASOS:ASOS',
  'ByteDance:ByteDance', 'Joom:Joom', 'Uber:Uber', 'Wayfair:Wayfair',
  'Grab:Grab', 'BigCommerce:BigCommerce', 'Omio:Omio', 'Gameloft:Gameloft',
].join(',')
// Ashby (api.ashbyhq.com) — public job-board API used by many modern AI/dev-tool
// companies. Handles verified 2026-07 to return live postings.
const DEFAULT_ASHBY = [
  'openai:OpenAI', 'harvey:Harvey', 'elevenlabs:ElevenLabs', 'sierra:Sierra',
  'notion:Notion', 'cohere:Cohere', 'ramp:Ramp', 'decagon:Decagon', 'vanta:Vanta',
  'cursor:Cursor', 'replit:Replit', 'perplexity:Perplexity', 'synthesia:Synthesia',
  'baseten:Baseten', 'mercor:Mercor', 'writer:Writer', 'benchling:Benchling',
  'supabase:Supabase', 'watershed:Watershed', 'sardine:Sardine', 'modal:Modal',
  'rho:Rho', 'linear:Linear', 'posthog:PostHog', 'railway:Railway', 'runway:Runway',
  // games + Ukraine IT/product (Genesis ecosystem)
  'voodoo:Voodoo', 'supercell:Supercell', 'preply:Preply', 'headway:Headway',
  'solidgate:Solidgate', 'genesis:Genesis', 'obrio:OBRIO', 'universe:Universe',
  'restream:Restream',
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
  ashby: DEFAULT_ASHBY,
} as const
const ENV_BY_KIND = {
  greenhouse: 'GREENHOUSE_BOARDS',
  lever: 'LEVER_COMPANIES',
  smartrecruiters: 'SMARTRECRUITERS_COMPANIES',
  ashby: 'ASHBY_COMPANIES',
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

// Ashby returns a full posting list (title/location/date + HTML description).
// workplaceType is "Remote"/"Hybrid"/"OnSite"; isRemote may be null.
async function fetchAshbyBoard(handle: string, label: string): Promise<Job[]> {
  const data = await fetchJson<{ jobs: any[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(handle)}`,
  )
  return (data.jobs || [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const loc = j.location
        || (j.secondaryLocations || []).map((l: any) => l.location).filter(Boolean).join(', ')
        || 'See listing'
      return {
        id: `companies-ashby-${handle}-${j.id}`,
        title: j.title,
        company: label,
        location: loc,
        url: j.jobUrl || j.applyUrl,
        source: 'companies' as const,
        remote:
          j.isRemote === true
          || /remote/i.test(j.workplaceType || '')
          || /remote|anywhere|distributed/i.test(`${j.title} ${loc}`),
        tags: [label, j.department, j.team].filter(Boolean),
        postedAt: new Date(j.publishedAt || Date.now()).toISOString(),
        employmentType: j.employmentType,
        description: stripHtml(j.descriptionPlain || j.descriptionHtml).slice(0, DESC_MAX),
      }
    })
}

// ---------- Company career pages (HTML parsing) ----------
// For companies whose careers site has no simple hosted ATS API. Each configured
// page's HTML is fetched once and parsed with a chain of strategies, first hit wins:
//   1. Phenom sites (phApp.ddo marker) -> POST <origin>/widgets, a public JSON API
//      that most Phenom career sites expose (DHL, Mastercard, Allianz, BCG, ...);
//      falls back to the ~10 jobs embedded in the /search-results page HTML.
//   2. Workday link on the page -> the public CXS JSON API of that tenant/site.
//   3. Embedded known-ATS links (Greenhouse/Lever/Ashby/SmartRecruiters) -> their API.
//   4. schema.org JSON-LD JobPosting blocks in the HTML.
//   5. Job-looking <a> anchors (works for Teamtailor-hosted pages and many custom lists).
// Configure with CAREERS_PAGES="Label|https://careers.example.com,Label2|https://..."
// (COMPANIES_DEFAULTS=off drops the seed list below; COMPANIES_SOURCE=off disables all).
// Seeds verified 2026-07 to yield jobs through one of the strategies above.
const DEFAULT_CAREERS_PAGES = [
  // Phenom-powered
  'DHL|https://careers.dhl.com/global/en',
  'Mastercard|https://careers.mastercard.com/us/en',
  'Allianz|https://careers.allianz.com/global/en',
  'BCG|https://careers.bcg.com/global/en',
  'Air Canada|https://careers.aircanada.com/ca/en',
  'Alight|https://careers.alight.com/us/en',
  'Fiserv|https://careers.fiserv.com/us/en',
  'FIS|https://careers.fisglobal.com/us/en',
  'Robert Half|https://careers.roberthalf.com/global/en',
  'Southwest Airlines|https://careers.southwestair.com/us/en',
  'Thales|https://careers.thalesgroup.com/global/en',
  'United Airlines|https://careers.united.com/us/en',
  'eBay|https://jobs.ebayinc.com/us/en',
  'Air Arabia|https://www.airarabiagroupcareers.com/gb/en',
  'RTX|https://careers.rtx.com/global/en',
  // Workday-powered (CXS API discovered from the page HTML)
  'Unilever|https://careers.unilever.com/en',
  'Nike|https://careers.nike.com/',
  'Expedia Group|https://careers.expediagroup.com/',
  'Home Depot|https://careers.homedepot.com/',
  'Linklaters|https://www.linklaters.com/careers',
  // Teamtailor-hosted (anchor parsing)
  'Voi|https://careers.voi.com/',
  'Moove|https://careers.moove.io/',
  'Savills|https://careers.savills.com/',
  // verified 2026-07-13 batch (out of ~540 user-suggested URLs, these parse):
  // big tech / enterprise / pharma
  'Cisco|https://careers.cisco.com/',
  'Adobe|https://careers.adobe.com/',
  'Red Hat|https://careers.redhat.com/',
  'Autodesk|https://careers.autodesk.com/',
  'Snowflake|https://careers.snowflake.com/',
  'Sophos|https://careers.sophos.com/',
  'Juniper Networks|https://careers.juniper.net/',
  'Analog Devices|https://careers.analog.com/',
  'Roche|https://careers.roche.com/',
  'Novartis|https://careers.novartis.com/',
  'Warner Bros. Discovery|https://careers.wbd.com/',
  'Zillow|https://careers.zillowgroup.com/',
  'NTT Data|https://www.nttdata.com/global/en/careers',
  'Rakuten|https://japan-job-en.rakuten.careers/search-jobs',
  'MUFG|https://www.mufg.jp/english/careers/',
  'Tencent|https://tencent.wd1.myworkdayjobs.com/Tencent_Careers',
  'BYD Europe|https://careers.bydeurope.com/',
  // game studios
  'Blizzard|https://careers.blizzard.com/',
  'Activision Blizzard|https://careers.activisionblizzard.com/',
  'CD Projekt Red|https://www.cdprojektred.com/en/jobs/',
  'King|https://careers.king.com/',
  'People Can Fly|https://careers.peoplecanfly.com/',
  'Embark Studios|https://careers.embark-studios.com/',
  'Crytek|https://www.crytek.com/career',
  'PlayStation|https://careers.playstation.com/',
  'Bungie|https://www.bungie.net/careers',
  // Ukraine IT
  'Boosta|https://boosta.biz/careers/',
  'SoftServe|https://career.softserveinc.com/en-us/vacancies',
  'Sigma Software|https://career.sigma.software/',
  'Levi9 Ukraine|https://jobs.ua.levi9.com/',
  'Ecommpay|https://careers.ecommpay.com/',
].join(',')

function careersPages(): { label: string; url: string }[] {
  const parts: string[] = []
  if (process.env.COMPANIES_DEFAULTS !== 'off') parts.push(DEFAULT_CAREERS_PAGES)
  if (process.env.CAREERS_PAGES) parts.push(process.env.CAREERS_PAGES)
  return parts
    .join(',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const i = entry.indexOf('|')
      const label = i > 0 ? entry.slice(0, i).trim() : ''
      const url = (i > 0 ? entry.slice(i + 1) : entry).trim()
      return { label, url }
    })
    .filter((p) => /^https?:\/\//.test(p.url))
    .map((p) => ({ url: p.url, label: p.label || new URL(p.url).hostname.replace(/^(careers|jobs|www)\./, '') }))
}

function pageJobId(pageUrl: string, unique: string): string {
  return `companies-page-${new URL(pageUrl).hostname}-${unique}`
}

// Some corporate career sites (e.g. Cushman & Wakefield) 403 non-browser agents,
// so page-HTML fetches use a browser-style UA. API-style endpoints keep the
// honest jobFinder UA above.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// Arbitrary company sites can hang for minutes; a slow page must not stall the
// whole refresh, so every career-page request gets a hard timeout.
const PAGE_TIMEOUT_MS = 25_000

async function fetchPageHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.text()
}

// --- Strategy 1: Phenom ---
// Locale segments in the path (/us/en, /global/en, /ca/en) drive the widget params.
function phenomParams(pageUrl: string): { country: string; lang: string } {
  const segs = new URL(pageUrl).pathname.split('/').filter(Boolean)
  for (let i = 0; i + 1 < segs.length; i++) {
    const c = segs[i]!
    const l = segs[i + 1]!
    if ((/^[a-z]{2}$/.test(c) || c === 'global') && /^[a-z]{2}$/.test(l)) {
      return { country: c, lang: `${l}_${c === 'global' ? 'global' : c}` }
    }
  }
  return { country: 'global', lang: 'en_global' }
}

function mapPhenomJob(j: any, pageUrl: string, label: string): Job {
  const location =
    (j.multi_location || []).join('; ') || j.cityStateCountry || j.location || j.country || 'See listing'
  return {
    id: pageJobId(pageUrl, String(j.jobSeqNo || j.jobId || j.reqId)),
    title: j.title,
    company: label,
    location,
    url: j.applyUrl || pageUrl,
    source: 'companies' as const,
    remote: /remote/i.test(`${j.title} ${location} ${j.workHours || ''}`),
    tags: [label, ...(j.multi_category || [])].filter(Boolean).slice(0, 6),
    postedAt: new Date(j.postedDate || j.dateCreated || Date.now()).toISOString(),
    employmentType: j.workHours || j.contractType1,
    description: stripHtml(j.descriptionTeaser).slice(0, DESC_MAX),
  }
}

async function fetchPhenomJobs(pageUrl: string, label: string): Promise<Job[]> {
  const { country, lang } = phenomParams(pageUrl)
  const body = {
    lang, country, deviceType: 'desktop', pageName: 'search-results', ddoKey: 'refineSearch',
    sortBy: 'Most recent', subsearch: '', from: 0, jobs: true, counts: true,
    all_fields: ['category', 'country', 'state', 'city', 'type'], size: 100, clearAll: false,
    jdsource: 'facets', isSliderEnable: false, pageId: 'page10', siteType: 'external',
    keywords: '', global: true, selected_fields: {}, locationData: {},
  }
  try {
    const data = await fetchJson<any>(`${new URL(pageUrl).origin}/widgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    const jobs = data?.refineSearch?.data?.jobs || []
    if (jobs.length) return jobs.map((j: any) => mapPhenomJob(j, pageUrl, label))
  } catch {
    /* fall through to the embedded-JSON fallback */
  }
  // Fallback: the search-results page embeds the first ~10 jobs in phApp.ddo.
  const html = await fetchPageHtml(`${pageUrl.replace(/\/+$/, '')}/search-results`)
  const m = html.match(/phApp\.ddo\s*=\s*({[\s\S]*?});/)
  if (!m) return []
  const jobs = JSON.parse(m[1]!)?.eagerLoadRefineSearch?.data?.jobs || []
  return jobs.map((j: any) => mapPhenomJob(j, pageUrl, label))
}

// --- Strategy 2: Workday (public CXS API of the tenant/site linked from the page) ---
function workdayPostedAt(postedOn: string | undefined): string {
  const s = postedOn || ''
  let days = 30 // unknown -> treat as old; the 14-day cap filters it out
  if (/today/i.test(s)) days = 0
  else if (/yesterday/i.test(s)) days = 1
  else {
    const m = /(\d+)\+?\s*days/i.exec(s)
    if (m) days = Number(m[1])
  }
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

async function fetchWorkdayJobs(html: string, pageUrl: string, label: string): Promise<Job[]> {
  const m = html.match(
    /https:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Za-z]{2,5}\/)?([A-Za-z0-9_-]+)/,
  )
  if (!m) return []
  const [, tenant, wd, site] = m
  if (!site || site === 'wday') return []
  const base = `https://${tenant}.${wd}.myworkdayjobs.com`
  const out: Job[] = []
  for (let offset = 0; offset < 60; offset += 20) {
    const data = await fetchJson<any>(`${base}/wday/cxs/${tenant}/${site}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText: '' }),
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    })
    const posts = data?.jobPostings || []
    for (const p of posts) {
      if (!p?.title || !p?.externalPath) continue
      const loc = p.locationsText || 'See listing'
      out.push({
        id: pageJobId(pageUrl, String(p.bulletFields?.[0] || p.externalPath)),
        title: p.title,
        company: label,
        location: loc,
        url: `${base}/${site}${p.externalPath}`,
        source: 'companies' as const,
        remote: /remote/i.test(`${p.title} ${loc}`),
        tags: [label],
        postedAt: workdayPostedAt(p.postedOn),
      })
    }
    if (posts.length < 20) break
  }
  return out
}

// --- Strategy 3: known ATS embedded in the page (reuse the hosted-board fetchers) ---
async function fetchEmbeddedAts(html: string, label: string): Promise<Job[]> {
  let m = html.match(/boards\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]{2,})/i)
  if (m && m[1] !== 'embed') return fetchGreenhouseBoard(m[1]!, label)
  m = html.match(/jobs\.(?:eu\.)?lever\.co\/([A-Za-z0-9_-]{2,})/)
  if (m) return fetchLeverBoard(m[1]!, label)
  m = html.match(/jobs\.ashbyhq\.com\/([A-Za-z0-9_-]{2,})/)
  if (m) return fetchAshbyBoard(m[1]!, label)
  m = html.match(/(?:careers|jobs)\.smartrecruiters\.com\/([A-Za-z0-9]{2,})/)
  if (m) return fetchSmartRecruitersBoard(m[1]!, label)
  return []
}

// --- Strategy 4: schema.org JSON-LD JobPosting blocks ---
function parseJsonLdJobs(html: string, pageUrl: string, label: string): Job[] {
  const out: Job[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let data: any
    try {
      data = JSON.parse(m[1]!)
    } catch {
      continue
    }
    const nodes = Array.isArray(data) ? data : data?.['@graph'] || [data]
    for (const n of nodes) {
      const type = n?.['@type']
      const isPosting = type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))
      if (!isPosting || !n.title) continue
      const locs = Array.isArray(n.jobLocation) ? n.jobLocation : [n.jobLocation].filter(Boolean)
      const location =
        locs
          .map((l: any) => [l?.address?.addressLocality, l?.address?.addressCountry].filter(Boolean).join(', '))
          .filter(Boolean)
          .join('; ') || 'See listing'
      const url = n.url || n.sameAs || pageUrl
      out.push({
        id: pageJobId(pageUrl, String(n.identifier?.value || n.identifier || url)),
        title: stripHtml(n.title),
        company: n.hiringOrganization?.name || label,
        location,
        url,
        source: 'companies' as const,
        remote: n.jobLocationType === 'TELECOMMUTE' || /remote/i.test(`${n.title} ${location}`),
        tags: [label],
        postedAt: new Date(n.datePosted || Date.now()).toISOString(),
        employmentType: Array.isArray(n.employmentType) ? n.employmentType[0] : n.employmentType,
        description: stripHtml(n.description).slice(0, DESC_MAX),
      })
    }
  }
  return out
}

// --- Strategy 5: job-looking anchors (Teamtailor-hosted pages, custom lists) ---
// A URL counts as a job link when its path ends in a /jobs|vacancies|positions/…
// segment that carries an id or a long slug. Several anchors often point at the
// same job (image card + title link); keep the shortest clean text per URL and
// fall back to a title derived from the slug.
const JOB_PATH_RE = /\/(?:jobs?|vacanc\w*|positions?|openings?)\/(?:[a-z]{2}\/)?([^/?#]*\d[^/?#]*|[a-z0-9][a-z0-9-]{10,})\/?$/i

function slugTitle(href: string): string {
  const m = JOB_PATH_RE.exec(new URL(href).pathname)
  const slug = (m?.[1] || '').replace(/^\d+-?/, '').replace(/[-_]+/g, ' ').trim()
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : ''
}

function parseJobAnchors(html: string, pageUrl: string, label: string): Job[] {
  const byHref = new Map<string, string>() // href -> best (shortest useful) anchor text
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let href: string
    try {
      href = new URL(m[1]!, pageUrl).toString()
    } catch {
      continue
    }
    if (!JOB_PATH_RE.test(new URL(href).pathname)) continue
    const text = stripHtml(m[2]!)
    const prev = byHref.get(href)
    const usable = text.length >= 4 && text.length <= 120 && !/^(view|see|all|apply|read|learn|more)\b/i.test(text)
    if (prev === undefined) byHref.set(href, usable ? text : '')
    else if (usable && (!prev || text.length < prev.length)) byHref.set(href, text)
  }
  const now = new Date().toISOString()
  const out: Job[] = []
  for (const [href, text] of byHref) {
    const title = text || slugTitle(href)
    if (!title) continue
    out.push({
      id: pageJobId(pageUrl, href),
      title,
      company: label,
      location: 'See listing',
      url: href,
      source: 'companies' as const,
      remote: /remote/i.test(title),
      tags: [label],
      postedAt: now, // listing pages carry no dates; presence = still open
    })
    if (out.length >= 100) break
  }
  return out
}

// The companies source fires ~190 fetch tasks (hosted boards + career pages).
// Launching them all at once trips upstream rate limits — verified: Greenhouse
// throttles the burst, so career pages whose strategy hits the same API return
// nothing while working fine in isolation. One shared pool bounds the burst.
const COMPANIES_POOL_SIZE = 16

async function runPool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= tasks.length) return
        results[i] = await tasks[i]!()
      }
    }),
  )
  return results
}

async function fetchCareerPage(pageUrl: string, label: string): Promise<Job[]> {
  const html = await fetchPageHtml(pageUrl)
  if (/phApp\.ddo/.test(html)) {
    const jobs = await fetchPhenomJobs(pageUrl, label).catch(() => [] as Job[])
    if (jobs.length) return jobs
  }
  if (/myworkdayjobs\.com/.test(html)) {
    const jobs = await fetchWorkdayJobs(html, pageUrl, label).catch(() => [] as Job[])
    if (jobs.length) return jobs
  }
  const ats = await fetchEmbeddedAts(html, label).catch(() => [] as Job[])
  if (ats.length) return ats
  const ld = parseJsonLdJobs(html, pageUrl, label)
  if (ld.length) return ld
  return parseJobAnchors(html, pageUrl, label)
}

export async function fetchCompanies(q: string): Promise<Job[]> {
  if (process.env.COMPANIES_SOURCE === 'off') return []
  const tasks: (() => Promise<Job[]>)[] = [
    ...companyBoards('greenhouse').map((b) => () =>
      fetchGreenhouseBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] greenhouse "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...companyBoards('lever').map((b) => () =>
      fetchLeverBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] lever "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...companyBoards('smartrecruiters').map((b) => () =>
      fetchSmartRecruitersBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] smartrecruiters "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...companyBoards('ashby').map((b) => () =>
      fetchAshbyBoard(b.handle, b.label).catch((err) => {
        console.error(`[jobs] ashby "${b.handle}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
    ...careersPages().map((p) => () =>
      fetchCareerPage(p.url, p.label).catch((err) => {
        console.error(`[jobs] careers page "${p.label}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
  ]
  const all = (await runPool(tasks, COMPANIES_POOL_SIZE)).flat()
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
