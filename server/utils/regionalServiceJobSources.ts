import type { Job } from './jobTypes'
import { absoluteHttpUrl as absoluteUrl, stripHtml } from './htmlText'

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
  {
    label: 'JobKorea · Hotel front desk',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%ED%98%B8%ED%85%94%20%ED%94%84%EB%A1%A0%ED%8A%B8',
    kind: 'jobkorea',
    category: 'Hotel / Front desk',
  },
  {
    label: 'JobKorea · Retail store',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EB%A7%A4%EC%9E%A5%EA%B4%80%EB%A6%AC%20%ED%8C%90%EB%A7%A4',
    kind: 'jobkorea',
    category: 'Retail / Store service',
  },
  {
    label: 'JobKorea · Warehouse',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EB%AC%BC%EB%A5%98%20%EC%B0%BD%EA%B3%A0',
    kind: 'jobkorea',
    category: 'Warehouse / Logistics',
  },
  {
    label: 'JobKorea · Delivery',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EB%B0%B0%EC%86%A1%20%EB%B0%B0%EB%8B%AC',
    kind: 'jobkorea',
    category: 'Delivery / Courier',
  },
  {
    label: 'JobKorea · Care service',
    market: 'KR',
    url: 'https://www.jobkorea.co.kr/Search/?stext=%EC%9A%94%EC%96%91%EB%B3%B4%ED%98%B8',
    kind: 'jobkorea',
    category: 'Care / Personal service',
  },
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
  {
    label: 'OLX UZ · Retail',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/roznichnaya-torgovlya-prodazhi/tashkent/',
    kind: 'olx-uz',
    category: 'Retail / Cashier / Sales floor',
  },
  {
    label: 'OLX UZ · Logistics',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/transport-logistika/tashkent/',
    kind: 'olx-uz',
    category: 'Transport / Courier / Warehouse',
  },
  {
    label: 'OLX UZ · Hotel',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/tashkent/q-%D0%B3%D0%BE%D1%81%D1%82%D0%B8%D0%BD%D0%B8%D1%86%D1%83/',
    kind: 'olx-uz',
    category: 'Hotel / Tourism / Front desk',
  },
  {
    label: 'OLX UZ · Housekeeping',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/tashkent/q-%D0%B3%D0%BE%D1%80%D0%BD%D0%B8%D1%87%D0%BD%D0%B0%D1%8F-%D0%B3%D0%BE%D1%81%D1%82%D0%B8%D0%BD%D0%B8%D1%86%D0%B0/',
    kind: 'olx-uz',
    category: 'Housekeeping / Cleaning',
  },
  {
    label: 'OLX UZ · Cashier',
    market: 'UZ',
    url: 'https://www.olx.uz/rabota/tashkent/q-%D0%BA%D0%B0%D1%81%D1%81%D0%B8%D1%80/',
    kind: 'olx-uz',
    category: 'Cashier',
  },
]

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
