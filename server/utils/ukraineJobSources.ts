import { XMLParser } from 'fast-xml-parser'
import type { Job } from './jobTypes'
import { extractSalaryFromText } from './enrich'

const REQUEST_TIMEOUT_MS = 25_000
const MAX_DESCRIPTION = 2_400
const USER_AGENT = 'jobFinder/1.0 (vacancy search; contact: admin@whiteslove.me)'

const DEFAULT_DOU_CATEGORIES = [
  'Front End',
  'Node.js',
  'Python',
  'Java',
  '.NET',
  'PHP',
  'QA',
  'DevOps',
  'Data Science',
  'Design',
  'Project Manager',
  'Product Manager',
]

const DEFAULT_SEARCH_TERMS = [
  'frontend',
  'front-end',
  'react',
  'vue',
  'javascript',
  'typescript',
  'nuxt',
]

const UA_CITIES = [
  'Київ', 'Kyiv', 'Киев',
  'Львів', 'Lviv', 'Львов',
  'Харків', 'Kharkiv', 'Харьков',
  'Одеса', 'Odesa', 'Одесса',
  'Дніпро', 'Dnipro', 'Днепр',
  'Запоріжжя', 'Zaporizhzhia', 'Запорожье',
  'Вінниця', 'Vinnytsia', 'Винница',
  'Чернівці', 'Chernivtsi', 'Черновцы',
  'Івано-Франківськ', 'Ivano-Frankivsk',
  'Ужгород', 'Uzhhorod',
  'Тернопіль', 'Ternopil', 'Тернополь',
  'Черкаси', 'Cherkasy', 'Черкассы',
  'Полтава', 'Poltava',
  'Хмельницький', 'Khmelnytskyi', 'Хмельницкий',
  'Житомир', 'Zhytomyr',
  'Рівне', 'Rivne', 'Ровно',
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

function cityFromText(text: string): string | undefined {
  const lower = text.toLocaleLowerCase('uk')
  return UA_CITIES.find((city) => lower.includes(city.toLocaleLowerCase('uk')))
}

function boardLocation(text: string): { location: string; city?: string; remote: boolean } {
  const remote = /\bremote\b|віддален|дистанційн|удален/iu.test(text)
  const city = cityFromText(text)
  return {
    location: city ? `${city}, Ukraine` : 'Ukraine',
    city,
    remote,
  }
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
    const location = boardLocation(context)
    const dateValue = item?.pubDate || item?.published || item?.updated
    const posted = dateValue ? new Date(dateValue) : new Date()
    const postedAt = Number.isNaN(posted.getTime()) ? new Date().toISOString() : posted.toISOString()

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
    console.warn(`[jobs] DOU category "${categories[index]}" failed:`, result.reason instanceof Error ? result.reason.message : String(result.reason))
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

function parseWorkUaPage(html: string, term: string): Job[] {
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
    const location = boardLocation(text)
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
      tags: ['Work.ua', term],
      postedAt: new Date().toISOString(),
      description: text || undefined,
      employerType: 'board',
      ...extractSalaryFromText(text),
    })
  }

  return jobs
}

function parseRobotaUaPage(html: string, term: string): Job[] {
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
    const location = boardLocation(text)
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
      tags: ['Robota.ua', term],
      postedAt: new Date().toISOString(),
      description: text || undefined,
      employerType: 'board',
      ...extractSalaryFromText(text),
    })
  }

  return jobs
}

async function fetchSearchTerms(
  terms: string[],
  maxPages: number,
  pageUrl: (term: string, page: number) => string,
  parser: (html: string, term: string) => Job[],
): Promise<Job[]> {
  const all: Job[] = []
  for (const term of terms) {
    for (let page = 1; page <= maxPages; page++) {
      try {
        const pageJobs = parser(await fetchText(pageUrl(term, page)), term)
        all.push(...pageJobs)
        if (!pageJobs.length) break
      } catch (error) {
        console.warn(`[jobs] UA board search "${term}" page ${page} failed:`, error instanceof Error ? error.message : String(error))
        break
      }
    }
  }
  return dedupe(all)
}

export async function fetchWorkUaJobs(q: string): Promise<Job[]> {
  if (String(process.env.WORK_UA_SOURCE || 'on').toLowerCase() === 'off') return []
  const terms = sourceTerms(process.env.WORK_UA_SEARCH_TERMS, DEFAULT_SEARCH_TERMS)
  const maxPages = integer(process.env.WORK_UA_MAX_PAGES, 1, 1, 5)
  const jobs = await fetchSearchTerms(
    terms,
    maxPages,
    (term, page) => {
      const params = new URLSearchParams({ search: term })
      if (page > 1) params.set('page', String(page))
      return `https://www.work.ua/jobs/?${params.toString()}`
    },
    parseWorkUaPage,
  )
  return jobs.filter((job) => queryMatches(job, q))
}

export async function fetchRobotaUaJobs(q: string): Promise<Job[]> {
  if (String(process.env.ROBOTA_UA_SOURCE || 'on').toLowerCase() === 'off') return []
  const terms = sourceTerms(process.env.ROBOTA_UA_SEARCH_TERMS, DEFAULT_SEARCH_TERMS)
  const maxPages = integer(process.env.ROBOTA_UA_MAX_PAGES, 1, 1, 5)
  const jobs = await fetchSearchTerms(
    terms,
    maxPages,
    (term, page) => `https://robota.ua/zapros/${encodeURIComponent(term)}/ukraine${page > 1 ? `?page=${page}` : ''}`,
    parseRobotaUaPage,
  )
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
    else console.warn(`[jobs] ${loaders[index]!.label} failed:`, result.reason instanceof Error ? result.reason.message : String(result.reason))
  })
  return dedupe(jobs)
}
