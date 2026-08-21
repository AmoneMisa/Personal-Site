import { useRedis } from '~~/server/utils/redis'
import { hiringDbEnabled, loadDbCandidates, saveDbCandidates } from './hiringDb'
import { normalizeCandidate } from './hiringNormalize'
import type { HiringSourceDiagnostic } from './hiringSources'
import type { CvProfile } from './hiringTypes'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 25_000
const STORE_KEY = 'hiring:store:v4'
const STORE_TTL_SECONDS = 100 * 86_400
const MAX_AGE_MONTHS = 3
const MAX_PAGES = 3
const DETAIL_BATCH = 6

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }

interface Summary {
  url: string
  role: string
  text: string
}

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

function htmlLines(value: string): string[] {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|article|section|tr|td)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function stripHtml(value: string): string {
  return htmlLines(value).join(' ').replace(/\s+/g, ' ').trim()
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

function cutoff(): number {
  const date = new Date()
  date.setUTCMonth(date.getUTCMonth() - MAX_AGE_MONTHS)
  return date.getTime()
}

function validRecent(value: string | null): value is string {
  if (!value) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && time >= cutoff() && time <= Date.now() + 48 * 60 * 60 * 1000
}

function isoDate(year: number, month: number, day: number): string | null {
  const value = Date.UTC(year, month - 1, day, 12)
  if (!Number.isFinite(value) || value > Date.now() + 48 * 60 * 60 * 1000) return null
  return new Date(value).toISOString()
}

function detailActivity(html: string, text: string): string | null {
  const candidates: number[] = []

  for (const match of html.matchAll(/(?:dateModified|datePublished|article:modified_time|article:published_time)[^>\n]{0,180}(20\d{2}-\d{2}-\d{2}(?:T[^"'<\s]+)?)/giu)) {
    const time = Date.parse(match[1]!)
    if (Number.isFinite(time) && time <= Date.now() + 48 * 60 * 60 * 1000) candidates.push(time)
  }
  for (const match of html.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/giu)) {
    const time = Date.parse(match[1]!)
    if (Number.isFinite(time) && time <= Date.now() + 48 * 60 * 60 * 1000) candidates.push(time)
  }
  for (const match of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/g)) {
    const iso = isoDate(Number(match[3]), Number(match[2]), Number(match[1]))
    if (iso) candidates.push(Date.parse(iso))
  }

  return candidates.length ? new Date(Math.max(...candidates)).toISOString() : null
}

function listSummaries(html: string): Summary[] {
  const base = 'https://ish-bor.uz/ru/ishchilar'
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']*\/ru\/ishchilar\/id\/\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const byUrl = new Map<string, Summary>()

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!
    const role = stripHtml(match[2])
    if (role.length < 2 || role.length > 220 || /подробнее/iu.test(role)) continue
    const start = match.index || 0
    const end = matches[index + 1]?.index ?? Math.min(html.length, start + 4_500)
    const url = absoluteUrl(match[1]!, base)
    byUrl.set(url, { url, role, text: htmlLines(html.slice(start, end)).join('\n') })
  }
  return [...byUrl.values()]
}

function parseAge(text: string): number | null {
  const match = text.match(/\b(\d{2})\s*(?:лет|год(?:а)?|yosh|yil)\b/iu)
    || text.match(/(?:возраст|yoshi)\s*[:—-]?\s*(\d{2})\b/iu)
  const age = match ? Number(match[1]) : Number.NaN
  return Number.isFinite(age) && age >= 14 && age <= 90 ? age : null
}

function parseExperience(text: string): number | null {
  if (/без опыта|tajribasiz/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|стаж|tajriba)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|yil)/iu)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|yil)\b[^\n]{0,30}(?:опыт|стаж|tajriba)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function salary(text: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const currency = /(?:\$|USD|доллар)/iu.test(text) ? 'USD' : 'UZS'
  const match = text.match(/(?:от\s*)?(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|dan|gacha)\s*(\d[\d\s.,]{2,}))?\s*(?:UZS|сум|so(?:'|’)m|\$|USD|доллар)?/iu)
  if (!match) return {}
  const parse = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = parse(match[1]!)
  const second = match[2] ? parse(match[2]) : undefined
  if (!Number.isFinite(first) || first <= 0) return {}
  return {
    salaryMin: second && Number.isFinite(second) ? Math.min(first, second) : first,
    salaryMax: second && Number.isFinite(second) ? Math.max(first, second) : undefined,
    currency,
  }
}

function city(text: string): string | null {
  const aliases: Array<[string, RegExp]> = [
    ['Tashkent', /\b(?:ташкент|tashkent|toshkent)\b/iu],
    ['Samarkand', /\b(?:самарканд|samarqand|samarkand)\b/iu],
    ['Bukhara', /\b(?:бухара|buxoro|bukhara)\b/iu],
    ['Fergana', /\b(?:фергана|фаргана|farg(?:'|’)ona|fergana)\b/iu],
    ['Andijan', /\b(?:андижан|andijon|andijan)\b/iu],
    ['Namangan', /\b(?:наманган|namangan)\b/iu],
    ['Nukus', /\b(?:нукус|nukus)\b/iu],
    ['Navoi', /\b(?:навои|navoi)\b/iu],
    ['Qarshi', /\b(?:карши|qarshi|karshi)\b/iu],
  ]
  return aliases.find(([, re]) => re.test(text))?.[0] || null
}

function district(text: string): string | null {
  const aliases: Array<[string, RegExp]> = [
    ['Chilanzar', /\b(?:чиланзар|chilonzor|chilanzar)\b/iu],
    ['Yunusabad', /\b(?:юнасабад|yunusobod|yunusabad)\b/iu],
    ['Mirabad', /\b(?:мирабад|mirobod|mirabad)\b/iu],
    ['Sergeli', /\b(?:сергели|sergeli)\b/iu],
    ['Uchtepa', /\b(?:учтепа|uchtepa)\b/iu],
    ['Almazar', /\b(?:алмазар|olmazor|almazar)\b/iu],
    ['Yakkasaray', /\b(?:яккасарай|yakkasaroy|yakkasaray)\b/iu],
    ['Yashnabad', /\b(?:яшнабад|yashnobod|yashnabad)\b/iu],
  ]
  return aliases.find(([, re]) => re.test(text))?.[0] || null
}

function contacts(text: string): CvProfile['contacts'] {
  const phone = text.match(/(?:\+?998\s*)?(?:\(?\d{2}\)?[\s-]*)?\d{3}[\s-]*\d{2}[\s-]*\d{2}/)?.[0]
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  return {
    ...(phone ? { phone: phone.replace(/\s+/g, ' ').trim() } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
  }
}

function profileFrom(summary: Summary, detailHtml: string): CvProfile | null {
  const detailText = htmlLines(detailHtml).join('\n')
  const activity = detailActivity(detailHtml, detailText)
  if (!validRecent(activity)) return null

  const combined = `${summary.text}\n${detailText}`
  const publicContacts = contacts(detailText)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)
  const age = parseAge(combined)
  const sourceId = summary.url.match(/\/id\/(\d+)/)?.[1] || summary.url
  const features: string[] = []
  if (/работа для студентов|student|talaba/iu.test(combined)) features.push('Student')
  if (/без опыта|tajribasiz/iu.test(combined)) features.push('No experience')

  return normalizeCandidate({
    id: `web-ishbor-uz-${sourceId}`,
    source: 'telegram',
    origin: 'web',
    sourceKey: 'ishbor-uz',
    country: 'UZ',
    name: '',
    role: summary.role,
    professions: [summary.role],
    previousProfessions: [],
    features,
    age,
    isAdult: age == null ? true : age >= 18,
    experienceYears: parseExperience(combined),
    city: city(combined),
    district: district(combined),
    remote: /удал[её]н|онлайн|online|masofaviy/iu.test(combined),
    relocationReady: /готов\p{L}* к переезду|возможен переезд|ko['’]?chib o['’]?tish/iu.test(combined),
    employmentTypes: [
      ...(/полный день|полная занятость|to['’]?liq/iu.test(combined) ? ['full_time' as const] : []),
      ...(/неполный день|частичная занятость|подработка|qisman/iu.test(combined) ? ['part_time' as const] : []),
    ],
    url: summary.url,
    publishedAt: null,
    updatedAt: activity,
    activityAt: activity,
    createdAt: activity,
    originalText: detailText.slice(0, 4_000),
    description: detailText.slice(0, 4_000),
    tags: ['ish-bor.uz', 'Web CV', 'Uzbekistan'],
    contacts: publicContacts,
    contact: publicContacts.telegram || publicContacts.email || publicContacts.phone || summary.url,
    contactType: hasDirect ? 'direct' : 'platform',
    ...salary(combined),
  })
}

async function fetchProfiles(): Promise<{ profiles: CvProfile[]; fetched: number }> {
  const all = new Map<string, Summary>()
  const maxPages = Math.max(1, Math.min(10, Number(process.env.HIRING_ISHBOR_MAX_PAGES) || MAX_PAGES))

  for (let page = 1; page <= maxPages; page++) {
    const url = page === 1
      ? 'https://ish-bor.uz/ru/ishchilar'
      : `https://ish-bor.uz/ru/ishchilar?page=${page}`
    const summaries = listSummaries(await fetchHtml(url))
    if (!summaries.length) break
    summaries.forEach((item) => all.set(item.url, item))
  }

  const summaries = [...all.values()]
  const profiles: CvProfile[] = []
  for (let offset = 0; offset < summaries.length; offset += DETAIL_BATCH) {
    const batch = summaries.slice(offset, offset + DETAIL_BATCH)
    const results = await Promise.allSettled(batch.map(async (summary) =>
      profileFrom(summary, await fetchHtml(summary.url))))
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) profiles.push(result.value)
    })
  }
  return { profiles, fetched: summaries.length }
}

async function persist(profiles: CvProfile[], diagnostic: HiringSourceDiagnostic): Promise<number> {
  const now = new Date().toISOString()
  let existing: StoredProfile[] = []
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (raw) existing = JSON.parse(raw) as StoredProfile[]
  } catch {
    // Postgres hydration below is the fallback.
  }
  if (!existing.length && hiringDbEnabled()) {
    existing = (await loadDbCandidates()).map((profile) => ({ ...profile, lastSeen: now }))
  }

  const byKey = new Map<string, StoredProfile>()
  for (const profile of existing) byKey.set(profile.url || profile.id, profile)
  for (const profile of profiles) byKey.set(profile.url || profile.id, { ...profile, lastSeen: now })

  const oldest = cutoff()
  const kept = [...byKey.values()].filter((profile) => {
    const time = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
    return Number.isFinite(time) && time >= oldest && time <= Date.now() + 48 * 60 * 60 * 1000
  })

  await useRedis().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
  if (hiringDbEnabled()) await saveDbCandidates(profiles, diagnostic)
  return kept.length
}

export function hiringExtraWebSourceHandles(): string[] {
  return process.env.HIRING_ISHBOR_CV_SOURCE === 'off' ? [] : ['web:ishbor-uz']
}

export async function refreshHiringExtraWebSource(
  handle: string,
): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  if (!hiringExtraWebSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())) return null
  const checkedAt = new Date().toISOString()
  try {
    const result = await fetchProfiles()
    const diagnostic: HiringSourceDiagnostic = {
      handle: 'web:ishbor-uz',
      country: 'UZ',
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      checkedAt,
    }
    const stored = await persist(result.profiles, diagnostic)
    console.log(`[hiring:web] ishbor-uz fetched=${result.fetched} candidates=${result.profiles.length} store=${stored}`)
    return { fetched: result.fetched, candidates: result.profiles.length, stored }
  } catch (error) {
    const diagnostic: HiringSourceDiagnostic = {
      handle: 'web:ishbor-uz',
      country: 'UZ',
      status: 'error',
      fetched: 0,
      candidates: 0,
      checkedAt,
      error: (error as Error).message,
    }
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}
