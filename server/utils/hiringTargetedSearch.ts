import { normalizeCandidate } from './hiringNormalize'
import type { CvProfile } from './hiringTypes'
import { cityRe } from './hiringWebFields'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 25_000
const MAX_PAGES = 3
const MAX_AGE_MONTHS = 3

interface CandidateBlock {
  href: string
  title: string
  text: string
  html: string
}

const MONTHS: Record<string, number> = {
  январь: 0, января: 0,
  февраль: 1, февраля: 1,
  март: 2, марта: 2,
  апрель: 3, апреля: 3,
  май: 4, мая: 4,
  июнь: 5, июня: 5,
  июль: 6, июля: 6,
  август: 7, августа: 7,
  сентябрь: 8, сентября: 8,
  октябрь: 9, октября: 9,
  ноябрь: 10, ноября: 10,
  декабрь: 11, декабря: 11,
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

function htmlText(value: string): string {
  return decodeEntities(value)
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function absoluteUrl(raw: string, base: string): string {
  try {
    const url = new URL(decodeEntities(raw), base)
    url.hash = ''
    return url.toString()
  } catch {
    return raw
  }
}

function cutoffDate(): Date {
  const value = new Date()
  value.setUTCMonth(value.getUTCMonth() - MAX_AGE_MONTHS)
  return value
}

function recent(iso: string | null): iso is string {
  if (!iso) return false
  const time = Date.parse(iso)
  return Number.isFinite(time)
    && time >= cutoffDate().getTime()
    && time <= Date.now() + 48 * 60 * 60 * 1000
}

function activityDate(text: string): string | null {
  const now = new Date()
  if (/(?:^|\s)сегодня(?:\s|$)/iu.test(text)) return now.toISOString()
  if (/(?:^|\s)вчера(?:\s|$)/iu.test(text)) return new Date(now.getTime() - 86_400_000).toISOString()

  const hours = text.match(/(?:^|\s)(\d{1,3})\s*(?:ч\.?|час(?:а|ов)?)\s+назад(?:\s|$)/iu)
  if (hours) return new Date(now.getTime() - Number(hours[1]) * 3_600_000).toISOString()

  const days = text.match(/(?:^|\s)(\d{1,3})\s*(?:дн(?:я|ей)?|день)\s+назад(?:\s|$)/iu)
  if (days) return new Date(now.getTime() - Number(days[1]) * 86_400_000).toISOString()

  const weeks = text.match(/(?:^|\s)(\d{1,2})\s*недел(?:ю|и|ь)\s+назад(?:\s|$)/iu)
  if (weeks) return new Date(now.getTime() - Number(weeks[1]) * 7 * 86_400_000).toISOString()

  const absolute = text.match(/(?<![\p{L}\p{N}])(\d{1,2})\s+([\p{L}]+),?\s+(20\d{2})(?![\p{L}\p{N}])/iu)
  if (absolute) {
    const month = MONTHS[absolute[2]!.toLocaleLowerCase('ru')]
    if (month != null) return new Date(Date.UTC(Number(absolute[3]), month, Number(absolute[1]), 12)).toISOString()
  }

  const dotted = text.match(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?!\d)/)
  if (dotted) return new Date(Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]), 12)).toISOString()
  return null
}

function parseSalary(text: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const match = text.match(/(?:от\s*)?(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до)\s*(\d[\d\s.,]{2,}))?\s*(?:UZS|сум|so(?:'|’)m)/iu)
  if (!match) return {}
  const parse = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = parse(match[1]!)
  const second = match[2] ? parse(match[2]) : first
  if (!Number.isFinite(first) || first <= 0) return {}
  return { salaryMin: Math.min(first, second), salaryMax: Math.max(first, second), currency: 'UZS' }
}

function contacts(text: string): CvProfile['contacts'] {
  const phone = text.match(/(?:\+?998|\+?\d{1,3})?[\s()-]*(?:\d[\s()-]*){8,12}/)?.[0]?.replace(/\s+/g, ' ').trim()
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(telegram ? { telegram } : {}) }
}

function blockAnchors(html: string): CandidateBlock[] {
  const root = 'https://flagma.uz/ru/resume/'
  const matches: Array<{ index: number; end: number; href: string; title: string }> = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1]!, root)
    if (!/flagma\.uz\/(?:ru\/)?(?:rezyume|resume)-[^?#]*-rr\d+\.html/i.test(href)) continue
    const title = htmlText(match[2]!)
    if (!title || title.length > 240) continue
    matches.push({ index: match.index, end: re.lastIndex, href, title })
  }

  const grouped: Array<{ href: string; first: number; end: number; titles: string[] }> = []
  for (const item of matches) {
    const current = grouped[grouped.length - 1]
    if (current && current.href === item.href) {
      current.end = Math.max(current.end, item.end)
      current.titles.push(item.title)
      continue
    }
    grouped.push({ href: item.href, first: item.index, end: item.end, titles: [item.title] })
  }

  return grouped.map((item, index) => {
    const start = Math.max(0, item.first - 350)
    const end = grouped[index + 1]?.first ?? Math.min(html.length, item.end + 5_000)
    const sliced = html.slice(start, end)
    const cut = start > 0 ? sliced.indexOf('>') : -1
    const trimmed = cut >= 0 && cut < 400 ? sliced.slice(cut + 1) : sliced
    const orphan = trimmed.search(/<\/(?:script|style)>/i)
    const opens = trimmed.search(/<(?:script|style)\b/i)
    const raw = orphan >= 0 && (opens < 0 || orphan < opens)
      ? trimmed.slice(trimmed.indexOf('>', orphan) + 1)
      : trimmed
    const title = item.titles.reduce((longest, candidate) => candidate.length > longest.length ? candidate : longest, '')
    return { href: item.href, title, html: raw, text: htmlText(raw) }
  })
}

const DEMOGRAPHICS_RE =
  /^\s*([^,|\n\d][^,|\n]{1,80})?\s*,?\s*(\d{2})\s*(?:года|лет|год|yil)\s*,\s*([^,|\n]{2,80}?)\s*(?:,\s*([A-Z]{2})\b)?\s*(?:\||$)/mu

function profileId(url: string): string {
  const token = url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(-180)
  return `web-flagma-uz-${token}`
}

function parseBlock(block: CandidateBlock): CvProfile | null {
  const activity = activityDate(block.text)
  if (!recent(activity)) return null

  const lines = block.text.split('\n').map((line) => line.trim()).filter(Boolean)
  const demographicsIndex = lines.findIndex((line) => DEMOGRAPHICS_RE.test(line))
  const demographics = demographicsIndex >= 0 ? lines[demographicsIndex]!.match(DEMOGRAPHICS_RE) : null
  const age = demographics ? Number(demographics[2]) : null
  const inlineName = demographics?.[1]?.replace(/[,|]+$/, '').trim() || ''
  const rowAbove = demographicsIndex > 0 ? lines[demographicsIndex - 1]!.replace(/[,|]+$/, '').trim() : ''
  const nameCandidate = inlineName || rowAbove
  const name = nameCandidate && nameCandidate.length <= 100 && !/^\d|€|\$|₸|сум|сохранить/iu.test(nameCandidate)
    ? nameCandidate
    : ''
  const city = demographics?.[3]?.trim() || null
  const candidateCountry = demographics?.[4]?.toUpperCase() || 'UZ'
  const publicContacts = contacts(block.text)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)

  return normalizeCandidate({
    id: profileId(block.href),
    source: 'telegram',
    origin: 'web',
    sourceKey: 'flagma-uz',
    sourceCountry: 'UZ',
    country: candidateCountry,
    name,
    role: block.title,
    age: age != null && age >= 14 && age <= 90 ? age : null,
    isAdult: age == null ? true : age >= 18,
    city,
    remote: /удал[её]н|remote|masofadan/iu.test(block.text),
    employmentTypes: [
      ...(/полная занятость|полный день|full[- ]?time/iu.test(block.text) ? ['full_time' as const] : []),
      ...(/неполная занятость|частичная занятость|part[- ]?time/iu.test(block.text) ? ['part_time' as const] : []),
    ],
    url: block.href,
    publishedAt: activity,
    updatedAt: activity,
    activityAt: activity,
    createdAt: activity,
    originalText: block.text.slice(0, 4_000),
    description: block.text.slice(0, 4_000),
    tags: ['Flagma UZ', 'Web CV', 'UZ'],
    contacts: publicContacts,
    contact: publicContacts.telegram || publicContacts.email || publicContacts.phone || block.href,
    contactType: hasDirect ? 'direct' : 'platform',
    ...parseSalary(block.text),
  })
}

function flagmaRegion(city: string): string {
  return cityRe('tashkent|toshkent|ташкент|тошкент').test(city.trim()) ? 'tashkent/' : ''
}

function pageUrl(term: string, page: number, city: string): string {
  const querySegment = encodeURIComponent(`q=${term.trim().replace(/\s+/g, ' ')}`)
  const suffix = page <= 1 ? '' : `page-${page}/`
  return `https://flagma.uz/ru/resume/${flagmaRegion(city)}${querySegment}/${suffix}`
}

/**
 * Query-specific Flagma search complements the bounded background crawl.
 * Flagma UZ has enough CV volume that a small global feed window cannot
 * represent a role search. Tashkent queries use Flagma's own city scope; other
 * cities safely fall back to the country-wide search and are filtered later.
 */
export async function searchTargetedHiringProfiles(term: string, city = ''): Promise<CvProfile[]> {
  const normalized = term.trim().replace(/\s+/g, ' ')
  if (normalized.length < 2 || normalized.length > 120) return []

  const byUrl = new Map<string, CvProfile>()
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(pageUrl(normalized, page, city), {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru,en;q=0.8',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`flagma.uz targeted search -> ${response.status}`)
    const html = await response.text()
    const blocks = blockAnchors(html)
    if (!blocks.length) break

    let recentOnPage = 0
    for (const block of blocks) {
      const profile = parseBlock(block)
      if (!profile) continue
      recentOnPage += 1
      byUrl.set(profile.url, profile)
    }
    if (!recentOnPage) break
  }
  return [...byUrl.values()]
}
