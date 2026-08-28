import { XMLParser } from 'fast-xml-parser'
import { parseHiringActivityDate } from '@whiteslove/parsing-lexicon/hiring-temporal'
import { crawlCyclicJobBoard } from './cyclicJobBoardCrawler'
import { extractSalaryFromText } from './enrich'
import { detectLexiconCity, detectWorkModes } from './hiringLexicon'
import type { Job } from './jobTypes'

const REQUEST_TIMEOUT_MS = 25_000
const MAX_DESCRIPTION = 2_400
const MAX_AGE_MS = 14 * 86_400_000
const USER_AGENT = 'jobFinder/1.0 (vacancy search; contact: admin@whiteslove.me)'

// These are source-owned DOU category names, not a local profession lexicon.
const DEFAULT_DOU_CATEGORIES = [
  '.NET',
  'Android',
  'Analyst',
  'C++',
  'Data Engineer',
  'Data Science',
  'Design',
  'DevOps',
  'Embedded',
  'Flutter',
  'Front End',
  'Golang',
  'HR',
  'iOS/macOS',
  'Java',
  'Marketing',
  'Node.js',
  'PHP',
  'Product Manager',
  'Project Manager',
  'Python',
  'QA',
  'Ruby',
  'Rust',
  'Sales',
  'Security',
  'Support',
  'Unity',
]

// Public-board discovery streams are an ingestion policy. Semantic matching of
// an end-user query (for example Frontend -> skills/profession context) stays in
// parsing-lexicon + Elasticsearch rather than in these source adapters.
const DEFAULT_BOARD_SEARCH_STREAMS = [
  'frontend',
  'react',
  'vue',
  'javascript',
  'backend',
  'fullstack',
  'devops',
  'qa',
  'data',
  'product',
  'designer',
]

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

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

function stripHtml(value: unknown): string {
  return decodeEntities(String(value || ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function rssText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record['#text'] || record['@_term'] || record['@_href'] || '')
  }
  return String(value)
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.7',
      'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.7',
      'User-Agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.text()
}

function sourceTerms(value: string | undefined, defaults: string[]): string[] {
  const raw = String(value || '').trim()
  return (raw ? raw.split(',') : defaults)
    .map((item) => item.trim())
    .filter(Boolean)
}

function queryMatches(job: Job, q: string): boolean {
  const needle = q.trim().toLocaleLowerCase('uk')
  if (!needle) return true
  return `${job.title} ${job.company} ${job.location} ${job.description || ''}`
    .toLocaleLowerCase('uk')
    .includes(needle)
}

function canonicalUrl(raw: string, base: string): string {
  try {
    const url = new URL(raw, base)
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function sourceLocation(text: string): { location: string; city?: string; remote: boolean } {
  const city = detectLexiconCity(text, 'UA') || undefined
  const remote = detectWorkModes(text).includes('remote')
  return {
    location: city ? `${city}, Ukraine` : remote ? 'Remote, Ukraine' : 'Ukraine',
    city,
    remote,
  }
}

function recentPostedAt(text: string, fallback = new Date()): string | null {
  const parsed = parseHiringActivityDate(text)
  if (!parsed) return fallback.toISOString()
  const time = Date.parse(parsed)
  if (!Number.isFinite(time)) return fallback.toISOString()
  if (time < fallback.getTime() - MAX_AGE_MS || time > fallback.getTime() + 48 * 60 * 60 * 1000) return null
  return new Date(time).toISOString()
}

function dedupe(jobs: Job[]): Job[] {
  const byUrl = new Map<string, Job>()
  for (const job of jobs) {
    const key = job.url || job.id
    if (!byUrl.has(key)) byUrl.set(key, job)
  }
  return [...byUrl.values()]
}

async function parseRssFeed(url: string, tag: string, idPrefix: string): Promise<Job[]> {
  const xml = await fetchText(url)
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml)
  const rawItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || []
  const items = Array.isArray(rawItems) ? rawItems : [rawItems]
  const out: Job[] = []

  for (const [index, item] of items.entries()) {
    const linkValue = typeof item?.link === 'object'
      ? item.link?.['@_href'] || item.link?.['#text']
      : item?.link
    const link = canonicalUrl(String(linkValue || ''), url)
    const rawTitle = stripHtml(rssText(item?.title))
    if (!link || !rawTitle) continue

    const description = stripHtml(rssText(item?.description || item?.summary || item?.content)).slice(0, MAX_DESCRIPTION)
    const company = stripHtml(rssText(item?.['dc:creator'] || item?.author?.name || item?.author)) || `${tag} employer`
    const region = stripHtml(rssText(item?.region || item?.location || item?.['job:location']))
    const context = `${rawTitle} ${region} ${description}`
    const location = sourceLocation(context)
    const dateValue = item?.pubDate || item?.published || item?.updated
    const posted = dateValue ? new Date(dateValue) : new Date()
    const postedAt = Number.isNaN(posted.getTime()) ? new Date().toISOString() : posted.toISOString()
    if (Date.parse(postedAt) < Date.now() - MAX_AGE_MS) continue

    out.push({
      id: `${idPrefix}-${rssText(item?.guid) || link || index}`,
      title: rawTitle,
      company,
      location: location.location,
      city: location.city,
      country: 'UA',
      url: link,
      applyUrl: link,
      source: 'companies',
      remote: location.remote,
      tags: [tag],
      postedAt,
      description: description || undefined,
      employerType: 'board',
      ...extractSalaryFromText(description),
    })
  }

  return out
}

export async function fetchDouJobs(q: string): Promise<Job[]> {
  if (String(process.env.DOU_SOURCE || 'on').toLowerCase() === 'off') return []

  const categories = sourceTerms(process.env.DOU_JOB_CATEGORIES, DEFAULT_DOU_CATEGORIES)
  const results = await Promise.allSettled(categories.map(async (category) => {
    const params = new URLSearchParams({ category })
    return parseRssFeed(
      `https://jobs.dou.ua/vacancies/feeds/?${params.toString()}`,
      `DOU · ${category}`,
      `companies-dou-${category.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-')}`,
    )
  }))

  const jobs = results.flatMap((result, index) => {
    if (result.status === 'fulfilled') return result.value
    console.warn(
      `[jobs] DOU category "${categories[index]}" failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
    return []
  })
  return dedupe(jobs).filter((job) => queryMatches(job, q))
}

export async function fetchDjinniJobs(q: string): Promise<Job[]> {
  if (String(process.env.DJINNI_SOURCE || 'on').toLowerCase() === 'off') return []
  const jobs = await parseRssFeed(
    process.env.DJINNI_RSS_URL || 'https://djinni.co/jobs/rss/',
    'Djinni',
    'companies-djinni',
  )
  return dedupe(jobs).filter((job) => queryMatches(job, q))
}

function searchCardRanges(html: string, pattern: RegExp): Array<{ href: string; id: string; inner: string; index: number }> {
  const out: Array<{ href: string; id: string; inner: string; index: number }> = []
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(html))) {
    out.push({ href: match[1]!, id: match[2]!, inner: match[3]!, index: match.index })
  }
  return out
}

function headingOrAnchor(inner: string): string {
  const heading = inner.match(/<(?:h1|h2|h3|h4)\b[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|h4)>/i)?.[1]
  const title = stripHtml(heading || inner)
  return title.length <= 220 ? title : ''
}

export function parseWorkUaPage(html: string, stream: string, now = new Date()): Job[] {
  const matches = searchCardRanges(
    html,
    /<a\b[^>]*href=["'](\/jobs\/(\d+)\/?(?:[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )
  const jobs: Job[] = []
  const seen = new Set<string>()

  for (const [index, match] of matches.entries()) {
    if (seen.has(match.id)) continue
    const title = headingOrAnchor(match.inner)
    if (!title || /^(?:відгукнути|apply|зберегти|подати)/iu.test(title)) continue

    const end = matches.slice(index + 1).find((candidate) => candidate.id !== match.id)?.index
      ?? Math.min(html.length, match.index + 8_000)
    const text = stripHtml(html.slice(match.index, end)).slice(0, MAX_DESCRIPTION)
    const postedAt = recentPostedAt(text, now)
    if (!postedAt) continue
    const location = sourceLocation(text)
    const url = canonicalUrl(match.href, 'https://www.work.ua')
    if (!url) continue

    seen.add(match.id)
    jobs.push({
      id: `companies-workua-${match.id}`,
      title,
      company: 'Work.ua employer',
      location: location.location,
      city: location.city,
      country: 'UA',
      url,
      applyUrl: url,
      source: 'companies',
      remote: location.remote,
      tags: ['Work.ua', stream],
      postedAt,
      description: text || undefined,
      employerType: 'board',
      ...extractSalaryFromText(text),
    })
  }

  return jobs
}

export function parseRobotaUaPage(html: string, stream: string, now = new Date()): Job[] {
  const matches = searchCardRanges(
    html,
    /<a\b[^>]*href=["']((?:https?:\/\/(?:www\.)?robota\.ua)?\/company\d+\/vacancy(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )
  const jobs: Job[] = []
  const seen = new Set<string>()

  for (const [index, match] of matches.entries()) {
    if (seen.has(match.id)) continue
    const title = headingOrAnchor(match.inner)
    if (!title) continue

    const end = matches.slice(index + 1).find((candidate) => candidate.id !== match.id)?.index
      ?? Math.min(html.length, match.index + 10_000)
    const text = stripHtml(html.slice(match.index, end)).slice(0, MAX_DESCRIPTION)
    const postedAt = recentPostedAt(text, now)
    if (!postedAt) continue
    const location = sourceLocation(text)
    const url = canonicalUrl(match.href, 'https://robota.ua')
    if (!url) continue

    seen.add(match.id)
    jobs.push({
      id: `companies-robotaua-${match.id}`,
      title,
      company: 'Robota.ua employer',
      location: location.location,
      city: location.city,
      country: 'UA',
      url,
      applyUrl: url,
      source: 'companies',
      remote: location.remote,
      tags: ['Robota.ua', stream],
      postedAt,
      description: text || undefined,
      employerType: 'board',
      ...extractSalaryFromText(text),
    })
  }

  return jobs
}

function streamKey(value: string): string {
  return value.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default'
}

async function mapLimited<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await worker(items[index]!)
    }
  })
  await Promise.all(runners)
  return results
}

async function fetchSearchStreams(options: {
  boardKey: string
  streams: string[]
  pagesPerRun: number
  maxPage: number
  pageUrl: (stream: string, page: number) => string
  parser: (html: string, stream: string) => Job[]
}): Promise<Job[]> {
  const runs = await mapLimited(options.streams, 3, async (stream) => {
    try {
      return await crawlCyclicJobBoard({
        key: `${options.boardKey}:${streamKey(stream)}`,
        pagesPerRun: options.pagesPerRun,
        maxPage: options.maxPage,
        fetchPage: (page) => fetchText(options.pageUrl(stream, page)),
        parsePage: (html) => options.parser(html, stream),
        requestDelayMs: 250,
      })
    } catch (error) {
      console.warn(
        `[jobs] ${options.boardKey} stream "${stream}" failed:`,
        error instanceof Error ? error.message : String(error),
      )
      return null
    }
  })
  return dedupe(runs.flatMap((run) => run?.jobs || []))
}

export async function fetchWorkUaJobs(q: string): Promise<Job[]> {
  if (String(process.env.WORK_UA_SOURCE || 'on').toLowerCase() === 'off') return []
  const streams = sourceTerms(process.env.WORK_UA_SEARCH_STREAMS, DEFAULT_BOARD_SEARCH_STREAMS)
  const jobs = await fetchSearchStreams({
    boardKey: 'work-ua',
    streams,
    pagesPerRun: integer(process.env.WORK_UA_PAGES_PER_RUN, 2, 1, 20),
    maxPage: integer(process.env.WORK_UA_MAX_PAGE, 250, 2, 2_000),
    pageUrl: (stream, page) => {
      const params = new URLSearchParams({ search: stream, days: '14' })
      if (page > 1) params.set('page', String(page))
      return `https://www.work.ua/jobs/?${params.toString()}`
    },
    parser: parseWorkUaPage,
  })
  return jobs.filter((job) => queryMatches(job, q))
}

export async function fetchRobotaUaJobs(q: string): Promise<Job[]> {
  if (String(process.env.ROBOTA_UA_SOURCE || 'on').toLowerCase() === 'off') return []
  const streams = sourceTerms(process.env.ROBOTA_UA_SEARCH_STREAMS, DEFAULT_BOARD_SEARCH_STREAMS)
  const jobs = await fetchSearchStreams({
    boardKey: 'robota-ua',
    streams,
    pagesPerRun: integer(process.env.ROBOTA_UA_PAGES_PER_RUN, 2, 1, 20),
    maxPage: integer(process.env.ROBOTA_UA_MAX_PAGE, 250, 2, 2_000),
    pageUrl: (stream, page) => {
      const base = `https://robota.ua/zapros/${encodeURIComponent(stream)}/ukraine`
      return page > 1 ? `${base}?page=${page}` : base
    },
    parser: parseRobotaUaPage,
  })
  return jobs.filter((job) => queryMatches(job, q))
}

export async function fetchUkraineBoardJobs(q: string): Promise<Job[]> {
  const loaders = [
    { label: 'dou', load: () => fetchDouJobs(q) },
    { label: 'djinni', load: () => fetchDjinniJobs(q) },
    { label: 'work.ua', load: () => fetchWorkUaJobs(q) },
    { label: 'robota.ua', load: () => fetchRobotaUaJobs(q) },
  ]
  const results = await Promise.allSettled(loaders.map(({ load }) => load()))
  const jobs: Job[] = []
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') jobs.push(...result.value)
    else console.warn(
      `[jobs] ${loaders[index]!.label} failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })
  return dedupe(jobs)
}
