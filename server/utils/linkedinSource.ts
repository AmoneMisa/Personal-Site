import type { Job } from './jobTypes'

// LinkedIn does not expose an open job-search API for ordinary applications.
// The official Talent Solutions APIs are partner-restricted and are focused on
// posting/integration. For read-only discovery we use the same public guest
// search endpoint that LinkedIn serves to signed-out visitors. It is deliberately
// isolated behind LINKEDIN_SOURCE so a markup/endpoint change never affects the
// rest of Job Finder.

const LINKEDIN_SEARCH_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'

const DEFAULT_LOCATIONS = [
  'Uzbekistan',
  'Ukraine',
  'Kazakhstan',
  'Kyrgyzstan',
  'Georgia',
  'Romania',
  'Moldova',
]

const REQUEST_TIMEOUT_MS = 10_000
const FRESHNESS_SECONDS = 14 * 24 * 60 * 60
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
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
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function classText(html: string, tag: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(
    new RegExp(
      `<${tag}[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      'i',
    ),
  )
  return stripHtml(match?.[1])
}

function configuredLocations(): string[] {
  const configured = process.env.LINKEDIN_LOCATIONS
  if (!configured) return DEFAULT_LOCATIONS

  const locations = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return locations.length ? locations : DEFAULT_LOCATIONS
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
    const posted = datetime && !Number.isNaN(Date.parse(datetime))
      ? new Date(datetime)
      : new Date()

    jobs.push({
      id: `linkedin-${jobId}`,
      title,
      company,
      location,
      url: `https://www.linkedin.com/jobs/view/${jobId}`,
      source: 'linkedin',
      remote: /remote|anywhere|worldwide|удал[её]н|віддален/i.test(`${title} ${location}`),
      tags: ['LinkedIn'],
      postedAt: posted.toISOString(),
    })
  }

  return jobs
}

async function fetchLocation(location: string, q: string): Promise<Job[]> {
  const params = new URLSearchParams({
    location,
    start: '0',
    sortBy: 'DD',
    f_TPR: `r${FRESHNESS_SECONDS}`,
  })
  if (q) params.set('keywords', q)

  const response = await fetch(`${LINKEDIN_SEARCH_URL}?${params}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`LinkedIn ${location} -> ${response.status}`)
  }

  return parseCards(await response.text())
}

export async function fetchLinkedInJobs(q: string): Promise<Job[]> {
  if (process.env.LINKEDIN_SOURCE === 'off') return []

  const results = await Promise.allSettled(
    configuredLocations().map((location) => fetchLocation(location, q)),
  )

  const byId = new Map<string, Job>()
  for (const result of results) {
    if (result.status !== 'fulfilled') {
      console.error('[jobs] linkedin location failed:', result.reason instanceof Error
        ? result.reason.message
        : String(result.reason))
      continue
    }
    for (const job of result.value) byId.set(job.id, job)
  }

  return [...byId.values()]
}
