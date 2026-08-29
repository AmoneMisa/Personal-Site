import type { Job } from './jobTypes'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_PER_FEED = 120

type ServiceMarket = 'KR' | 'UZ'

type ServiceFeed = {
  label: string
  market: ServiceMarket
  url: string
  kind: 'jobkorea' | 'olx-uz'
  category: string
}

export const REGIONAL_SERVICE_JOB_FEEDS: ServiceFeed[] = [
  // Korea: local-language service searches. JobKorea exposes these as public
  // candidate-facing result pages; each search is intentionally narrow so
  // ordinary corporate vacancies do not swamp hospitality/service work.
  {
    label: 'JobKorea · Waitstaff',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%ED%99%80%EC%84%9C%EB%B9%99',
    kind: 'jobkorea',
    category: 'Waitstaff / Restaurant service',
  },
  {
    label: 'JobKorea · Barista',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EB%B0%94%EB%A6%AC%EC%8A%A4%ED%83%80',
    kind: 'jobkorea',
    category: 'Barista / Cafe',
  },
  {
    label: 'JobKorea · Kitchen',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EC%A3%BC%EB%B0%A9',
    kind: 'jobkorea',
    category: 'Kitchen / Cook',
  },
  {
    label: 'JobKorea · Security',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EA%B2%BD%EB%B9%84',
    kind: 'jobkorea',
    category: 'Security',
  },
  {
    label: 'JobKorea · Cashier',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EC%BA%90%EC%85%94',
    kind: 'jobkorea',
    category: 'Cashier / Retail',
  },
  {
    label: 'JobKorea · Cleaning',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EB%AF%B8%ED%99%94',
    kind: 'jobkorea',
    category: 'Cleaning / Facility service',
  },

  // Uzbekistan: OLX has high-volume local service categories that complement
  // ish-bor/ishgo and the corporate employers already ingested elsewhere.
  {
    label: 'OLX UZ · Restaurants',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/bary-restorany-razvlecheniya/tashkent/',
    kind: 'olx-uz',
    category: 'Restaurant / Hospitality',
  },
  {
    label: 'OLX UZ · Security',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/ohrana-bezopasnost/tashkent/',
    kind: 'olx-uz',
    category: 'Security',
  },
]

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
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

function stripHtml(value: unknown): string {
  return decodeEntities(String(value || ''))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function absoluteUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(decodeEntities(raw), base)
    if (!/^https?:$/.test(url.protocol)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function serviceJob(
  feed: ServiceFeed,
  url: string,
  title: string,
  company?: string,
  location?: string,
): Job {
  return {
    id: `companies-service-${feed.market.toLowerCase()}-${url}`,
    title,
    company: company || feed.label,
    location: location || (feed.market === 'KR' ? 'South Korea' : 'Tashkent, Uzbekistan'),
    url,
    source: 'companies',
    remote: false,
    tags: [feed.market, feed.category, 'Service jobs'],
    postedAt: new Date().toISOString(),
    employerType: 'board',
  }
}

export function parseJobKoreaServicePage(html: string, feed: ServiceFeed): Job[] {
  const byUrl = new Map<string, Job>()
  const re = /<a\b[^>]*href=["']([^"']*\/Recruit\/GI_Read\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html)) && byUrl.size < MAX_PER_FEED) {
    const url = absoluteUrl(match[1]!, feed.url)
    if (!url || byUrl.has(url)) continue
    const title = stripHtml(match[2])
    if (title.length < 3 || title.length > 180) continue
    if (/^(?:지원|즉시지원|상세|기업정보|스크랩|채용정보)$/u.test(title)) continue

    // JobKorea commonly repeats a posting link for company/title/actions. Keep
    // the most vacancy-like text and let URL dedup collapse the repetitions.
    byUrl.set(url, serviceJob(feed, url, title))
  }

  return [...byUrl.values()]
}

export function parseOlxUzServicePage(html: string, feed: ServiceFeed): Job[] {
  const byUrl = new Map<string, Job>()
  const re = /<a\b[^>]*href=["']([^"']*\/d\/obyavlenie\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = re.exec(html)) && byUrl.size < MAX_PER_FEED) {
    const url = absoluteUrl(match[1]!, feed.url)
    if (!url || byUrl.has(url)) continue
    const title = stripHtml(match[2])
    if (title.length < 4 || title.length > 180) continue
    if (/^(?:избранное|подробнее|смотреть|next|previous)$/iu.test(title)) continue
    byUrl.set(url, serviceJob(feed, url, title))
  }

  return [...byUrl.values()]
}

async function fetchFeed(feed: ServiceFeed): Promise<Job[]> {
  const response = await fetch(feed.url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': feed.market === 'KR' ? 'ko-KR,ko;q=0.9,en;q=0.7' : 'ru-RU,ru;q=0.9,uz;q=0.8,en;q=0.6',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${feed.label} -> ${response.status}`)
  const html = await response.text()
  return feed.kind === 'jobkorea'
    ? parseJobKoreaServicePage(html, feed)
    : parseOlxUzServicePage(html, feed)
}

function filterQuery(jobs: Job[], q: string): Job[] {
  const needle = q.trim().toLocaleLowerCase('en')
  if (!needle) return jobs
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`
      .toLocaleLowerCase('en')
      .includes(needle),
  )
}

export async function fetchRegionalServiceJobs(q: string): Promise<Job[]> {
  if (String(process.env.REGIONAL_SERVICE_JOB_SOURCE || 'on').toLowerCase() === 'off') return []

  const results = await Promise.allSettled(REGIONAL_SERVICE_JOB_FEEDS.map(fetchFeed))
  const byUrl = new Map<string, Job>()

  results.forEach((result, index) => {
    const feed = REGIONAL_SERVICE_JOB_FEEDS[index]!
    if (result.status === 'fulfilled') {
      for (const job of result.value) byUrl.set(job.url, job)
      return
    }
    console.warn(
      `[jobs:regional-service] ${feed.label} failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })

  return filterQuery([...byUrl.values()], q)
}
