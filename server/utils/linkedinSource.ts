import type { Job } from './jobTypes'
import {
  REMOTE_JOB_QUERIES,
  USA_RELOCATION_QUERIES,
  linkedinLocationCoverage,
  rotatingSlice,
} from './jobSearchCoverage'
import { detectWorkModes } from './hiringLexicon'
import { decodeHtmlEntities } from './htmlText'

// Read-only LinkedIn collector. Search uses the public guest endpoint exposed to
// signed-out visitors; detail pages are fetched separately so discovery stays
// cheap and one broken detail parser cannot stop the whole source.
const LINKEDIN_BASE_URL = 'https://www.linkedin.com'
const LINKEDIN_SEARCH_URL =
  `${LINKEDIN_BASE_URL}/jobs-guest/jobs/api/seeMoreJobPostings/search`

const BASE_LOCATIONS = [
  'Uzbekistan',
  'Ukraine',
  'Kazakhstan',
  'Kyrgyzstan',
  'Georgia',
  'Romania',
  'Moldova',
]

const REQUEST_TIMEOUT_MS = clampEnv('LINKEDIN_REQUEST_TIMEOUT_MS', 10_000, 5_000, 30_000)
const DETAIL_TIMEOUT_MS = clampEnv('LINKEDIN_DETAIL_TIMEOUT_MS', 10_000, 5_000, 30_000)
const FRESHNESS_DAYS = clampEnv('LINKEDIN_FRESHNESS_DAYS', 14, 1, 30)
const MAX_PAGES = clampEnv('LINKEDIN_MAX_PAGES', 4, 1, 8)
const REGIONAL_LOCATIONS_PER_CYCLE = clampEnv('LINKEDIN_REGIONAL_LOCATIONS_PER_CYCLE', 10, 4, 30)
const PRIORITY_QUERIES_PER_CYCLE = clampEnv('LINKEDIN_PRIORITY_QUERIES_PER_CYCLE', 4, 2, 8)
const LOCATION_CONCURRENCY = clampEnv('LINKEDIN_LOCATION_CONCURRENCY', 4, 1, 8)
const DETAIL_CONCURRENCY = clampEnv('LINKEDIN_DETAIL_CONCURRENCY', 6, 1, 12)
const DETAILS_LIMIT_PER_CYCLE = clampEnv('LINKEDIN_DETAILS_LIMIT_PER_CYCLE', 64, 0, 500)
const PAGE_DELAY_MS = clampEnv('LINKEDIN_PAGE_DELAY_MS', 800, 0, 5_000)
const PAGE_DELAY_BAND_MS = clampEnv('LINKEDIN_PAGE_DELAY_BAND_MS', 900, 0, 5_000)
const FRESHNESS_SECONDS = FRESHNESS_DAYS * 24 * 60 * 60
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export type LinkedInSourceHealth = {
  requests: number
  successes: number
  rateLimited: number
  parseFailures: number
  emptyPages: number
  detailRequests: number
  detailSuccesses: number
  closedJobs: number
  lastSuccessAt: string | null
  lastError: string | null
}

const health: LinkedInSourceHealth = {
  requests: 0,
  successes: 0,
  rateLimited: 0,
  parseFailures: 0,
  emptyPages: 0,
  detailRequests: 0,
  detailSuccesses: 0,
  closedJobs: 0,
  lastSuccessAt: null,
  lastError: null,
}

function clampEnv(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name])
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback))
}

function csvEnv(name: string): string[] {
  return String(process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function boolEnv(name: string): boolean {
  return /^(?:1|true|yes|on)$/i.test(String(process.env[name] || ''))
}

function recordError(error: unknown) {
  health.lastError = error instanceof Error ? error.message : String(error)
}

export function linkedinSourceHealth(): Readonly<LinkedInSourceHealth> {
  return Object.freeze({ ...health })
}

// LinkedIn descriptions are structured prose rather than flat labels. Keep the
// source-specific paragraph/list boundaries here, but delegate entity decoding
// to the shared infrastructure helper so every source interprets entities alike.
function linkedinText(value: string | undefined): string {
  if (!value) return ''
  return decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p\s*>/gi, '\n')
      .replace(/<\/li\s*>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function classText(html: string, tag: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(`<${tag}[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  )
  return linkedinText(match?.[1])
}

function classBlock(html: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(`<([a-z0-9]+)[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  )
  return match?.[2] || ''
}

function attributeBlock(html: string, attribute: string, value: string): string {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(`<([a-z0-9]+)[^>]*${escapedAttribute}=["'][^"']*${escapedValue}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  )
  return match?.[2] || ''
}

export type LinkedInJobAvailability = 'active' | 'closed' | 'unknown'

/**
 * Only explicit, visible LinkedIn status copy is authoritative. A missing
 * button, a sign-in wall or a failed request must never retire a vacancy.
 */
export function parseLinkedInJobAvailability(html: string): LinkedInJobAvailability {
  const visibleText = linkedinText(html)
  if (/\b(?:no longer accepting applications|applications? (?:are )?closed)\b/i.test(visibleText)
    || /(?:заявки на эту вакансию больше не принимаются|при[её]м заявок (?:заверш[её]н|закрыт)|вакансия закрыта)/iu.test(visibleText)) {
    return 'closed'
  }
  if (/(?:подать заявку|откликнуться|apply(?: now)?|easy apply)/iu.test(visibleText)) return 'active'
  return 'unknown'
}

function configuredLocations(): string[] {
  const configured = process.env.LINKEDIN_LOCATIONS
  if (configured) {
    const locations = configured.split(',').map((value) => value.trim()).filter(Boolean)
    if (locations.length) return locations
  }

  const regional = linkedinLocationCoverage()
    .map((place) => place.location)
    .filter((location) => !BASE_LOCATIONS.includes(location))
  return [
    ...BASE_LOCATIONS,
    ...rotatingSlice(regional, REGIONAL_LOCATIONS_PER_CYCLE, 30),
  ]
}

function extractJobId(card: string): string | undefined {
  return card.match(/urn:li:jobPosting:(\d+)/i)?.[1]
    || card.match(/\/jobs\/view\/(?:[^"'?/]*-)?(\d+)(?:[/?"'])/i)?.[1]
}

function parseSalaryText(value: string): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const text = linkedinText(value)
  if (!text) return {}
  const currency = /\bUSD\b/i.test(text) || text.includes('$') ? 'USD'
    : /\bEUR\b/i.test(text) || text.includes('€') ? 'EUR'
      : /\bGBP\b/i.test(text) || text.includes('£') ? 'GBP'
        : /\bUAH\b/i.test(text) || text.includes('₴') ? 'UAH'
          : /\bKZT\b/i.test(text) || text.includes('₸') ? 'KZT'
            : text.match(/\b[A-Z]{3}\b/)?.[0]

  const amounts = [...text.matchAll(/(?:^|[^\p{L}\d])([\d][\d\s,.]*)/gu)]
    .map((match) => Number(match[1]!.replace(/[^\d.]/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  if (!amounts.length) return currency ? { salaryCurrency: currency } : {}
  const salaryMin = amounts[0]
  const salaryMax = amounts.length > 1 ? amounts[1] : amounts[0]
  return { salaryMin, salaryMax, ...(currency ? { salaryCurrency: currency } : {}) }
}

export function parseLinkedInJobCards(html: string): Job[] {
  const jobs: Job[] = []
  for (const part of html.split(/<li\b/i).slice(1)) {
    const card = `<li${part}`
    const jobId = extractJobId(card)
    if (!jobId) continue

    const title = classText(card, 'h3', 'base-search-card__title')
    if (!title) continue
    const company = classText(card, 'h4', 'base-search-card__subtitle') || 'Unknown'
    const location = classText(card, 'span', 'job-search-card__location') || 'See listing'
    const salaryText = classText(card, 'span', 'job-search-card__salary-info')
    const datetime = card.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]
    const posted = datetime && !Number.isNaN(Date.parse(datetime)) ? new Date(datetime) : new Date()

    jobs.push({
      id: `linkedin-${jobId}`,
      title,
      company,
      location,
      url: `${LINKEDIN_BASE_URL}/jobs/view/${jobId}`,
      source: 'linkedin',
      remote: detectWorkModes(`${title} ${location}`).includes('remote'),
      tags: ['LinkedIn'],
      postedAt: posted.toISOString(),
      ...parseSalaryText(salaryText),
    })
  }
  return jobs
}

function criteriaFromDetail(html: string): Map<string, string> {
  const criteria = new Map<string, string>()
  const itemRe = /<li[^>]*class=["'][^"']*description__job-criteria-item[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi
  for (const match of html.matchAll(itemRe)) {
    const item = match[1] || ''
    const label = classText(item, 'h3', 'description__job-criteria-subheader').toLowerCase()
    const value = classText(item, 'span', 'description__job-criteria-text')
    if (label && value) criteria.set(label, value)
  }
  return criteria
}

function directApplyUrl(html: string): string | undefined {
  const code = html.match(/<code\b[^>]*id=["']applyUrl["'][^>]*>([\s\S]*?)<\/code>/i)?.[1]
  if (!code) return undefined
  const decoded = decodeHtmlEntities(linkedinText(code))
  const match = decoded.match(/(?:\?|&)url=([^"'\s&]+)/i)
  if (!match?.[1]) return undefined
  try {
    const url = decodeURIComponent(match[1])
    return /^https?:\/\//i.test(url) ? url : undefined
  } catch {
    return undefined
  }
}

export function parseLinkedInJobDetail(html: string): Partial<Job> {
  // Guest pages use show-more-less-html__markup. Authenticated LinkedIn pages
  // deliberately rotate CSS class names, but retain this semantic test id.
  const description = linkedinText(
    classBlock(html, 'show-more-less-html__markup')
      || attributeBlock(html, 'data-testid', 'expandable-text-box'),
  )
  const criteria = criteriaFromDetail(html)
  const seniority = criteria.get('seniority level')
  const employmentType = criteria.get('employment type')
  const jobFunction = criteria.get('job function')
  const industries = criteria.get('industries') || criteria.get('industry')
  const salaryText = classText(html, 'div', 'compensation__salary')
    || classText(html, 'span', 'compensation__salary')
  const tags = [seniority, jobFunction, industries].filter((value): value is string => Boolean(value))

  const applyUrl = directApplyUrl(html)
  const availability = parseLinkedInJobAvailability(html)
  return {
    ...(description ? { description: description.slice(0, 20_000) } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(tags.length ? { tags } : {}),
    ...(applyUrl ? { applyUrl } : {}),
    ...(availability === 'closed' ? { vacancyStatus: 'closed' } : {}),
    ...parseSalaryText(salaryText),
  }
}

type LinkedInSearchFilters = {
  remoteOnly?: boolean
  easyApply?: boolean
  jobTypes?: string[]
  companyIds?: string[]
  distance?: number
}

function configuredFilters(passRemoteOnly = false): LinkedInSearchFilters {
  const distance = Number(process.env.LINKEDIN_DISTANCE)
  return {
    remoteOnly: passRemoteOnly || boolEnv('LINKEDIN_REMOTE_ONLY'),
    easyApply: boolEnv('LINKEDIN_EASY_APPLY'),
    jobTypes: csvEnv('LINKEDIN_JOB_TYPES'),
    companyIds: csvEnv('LINKEDIN_COMPANY_IDS'),
    distance: Number.isFinite(distance) && distance >= 0 ? distance : undefined,
  }
}

export function buildLinkedInSearchParams(
  location: string,
  keywords: string,
  start: number,
  filters: LinkedInSearchFilters = {},
): URLSearchParams {
  const params = new URLSearchParams({
    location,
    start: String(start),
    pageNum: '0',
    sortBy: 'DD',
    f_TPR: `r${FRESHNESS_SECONDS}`,
  })
  if (keywords) params.set('keywords', keywords)
  if (filters.distance !== undefined) params.set('distance', String(filters.distance))
  if (filters.remoteOnly) params.set('f_WT', '2')
  if (filters.easyApply) params.set('f_AL', 'true')
  if (filters.jobTypes?.length) params.set('f_JT', filters.jobTypes.join(','))
  if (filters.companyIds?.length) params.set('f_C', filters.companyIds.join(','))
  return params
}

async function linkedinFetch(url: string, timeoutMs: number): Promise<Response> {
  health.requests += 1
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (response.status === 429) health.rateLimited += 1
    if (response.ok) {
      health.successes += 1
      health.lastSuccessAt = new Date().toISOString()
    } else {
      health.lastError = `HTTP ${response.status} for ${new URL(url).pathname}`
    }
    return response
  } catch (error) {
    recordError(error)
    throw error
  }
}

async function fetchPage(
  location: string,
  keywords: string,
  start: number,
  filters: LinkedInSearchFilters,
): Promise<Job[]> {
  const params = buildLinkedInSearchParams(location, keywords, start, filters)
  const response = await linkedinFetch(`${LINKEDIN_SEARCH_URL}?${params}`, REQUEST_TIMEOUT_MS)
  if (!response.ok) throw new Error(`LinkedIn ${location} start=${start} -> ${response.status}`)
  const html = await response.text()
  const jobs = parseLinkedInJobCards(html)
  if (!jobs.length) health.emptyPages += 1
  return jobs
}

async function fetchJobDetail(job: Job): Promise<Job> {
  const jobId = job.id.replace(/^linkedin-/, '')
  if (!/^\d+$/.test(jobId)) return job
  health.detailRequests += 1
  try {
    const response = await linkedinFetch(`${LINKEDIN_BASE_URL}/jobs/view/${jobId}`, DETAIL_TIMEOUT_MS)
    if (!response.ok || /linkedin\.com\/signup/i.test(response.url)) return job
    const html = await response.text()
    const detail = parseLinkedInJobDetail(html)
    health.detailSuccesses += 1
    if (detail.vacancyStatus === 'closed') health.closedJobs += 1
    return {
      ...job,
      ...detail,
      tags: [...new Set([...(job.tags || []), ...(detail.tags || [])])],
      remote: job.remote || detectWorkModes(`${job.title} ${job.location} ${detail.description || ''}`).includes('remote'),
    }
  } catch (error) {
    health.parseFailures += 1
    recordError(error)
    return job
  }
}

async function enrichDetails(jobs: Job[]): Promise<Job[]> {
  if (DETAILS_LIMIT_PER_CYCLE <= 0) return jobs
  const selected = jobs.slice(0, DETAILS_LIMIT_PER_CYCLE)
  const byId = new Map(jobs.map((job) => [job.id, job]))
  for (let offset = 0; offset < selected.length; offset += DETAIL_CONCURRENCY) {
    const chunk = selected.slice(offset, offset + DETAIL_CONCURRENCY)
    const enriched = await Promise.all(chunk.map(fetchJobDetail))
    for (const job of enriched) byId.set(job.id, job)
  }
  return [...byId.values()]
}

async function delayBetweenPages() {
  if (PAGE_DELAY_MS <= 0 && PAGE_DELAY_BAND_MS <= 0) return
  const jitter = PAGE_DELAY_BAND_MS ? Math.floor(Math.random() * PAGE_DELAY_BAND_MS) : 0
  await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS + jitter))
}

async function fetchLocation(
  location: string,
  keywords: string,
  {
    maxPages = MAX_PAGES,
    tags = [],
    forceRemote = false,
    remoteOnly = false,
  }: { maxPages?: number, tags?: string[], forceRemote?: boolean, remoteOnly?: boolean } = {},
): Promise<Job[]> {
  const byId = new Map<string, Job>()
  const filters = configuredFilters(remoteOnly)
  for (let page = 0; page < maxPages; page += 1) {
    const start = page * 25
    if (start >= 1_000) break
    const jobs = await fetchPage(location, keywords, start, filters)
    if (!jobs.length) break
    const before = byId.size
    for (const job of jobs) {
      byId.set(job.id, {
        ...job,
        remote: forceRemote || job.remote,
        tags: [...new Set([...(job.tags || []), ...tags])],
      })
    }
    if (byId.size === before) break
    if (page + 1 < maxPages) await delayBetweenPages()
  }
  console.log(`[jobs:linkedin] location=${location} query=${keywords || '<all>'} jobs=${byId.size}`)
  return [...byId.values()]
}

type SearchPass = {
  location: string
  keywords: string
  maxPages?: number
  tags?: string[]
  forceRemote?: boolean
  remoteOnly?: boolean
}

function priorityPasses(q: string): SearchPass[] {
  const priority = [
    ...REMOTE_JOB_QUERIES.map((keywords) => ({
      location: 'Worldwide',
      keywords: q ? `${q} ${keywords}` : keywords,
      maxPages: 2,
      tags: ['Remote search', 'Worldwide remote'],
      forceRemote: true,
      remoteOnly: true,
    })),
    ...USA_RELOCATION_QUERIES.map((keywords) => ({
      location: 'United States',
      keywords: q ? `${q} ${keywords}` : keywords,
      maxPages: 2,
      tags: ['USA relocation search', 'Visa/relocation search'],
      forceRemote: false,
      remoteOnly: false,
    })),
  ]
  return rotatingSlice(priority, PRIORITY_QUERIES_PER_CYCLE, 30)
}

function countryRemotePasses(q: string): SearchPass[] {
  return [
    { location: 'Uzbekistan', keywords: q, maxPages: 2, tags: ['Remote Uzbekistan'], forceRemote: true, remoteOnly: true },
    { location: 'Kazakhstan', keywords: q, maxPages: 2, tags: ['Remote Kazakhstan'], forceRemote: true, remoteOnly: true },
    { location: 'Ukraine', keywords: q, maxPages: 2, tags: ['Remote Ukraine'], forceRemote: true, remoteOnly: true },
    { location: 'Romania', keywords: q, maxPages: 2, tags: ['Remote Romania'], forceRemote: true, remoteOnly: true },
  ]
}

async function runPasses(passes: SearchPass[]): Promise<Job[]> {
  const byId = new Map<string, Job>()
  for (let offset = 0; offset < passes.length; offset += LOCATION_CONCURRENCY) {
    const chunk = passes.slice(offset, offset + LOCATION_CONCURRENCY)
    const settled = await Promise.allSettled(
      chunk.map((pass) => fetchLocation(pass.location, pass.keywords, pass)),
    )
    settled.forEach((result, index) => {
      const pass = chunk[index]!
      if (result.status === 'fulfilled') {
        for (const job of result.value) byId.set(job.id, job)
      } else {
        recordError(result.reason)
        console.error(
          `[jobs] linkedin failed (${pass.location}; ${pass.keywords || '<all>'}):`,
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        )
      }
    })
  }
  return [...byId.values()]
}

export async function fetchLinkedInJobs(q: string): Promise<Job[]> {
  if (process.env.LINKEDIN_SOURCE === 'off') return []

  const standardPasses: SearchPass[] = configuredLocations().map((location) => ({ location, keywords: q }))
  const passes = [
    ...standardPasses,
    ...countryRemotePasses(q),
    ...priorityPasses(q),
  ]
  const jobs = await runPasses(passes)
  const byId = new Map<string, Job>()
  for (const job of jobs) byId.set(job.id, job)
  const unique = [...byId.values()]
  const enriched = await enrichDetails(unique)
  console.log(
    `[jobs:linkedin] total=${enriched.length} details=${health.detailSuccesses}/${health.detailRequests} `
      + `requests=${health.requests} rateLimited=${health.rateLimited}`,
  )
  return enriched
}
