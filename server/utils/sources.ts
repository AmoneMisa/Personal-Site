// Source adapters. Each fetches from a job API/feed and normalizes to Job[].
// Failures in one source never break the others (handled by the route).

import { parseHiringSourceSalary } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import { XMLParser } from 'fast-xml-parser'
import type { Job } from './jobTypes'
import { extractSalaryFromText } from './enrich'
import { detectWorkModes } from './hiringLexicon'

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

// Keep complete vacancy descriptions for enrichment. US sponsorship/work-
// authorization disclaimers are frequently near the end of long postings; the
// UI can clamp presentation without discarding parser input.
const DESC_MAX = Number.POSITIVE_INFINITY

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    // URLs may contain API credentials in path/query (Jooble, Adzuna). Keep
    // failures observable without leaking those secrets into application logs.
    let host = 'upstream'
    try {
      host = new URL(url).host
    } catch {
      // Keep the generic label for malformed URLs.
    }
    throw new Error(`${host} -> ${res.status}`)
  }
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
  return (data.data || []).map((j) => {
    const tags = Array.isArray(j.tags) ? j.tags : j.tags ? [j.tags] : []
    const jobTypes = Array.isArray(j.job_types) ? j.job_types : j.job_types ? [j.job_types] : []
    return {
      id: `arbeitnow-${j.slug}`,
      title: j.title,
      company: j.company_name,
      location: j.location || (j.remote ? 'Remote' : 'Unknown'),
      url: j.url,
      source: 'arbeitnow' as const,
      remote: !!j.remote,
      tags: [...tags, ...jobTypes].slice(0, 8),
      postedAt: new Date((j.created_at || 0) * 1000).toISOString(),
      employmentType: jobTypes[0],
      description: stripHtml(j.description).slice(0, DESC_MAX),
    }
  })
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
        remote: locations.some((l: string) => detectWorkModes(l).includes('remote')),
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
    description: stripHtml(j.jobDescription || j.jobExcerpt).slice(0, DESC_MAX),
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
    remote: detectWorkModes(j.title + ' ' + (j.location?.display_name || '')).includes('remote'),
    tags: j.category?.label ? [j.category.label] : [],
    postedAt: new Date(j.created).toISOString(),
    employmentType: j.contract_time,
    salaryMin: j.salary_min ?? undefined,
    salaryMax: j.salary_max ?? undefined,
    salaryCurrency: j.salary_min ? (country.toUpperCase() === 'PL' ? 'PLN' : 'USD') : undefined,
    description: stripHtml(j.description).slice(0, DESC_MAX),
  }))
}

// ---------- Jooble (env: JOOBLE_KEY, optional JOOBLE_LOCATIONS) ----------
// One API call is required per location. Defaults cover Central Asia + Ukraine;
// override with a comma-separated JOOBLE_LOCATIONS list to conserve quota or
// target cities. Legacy JOOBLE_LOCATION is still accepted.
const JOOBLE_DEFAULT_LOCATIONS = [
  'Uzbekistan',
  'Kazakhstan',
  'Kyrgyzstan',
  'Tajikistan',
  'Turkmenistan',
  'Ukraine',
]

// Jooble has its own response field, but money semantics are shared.
function parseJoobleSalary(value: unknown): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const parsed = parseHiringSourceSalary(value)
  if (!parsed || (parsed.min == null && parsed.max == null) || !parsed.currency) return {}
  return {
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    salaryCurrency: parsed.currency,
  }
}

export async function fetchJooble(q: string): Promise<Job[]> {
  const key = process.env.JOOBLE_KEY
  if (!key) return []
  const configured = process.env.JOOBLE_LOCATIONS || process.env.JOOBLE_LOCATION
  const locations = (configured ? configured.split(',') : JOOBLE_DEFAULT_LOCATIONS)
    .map((location) => location.trim())
    .filter(Boolean)

  const results = await Promise.all(
    locations.map(async (location) => {
      try {
        const data = await fetchJson<{ jobs: any[] }>(`https://jooble.org/api/${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: q || 'developer',
            location,
            page: '1',
            ResultOnPage: '50',
            companysearch: 'false',
          }),
        })
        return data.jobs || []
      } catch (err) {
        console.error(`[jobs] jooble location "${location}" failed:`, (err as Error).message)
        return []
      }
    }),
  )

  const deduped = new Map<string, Job>()
  for (const [index, j] of results.flat().entries()) {
    const description = stripHtml(j.snippet).slice(0, DESC_MAX)
    const job: Job = {
      id: `jooble-${j.id || index}`,
      title: j.title,
      company: j.company || 'Unknown',
      location: j.location || 'Unknown',
      url: j.link,
      source: 'jooble',
      remote: detectWorkModes(`${j.title} ${j.location || ''} ${description}`).includes('remote'),
      tags: [j.type, j.source].filter(Boolean).slice(0, 6),
      postedAt: j.updated ? new Date(j.updated).toISOString() : new Date().toISOString(),
      employmentType: j.type || undefined,
      ...parseJoobleSalary(j.salary),
      description,
    }
    deduped.set(String(j.id || j.link || job.id), job)
  }
  return [...deduped.values()]
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
  // remote-first / large employers (work-from-home list, verified 2026-07)
  'Alorica:Alorica', 'geico:GEICO',
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
  // games + Ukraine IT/product (Genesis ecosystem).
  // NB: 'genesis' on Ashby is a US AI-robotics company (Bay Area), NOT the
  // Ukrainian Genesis (own career site, Cloudflare-gated) — do not re-add it.
  'voodoo:Voodoo', 'supercell:Supercell', 'preply:Preply', 'headway:Headway',
  'solidgate:Solidgate', 'obrio:OBRIO', 'universe:Universe',
  'restream:Restream',
  // remote-first employers (from the "work-from-home companies" list, verified 2026-07)
  'zapier:Zapier', 'buffer:Buffer',
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
  // US healthcare/insurance remote employers (work-from-home list, Phenom, verified 2026-07)
  'Humana|https://careers.humana.com/',
  'CVS Health|https://jobs.cvshealth.com/us/en',
  'Cigna|https://jobs.thecignagroup.com/us/en',
  // Workday-powered (CXS API discovered from the page HTML)
  'Unilever|https://careers.unilever.com/en',
  'Nike|https://careers.nike.com/',
  'Expedia Group|https://careers.expediagroup.com/',
  'Home Depot|https://careers.homedepot.com/',
  'Linklaters|https://www.linklaters.com/careers',
  'Elevance Health|https://careers.elevancehealth.com/',
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
  const summaries: { job: Job; externalPath: string }[] = []
  const oldestAllowed = Date.now() - 14 * 86_400_000
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
      const postedAt = workdayPostedAt(p.postedOn)
      // The public feed enforces the same 14-day ceiling, so avoid a detail
      // request for postings that would be discarded immediately afterward.
      if (new Date(postedAt).getTime() < oldestAllowed) continue
      summaries.push({
        externalPath: p.externalPath,
        job: {
          id: pageJobId(pageUrl, String(p.bulletFields?.[0] || p.externalPath)),
          title: p.title,
          company: label,
          location: loc,
          url: `${base}/${site}${p.externalPath}`,
          source: 'companies' as const,
          remote: /remote/i.test(`${p.title} ${loc}`),
          tags: [label],
          postedAt,
        },
      })
    }
    if (posts.length < 20) break
  }

  const out: Job[] = []
  for (let start = 0; start < summaries.length; start += 6) {
    const batch = summaries.slice(start, start + 6)
    const detailed = await Promise.all(
      batch.map(async ({ job, externalPath }) => {
        try {
          const data = await fetchJson<any>(
            `${base}/wday/cxs/${tenant}/${site}${externalPath}`,
            { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) },
          )
          const info = data?.jobPostingInfo || {}
          const fullDescription = stripHtml(info.jobDescription || info.description || '')
          return {
            ...job,
            employmentType: info.timeType || info.workerType || job.employmentType,
            description: fullDescription.slice(0, DESC_MAX) || undefined,
            ...extractSalaryFromText(fullDescription),
          }
        } catch (err) {
          console.error(`[jobs] workday detail ${label} failed:`, (err as Error).message)
          return job
        }
      }),
    )
    out.push(...detailed)
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

// ---------- DOU.ua company vacancy pages (HTML, Ukraine) ----------
// Several Ukrainian companies run their own SPA / bot-gated / builder career sites
// (MacPaw = Next.js SPA, Uklon = Weblium builder, Genesis parent = under construction)
// that expose no fetchable job API — but they all publish their live openings on their
// DOU.ua company profile, which is server-rendered as <ul class="vacancies-list">.
// This targets specific companies by DOU slug: the general DOU RSS only carries the
// latest ~50 across ALL companies, so a given company never surfaces reliably there.
// Handles verified 2026-07-13. Configure via DOU_COMPANIES="slug:Label,slug2:Label2";
// COMPANIES_DEFAULTS=off drops the seed, COMPANIES_SOURCE=off disables all companies.
const DEFAULT_DOU_COMPANIES = [
  'macpaw:MacPaw', 'uklon:Uklon', 'genesis-technology-partners:Genesis',
].join(',')

function douCompanies(): { handle: string; label: string }[] {
  const seed = process.env.COMPANIES_DEFAULTS === 'off' ? '' : DEFAULT_DOU_COMPANIES
  const env = process.env.DOU_COMPANIES
  return parseBoards([seed, env || ''].filter(Boolean).join(','))
}

// A DOU company page lists each opening as
//   <li><a href=".../companies/<slug>/vacancies/<id>/?from=widget_company">Title</a>
//       <span class="cities">, Київ, віддалено</span></li>
// The page carries no post date, so presence == still open (postedAt = now); a closed
// role drops off the page and ages out via the store's not-seen-recently pruning.
const DOU_VACANCY_RE =
  /<a\s+href="([^"]*\/vacancies\/(\d+)\/[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*(?:<span class="cities">([^<]*)<\/span>)?/gi

async function fetchDouCompany(slug: string, label: string): Promise<Job[]> {
  const html = await fetchPageHtml(`https://jobs.dou.ua/companies/${encodeURIComponent(slug)}/`)
  const out: Job[] = []
  DOU_VACANCY_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = DOU_VACANCY_RE.exec(html))) {
    const href = m[1]!
    // The page also renders a "similar companies" widget; keep only THIS company's ads.
    if (!href.includes(`/companies/${slug}/`)) continue
    const title = stripHtml(m[3]!)
    if (!title) continue
    const cities = (m[4] || '').replace(/^[,\s]+/, '').trim()
    out.push({
      id: `companies-dou-${slug}-${m[2]}`,
      title,
      company: label,
      location: cities ? `${cities}, Ukraine` : 'Ukraine',
      url: href.split('?')[0]!, // canonical (drop ?from=widget_company) for clean dedup
      source: 'companies' as const,
      remote: /віддален|remote/i.test(cities),
      tags: [label],
      postedAt: new Date().toISOString(),
    })
    if (out.length >= 100) break
  }
  return out
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
    ...douCompanies().map((c) => () =>
      fetchDouCompany(c.handle, c.label).catch((err) => {
        console.error(`[jobs] dou company "${c.handle}" failed:`, (err as Error).message)
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
// Ships with DOU.ua plus the non-programming We Work Remotely categories. WWR
// explicitly publishes these feeds for reuse with attribution, and keeping the
// categories separate avoids turning the default feed into another IT board.
// Add more via RSS_FEEDS for niche boards (VueJobs, etc.), e.g.:
//   RSS_FEEDS="vuejobs|https://vuejobs.com/feed"
// Set RSS_DEFAULTS=off to disable the built-in feeds.
const DEFAULT_RSS_FEEDS = [
  'dou.ua|https://jobs.dou.ua/vacancies/feeds/',
  'wwr-support|https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  'wwr-sales-marketing|https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  'wwr-management-finance|https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss',
  'wwr-other|https://weworkremotely.com/categories/all-other-remote-jobs.rss',
].join(',')

function rssText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record['#text'] || record['@_term'] || '')
  }
  return String(value)
}

function isRemoteOnlyRss(url: string): boolean {
  try {
    return /(^|\.)weworkremotely\.com$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

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
        const title = rssText(it.title)
        const dateStr = it.pubDate || it.published || it.updated
        const description = stripHtml(rssText(it.description || it.summary || it.content))
        const remoteOnly = isRemoteOnlyRss(feed.url)
        const region = rssText(it.region || it.location || it['job:location'])
        const categories = (Array.isArray(it.category) ? it.category : [it.category])
          .map(rssText)
          .filter(Boolean)
        let jobTitle = title
        let company = rssText(it['dc:creator']) || feed.label
        if (remoteOnly) {
          const separator = title.indexOf(': ')
          if (separator > 0 && separator < title.length - 2) {
            company = title.slice(0, separator).trim()
            jobTitle = title.slice(separator + 2).trim()
          }
        }
        all.push({
          id: `rss-${feed.label}-${rssText(it.guid) || link || title}`,
          title: String(jobTitle || 'Untitled'),
          company,
          location: region || (remoteOnly ? 'Remote' : 'See listing'),
          url: String(link || ''),
          source: 'rss',
          remote: remoteOnly || detectWorkModes(`${title} ${description} ${region}`).includes('remote'),
          workMode: remoteOnly ? 'remote' : undefined,
          tags: [feed.label, ...categories].slice(0, 8),
          postedAt: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
          description: description.slice(0, DESC_MAX),
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

// ---------- DevKG (no key) — Kyrgyzstan ----------
// DevKG advertises this RSS feed in the <head> of its vacancies page. Using the
// published feed keeps this adapter stable and avoids scraping presentation HTML.
// The feed exposes employer in the title and work type / salary in description.
// Disable with DEVKG_SOURCE=off.
const DEVKG_RSS_URL = 'https://devkg.com/rss/jobs.xml'

function parseDevKgAmount(value: string | undefined): number | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : undefined
}

function parseDevKgSalary(text: string): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const match = text.match(
    /\b(от|до)?\s*([\d\s]+(?:[.,]\d+)?)\s*(?:[-–—]\s*([\d\s]+(?:[.,]\d+)?))?\s*(KGS|USD|EUR)\b/i,
  )
  if (!match) return {}

  const qualifier = match[1]?.toLowerCase()
  const first = parseDevKgAmount(match[2])
  const second = parseDevKgAmount(match[3])
  return {
    salaryMin: qualifier === 'до' ? undefined : first,
    salaryMax: second ?? (qualifier === 'до' ? first : undefined),
    salaryCurrency: match[4].toUpperCase(),
  }
}

export async function fetchDevKg(q: string): Promise<Job[]> {
  if (process.env.DEVKG_SOURCE === 'off') return []

  const xml = await fetchText(DEVKG_RSS_URL)
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml)
  const rawItems = parsed?.rss?.channel?.item || []
  const items = Array.isArray(rawItems) ? rawItems : [rawItems]

  const jobs = items.map((item: any, index: number): Job => {
    const fullTitle = String(item.title?.['#text'] || item.title || '').trim()
    const separator = fullTitle.lastIndexOf(' - ')
    const title = separator > 0 ? fullTitle.slice(0, separator).trim() : fullTitle
    const company = separator > 0 ? fullTitle.slice(separator + 3).trim() : 'DevKG employer'
    const rawDescription = String(item.description?.['#text'] || item.description || '')
    const description = stripHtml(rawDescription)
    const typeMatch = description.match(/\bТип:\s*(.+?)(?=\s+(?:от|до|\d)\s*[\d\s]*\s*(?:KGS|USD|EUR)\b)/i)
    const employmentType = typeMatch?.[1]?.trim()
    const url = String(item.link?.['#text'] || item.link || '')
    const guid = String(item.guid?.['#text'] || item.guid || url || `${title}-${index}`)

    return {
      id: `devkg-${guid}`,
      title: title || 'Untitled vacancy',
      company,
      location: 'Kyrgyzstan',
      url,
      source: 'devkg',
      remote: /удал[её]н|remote|дистанцион/i.test(`${employmentType || ''} ${description}`),
      tags: ['DevKG', 'Kyrgyzstan'],
      postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      employmentType,
      ...parseDevKgSalary(description),
      salaryPeriod: /в месяц|monthly|per month/i.test(description) ? 'month' : undefined,
      description: description.slice(0, DESC_MAX),
    }
  })

  if (!q) return jobs
  const needle = q.toLocaleLowerCase('ru')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.description || ''}`.toLocaleLowerCase('ru').includes(needle),
  )
}

// ---------- Uzbekistan boards (no key) — ishGO + IT-Jobs.uz ----------
// Both boards permit public vacancy/search indexing and publish each detail page
// as standard Schema.org JobPosting JSON-LD. Read a bounded number of current
// links from the public listing, then normalize those first-party records. This
// avoids private APIs and brittle visual-card parsing.
type UzbekBoardSource = 'ishgo' | 'itjobsuz'

interface UzbekBoardConfig {
  source: UzbekBoardSource
  label: string
  listingUrl: string
  detailPrefix: string
  envFlag: 'ISHGO_SOURCE' | 'ITJOBS_UZ_SOURCE'
}

const UZBEK_BOARDS: Record<UzbekBoardSource, UzbekBoardConfig> = {
  ishgo: {
    source: 'ishgo',
    label: 'ishGO.uz',
    listingUrl: 'https://ishgo.uz/ru/vacancies',
    detailPrefix: '/ru/vacancies/',
    envFlag: 'ISHGO_SOURCE',
  },
  itjobsuz: {
    source: 'itjobsuz',
    label: 'IT-Jobs.uz',
    listingUrl: 'https://it-jobs.uz/ru/jobs',
    detailPrefix: '/ru/jobs/',
    envFlag: 'ITJOBS_UZ_SOURCE',
  },
}

const UZBEK_BOARD_MAX_DETAILS = 24
const UZBEK_BOARD_BATCH_SIZE = 6

interface UzbekBoardLink {
  url: string
  localizedTitle?: string
}

function extractDetailLinks(html: string, config: UzbekBoardConfig): UzbekBoardLink[] {
  const origin = new URL(config.listingUrl).origin
  const links = new Map<string, UzbekBoardLink>()
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), origin)
      if (url.origin !== origin || !url.pathname.startsWith(config.detailPrefix)) continue
      if (url.pathname === config.detailPrefix) continue
      const canonical = `${url.origin}${url.pathname}`
      const heading = match[2].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]
      links.set(canonical, {
        url: canonical,
        localizedTitle: heading ? stripHtml(heading) : undefined,
      })
      if (links.size >= UZBEK_BOARD_MAX_DETAILS) break
    } catch {
      // Ignore malformed hrefs from unrelated page markup.
    }
  }
  return [...links.values()]
}

function findJobPosting(value: any): any | undefined {
  if (!value || typeof value !== 'object') return undefined
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return undefined
  }
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
  if (types.includes('JobPosting')) return value
  return findJobPosting(value['@graph'])
}

function extractJobPosting(html: string): any | undefined {
  for (const match of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const found = findJobPosting(JSON.parse(match[1]))
      if (found) return found
    } catch {
      // A page may contain unrelated malformed JSON-LD; keep looking.
    }
  }
  return undefined
}

function schemaSalary(posting: any): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'> {
  const salary = Array.isArray(posting.baseSalary) ? posting.baseSalary[0] : posting.baseSalary
  const value = salary?.value
  const min = Number(value?.minValue ?? value?.value)
  const max = Number(value?.maxValue)
  const unit = String(value?.unitText || '').toLowerCase()
  const salaryPeriod = /hour/.test(unit)
    ? 'hour'
    : /month/.test(unit)
      ? 'month'
      : /year/.test(unit)
        ? 'year'
        : undefined
  return {
    salaryMin: Number.isFinite(min) ? min : undefined,
    salaryMax: Number.isFinite(max) ? max : undefined,
    salaryCurrency: salary?.currency ? String(salary.currency).toUpperCase() : undefined,
    salaryPeriod,
  }
}

function schemaLocation(posting: any): string {
  const locations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  const parts = locations
    .map((location: any) => {
      const address = location?.address || {}
      const country = typeof address.addressCountry === 'object'
        ? address.addressCountry.name
        : address.addressCountry
      const unique = new Map<string, string>()
      for (const part of [address.addressLocality, address.addressRegion, country].filter(Boolean)) {
        const text = String(part).trim()
        unique.set(text.toLocaleLowerCase('ru'), text)
      }
      return [...unique.values()].join(', ')
    })
    .filter(Boolean)
  return [...new Set(parts)].join(' / ') || 'Uzbekistan'
}

function normalizeSchemaPosting(
  posting: any,
  url: string,
  config: UzbekBoardConfig,
  html: string,
  titleOverride?: string,
): Job | undefined {
  if (!posting?.title || !posting?.datePosted) return undefined
  const date = new Date(posting.datePosted)
  if (Number.isNaN(date.getTime())) return undefined
  const description = stripHtml(posting.description).slice(0, DESC_MAX)
  const employment = Array.isArray(posting.employmentType)
    ? posting.employmentType.map(String)
    : posting.employmentType
      ? [String(posting.employmentType)]
      : []
  const company = posting.hiringOrganization?.name || 'Unknown'
  const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || url
  const documentTitle = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const localizedIshGoTitle = config.source === 'ishgo'
    ? documentTitle.match(/^Вакансия\s+(.+?),\s+работа\s+в\b/i)?.[1]
    : undefined

  return {
    id: `${config.source}-${slug}`,
    title: titleOverride || localizedIshGoTitle || stripHtml(String(posting.title)),
    company: stripHtml(String(company)),
    location: schemaLocation(posting),
    url,
    source: config.source,
    remote: posting.jobLocationType === 'TELECOMMUTE'
      || /remote|удал[её]н|дистанцион|masofaviy/i.test(`${description} ${employment.join(' ')}`),
    tags: [config.label],
    postedAt: date.toISOString(),
    employmentType: employment[0],
    ...schemaSalary(posting),
    description,
  }
}

async function fetchUzbekBoard(q: string, source: UzbekBoardSource): Promise<Job[]> {
  const config = UZBEK_BOARDS[source]
  if (process.env[config.envFlag] === 'off') return []

  const listing = await fetchText(config.listingUrl)
  const links = extractDetailLinks(listing, config)
  const jobs: Job[] = []
  for (let start = 0; start < links.length; start += UZBEK_BOARD_BATCH_SIZE) {
    const batch = links.slice(start, start + UZBEK_BOARD_BATCH_SIZE)
    const parsed = await Promise.all(
      batch.map(async ({ url, localizedTitle }) => {
        try {
          const html = await fetchText(url)
          const posting = extractJobPosting(html)
          return posting
            ? normalizeSchemaPosting(posting, url, config, html, localizedTitle)
            : undefined
        } catch (err) {
          console.error(`[jobs] ${config.source} detail failed:`, (err as Error).message)
          return undefined
        }
      }),
    )
    jobs.push(...parsed.filter((job): job is Job => job !== undefined))
  }

  if (!q) return jobs
  const needle = q.toLocaleLowerCase('ru')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.description || ''}`.toLocaleLowerCase('ru').includes(needle),
  )
}

export async function fetchIshGo(q: string): Promise<Job[]> {
  return fetchUzbekBoard(q, 'ishgo')
}

export async function fetchItJobsUz(q: string): Promise<Job[]> {
  return fetchUzbekBoard(q, 'itjobsuz')
}

// ---------- Telegram public channels (no bot token) ----------
// Telegram exposes a read-only preview for public channels at /s/<handle>.
// This adapter reads only that public HTML; it never joins channels, uses a
// user account, or requires Telegram Bot API credentials.
interface TelegramChannel {
  handle: string
  label: string
  country: string
  location: string
  priority: 1 | 2 | 3
  tags: string[]
}

const TELEGRAM_CHANNELS: TelegramChannel[] = [
  // Uzbekistan — primary IT/general/banking feeds.
  { handle: 'UzDev_Jobs', label: 'UzDev Jobs', country: 'UZ', location: 'Uzbekistan', priority: 1, tags: ['IT'] },
  { handle: 'itcloz', label: 'IT Cloz', country: 'UZ', location: 'Uzbekistan', priority: 1, tags: ['IT'] },
  { handle: 'clozjobs', label: 'Cloz Jobs', country: 'UZ', location: 'Uzbekistan', priority: 1, tags: ['Jobs'] },
  { handle: 'Ish_Toshkent', label: 'Ish Toshkent', country: 'UZ', location: 'Tashkent, Uzbekistan', priority: 1, tags: ['General'] },
  { handle: 'ish_bor_vakansiyalaruz', label: 'Ish Bor Vakansiyalar', country: 'UZ', location: 'Uzbekistan', priority: 1, tags: ['General'] },
  { handle: 'ishbank', label: 'Ishbank', country: 'UZ', location: 'Uzbekistan', priority: 1, tags: ['Banking', 'Finance'] },
  { handle: 'vacancyuzairports', label: 'Uzbekistan Airports Careers', country: 'UZ', location: 'Uzbekistan', priority: 2, tags: ['Aviation'] },
  { handle: 'careerTBC', label: 'TBC Uzbekistan Careers', country: 'UZ', location: 'Uzbekistan', priority: 2, tags: ['Banking', 'Fintech'] },
  { handle: 'tatu_karyera_markazi', label: 'TATU Career Center', country: 'UZ', location: 'Tashkent, Uzbekistan', priority: 2, tags: ['IT', 'Junior'] },
  { handle: 'tdtu_karyera_markaz', label: 'TDTU Career Center', country: 'UZ', location: 'Tashkent, Uzbekistan', priority: 2, tags: ['Engineering'] },
  // Duplicate mirrors / very narrow feeds are opt-in via TELEGRAM_INCLUDE_LOW_PRIORITY=on.
  { handle: 'linkedinjobsuzbekistan', label: 'LinkedIn Jobs Uzbekistan mirror', country: 'UZ', location: 'Uzbekistan', priority: 3, tags: ['Mirror'] },
  { handle: 'uzjobsuz', label: 'UzJobs mirror', country: 'UZ', location: 'Uzbekistan', priority: 3, tags: ['Mirror'] },
  { handle: 'android_jobs_for_future_tashkent', label: 'Android Jobs Tashkent', country: 'UZ', location: 'Tashkent, Uzbekistan', priority: 3, tags: ['Android'] },

  // Kazakhstan.
  { handle: 'jobkz_1', label: 'JobKZ', country: 'KZ', location: 'Kazakhstan', priority: 1, tags: ['General'] },
  { handle: 'devkz_jobs', label: 'DevKZ Jobs', country: 'KZ', location: 'Kazakhstan', priority: 1, tags: ['IT'] },
  { handle: 'almaty_rabota_work', label: 'Almaty Rabota', country: 'KZ', location: 'Almaty, Kazakhstan', priority: 2, tags: ['General'] },

  // Kyrgyzstan.
  { handle: 'findwork', label: 'Find Work KG', country: 'KG', location: 'Kyrgyzstan', priority: 1, tags: ['General'] },
  { handle: 'jobkg_official', label: 'Job KG', country: 'KG', location: 'Kyrgyzstan', priority: 1, tags: ['General'] },
  { handle: 'jobslbish', label: 'Jobs Lbish', country: 'KG', location: 'Kyrgyzstan', priority: 2, tags: ['General'] },
  { handle: 'jumush312kg', label: 'Jumush 312 KG', country: 'KG', location: 'Bishkek, Kyrgyzstan', priority: 2, tags: ['General'] },

  // Ukraine and Romania.
  { handle: 'robotaua_now_remote', label: 'Robota UA Remote', country: 'UA', location: 'Ukraine', priority: 1, tags: ['Remote'] },
  { handle: 'jobs_kyiv', label: 'Jobs Kyiv', country: 'UA', location: 'Kyiv, Ukraine', priority: 2, tags: ['General'] },
  { handle: 'devjobro', label: 'DevJob Romania', country: 'RO', location: 'Romania', priority: 1, tags: ['IT'] },
  { handle: 'jobs4ukrinromania', label: 'Jobs for Ukrainians in Romania', country: 'RO', location: 'Romania', priority: 1, tags: ['For Ukrainians'] },
]

function decodeTelegramEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', bull: '•',
  }
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(value) ? String.fromCodePoint(value) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function telegramText(html: string): string {
  return decodeTelegramEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function telegramField(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,6}(?:${names})\\s*[:—-]\\s*([^\\n]{2,100})`, 'iu'))
  return match?.[1]?.trim()
}

const TELEGRAM_ROLE_RE = /\b(?:developer|engineer|designer|manager|analyst|consultant|specialist|associate|assistant|administrator|accountant|auditor|recruiter|copywriter|marketer|sales|support|operator|courier|driver|chef|waiter|qa|tester|devops|frontend|backend|android|ios)\b|разработ|инженер|дизайнер|менеджер|аналитик|консультант|специалист|ассистент|администратор|бухгалтер|аудитор|рекрутер|копирайтер|маркетолог|продав|кассир|оператор|курьер|водител|повар|официант|сварщик|электрик|mutaxassis|dasturchi|menejer|sotuv|haydovchi|oshpaz/iu

const TELEGRAM_PROMOTION_RE = /t\.me\/addlist\b|(?:telegram[- ]?)?канал\w*\s+(?:в\s+)?(?:одн\w+\s+)?папк|папк\w*\s+(?:telegram[- ]?)?канал|добав(?:ить|ьте|ляй)\s+(?:свой\s+)?канал\s+в\s+папк|добав(?:ить|ьте)\s+папк|до\s+закрытия\s+доступа|пока\s+ты\s+листаешь\s+ленту|лучшие\s+офферы\s+разлетаются|вакансии\s+сами\s+приходят|карьерн\w+\s+лайфхак/iu

/**
 * Reject channel advertising, digest/folder promotions and other posts that
 * mention jobs without describing one concrete opening. Shared with the store
 * read/prune path so already-cached trash disappears immediately after deploy.
 */
export function isLikelyTelegramVacancy(text: string): boolean {
  const value = text.replace(/\s+/g, ' ').trim()
  if (value.length < 20 || TELEGRAM_PROMOTION_RE.test(value)) return false

  const explicitPosition = /(?:vacancy|position|role|вакансия|позиция|посада|lavozim)\s*[:—-]\s*[\p{L}\p{N}]/iu.test(value)
  const hiringPhrase = /(?:we(?:'re| are)?\s+(?:hiring|looking\s+for)|ищем|требуется|шукаємо|потрібен|kerak)\s+(?:[\p{L}\p{N}][\p{L}\p{N}+.#/-]*\s*){1,8}/iu.test(value)
  const role = TELEGRAM_ROLE_RE.test(value)
  const requirements = /requirements?|responsibilit|qualifications?|обязанност|требован|условия|вазиф|талаб|міндет|талап/iu.test(value)
  const employment = /full[- ]?time|part[- ]?time|employment|график|занятост|офис|гибрид|удал[её]н|remote|ish vaqti|bandlik/iu.test(value)
  const application = /(?:apply|отклик|резюме|cv\b|hr\b|contact|контакт|мурожаат|bog['’]?lan)/iu.test(value)
  const concreteSalary = /\d[\d\s.,]*(?:USD|EUR|GBP|UAH|UZS|KZT|KGS|TJS|TMT|PLN|RON|[$€£₴₸]|сум|so['’]?m|тенге|тг\.?|сом|грн)/iu.test(value)

  if (explicitPosition || hiringPhrase) return role || requirements || employment || application || concreteSalary
  return role && [requirements, employment, application, concreteSalary].filter(Boolean).length >= 1
}

function telegramTitle(text: string, channel: TelegramChannel): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const explicit = telegramField(text, 'vacancy|position|role|вакансия|позиция|посада|lavozim')
  const useful = lines.find((line) =>
    !/^(?:#\w+\s*)+$/.test(line)
    && !/^(?:vacancy|вакансия|иш|ish|работа|job)\s*[:.!-]*$/i.test(line)
    && TELEGRAM_ROLE_RE.test(line),
  )
  const title = explicit || useful || lines.find((line) => !/^#/.test(line)) || `Vacancy from ${channel.label}`
  return title.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\s#*_-]+/gu, '').slice(0, 180)
    || `Vacancy from ${channel.label}`
}

// Build a Job from one channel post's plain text. Shared by both transports:
// the t.me/s HTML scrape and the MTProto worker (which returns text directly).
// Returns null for non-job posts (too short / no vacancy keywords / filtered out).
function telegramTextToJob(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramChannel,
  needle: string,
): Job | null {
  if (!isLikelyTelegramVacancy(text)) return null
  const title = telegramTitle(text, channel)
  const company = telegramField(text, 'company|employer|компания|работодатель|роботодавець|компанія|tashkilot|ish beruvchi') || channel.label
  const location = telegramField(text, 'location|city|локация|город|місто|manzil|shahar') || channel.location
  if (needle && !`${title} ${company} ${text}`.toLocaleLowerCase('ru').includes(needle)) return null

  // Parse salary from the salary line only (💰 / зарплата / maosh / ...), so a
  // phone number or a URL's digits elsewhere in the post can't be mistaken for pay.
  const salaryLine = text.split('\n').find((line) =>
    /💰|зарплат|заработн|оклад|оплата|\bsalary\b|maosh|маош|ish haqi|ойлик/i.test(line),
  )
  const salary = parseJoobleSalary(salaryLine ?? text)
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  return {
    id: opts.id,
    title,
    company,
    location,
    url: opts.url,
    source: 'telegram',
    remote: /remote|удал[её]н|віддален|masofaviy|онлайн|online/i.test(`${title} ${text}`),
    tags: [...channel.tags, channel.country, `@${channel.handle}`, ...hashtags].slice(0, 8),
    postedAt: opts.dateIso && !Number.isNaN(Date.parse(opts.dateIso))
      ? new Date(opts.dateIso).toISOString()
      : new Date().toISOString(),
    description: text.slice(0, DESC_MAX),
    ...salary,
  }
}

function parseTelegramChannelHtml(html: string, channel: TelegramChannel, q: string): Job[] {
  const jobs: Job[] = []
  const chunks = html.split(/<div class="tgme_widget_message_wrap\b[^>]*>/i).slice(1)
  const needle = q.trim().toLocaleLowerCase('ru')

  for (const chunk of chunks) {
    const post = chunk.match(/data-post="([^"]+)"/i)?.[1]
    const body = chunk.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
    if (!post || !body) continue
    const datetime = chunk.match(/<time[^>]+datetime="([^"]+)"/i)?.[1]
    const job = telegramTextToJob(telegramText(body), {
      id: `telegram-${post.replace(/[^a-z0-9_-]+/gi, '-')}`,
      url: `https://t.me/${post}`,
      dateIso: datetime,
    }, channel, needle)
    if (job) jobs.push(job)
  }
  return jobs
}

// MTProto sidecar transport (shared with the flat-finder telegram-worker). When
// TELEGRAM_WORKER_URL is set, channel history comes from that worker's /history
// endpoint (a real user session that isn't datacenter-IP throttled like t.me/s).
interface TelegramWorkerMessage { id: number; text: string; date: string | null; preview?: string | null }
async function fetchTelegramChannelViaWorker(
  base: string,
  channel: TelegramChannel,
  q: string,
): Promise<Job[]> {
  const url = `${base.replace(/\/+$/, '')}/history?channel=${encodeURIComponent(channel.handle)}&limit=100`
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`tg-worker @${channel.handle} -> ${res.status}`)
  const data = (await res.json()) as { ok?: boolean; messages?: TelegramWorkerMessage[] }
  if (!data.ok || !Array.isArray(data.messages)) throw new Error(`tg-worker @${channel.handle} bad payload`)
  const needle = q.trim().toLocaleLowerCase('ru')
  const jobs: Job[] = []
  for (const m of data.messages) {
    // Fold the link-preview (webpage title/description) into the text so salary,
    // skills and requirements that only appear on the linked job page are parsed.
    const text = [(m.text || '').trim(), (m.preview || '').trim()].filter(Boolean).join('\n')
    if (!text) continue
    const job = telegramTextToJob(text, {
      id: `telegram-${channel.handle}-${m.id}`,
      url: `https://t.me/${channel.handle}/${m.id}`,
      dateIso: m.date,
    }, channel, needle)
    if (job) jobs.push(job)
  }
  return jobs
}

async function fetchTelegramChannel(channel: TelegramChannel, q: string): Promise<Job[]> {
  // Preferred: the MTProto worker (real user session, not IP-throttled). Falls
  // back to the t.me/s web preview when TELEGRAM_WORKER_URL is not configured.
  const workerUrl = process.env.TELEGRAM_WORKER_URL
  if (workerUrl) return fetchTelegramChannelViaWorker(workerUrl, channel, q)

  const url = `https://t.me/s/${encodeURIComponent(channel.handle)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`t.me/@${channel.handle} -> ${res.status}`)
  return parseTelegramChannelHtml(await res.text(), channel, q)
}

export async function fetchTelegram(q: string): Promise<Job[]> {
  if (process.env.TELEGRAM_SOURCE === 'off') return []
  const includeLowPriority = process.env.TELEGRAM_INCLUDE_LOW_PRIORITY === 'on'
  const channels = TELEGRAM_CHANNELS.filter((channel) => includeLowPriority || channel.priority < 3)
  const jobs: Job[] = []

  // Small batches avoid hammering Telegram and reduce the chance of a 429.
  for (let start = 0; start < channels.length; start += 4) {
    const batch = channels.slice(start, start + 4)
    const results = await Promise.all(
      batch.map((channel) => fetchTelegramChannel(channel, q).catch((err) => {
        console.error(`[jobs] telegram @${channel.handle} failed:`, (err as Error).message)
        return [] as Job[]
      })),
    )
    jobs.push(...results.flat())
  }
  return jobs
}

// ---------- OLX (no key) — Uzbekistan + Kazakhstan classifieds ----------
// OLX exposes a public offers JSON API (the same one its own site calls). It is
// Kept as an explicit opt-in fallback because the public endpoint may be blocked
// by OLX at infrastructure level (403 in the production-like smoke test). Enable
// only after verifying the deployment IP with OLX: OLX_SOURCE=on.
//
// category_id=6 is "Работа" (Jobs). Ads carry created_time AND last_refresh_time;
// we use last_refresh_time as postedAt because an OLX ad that was re-activated is
// an ACTIVE vacancy — the freshness signal that matters to a job seeker — which
// also keeps far more live UZ/KZ roles inside the 14-day cap. Disable with OLX_SOURCE=off.
const OLX_JOBS_CATEGORY = 6
const OLX_HOSTS: { host: string; country: string; countryName: string }[] = [
  { host: 'www.olx.uz', country: 'UZ', countryName: 'Uzbekistan' },
  { host: 'www.olx.kz', country: 'KZ', countryName: 'Kazakhstan' },
]
const OLX_PAGE_SIZE = 50 // API max per request
const OLX_PAGES = 6 // 6 * 50 = up to 300 newest ads per country per refresh

async function fetchOlxHost(
  host: string,
  countryName: string,
  page: number,
): Promise<Job[]> {
  const params = new URLSearchParams({
    offset: String(page * OLX_PAGE_SIZE),
    limit: String(OLX_PAGE_SIZE),
    category_id: String(OLX_JOBS_CATEGORY),
    sort_by: 'created_at:desc',
  })
  const data = await fetchJson<{ data: any[] }>(`https://${host}/api/v1/offers/?${params}`)
  return (data.data || [])
    .filter((o) => o.status === 'active' || !o.status)
    .map((o) => {
      const city = o.location?.city?.name
      const region = o.location?.region?.name
      const location = [city, countryName].filter(Boolean).join(', ') || countryName
      const salary = (o.params || []).find((p: any) => /salary/i.test(p.key))?.value
      const text = `${o.title} ${stripHtml(o.description)}`
      return {
        id: `olx-${host}-${o.id}`,
        title: o.title,
        company: o.user?.name || (o.business ? 'OLX (business)' : 'OLX'),
        location,
        url: o.url,
        source: 'olx' as const,
        remote: /\bremote\b|удал[её]нк|masofaviy|онлайн|online/i.test(text),
        tags: [countryName, region].filter(Boolean),
        // Re-activation date = the ad is a live vacancy now; fall back to first post.
        postedAt: new Date(o.last_refresh_time || o.created_time || Date.now()).toISOString(),
        salaryMin: typeof salary?.from === 'number' ? salary.from : undefined,
        salaryMax: typeof salary?.to === 'number' ? salary.to : undefined,
        salaryCurrency: salary?.currency || undefined,
        description: stripHtml(o.description).slice(0, DESC_MAX),
      }
    })
}

export async function fetchOlx(q: string): Promise<Job[]> {
  if (process.env.OLX_SOURCE !== 'on') return []
  const tasks: Promise<Job[]>[] = []
  for (const { host, countryName } of OLX_HOSTS) {
    for (let page = 0; page < OLX_PAGES; page++) {
      tasks.push(
        fetchOlxHost(host, countryName, page).catch((err) => {
          console.error(`[jobs] olx ${host} p${page} failed:`, (err as Error).message)
          return [] as Job[]
        }),
      )
    }
  }
  const all = (await Promise.all(tasks)).flat()
  if (!q) return all
  const needle = q.toLowerCase()
  return all.filter((j) => `${j.title} ${j.company}`.toLowerCase().includes(needle))
}
