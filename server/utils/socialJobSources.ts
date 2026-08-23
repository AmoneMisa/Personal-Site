import type { Job, JobSource } from './jobTypes'

type Platform = 'facebook' | 'threads'

type Target = {
  key: string
  platform: Platform
  country: string
  city?: string
  target?: string
  query?: string
  limit?: number
}

type SocialItem = {
  id?: string
  author?: string
  text?: string
  url?: string
  createdAt?: string | null
}

type SocialResponse = {
  ok?: boolean
  count?: number
  items?: SocialItem[]
  error?: string
}

// The shared social sidecar serializes Chromium with SOCIAL_BROWSER_CONCURRENCY=1.
// Threads queries therefore need enough budget to wait behind another browser
// request and still complete their own navigation/scroll pass. Keep both below
// the flat-finder social proxy's 180s hard timeout.
const FACEBOOK_REQUEST_TIMEOUT_MS = Math.max(
  30_000,
  Math.min(170_000, Number(process.env.FACEBOOK_JOB_REQUEST_TIMEOUT_MS) || 90_000),
)
const THREADS_REQUEST_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(170_000, Number(process.env.THREADS_JOB_REQUEST_TIMEOUT_MS) || 150_000),
)
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

// Keep the social vacancy layer intentionally small and vacancy-biased. The
// social fetcher is a shared browser service, so this source must not fan out
// into dozens of concurrent searches and starve the main site again.
const FACEBOOK_TARGETS: Target[] = [
  { key: 'fb-uz-tashkent-work', platform: 'facebook', country: 'UZ', city: 'Tashkent', target: 'https://www.facebook.com/groups/210512423334861/', limit: 80 },
  { key: 'fb-uz-work', platform: 'facebook', country: 'UZ', target: 'https://www.facebook.com/groups/182315195189726/', limit: 80 },
  { key: 'fb-uz-work-search', platform: 'facebook', country: 'UZ', target: 'https://www.facebook.com/groups/1734634446766716/', limit: 80 },
  { key: 'fb-ua-freelancers', platform: 'facebook', country: 'UA', target: 'https://www.facebook.com/groups/freelancers.ukraine/', limit: 60 },
  { key: 'fb-ro-bucharest-jobs', platform: 'facebook', country: 'RO', city: 'Bucharest', target: 'https://www.facebook.com/groups/bucharestanglojobs/', limit: 60 },
]

const THREADS_TARGETS: Target[] = [
  { key: 'threads-remote', platform: 'threads', country: 'REMOTE', query: 'Remote Jobs hiring', limit: 30 },
  { key: 'threads-uz', platform: 'threads', country: 'UZ', city: 'Tashkent', query: 'Вакансии Ташкент', limit: 30 },
  { key: 'threads-kz', platform: 'threads', country: 'KZ', city: 'Almaty', query: 'Вакансии Алматы', limit: 30 },
  { key: 'threads-kg', platform: 'threads', country: 'KG', city: 'Bishkek', query: 'Вакансии Бишкек', limit: 30 },
  { key: 'threads-ua', platform: 'threads', country: 'UA', query: 'Вакансії Україна', limit: 30 },
  { key: 'threads-ro', platform: 'threads', country: 'RO', city: 'Bucharest', query: 'job București', limit: 30 },
]

const VACANCY_RE = /(?:we(?:'|’)re\s+hiring|we\s+are\s+hiring|now\s+hiring|hiring\s+(?:for|a|an)|job\s+opening|open\s+(?:role|position)|vacanc(?:y|ies)|ваканси[яи]|требу(?:ется|ются)|ищем\s+(?:сотрудник|специалист|менеджер|разработчик|дизайнер|оператор|кассир)|шукаємо\s+(?:співробітник|фахівц|менеджер|розробник)|потріб(?:ен|на|ні)\s+(?:співробітник|фахівець|менеджер)|ish(?:ga)?\s+(?:taklif|qabul)|xodim\s+kerak|vakansiya|loc\s+de\s+munc[ăa]|angajez|angajăm)/iu
const CANDIDATE_RE = /(?:open\s+to\s+work|looking\s+for\s+(?:a\s+)?(?:job|role|work)|seeking\s+(?:a\s+)?(?:job|role|opportunit)|ищу\s+(?:работу|подработку)|шукаю\s+(?:роботу|підробіток)|ish\s+(?:qidir|izlay)|ish\s+kerak|жұмыс\s+іздеймін|жумуш\s+издейм|caut\s+(?:un\s+)?loc\s+de\s+munc[ăa]|(?:îmi|imi)\s+caut\s+(?:un\s+)?job)/iu

function validDate(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return null
  if (Date.now() - time > MAX_AGE_MS || time > Date.now() + 24 * 60 * 60 * 1000) return null
  return new Date(time).toISOString()
}

function titleFrom(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const vacancyLine = lines.find((line) => VACANCY_RE.test(line)) || lines[0] || 'Vacancy'
  return vacancyLine
    .replace(/https?:\/\/\S+/giu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'Vacancy'
}

function remoteFrom(text: string): boolean {
  return /(?:remote|worldwide|anywhere|work\s+from\s+home|wfh|удал[её]н|віддален|дистанц|masofaviy|онлайн|online|la\s+distan(?:ță|ta)|de\s+acas[ăa])/iu.test(text)
}

function toJob(item: SocialItem, target: Target): Job | null {
  const text = String(item.text || '').trim()
  const postedAt = validDate(item.createdAt)
  const url = String(item.url || '').trim()
  if (!text || !url || !postedAt) return null
  if (!VACANCY_RE.test(text) || CANDIDATE_RE.test(text)) return null

  const idPart = String(item.id || url).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(-140)
  const source = target.platform as JobSource
  const company = String(item.author || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    || (target.platform === 'facebook' ? 'Facebook' : 'Threads')
  const location = target.city
    ? `${target.city}, ${target.country}`
    : target.country === 'REMOTE'
      ? 'Remote'
      : target.country

  return {
    id: `${target.platform}-${target.key}-${idPart}`,
    title: titleFrom(text),
    company,
    location,
    url,
    source,
    remote: remoteFrom(text) || target.country === 'REMOTE',
    tags: [target.platform === 'facebook' ? 'Facebook' : 'Threads', target.country, target.key],
    postedAt,
    description: text.slice(0, 6_000),
  }
}

async function fetchTarget(target: Target): Promise<Job[]> {
  const endpoint = String(process.env.HIRING_SOCIAL_API_URL || '').replace(/\/$/, '')
  const key = String(process.env.QUEUE_INTERNAL_KEY || '')
  if (!endpoint) throw new Error('HIRING_SOCIAL_API_URL is not configured')
  if (key.length < 16) throw new Error('QUEUE_INTERNAL_KEY is not configured')

  const payload = target.platform === 'facebook'
    ? { source: 'facebook', target: target.target, limit: target.limit || 60 }
    : { source: 'threads', mode: 'search', query: target.query, limit: target.limit || 30 }

  const timeoutMs = target.platform === 'threads'
    ? THREADS_REQUEST_TIMEOUT_MS
    : FACEBOOK_REQUEST_TIMEOUT_MS

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-queue-key': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const body = await response.json().catch(() => ({})) as SocialResponse
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `${target.platform} social fetch -> HTTP ${response.status}`)
  }

  return (Array.isArray(body.items) ? body.items : [])
    .map((item) => toJob(item, target))
    .filter((job): job is Job => Boolean(job))
}

async function fetchPlatform(targets: Target[], platform: Platform): Promise<Job[]> {
  if (String(process.env.SOCIAL_JOB_SOURCE || 'on').toLowerCase() === 'off') return []

  const byUrl = new Map<string, Job>()

  if (platform === 'threads') {
    // The sidecar serializes Chromium anyway. Starting every search at once only
    // starts every caller timeout at once, so later requests can expire while
    // waiting for the browser semaphore. Submit them in the order we want them
    // executed instead.
    for (const target of targets) {
      try {
        for (const job of await fetchTarget(target)) byUrl.set(job.url, job)
      } catch (error) {
        console.warn(
          `[jobs:${platform}] ${target.key} failed:`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }
    return [...byUrl.values()]
  }

  const settled = await Promise.allSettled(targets.map((target) => fetchTarget(target)))
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      for (const job of result.value) byUrl.set(job.url, job)
      return
    }
    console.warn(
      `[jobs:${platform}] ${targets[index]?.key || 'target'} failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })
  return [...byUrl.values()]
}

export const fetchFacebookJobs = (_q = '') => fetchPlatform(FACEBOOK_TARGETS, 'facebook')
export const fetchThreadsJobs = (_q = '') => fetchPlatform(THREADS_TARGETS, 'threads')
