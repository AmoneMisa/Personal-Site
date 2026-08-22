import { persistWebProfiles } from './hiringWebSources'
import { recordWebDiagnostic, type WebSourceDiagnostic } from './hiringDiagnostics'
import { detectCity, isLikelyCvPost } from './hiringSources'
import { normalizeCandidate } from './hiringNormalize'
import type { CvProfile } from './hiringTypes'

const REQUEST_TIMEOUT_MS = 180_000
const DEFAULT_LIMIT = 80
const MAX_AGE_MONTHS = 3

type SocialPlatform = 'facebook' | 'threads'

type SocialTarget = {
  key: string
  label: string
  platform: SocialPlatform
  country: 'UZ' | 'KZ' | 'KG' | 'UA'
  city?: string
  target?: string
  query?: string
  limit?: number
}

type SocialItem = {
  id?: string
  source?: SocialPlatform
  target?: string
  author?: string
  text?: string
  url?: string
  createdAt?: string | null
  images?: string[]
}

type SocialResponse = {
  ok?: boolean
  count?: number
  items?: SocialItem[]
  error?: string
}

// Public-only sources. Facebook targets are groups/pages readable without a
// user session by the social-fetcher. Threads uses anonymous Recent search: it
// is much more useful for candidate discovery than pinning the crawler to one
// employer/account and lets us search explicit job-seeker intent per country.
const TARGETS: SocialTarget[] = [
  // Uzbekistan — bias toward mixed/job-seeker groups because /hiring needs CVs,
  // not another vacancy mirror.
  {
    key: 'facebook-uz-tashkent-candidates',
    label: 'Ищу работу в Ташкенте',
    platform: 'facebook',
    country: 'UZ',
    city: 'Tashkent',
    target: 'https://www.facebook.com/groups/165844980247044/',
    limit: 120,
  },
  {
    key: 'facebook-uz-tashkent-work',
    label: 'Работа в Ташкенте',
    platform: 'facebook',
    country: 'UZ',
    city: 'Tashkent',
    target: 'https://www.facebook.com/groups/210512423334861/',
    limit: 120,
  },
  {
    key: 'facebook-uz-work',
    label: 'Есть работа! Узбекистан',
    platform: 'facebook',
    country: 'UZ',
    target: 'https://www.facebook.com/groups/182315195189726/',
    limit: 120,
  },
  {
    key: 'facebook-uz-work-search',
    label: 'РАБОТА-УЗБЕКИСТАН',
    platform: 'facebook',
    country: 'UZ',
    target: 'https://www.facebook.com/groups/1734634446766716/',
    limit: 120,
  },

  // Kazakhstan — active public job communities. They are mixed/vacancy-heavy,
  // therefore every post still has to pass isLikelyCvPost below.
  {
    key: 'facebook-kz-almaty-24rabota',
    label: '24rabota.kz — Алматы',
    platform: 'facebook',
    country: 'KZ',
    city: 'Almaty',
    target: 'https://www.facebook.com/groups/24rabota.kz/',
    limit: 100,
  },
  {
    key: 'facebook-kz-astana-work',
    label: 'Работа в Астане',
    platform: 'facebook',
    country: 'KZ',
    city: 'Astana',
    target: 'https://www.facebook.com/groups/astana.rabota.vakansii/',
    limit: 100,
  },

  // Ukraine — public professional communities where self-promotion / freelance
  // availability appears alongside vacancies.
  {
    key: 'facebook-ua-digital-jobs',
    label: 'Digital Jobs Ukraine',
    platform: 'facebook',
    country: 'UA',
    target: 'https://www.facebook.com/groups/DIGITALJOBSUKR/',
    limit: 100,
  },
  {
    key: 'facebook-ua-freelancers',
    label: 'Freelancers Ukraine',
    platform: 'facebook',
    country: 'UA',
    target: 'https://www.facebook.com/groups/freelancers.ukraine/',
    limit: 100,
  },

  // Threads public Recent search. Two intent variants per country compensate
  // for the small anonymous result window while keeping precision high.
  { key: 'threads-uz-ru', label: 'Threads: ищу работу Ташкент', platform: 'threads', country: 'UZ', city: 'Tashkent', query: 'ищу работу Ташкент', limit: 40 },
  { key: 'threads-uz-uz', label: 'Threads: ish qidiryapman Toshkent', platform: 'threads', country: 'UZ', city: 'Tashkent', query: 'ish qidiryapman Toshkent', limit: 40 },
  { key: 'threads-kz-almaty', label: 'Threads: ищу работу Алматы', platform: 'threads', country: 'KZ', city: 'Almaty', query: 'ищу работу Алматы', limit: 40 },
  { key: 'threads-kz-astana', label: 'Threads: ищу работу Астана', platform: 'threads', country: 'KZ', city: 'Astana', query: 'ищу работу Астана', limit: 40 },
  { key: 'threads-kg-bishkek', label: 'Threads: ищу работу Бишкек', platform: 'threads', country: 'KG', city: 'Bishkek', query: 'ищу работу Бишкек', limit: 40 },
  { key: 'threads-kg-cv', label: 'Threads: резюме Бишкек', platform: 'threads', country: 'KG', city: 'Bishkek', query: 'резюме Бишкек', limit: 40 },
  { key: 'threads-ua-kyiv', label: 'Threads: шукаю роботу Київ', platform: 'threads', country: 'UA', city: 'Kyiv', query: 'шукаю роботу Київ', limit: 40 },
  { key: 'threads-ua-country', label: 'Threads: шукаю роботу Україна', platform: 'threads', country: 'UA', query: 'шукаю роботу Україна', limit: 40 },
]

function configuredTargets(): SocialTarget[] {
  if (String(process.env.HIRING_SOCIAL_SOURCE || 'on').toLowerCase() === 'off') return []
  const raw = String(process.env.HIRING_SOCIAL_SOURCES || '').trim()
  if (!raw) return TARGETS
  const allowed = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  return TARGETS.filter((target) => allowed.has(target.key.toLowerCase()))
}

export function hiringSocialSourceHandles(): string[] {
  return configuredTargets().map((target) => `social:${target.key}`)
}

function socialApiUrl(): string {
  return String(process.env.HIRING_SOCIAL_API_URL || '').replace(/\/$/, '')
}

function cutoff(): number {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() - MAX_AGE_MONTHS)
  return date.getTime()
}

function recentIso(value: string | null | undefined): string | null {
  if (!value) return null
  const time = Date.parse(value)
  if (!Number.isFinite(time) || time < cutoff() || time > Date.now() + 48 * 60 * 60 * 1000) return null
  return new Date(time).toISOString()
}

function contacts(text: string): CvProfile['contacts'] {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/(?<![\w.])@[A-Za-z0-9_]{5,}/)?.[0]
  const phone = text.match(/(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,12}/)?.[0]?.replace(/\s+/g, ' ').trim()
  return {
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
  }
}

const INTENT_PREFIX_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:я\s+)?(?:ищу|шукаю)\s+(?:себе\s+)?(?:работу|подработку|роботу|підробіток)\s*[:—-]?\s*/iu
const UZ_INTENT_PREFIX_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:menga\s+)?(?:ish(?:\s+joyi)?\s+kerak|ish\s+(?:qidiryapman|qidiraman|izlayapman))\s*[:—-]?\s*/iu

function roleFrom(text: string): string {
  const lines = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const intent = lines.find((line) => /(?:ищу|шукаю).{0,20}(?:работ|робот)|(?:ish.{0,20}(?:kerak|qidir|izlay))/iu.test(line))
  const stripped = (intent || '')
    .replace(INTENT_PREFIX_RE, '')
    .replace(UZ_INTENT_PREFIX_RE, '')
    .replace(/^\s*[:—-]\s*/, '')
    .trim()
  if (stripped.length >= 2 && stripped.length <= 180) return stripped
  return ''
}

function nameFrom(item: SocialItem, text: string): string {
  const explicit = text.match(/(?:^|\n)\s*(?:имя|ім['’]я|ism(?:i|im)?|name)\s*[:—-]\s*([^\n]{2,80})/iu)?.[1]?.trim()
  if (explicit && !/ваканс|компан|работ|робот|ish/iu.test(explicit)) return explicit
  const author = String(item.author || '').trim()
  return author && author.length <= 80 ? author : ''
}

function itemToProfile(item: SocialItem, target: SocialTarget): CvProfile | null {
  const text = String(item.text || '').trim()
  const createdAt = recentIso(item.createdAt)
  if (!createdAt || !item.url || !text || !isLikelyCvPost(text, true)) return null

  const publicContacts = contacts(text)
  const direct = publicContacts.telegram || publicContacts.email || publicContacts.phone || null
  const city = detectCity(text, target.country) || target.city || null
  const role = roleFrom(text)
  const id = String(item.id || item.url).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(-180)

  return normalizeCandidate({
    id: `social-${target.key}-${id}`,
    source: 'social',
    origin: target.platform,
    sourceKey: target.key,
    sourceLabel: target.label,
    sourceCountry: target.country,
    country: target.country,
    name: nameFrom(item, text),
    role,
    professions: role ? [role] : [],
    city,
    isAdult: true,
    remote: /remote|удал[её]н|віддален|дистанц|masofaviy|онлайн|online/iu.test(text) ? true : null,
    url: item.url,
    publishedAt: createdAt,
    updatedAt: createdAt,
    activityAt: createdAt,
    createdAt,
    originalText: text.slice(0, 4_000),
    description: text.slice(0, 4_000),
    photos: Array.isArray(item.images) ? item.images.slice(0, 8) : [],
    photo: Array.isArray(item.images) ? item.images[0] || null : null,
    contacts: publicContacts,
    contact: direct || item.url,
    contactType: direct ? 'direct' : 'platform',
    tags: [target.label, target.platform === 'facebook' ? 'Facebook' : 'Threads', target.country],
  })
}

async function fetchTarget(target: SocialTarget): Promise<{ profiles: CvProfile[]; fetched: number }> {
  const endpoint = socialApiUrl()
  const key = String(process.env.QUEUE_INTERNAL_KEY || '')
  if (!endpoint) throw new Error('HIRING_SOCIAL_API_URL is not configured')
  if (key.length < 16) throw new Error('QUEUE_INTERNAL_KEY is not configured')

  const payload = target.platform === 'facebook'
    ? { source: 'facebook', target: target.target, limit: target.limit || DEFAULT_LIMIT }
    : { source: 'threads', mode: 'search', query: target.query, sort: 'latest', limit: target.limit || DEFAULT_LIMIT }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-queue-key': key },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const body = await response.json().catch(() => ({})) as SocialResponse
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `social fetcher -> HTTP ${response.status}`)
  }

  const items = Array.isArray(body.items) ? body.items : []
  const profiles = items.map((item) => itemToProfile(item, target)).filter((item): item is CvProfile => Boolean(item))
  return { profiles, fetched: Number.isFinite(body.count) ? Number(body.count) : items.length }
}

export async function refreshHiringSocialSource(handle: string): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  if (String(process.env.HIRING_SOCIAL_SOURCE || 'on').toLowerCase() === 'off') return null
  const key = handle.replace(/^social:/i, '').toLowerCase()
  const target = configuredTargets().find((item) => item.key.toLowerCase() === key)
  if (!target) return null

  const startedAt = Date.now()
  const checkedAt = new Date().toISOString()
  const diagnosticBase = {
    handle: `social:${target.key}`,
    key: `social:${target.key}`,
    label: target.label,
    country: target.country,
    pages: 1,
    duplicate: 0,
    expired: 0,
    shown: 0,
    newestActivityAt: null,
    oldestActivityAt: null,
    lastSeenProfileId: '',
    lastSuccessAt: null,
    reachedCursor: false,
    checkedAt,
  }

  try {
    const run = await fetchTarget(target)
    const times = run.profiles
      .map((profile) => profile.createdAt || '')
      .filter(Boolean)
      .sort()
    const diagnostic: WebSourceDiagnostic = {
      ...diagnosticBase,
      status: run.profiles.length ? 'ok' : 'empty',
      fetched: run.fetched,
      candidates: run.profiles.length,
      blocks: run.fetched,
      parsed: run.profiles.length,
      rejected: Math.max(0, run.fetched - run.profiles.length),
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: times.at(-1) || null,
      oldestActivityAt: times[0] || null,
      lastSuccessAt: checkedAt,
    }

    const persisted = await persistWebProfiles(run.profiles, diagnostic, target.key)
    diagnostic.shown = persisted.shown
    diagnostic.expired = persisted.expired
    recordWebDiagnostic(diagnostic)
    console.log(
      `[hiring:social] ${target.key} fetched=${run.fetched} candidates=${run.profiles.length}`
      + ` shown=${persisted.shown} store=${persisted.stored} in ${diagnostic.fetchDurationMs}ms`,
    )
    return { fetched: run.fetched, candidates: run.profiles.length, stored: persisted.stored }
  } catch (error) {
    const diagnostic: WebSourceDiagnostic = {
      ...diagnosticBase,
      status: 'error',
      fetched: 0,
      candidates: 0,
      blocks: 0,
      parsed: 0,
      rejected: 0,
      fetchDurationMs: Date.now() - startedAt,
      error: (error as Error).message,
    }
    recordWebDiagnostic(diagnostic)
    throw error
  }
}
