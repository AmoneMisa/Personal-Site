import { parseHiringSourceSalary } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import type { Job } from './jobTypes'
import { detectWorkModes } from './hiringLexicon'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 20_000
const MAX_AGE_DAYS = 14
const MAX_DESCRIPTION = 4_000

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

function stripHtml(value: unknown): string {
  return decodeEntities(String(value || ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlLines(value: string): string[] {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|article|section|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function absoluteUrl(raw: string, base: string): string {
  try {
    const url = new URL(decodeEntities(raw), base)
    url.hash = ''
    return url.toString()
  } catch {
    return base
  }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru,en;q=0.8',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.text()
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.json() as Promise<T>
}

function jobId(label: string, url: string): string {
  const token = url.replace(/^https?:\/\//i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(-180)
  return `companies-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`
}

function parseRelativeDate(text: string): string | null {
  const now = Date.now()
  if (/\b(?:сегодня|today|astăzi|azi)\b/iu.test(text)) return new Date(now).toISOString()
  if (/\b(?:вчера|yesterday|ieri)\b/iu.test(text)) return new Date(now - 86_400_000).toISOString()

  const days = text.match(/\b(\d{1,2})\s*(?:дн(?:я|ей)?|days?|zile)\s*(?:назад|ago)?\b/iu)
  if (days) return new Date(now - Number(days[1]) * 86_400_000).toISOString()
  const hours = text.match(/\b(\d{1,2})\s*(?:ч(?:ас(?:а|ов)?)?|hours?|hrs?)\s*(?:назад|ago)?\b/iu)
  if (hours) return new Date(now - Number(hours[1]) * 3_600_000).toISOString()
  return null
}

function parseDottedDate(text: string): string | null {
  const values: number[] = []
  for (const match of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g)) {
    const value = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12)
    if (Number.isFinite(value) && value <= Date.now() + 48 * 60 * 60 * 1000) values.push(value)
  }
  return values.length ? new Date(Math.max(...values)).toISOString() : null
}

function isRecent(date: string | null | undefined): boolean {
  if (!date) return false
  const time = Date.parse(date)
  return Number.isFinite(time) && time >= Date.now() - MAX_AGE_DAYS * 86_400_000 && time <= Date.now() + 48 * 60 * 60 * 1000
}

function salary(text: string): Pick<Job, 'salaryMin' | 'salaryMax' | 'salaryCurrency'> {
  const parsed = parseHiringSourceSalary(text)
  if (!parsed || (parsed.min == null && parsed.max == null) || !parsed.currency) return {}
  return {
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    salaryCurrency: parsed.currency,
  }
}

function makeJob(input: {
  label: string
  title: string
  company?: string
  location: string
  url: string
  postedAt?: string
  description?: string
  employmentType?: string
  tags?: string[]
  employerType?: 'direct' | 'board'
}): Job {
  return {
    id: jobId(input.label, input.url),
    title: stripHtml(input.title).slice(0, 240),
    company: stripHtml(input.company || input.label).slice(0, 180),
    location: stripHtml(input.location || 'See listing').slice(0, 240),
    url: input.url,
    source: 'companies',
    remote: detectWorkModes(`${input.title} ${input.location} ${input.description || ''}`).includes('remote'),
    tags: [...new Set([input.label, ...(input.tags || [])])].slice(0, 8),
    postedAt: input.postedAt || new Date().toISOString(),
    employmentType: input.employmentType,
    description: stripHtml(input.description || '').slice(0, MAX_DESCRIPTION) || undefined,
    employerType: input.employerType || 'direct',
    ...salary(`${input.title} ${input.description || ''}`),
  }
}

function filterQuery(jobs: Job[], q: string): Job[] {
  if (!q.trim()) return jobs
  const needle = q.toLocaleLowerCase('ru')
  return jobs.filter((job) =>
    `${job.title} ${job.company} ${job.location} ${job.description || ''}`
      .toLocaleLowerCase('ru')
      .includes(needle),
  )
}

const ISHKOP_CITIES: Array<[string, string]> = [
  ['Tashkent', 'Ташкент'],
  ['Samarkand', 'Самарканд'],
  ['Bukhara', 'Бухара'],
  ['Fergana', 'Фергана'],
  ['Andijan', 'Андижан'],
  ['Namangan', 'Наманган'],
  ['Nukus', 'Нукус'],
  ['Navoi', 'Навои'],
  ['Urgench', 'Ургенч'],
  ['Qarshi', 'Карши'],
]

function likelyCompany(lines: string[], title: string): string {
  const index = lines.findIndex((line) => line === title || line.includes(title))
  for (const line of lines.slice(Math.max(0, index + 1), Math.max(0, index + 5))) {
    if (line.length < 2 || line.length > 120) continue
    if (/UZS|USD|сум|дн(?:я|ей)? назад|вчера|сегодня|Ташкент|Самарканд|Бухара|Ферган|Андижан|Наманган|Нукус|Навои|Ургенч|Карши/iu.test(line)) continue
    if (/^(?:обязанности|требования|условия|скрыть|вакансия скрыта)/iu.test(line)) continue
    return line
  }
  return 'Ishkop employer'
}

function parseIshkopPage(html: string, location: string): Job[] {
  const base = 'https://ishkop.uz/'
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']*jobdesc\?[^"']*\bid=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const out: Job[] = []

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!
    const title = stripHtml(match[2])
    if (title.length < 3 || title.length > 240) continue
    const start = match.index || 0
    const end = matches[i + 1]?.index ?? Math.min(html.length, start + 8_000)
    const block = html.slice(start, end)
    const text = htmlLines(block).join('\n')
    const postedAt = parseRelativeDate(text)
    if (!isRecent(postedAt)) continue
    const url = absoluteUrl(match[1]!, base)
    const lines = htmlLines(block)
    const detectedLocation = lines.find((line) =>
      /(?:Ташкент|Самарканд|Бухар|Ферган|Андижан|Наманган|Нукус|Навои|Ургенч|Карши)(?:\b|,)/iu.test(line),
    ) || `${location}, Uzbekistan`

    out.push({
      ...makeJob({
        label: 'Ishkop.uz',
        title,
        company: likelyCompany(lines, title),
        location: detectedLocation,
        url,
        postedAt: postedAt!,
        description: text,
        tags: ['Uzbekistan', location],
        employerType: 'board',
      }),
      ...salary(text),
    })
  }
  return out
}

async function fetchIshkop(): Promise<Job[]> {
  const pages = await Promise.allSettled(
    ISHKOP_CITIES.map(async ([label, city]) => {
      const url = `https://ishkop.uz/${encodeURIComponent('вакансии')}/${encodeURIComponent(city)}`
      return parseIshkopPage(await fetchHtml(url), label)
    }),
  )
  return pages.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}

interface IshBorSummary { url: string; title: string; text: string }

function ishBorSummaries(html: string): IshBorSummary[] {
  const base = 'https://ish-bor.uz/ru/ishlar'
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/ru\/ishlar\/id\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const unique = new Map<string, IshBorSummary>()
  for (let i = 0; i < matches.length && unique.size < 24; i++) {
    const match = matches[i]!
    const title = stripHtml(match[2])
    if (title.length < 2 || /подробнее/iu.test(title)) continue
    const start = match.index || 0
    const end = matches[i + 1]?.index ?? Math.min(html.length, start + 4_000)
    const url = absoluteUrl(match[1]!, base)
    unique.set(url, { url, title, text: htmlLines(html.slice(start, end)).join('\n') })
  }
  return [...unique.values()]
}

async function fetchIshBor(): Promise<Job[]> {
  const listUrl = 'https://ish-bor.uz/ru/ishlar'
  const summaries = ishBorSummaries(await fetchHtml(listUrl))
  const results = await Promise.allSettled(summaries.map(async (summary) => {
    let detailText = summary.text
    let postedAt: string | null = null
    try {
      const detail = await fetchHtml(summary.url)
      detailText = htmlLines(detail).join('\n')
      postedAt = parseDottedDate(detailText) || parseRelativeDate(detailText)
    } catch {
      // Presence on the current first page is still a strong active-listing
      // signal. A detail-page failure must not discard the whole board.
    }
    if (postedAt && !isRecent(postedAt)) return null
    const lines = summary.text.split('\n').filter(Boolean)
    const location = lines.find((line) => /Ташкент|Самарканд|Бухар|Ферган|Андижан|Наманган|Навои|Нукус|обл\./iu.test(line)) || 'Uzbekistan'
    return {
      ...makeJob({
        label: 'ish-bor.uz',
        title: summary.title,
        company: 'ish-bor.uz employer',
        location,
        url: summary.url,
        postedAt: postedAt || new Date().toISOString(),
        description: detailText,
        tags: ['Uzbekistan'],
        employerType: 'board',
      }),
      ...salary(`${summary.text}\n${detailText}`),
    }
  }))
  return results
    .filter((result): result is PromiseFulfilledResult<Job | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((job): job is Job => job !== null)
}

function parseIshPlusPage(html: string, pageUrl: string): Job[] {
  const matches = [...html.matchAll(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi)]
  const out: Job[] = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!
    const title = stripHtml(match[1])
    if (title.length < 3 || title.length > 240) continue
    const start = Math.max(0, (match.index || 0) - 1_500)
    const end = matches[i + 1]?.index ?? Math.min(html.length, (match.index || 0) + 7_000)
    const block = html.slice(start, end)
    const text = htmlLines(block).join('\n')
    const postedAt = parseDottedDate(text)
    if (!isRecent(postedAt)) continue
    const company = text.match(/(?:Организация|Tashkilot)\s*:\s*([^\n]{2,220})/iu)?.[1]?.trim() || 'IshPlus employer'
    const detailHref = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((item) => ({ href: item[1]!, text: stripHtml(item[2]) }))
      .find((item) => /подробнее|batafsil|details/iu.test(item.text) || /vacanc/i.test(item.href))?.href
    const location = text.split('\n').find((line) => /Ташкент|Toshkent|Чиланзар|Юнусабад|Мирабад|Учтеп|Алмазар|Olmazor|Uchtepa|Mirobod|Chilonzor/iu.test(line)) || 'Tashkent, Uzbekistan'
    const url = detailHref ? absoluteUrl(detailHref, pageUrl) : `${pageUrl}#${encodeURIComponent(title)}`
    out.push({
      ...makeJob({
        label: 'IshPlus.uz',
        title,
        company,
        location,
        url,
        postedAt: postedAt!,
        description: text,
        tags: ['Uzbekistan', 'Inclusive employment'],
        employerType: 'board',
      }),
      ...salary(text),
    })
  }
  return out
}

async function fetchIshPlus(): Promise<Job[]> {
  const pages = await Promise.allSettled(
    [1, 2, 3, 4].map(async (page) => {
      const url = `https://ishplus.uz/vacancies?lang=ru&page=${page}`
      return parseIshPlusPage(await fetchHtml(url), url)
    }),
  )
  return pages.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}

const MUK_COUNTRIES: Array<[RegExp, string, string]> = [
  [/^Узбекистан\s+/iu, 'Uzbekistan', 'UZ'],
  [/^Казахстан\s+/iu, 'Kazakhstan', 'KZ'],
  [/^Кыргызстан\s+/iu, 'Kyrgyzstan', 'KG'],
  [/^Украина\s+/iu, 'Ukraine', 'UA'],
  [/^Румыния\s+/iu, 'Romania', 'RO'],
]

async function fetchMuk(): Promise<Job[]> {
  const url = 'https://muk.group/ru/vacancies/'
  const html = await fetchHtml(url)
  const out: Job[] = []
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/ru\/vacancies\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = stripHtml(match[2])
    const country = MUK_COUNTRIES.find(([re]) => re.test(raw))
    if (!country) continue
    const title = raw.replace(country[0], '').trim()
    if (title.length < 3) continue
    out.push(makeJob({
      label: 'MUK',
      title,
      company: 'MUK',
      location: country[1],
      url: absoluteUrl(match[1]!, url),
      description: raw,
      tags: [country[2]],
      employerType: 'direct',
    }))
  }
  return out
}

async function fetchTegen(): Promise<Job[]> {
  const url = 'https://tegen.uz/vacancy/'
  const html = await fetchHtml(url)
  const headings = [...html.matchAll(/<h[4-6]\b[^>]*>([\s\S]*?)<\/h[4-6]>/gi)]
  const out: Job[] = []
  for (let i = 0; i < headings.length; i++) {
    const title = stripHtml(headings[i]![1])
    if (!title || /вакансии в tegen|карьера в tegen/iu.test(title)) continue
    if (title.length > 180) continue
    const start = headings[i]!.index || 0
    const end = headings[i + 1]?.index ?? html.length
    const description = htmlLines(html.slice(start, end)).join('\n')
    out.push(makeJob({
      label: 'Tegen',
      title,
      company: 'Tegen',
      location: 'Tashkent, Uzbekistan',
      url: `${url}#${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}`,
      description,
      tags: ['Uzbekistan', 'Retail'],
      employerType: 'direct',
    }))
  }
  return out
}

async function fetchUzbekistanAirways(): Promise<Job[]> {
  const root = 'https://corp.uzairways.com/ru/vacancy'
  const pages = await Promise.allSettled([0, 1, 2].map((page) => fetchHtml(page ? `${root}?page=${page}` : root)))
  const byUrl = new Map<string, Job>()
  for (const result of pages) {
    if (result.status !== 'fulfilled') continue
    for (const match of result.value.matchAll(/<a\b[^>]*href=["']([^"']*\/ru\/node\/\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = stripHtml(match[2])
      if (title.length < 5 || title.length > 300) continue
      const url = absoluteUrl(match[1]!, root)
      byUrl.set(url, makeJob({
        label: 'Uzbekistan Airways',
        title,
        company: 'Uzbekistan Airways',
        location: 'Uzbekistan',
        url,
        tags: ['Uzbekistan', 'Airline', 'Aviation'],
        employerType: 'direct',
      }))
    }
  }
  return [...byUrl.values()]
}

async function fetchCentrumAir(): Promise<Job[]> {
  const root = 'https://centrum-air.com/en/vacancies'
  const html = await fetchHtml(root)
  const start = html.search(/Open positions/i)
  const end = html.search(/Career from the inside/i)
  const section = html.slice(Math.max(0, start), end > start ? end : html.length)
  const headings = [...section.matchAll(/<h[4-6]\b[^>]*>([\s\S]*?)<\/h[4-6]>/gi)]
  const out: Job[] = []

  for (let i = 0; i < headings.length; i++) {
    const title = stripHtml(headings[i]![1])
    if (!title || /open positions|benefits/iu.test(title)) continue
    const hStart = headings[i]!.index || 0
    const hEnd = headings[i + 1]?.index ?? section.length
    const block = section.slice(hStart, hEnd)
    const description = htmlLines(block).join('\n')
    const href = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => ({ href: match[1]!, text: stripHtml(match[2]) }))
      .find((item) => /read more|apply/iu.test(item.text))?.href
    out.push(makeJob({
      label: 'Centrum Air',
      title,
      company: 'Centrum Air',
      location: 'Tashkent, Uzbekistan',
      url: href ? absoluteUrl(href, root) : `${root}#${encodeURIComponent(title)}`,
      description,
      tags: ['Uzbekistan', 'Airline', 'Aviation'],
      employerType: 'direct',
    }))
  }
  return out
}

function qanotTitle(line: string): boolean {
  if (line.length < 5 || line.length > 180) return false
  if (/^(?:requirements?|candidate requirements|documents?|company|location|salary|how to apply|selection|we offer|key responsibilities)/iu.test(line)) return false
  return /flight attendant|captain|co-?pilot|first officer|dispatcher|specialist|engineer|mechanic|call center|operator|manager|pilot/iu.test(line)
}

async function fetchQanotSharq(): Promise<Job[]> {
  const root = 'https://www.qanotsharq.com/en/vacancy'
  const html = await fetchHtml(root)
  const lines = htmlLines(html)
  const titles = new Map<string, number>()
  lines.forEach((line, index) => {
    if (qanotTitle(line)) titles.set(line, index)
  })
  // The first two announcements use sentence-like headings rather than heading
  // elements, so normalize them to concise role names.
  if (lines.some((line) => /FEMALE flight attendant/iu.test(line))) titles.set('Flight Attendant', 0)
  if (lines.some((line) => /position of captain.*co-pilot.*Airbus/iu.test(line))) titles.set('Captain / First Officer — Airbus A320/A321/A330', 0)

  const ordered = [...titles.entries()].sort((a, b) => a[1] - b[1])
  return ordered.slice(0, 30).map(([title, index], i) => {
    const nextIndex = ordered[i + 1]?.[1] ?? Math.min(lines.length, index + 35)
    const description = lines.slice(index, Math.min(nextIndex, index + 40)).join('\n')
    return makeJob({
      label: 'Qanot Sharq',
      title,
      company: 'Qanot Sharq Airlines',
      location: /location:\s*([^\n]+)/iu.exec(description)?.[1] || 'Tashkent, Uzbekistan',
      url: `${root}#${encodeURIComponent(title.toLowerCase().replace(/\s+/g, '-'))}`,
      description,
      tags: ['Uzbekistan', 'Airline', 'Aviation'],
      employerType: 'direct',
    })
  })
}

interface MicrosoftResponse {
  operationResult?: {
    result?: {
      jobs?: Array<{
        jobId?: string | number
        title?: string
        description?: string
        properties?: {
          locations?: string[]
          employmentType?: string
          discipline?: string
          subDiscipline?: string
        }
      }>
      totalJobs?: number
    }
  }
}

async function fetchMicrosoft(): Promise<Job[]> {
  const endpoint = 'https://gcsservices.careers.microsoft.com/search/api/v1/search'
  const out: Job[] = []
  for (let page = 1; page <= 3; page++) {
    const params = new URLSearchParams({ l: 'en_us', pg: String(page), pgSz: '100', o: String((page - 1) * 100), flt: 'true' })
    const data = await fetchJson<MicrosoftResponse>(`${endpoint}?${params}`)
    const jobs = data.operationResult?.result?.jobs || []
    for (const item of jobs) {
      if (!item.jobId || !item.title) continue
      const location = item.properties?.locations?.join('; ') || 'See listing'
      const url = `https://jobs.careers.microsoft.com/global/en/job/${item.jobId}`
      out.push(makeJob({
        label: 'Microsoft',
        title: item.title,
        company: 'Microsoft',
        location,
        url,
        description: item.description,
        employmentType: item.properties?.employmentType,
        tags: [item.properties?.discipline || '', item.properties?.subDiscipline || ''].filter(Boolean),
        employerType: 'direct',
      }))
    }
    const total = Number(data.operationResult?.result?.totalJobs || 0)
    if (!jobs.length || page * 100 >= total) break
  }
  return out
}

interface SmartRecruitersResponse {
  content?: Array<{
    id?: string
    name?: string
    releasedDate?: string
    company?: { name?: string }
    location?: { fullLocation?: string; city?: string; country?: string; remote?: boolean }
    typeOfEmployment?: { label?: string }
    function?: { label?: string }
    industry?: { label?: string }
  }>
}

async function fetchUbisoft(): Promise<Job[]> {
  const out: Job[] = []
  for (const offset of [0, 100]) {
    const data = await fetchJson<SmartRecruitersResponse>(
      `https://api.smartrecruiters.com/v1/companies/Ubisoft2/postings?limit=100&offset=${offset}`,
    )
    const items = data.content || []
    for (const item of items) {
      if (!item.id || !item.name) continue
      const postedAt = item.releasedDate ? new Date(item.releasedDate).toISOString() : new Date().toISOString()
      if (!isRecent(postedAt)) continue
      const location = item.location?.fullLocation
        || [item.location?.city, item.location?.country].filter(Boolean).join(', ')
        || 'See listing'
      const job = makeJob({
        label: 'Ubisoft',
        title: item.name,
        company: item.company?.name || 'Ubisoft',
        location,
        url: `https://jobs.smartrecruiters.com/Ubisoft2/${item.id}`,
        postedAt,
        employmentType: item.typeOfEmployment?.label,
        tags: [item.function?.label || '', item.industry?.label || ''].filter(Boolean),
        employerType: 'direct',
      })
      if (item.location?.remote === true) job.remote = true
      out.push(job)
    }
    if (items.length < 100) break
  }
  return out
}

async function fetchEa(): Promise<Job[]> {
  const root = 'https://jobs.ea.com/en_US/careers/SearchJobs/'
  const html = await fetchHtml(root)
  const out: Job[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/careers\/JobDetail\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = stripHtml(match[2])
    if (title.length < 3 || title.length > 220) continue
    const url = absoluteUrl(match[1]!, root)
    if (seen.has(url)) continue
    seen.add(url)
    out.push(makeJob({
      label: 'Electronic Arts',
      title,
      company: 'Electronic Arts',
      location: 'See listing',
      url,
      tags: ['EA', 'Games'],
      employerType: 'direct',
    }))
  }
  return out
}

async function fetchEpam(): Promise<Job[]> {
  const countryPages: Array<[string, string]> = [
    ['Romania', 'https://careers.epam.com/en/jobs/romania'],
    ['Kazakhstan', 'https://careers.epam.com/en/jobs/kazakhstan'],
    ['Ukraine', 'https://careers.epam.com/en/jobs/ukraine'],
  ]
  const results = await Promise.allSettled(countryPages.map(async ([country, url]) => {
    const html = await fetchHtml(url)
    const jobs: Job[] = []
    const seen = new Set<string>()
    for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/en\/vacancy\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = stripHtml(match[2])
      if (title.length < 3 || title.length > 220) continue
      const href = absoluteUrl(match[1]!, url)
      if (seen.has(href)) continue
      seen.add(href)
      jobs.push(makeJob({
        label: 'EPAM',
        title,
        company: 'EPAM',
        location: country,
        url: href,
        tags: ['IT'],
        employerType: 'direct',
      }))
    }
    return jobs
  }))
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
}

async function fetchJobsHorecaRo(): Promise<Job[]> {
  // The public site describes the matching service, but job cards may be loaded
  // dynamically. Parse only explicit public job-detail links when present; an
  // empty result is intentional and safer than inventing postings from forms.
  const root = 'https://jobshoreca.ro/'
  const html = await fetchHtml(root)
  const out: Job[] = []
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteUrl(match[1]!, root)
    if (!/\/(?:job|jobs|locuri-de-munca)\/[a-z0-9][^/?#]{2,}/iu.test(new URL(href).pathname)) continue
    const title = stripHtml(match[2])
    if (title.length < 3 || title.length > 180) continue
    out.push(makeJob({
      label: 'Jobs HoReCa',
      title,
      company: 'Jobs HoReCa employer',
      location: 'Romania',
      url: href,
      tags: ['Romania', 'HoReCa'],
      employerType: 'board',
    }))
  }
  return out
}

type Loader = { label: string; load: () => Promise<Job[]> }

export async function fetchSourceExpansionJobs(q: string): Promise<Job[]> {
  if (process.env.SOURCE_EXPANSION_JOBS === 'off') return []

  const loaders: Loader[] = [
    { label: 'ishkop', load: fetchIshkop },
    { label: 'ish-bor', load: fetchIshBor },
    { label: 'ishplus', load: fetchIshPlus },
    { label: 'muk', load: fetchMuk },
    { label: 'tegen', load: fetchTegen },
    { label: 'uzbekistan-airways', load: fetchUzbekistanAirways },
    { label: 'centrum-air', load: fetchCentrumAir },
    { label: 'qanot-sharq', load: fetchQanotSharq },
    { label: 'microsoft', load: fetchMicrosoft },
    { label: 'ubisoft', load: fetchUbisoft },
    { label: 'ea', load: fetchEa },
    { label: 'epam', load: fetchEpam },
    { label: 'jobs-horeca-ro', load: fetchJobsHorecaRo },
  ]

  const results = await Promise.allSettled(loaders.map(({ load }) => load()))
  const byUrl = new Map<string, Job>()
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn(
        `[jobs:source-expansion] ${loaders[index]!.label} failed:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      )
      return
    }
    for (const job of result.value) {
      if (!job.title || !job.url) continue
      byUrl.set(job.url, job)
    }
  })

  return filterQuery([...byUrl.values()], q)
}
