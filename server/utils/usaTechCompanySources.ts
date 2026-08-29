import { detectUsLocation } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import type { Job } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'

const UA = 'jobFinder/1.0 (job aggregator; contact: admin@whiteslove.me)'
const REQUEST_TIMEOUT_MS = 20_000
const MAX_DESCRIPTION = 12_000

type GreenhouseCompany = {
  handle: string
  label: string
}

// Additional US-focused technology employers with public Greenhouse Job Board
// API feeds. These intentionally live outside sources.ts's broad default seed
// list so the USA expansion can be disabled independently without changing the
// public `companies` source contract or the UI source selector.
export const USA_TECH_GREENHOUSE_COMPANIES: GreenhouseCompany[] = [
  { handle: 'okta', label: 'Okta' },
  { handle: 'snowflake', label: 'Snowflake' },
  { handle: 'doordashusa', label: 'DoorDash' },
  { handle: 'pagerduty', label: 'PagerDuty' },
  { handle: 'hashicorp', label: 'HashiCorp' },
  { handle: 'rippling', label: 'Rippling' },
  { handle: 'confluent', label: 'Confluent' },
  { handle: 'dbtlabs', label: 'dbt Labs' },
  { handle: 'fivetran', label: 'Fivetran' },
  { handle: 'retool', label: 'Retool' },
  { handle: 'intercom', label: 'Intercom' },
  { handle: 'mercury', label: 'Mercury' },
  { handle: 'huggingface', label: 'Hugging Face' },
  { handle: 'characterai', label: 'Character.AI' },
  { handle: 'yugabyte', label: 'Yugabyte' },
  { handle: 'zoominfo', label: 'ZoomInfo' },
  { handle: 'miro', label: 'Miro' },
]

type GreenhouseJob = {
  id?: number | string
  title?: string
  absolute_url?: string
  updated_at?: string
  content?: string
  location?: { name?: string }
  departments?: Array<{ name?: string }>
  offices?: Array<{ name?: string; location?: string }>
}

function stripHtml(value: unknown): string {
  return String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isUsJob(job: GreenhouseJob): boolean {
  const location = job.location?.name || ''
  const officeText = (job.offices || [])
    .map((office) => `${office.name || ''} ${office.location || ''}`)
    .join(' ')
  const text = `${location} ${officeText}`.trim()

  return detectUsLocation(text)
    || /\b(?:United States|USA|U\.S\.|US Remote|Remote(?:\s*-|,)\s*US)\b/i.test(text)
}

export function mapUsGreenhouseJobs(
  company: GreenhouseCompany,
  items: GreenhouseJob[],
): Job[] {
  const now = new Date().toISOString()
  return items.flatMap((item) => {
    const title = stripHtml(item.title)
    const url = String(item.absolute_url || '').trim()
    if (!title || !url || !isUsJob(item)) return []

    const location = stripHtml(item.location?.name || '') || 'United States'
    const description = stripHtml(item.content).slice(0, MAX_DESCRIPTION)
    const departmentTags = (item.departments || [])
      .map((department) => stripHtml(department.name))
      .filter(Boolean)
      .slice(0, 4)

    const postedAt = item.updated_at && Number.isFinite(Date.parse(item.updated_at))
      ? new Date(item.updated_at).toISOString()
      : now

    return [{
      id: `companies-us-gh-${company.handle}-${item.id || url}`,
      title,
      company: company.label,
      location,
      url,
      source: 'companies' as const,
      remote: detectWorkModes(`${title} ${location} ${description}`).includes('remote'),
      tags: [...new Set([company.label, 'USA', ...departmentTags])].slice(0, 8),
      postedAt,
      description: description || undefined,
      employerType: 'direct' as const,
    }]
  })
}

async function fetchCompany(company: GreenhouseCompany): Promise<Job[]> {
  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company.handle)}/jobs?content=true`,
    {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!response.ok) throw new Error(`${company.label} -> ${response.status}`)
  const payload = await response.json() as { jobs?: GreenhouseJob[] }
  return mapUsGreenhouseJobs(company, Array.isArray(payload.jobs) ? payload.jobs : [])
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

export async function fetchUsaTechCompanyJobs(q: string): Promise<Job[]> {
  if (String(process.env.USA_TECH_COMPANY_SOURCE || 'on').toLowerCase() === 'off') return []

  const results = await Promise.allSettled(USA_TECH_GREENHOUSE_COMPANIES.map(fetchCompany))
  const byUrl = new Map<string, Job>()

  results.forEach((result, index) => {
    const company = USA_TECH_GREENHOUSE_COMPANIES[index]!
    if (result.status === 'rejected') {
      console.warn(
        `[jobs:usa-tech] ${company.label} failed:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      return
    }
    for (const job of result.value) byUrl.set(job.url, job)
  })

  return filterQuery([...byUrl.values()], q)
}
