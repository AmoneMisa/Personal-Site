import type { Job } from './jobTypes'
import {
  REMOTE_JOB_QUERIES,
  USA_RELOCATION_QUERIES,
  linkedinLocationCoverage,
  rotatingSlice,
} from './jobSearchCoverage'
import { detectWorkModes } from './hiringLexicon'

// LinkedIn does not expose an open job-search API for ordinary applications.
// The official Talent Solutions APIs are partner-restricted. Read-only discovery
// uses the public guest endpoint served to signed-out visitors.
const LINKEDIN_SEARCH_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'

const BASE_LOCATIONS = [
  'Uzbekistan',
  'Ukraine',
  'Kazakhstan',
  'Kyrgyzstan',
  'Georgia',
  'Romania',
  'Moldova',
]

const REQUEST_TIMEOUT_MS = Math.max(
  5_000,
  Math.min(30_000, Number(process.env.LINKEDIN_REQUEST_TIMEOUT_MS) || 10_000),
)
const FRESHNESS_SECONDS = 14 * 24 * 60 * 60
const MAX_PAGES = Math.max(1, Math.min(8, Number(process.env.LINKEDIN_MAX_PAGES) || 4))
const REGIONAL_LOCATIONS_PER_CYCLE = Math.max(
  4,
  Math.min(30, Number(process.env.LINKEDIN_REGIONAL_LOCATIONS_PER_CYCLE) || 10),
)
const PRIORITY_QUERIES_PER_CYCLE = Math.max(
  2,
  Math.min(8, Number(process.env.LINKEDIN_PRIORITY_QUERIES_PER_CYCLE) || 4),
)
const LOCATION_CONCURRENCY = Math.max(
  1,
  Math.min(8, Number(process.env.LINKEDIN_LOCATION_CONCURRENCY) || 4),
)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hex = entity[1]?.toLowerCase() === 'x'
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return named[entity.toLowerCase()] ?? match
  })
}

function stripHtml(value: string | undefined): string {
  if (!value) return ''
  return decodeEntities(value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function classText(html: string, tag: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(`<${tag}[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  )
  return stripHtml(match?.[1])
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

function parseCards(html: string): Job[] {
  const jobs: Job[] = []
  for (const part of html.split(/<li\b/i).slice(1)) {
    const card = `<li${part}`
    const jobId = extractJobId(card)
    if (!jobId) continue

    const title = classText(card, 'h3', 'base-search-card__title')
    if (!title) continue
    const company = classText(card, 'h4', 'base-search-card__subtitle') || 'Unknown'
    const location = classText(card, 'span', 'job-search-card__location') || 'See listing'
    const datetime = card.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1]
    const posted = datetime && !Number.isNaN(Date.parse(datetime)) ? new Date(datetime) : new Date()

    jobs.push({
      id: `linkedin-${jobId}`,
      title,
      company,
      location,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      source: 'linkedin',
      remote: detectWorkModes(`${title} ${location}`).includes('remote'),
      tags: ['LinkedIn'],
      postedAt: posted.toISOString(),
    })
  }
  return jobs
}

async function fetchPage(location: string, keywords: string, start: number): Promise<Job[]> {
  const params = new URLSearchParams({
    location,
    start: String(start),
    sortBy: 'DD',
    f_TPR: `r${FRESHNESS_SECONDS}`,
  })
  if (keywords) params.set('keywords', keywords)

  const response = await fetch(`${LINKEDIN_SEARCH_URL}?${params}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`LinkedIn ${location} start=${start} -> ${response.status}`)
  return parseCards(await response.text())
}

async function fetchLocation(
  location: string,
  keywords: string,
  { maxPages = MAX_PAGES, tags = [], forceRemote = false }: { maxPages?: number, tags?: string[], forceRemote?: boolean } = {},
): Promise<Job[]> {
  const byId = new Map<string, Job>()
  for (let page = 0; page < maxPages; page += 1) {
    const jobs = await fetchPage(location, keywords, page * 25)
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
}

function priorityPasses(q: string): SearchPass[] {
  const priority = [
    ...REMOTE_JOB_QUERIES.map((keywords) => ({
      location: 'Worldwide',
      keywords: q ? `${q} ${keywords}` : keywords,
      maxPages: 2,
      tags: ['Remote search', 'Worldwide remote'],
      forceRemote: true,
    })),
    ...USA_RELOCATION_QUERIES.map((keywords) => ({
      location: 'United States',
      keywords: q ? `${q} ${keywords}` : keywords,
      maxPages: 2,
      tags: ['USA relocation search', 'Visa/relocation search'],
      forceRemote: false,
    })),
  ]
  return rotatingSlice(priority, PRIORITY_QUERIES_PER_CYCLE, 30)
}

function countryRemotePasses(q: string): SearchPass[] {
  return [
    { location: 'Uzbekistan', keywords: q ? `${q} remote` : 'remote', maxPages: 2, tags: ['Remote Uzbekistan'], forceRemote: true },
    { location: 'Kazakhstan', keywords: q ? `${q} remote` : 'remote', maxPages: 2, tags: ['Remote Kazakhstan'], forceRemote: true },
    { location: 'Ukraine', keywords: q ? `${q} remote` : 'remote', maxPages: 2, tags: ['Remote Ukraine'], forceRemote: true },
    { location: 'Romania', keywords: q ? `${q} remote` : 'remote', maxPages: 2, tags: ['Remote Romania'], forceRemote: true },
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
  return [...byId.values()]
}
