import { moneyCurrencyFromText } from '@whiteslove/parsing-lexicon/currency'
import { detectEmploymentTypes, detectWorkModes, detectWorkSchedules } from '@whiteslove/parsing-lexicon/hiring-work-semantics'
import type { Job } from './jobTypes'

const BASE_URL = 'https://jobs.ua/vacancy'
const REQUEST_TIMEOUT_MS = 20_000
const DEFAULT_MAX_PAGES = 2
const MAX_PAGES_LIMIT = 10
const DEFAULT_REQUEST_DELAY_MS = 1_000
const MAX_DESCRIPTION = 1_200

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
}

function stripHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  ).replace(/\s+/g, ' ').trim()
}

function attribute(fragment: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = fragment.match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'))
  return decodeEntities(match?.[2] || '').trim()
}

function taggedContent(fragment: string, className: string): string {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = fragment.match(
    new RegExp(`<([a-z][\\w:-]*)\\b[^>]*class=["'][^"']*\\b${escaped}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'),
  )
  return match?.[2] || ''
}

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function salaryFrom(value: string): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'> {
  const text = stripHtml(value)
  if (!text) return {}

  const amounts = [...text.matchAll(/\d[\d\s.,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/\D/g, ''), 10))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
  if (!amounts.length) return {}

  const salaryCurrency = moneyCurrencyFromText(text) || undefined

  const salaryMin = amounts[0]
  const salaryMax = amounts.length > 1 ? amounts[1] : amounts[0]
  return {
    salaryMin: Math.min(salaryMin!, salaryMax!),
    salaryMax: Math.max(salaryMin!, salaryMax!),
    salaryCurrency,
    salaryPeriod: 'month',
  }
}

function scheduleFrom(card: string): string {
  const match = card.match(
    /<span\b[^>]*class=["'][^"']*caption[^"']*["'][^>]*>\s*(?:Графік роботи|График работы)\s*:\s*<\/span>\s*<span\b[^>]*class=["'][^"']*black-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/iu,
  )
  return stripHtml(match?.[1] || '')
}

function workFields(schedule: string): Pick<Job, 'remote' | 'workMode' | 'employmentKind' | 'workSchedules'> {
  const remote = detectWorkModes(schedule).includes('remote')
  const parttime = detectEmploymentTypes(schedule).includes('part_time')
  const shift = detectWorkSchedules(schedule).includes('shift')
  return {
    remote,
    workMode: remote ? 'remote' : 'office',
    employmentKind: parttime ? 'parttime' : 'fulltime',
    workSchedules: shift ? ['shift'] : undefined,
  }
}

function cardsFrom(html: string): string[] {
  const starts = [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bb-vacancy__item\b[^"']*["'][^>]*>/gi)]
  return starts.map((match, index) => {
    const start = match.index || 0
    const next = starts[index + 1]?.index
    return html.slice(start, next === undefined ? Math.min(html.length, start + 30_000) : next)
  })
}

/** Parse only the public vacancy-list cards; no vacancy detail requests are needed. */
export function parseJobsUaVacancies(html: string, now = new Date()): Job[] {
  const jobs: Job[] = []
  const seen = new Set<string>()

  for (const card of cardsFrom(html)) {
    const opening = card.match(/^<li\b[^>]*>/i)?.[0] || ''
    const numericId = attribute(opening, 'id')
    const titleTag = card.match(
      /<a\b([^>]*class=["'][^"']*\bb-vacancy__top__title\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/i,
    )
    const title = stripHtml(titleTag?.[2] || '')
    const rawHref = attribute(titleTag?.[1] || '', 'href')
    if (!numericId || !/^\d+$/.test(numericId) || !title || !rawHref || seen.has(numericId)) continue

    let url: URL
    try {
      url = new URL(rawHref, BASE_URL)
    } catch {
      continue
    }
    if (!/(?:^|\.)jobs\.ua$/i.test(url.hostname) || !/\/job-[^/?#]+-\d+/i.test(url.pathname)) continue

    const tech = taggedContent(card, 'b-vacancy__tech')
    const companyTag = tech.match(/<span\b([^>]*class=["'][^"']*\blink__hidden\b[^"']*["'][^>]*)>([\s\S]*?)<\/span>/i)
    const company = stripHtml(attribute(companyTag?.[1] || '', 'title') || companyTag?.[2] || '')
    const cityTag = tech.match(/<a\b[^>]*href=["'][^"']*\/city\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
    const city = stripHtml(cityTag?.[1] || '')
    const description = stripHtml(taggedContent(card, 'b-text')).slice(0, MAX_DESCRIPTION)
    const schedule = scheduleFrom(card)
    const salary = salaryFrom(taggedContent(card, 'b-vacancy__top__pay'))

    seen.add(numericId)
    jobs.push({
      id: `companies-jobs-ua-${numericId}`,
      title,
      company: company || 'Jobs.ua employer',
      location: city ? `${city}, Ukraine` : 'Ukraine',
      city: city || undefined,
      country: 'UA',
      url: url.toString(),
      applyUrl: url.toString(),
      source: 'companies',
      tags: ['Jobs.ua'],
      postedAt: now.toISOString(),
      description: description || undefined,
      employmentType: schedule || undefined,
      schedule: schedule || undefined,
      employerType: 'board',
      ...workFields(schedule),
      ...salary,
    })
  }

  return jobs
}

function listingUrl(page: number): string {
  const path = page === 1 ? BASE_URL : `${BASE_URL}/page-${page}`
  return `${path}?period=7`
}

async function fetchPage(page: number): Promise<string> {
  const response = await fetch(listingUrl(page), {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.7',
      'User-Agent': 'jobFinder/1.0 (vacancy search; contact: admin@whiteslove.me)',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`jobs.ua -> ${response.status}`)
  return response.text()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchJobsUaJobs(q: string): Promise<Job[]> {
  if (String(process.env.JOBS_UA_SOURCE || 'on').toLowerCase() === 'off') return []

  const maxPages = integer(process.env.JOBS_UA_MAX_PAGES, DEFAULT_MAX_PAGES, 1, MAX_PAGES_LIMIT)
  const requestDelayMs = integer(process.env.JOBS_UA_REQUEST_DELAY_MS, DEFAULT_REQUEST_DELAY_MS, 500, 10_000)
  const jobs: Job[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await delay(requestDelayMs)

    let pageJobs: Job[]
    try {
      pageJobs = parseJobsUaVacancies(await fetchPage(page))
    } catch (error) {
      if (page === 1) throw error
      console.warn('[jobs] Jobs.ua pagination stopped:', error instanceof Error ? error.message : String(error))
      break
    }

    let added = 0
    for (const job of pageJobs) {
      if (seen.has(job.id)) continue
      seen.add(job.id)
      jobs.push(job)
      added++
    }
    if (!pageJobs.length || !added) break
  }

  if (!q.trim()) return jobs
  const needle = q.toLocaleLowerCase('uk')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${job.description || ''}`
      .toLocaleLowerCase('uk')
      .includes(needle),
  )
}
