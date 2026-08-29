import type { Job } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'

const UA = 'jobFinder/1.0 (job aggregator; contact: admin@whiteslove.me)'
const REQUEST_TIMEOUT_MS = 20_000

export type RegionalCompanyCountry = 'UA' | 'RO' | 'UZ'

type RegionalLeverCompany = {
  handle: string
  label: string
  country: RegionalCompanyCountry
  aliases: string[]
}

// Direct employer feeds verified live in 2026-08. Some employers are global;
// aliases below deliberately keep only vacancies that explicitly target the
// requested country/cities so they do not flood the shared `companies` source.
export const REGIONAL_TECH_COMPANIES: RegionalLeverCompany[] = [
  { handle: 'provectus', label: 'Provectus', country: 'UA', aliases: ['ukraine', 'kyiv', 'kiev', 'odesa', 'odessa', 'lviv'] },
  { handle: 'kyivstar', label: 'Kyivstar', country: 'UA', aliases: ['ukraine', 'kyiv', 'kiev', 'all'] },
  { handle: '3pillarglobal', label: '3Pillar', country: 'RO', aliases: ['romania', 'bucharest', 'cluj', 'iasi', 'timișoara', 'timisoara'] },
  { handle: 'brillio-2', label: 'Brillio', country: 'RO', aliases: ['romania', 'bucharest', 'bihor'] },
  { handle: 'viseven', label: 'Viseven', country: 'RO', aliases: ['romania', 'bucharest'] },
  { handle: 'civitta', label: 'Civitta', country: 'RO', aliases: ['romania', 'bucharest'] },
  { handle: 'binance', label: 'Binance', country: 'UZ', aliases: ['uzbekistan', 'tashkent', 'toshkent'] },
  { handle: 'weloglobal', label: 'Welo Global', country: 'UZ', aliases: ['uzbekistan', 'tashkent', 'toshkent'] },
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

function matchesCountry(posting: LeverPosting, company: RegionalLeverCompany): boolean {
  const location = String(posting.categories?.location || '').toLocaleLowerCase('en')
  if (!location) return false
  return company.aliases.some((alias) => location.includes(alias.toLocaleLowerCase('en')))
}

export function mapRegionalLeverPostings(
  postings: LeverPosting[],
  company: RegionalLeverCompany,
): Job[] {
  return postings.flatMap((posting) => {
    if (!posting.text || !posting.hostedUrl || !matchesCountry(posting, company)) return []

    const location = posting.categories?.location || company.country
    const description = stripHtml(posting.descriptionPlain || posting.description).slice(0, 6000)
    const semanticText = `${posting.text} ${location} ${posting.workplaceType || ''} ${description}`

    return [{
      id: `companies-regional-${company.country.toLowerCase()}-${company.handle}-${posting.id || posting.hostedUrl}`,
      title: posting.text,
      company: company.label,
      location,
      url: posting.hostedUrl,
      source: 'companies' as const,
      remote: detectWorkModes(semanticText).includes('remote') || /remote/i.test(String(posting.workplaceType || '')),
      tags: [company.label, company.country, posting.categories?.team, posting.categories?.department]
        .filter((value): value is string => Boolean(value))
        .slice(0, 8),
      postedAt: new Date(posting.createdAt || Date.now()).toISOString(),
      employmentType: posting.categories?.commitment,
      description: description || undefined,
      employerType: 'direct' as const,
    }]
  })
}

async function fetchLeverCompany(company: RegionalLeverCompany): Promise<Job[]> {
  const response = await fetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company.handle)}?mode=json`,
    {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!response.ok) throw new Error(`${company.label} -> ${response.status}`)
  const postings = await response.json() as LeverPosting[]
  return mapRegionalLeverPostings(Array.isArray(postings) ? postings : [], company)
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

export async function fetchRegionalTechCompanyJobs(q: string): Promise<Job[]> {
  if (String(process.env.REGIONAL_TECH_COMPANY_SOURCE || 'on').toLowerCase() === 'off') return []

  const results = await Promise.allSettled(REGIONAL_TECH_COMPANIES.map(fetchLeverCompany))
  const jobs: Job[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value)
      return
    }
    const company = REGIONAL_TECH_COMPANIES[index]!
    console.warn(
      `[jobs:regional-tech] ${company.label} failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })

  return filterQuery(jobs, q)
}
