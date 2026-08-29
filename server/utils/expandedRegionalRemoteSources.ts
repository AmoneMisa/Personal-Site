import type { Job } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'

const UA = 'jobFinder/1.0 (job aggregator; contact: admin@whiteslove.me)'
const REQUEST_TIMEOUT_MS = 20_000

type TargetMarket = 'UA' | 'RO' | 'UZ' | 'US' | 'REMOTE'

type LeverTarget = {
  handle: string
  label: string
  market: TargetMarket
  aliases: string[]
}

// Additional direct employers verified live in 2026-08. The same company may
// appear in more than one market when its public Lever board explicitly lists
// vacancies for those countries. URL deduplication collapses overlaps later.
export const EXPANDED_REGIONAL_REMOTE_COMPANIES: LeverTarget[] = [
  // Romania: general operations, customer support, field work, sales and management.
  { handle: 'tsmg', label: 'TSMG', market: 'RO', aliases: ['romania', 'bucharest'] },
  { handle: 'companial', label: 'Companial', market: 'RO', aliases: ['romania', 'bucharest'] },

  // Ukraine: cross-border remote employers plus Binance's Ukraine-specific slice.
  { handle: 'remofirst', label: 'RemoFirst', market: 'UA', aliases: ['ukraine', 'kyiv', 'kiev'] },
  { handle: 'binance', label: 'Binance', market: 'UA', aliases: ['ukraine', 'kyiv', 'kiev'] },

  // Uzbekistan: RemoFirst explicitly includes Uzbekistan in multiple remote roles.
  { handle: 'remofirst', label: 'RemoFirst', market: 'UZ', aliases: ['uzbekistan', 'tashkent', 'toshkent'] },

  // USA / US-remote: support, operations, security, sales and management-heavy boards.
  { handle: 'pointclickcare', label: 'PointClickCare', market: 'US', aliases: ['united states', 'remote - us', 'us remote', 'usa'] },
  { handle: 'atmosera', label: 'Atmosera', market: 'US', aliases: ['united states', 'remote - us', 'remote us', 'usa'] },
  { handle: 'entrata', label: 'Entrata', market: 'US', aliases: ['united states', 'remote - us', 'remote us', 'usa'] },
  { handle: 'Instrumentl', label: 'Instrumentl', market: 'US', aliases: ['united states', 'remote - usa', 'remote usa', 'usa'] },
  { handle: 'lwolf', label: 'Lone Wolf Technologies', market: 'US', aliases: ['united states', 'united states (remote)', 'remote - us', 'usa'] },
  { handle: 'deleteme', label: 'DeleteMe', market: 'US', aliases: ['united states', 'remote - us', 'remote us', 'usa'] },
  { handle: 'protective', label: 'Protective', market: 'US', aliases: ['united states', 'work from home', 'remote - us', 'usa'] },

  // Broad remote sources with explicit worldwide / multi-country remote locations.
  { handle: 'remofirst', label: 'RemoFirst', market: 'REMOTE', aliases: ['remote', 'worldwide', 'distributed'] },
  { handle: 'weloglobal', label: 'Welo Global', market: 'REMOTE', aliases: ['remote', 'worldwide', 'remote - europe'] },
]

type LeverPosting = {
  id?: string
  text?: string
  hostedUrl?: string
  createdAt?: number
  descriptionPlain?: string
  description?: string
  categories?: {
    location?: string
    team?: string
    department?: string
    commitment?: string
  }
  workplaceType?: string
}

function stripHtml(value: unknown): string {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchesTarget(posting: LeverPosting, target: LeverTarget): boolean {
  const location = String(posting.categories?.location || '').toLocaleLowerCase('en')
  const workplace = String(posting.workplaceType || '').toLocaleLowerCase('en')
  const text = `${location} ${workplace}`
  if (!text.trim()) return false
  return target.aliases.some((alias) => text.includes(alias.toLocaleLowerCase('en')))
}

export function mapExpandedLeverPostings(postings: LeverPosting[], target: LeverTarget): Job[] {
  return postings.flatMap((posting) => {
    if (!posting.text || !posting.hostedUrl || !matchesTarget(posting, target)) return []

    const location = posting.categories?.location || (target.market === 'REMOTE' ? 'Remote' : target.market)
    const description = stripHtml(posting.descriptionPlain || posting.description).slice(0, 6000)
    const semanticText = `${posting.text} ${location} ${posting.workplaceType || ''} ${description}`

    return [{
      id: `companies-expanded-${target.market.toLowerCase()}-${target.handle}-${posting.id || posting.hostedUrl}`,
      title: posting.text,
      company: target.label,
      location,
      url: posting.hostedUrl,
      source: 'companies' as const,
      remote: detectWorkModes(semanticText).includes('remote') || /remote/i.test(String(posting.workplaceType || '')),
      tags: [target.market, posting.categories?.team, posting.categories?.department]
        .filter((value): value is string => Boolean(value))
        .slice(0, 8),
      postedAt: new Date(posting.createdAt || Date.now()).toISOString(),
      employmentType: posting.categories?.commitment,
      description: description || undefined,
      employerType: 'direct' as const,
    }]
  })
}

async function fetchLeverBoard(handle: string): Promise<LeverPosting[]> {
  const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(handle)}?mode=json`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${handle} -> ${response.status}`)
  const postings = await response.json() as LeverPosting[]
  return Array.isArray(postings) ? postings : []
}

function filterQuery(jobs: Job[], q: string): Job[] {
  const needle = q.trim().toLocaleLowerCase('en')
  if (!needle) return jobs
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${job.description || ''}`
      .toLocaleLowerCase('en')
      .includes(needle),
  )
}

export async function fetchExpandedRegionalRemoteJobs(q: string): Promise<Job[]> {
  if (String(process.env.EXPANDED_REGIONAL_REMOTE_SOURCE || 'on').toLowerCase() === 'off') return []

  const handles = [...new Set(EXPANDED_REGIONAL_REMOTE_COMPANIES.map((target) => target.handle))]
  const fetched = await Promise.allSettled(handles.map(async (handle) => ({ handle, postings: await fetchLeverBoard(handle) })))
  const postingByHandle = new Map<string, LeverPosting[]>()

  fetched.forEach((result, index) => {
    const handle = handles[index]!
    if (result.status === 'fulfilled') {
      postingByHandle.set(handle, result.value.postings)
      return
    }
    console.warn(
      `[jobs:expanded-regional-remote] ${handle} failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })

  const deduped = new Map<string, Job>()
  for (const target of EXPANDED_REGIONAL_REMOTE_COMPANIES) {
    const postings = postingByHandle.get(target.handle) || []
    for (const job of mapExpandedLeverPostings(postings, target)) deduped.set(job.url || job.id, job)
  }

  return filterQuery([...deduped.values()], q)
}
