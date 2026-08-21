import { useRedis } from '~~/server/utils/redis'
import { hiringDbEnabled, loadDbCandidates, saveDbCandidates } from './hiringDb'
import { normalizeCandidate } from './hiringNormalize'
import type { CvProfile } from './hiringTypes'
import type { HiringSourceDiagnostic } from './hiringSources'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 25_000
const MAX_AGE_MONTHS = 3
const STORE_KEY = 'hiring:store:v4'
const STORE_TTL_SECONDS = 100 * 86_400
const MAX_PAGES = 5

interface WebCvSource {
  key: string
  label: string
  country: 'UZ' | 'UA' | 'KZ' | 'RO' | 'KG'
  /** Anchor text longer than this is not a candidate title. Cards that wrap the
   *  whole profile in one link need a larger budget than a plain headline. */
  maxTitleChars?: number
  root: string
  pageUrl: (page: number) => string
  linkRe: RegExp
  parse: (block: CandidateBlock, source: WebCvSource) => CvProfile | null
}

interface CandidateBlock {
  href: string
  title: string
  text: string
  html: string
}

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }

const MONTHS: Record<string, number> = {
  январь: 0, января: 0, february: 1, февраль: 1, февраля: 1,
  март: 2, марта: 2, april: 3, апрель: 3, апреля: 3,
  may: 4, май: 4, мая: 4, june: 5, июнь: 5, июня: 5,
  july: 6, июль: 6, июля: 6, august: 7, август: 7, августа: 7,
  september: 8, сентябрь: 8, сентября: 8, october: 9, октябрь: 9, октября: 9,
  november: 10, ноябрь: 10, ноября: 10, december: 11, декабрь: 11, декабря: 11,
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, august: 7, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
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

function isRecent(iso: string | null): boolean {
  if (!iso) return false
  const time = Date.parse(iso)
  return Number.isFinite(time) && time >= cutoffDate().getTime() && time <= Date.now() + 48 * 60 * 60 * 1000
}

// Unicode-aware boundaries. JavaScript's \b only knows ASCII word characters,
// so it never fires next to Cyrillic or Romanian letters.
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const TODAY_RE = new RegExp(`${B}(?:сегодня|сьогодні|bugun|today|astăzi|azi)${E}`, 'iu')
const YESTERDAY_RE = new RegExp(`${B}(?:вчера|вчора|kecha|yesterday|ieri)${E}`, 'iu')
const HOURS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:ч\\.?|час(?:а|ов)?|год(?:ину|ини)|soat|hours?|hrs?|ore|oră)${E}`, 'iu')
const DAYS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:дн(?:я|ей|і|ів)?|день|days?|kun|zile|zi)${E}`, 'iu')
const WEEKS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:недел(?:ю|и|ь)|тижн(?:ів|і|я)|hafta|weeks?|săptămân\\p{L}*)${E}`, 'iu')
const MONTHS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:месяц\\p{L}*|місяц\\p{L}*|oy|months?|lun\\p{L}*)${E}`, 'iu')

function activityDate(text: string): string | null {
  const now = new Date()
  if (TODAY_RE.test(text)) return now.toISOString()
  if (YESTERDAY_RE.test(text)) return new Date(now.getTime() - 86_400_000).toISOString()

  const hours = text.match(HOURS_AGO_RE)
  if (hours) return new Date(now.getTime() - Number(hours[1]) * 3_600_000).toISOString()

  const days = text.match(DAYS_AGO_RE)
  if (days) return new Date(now.getTime() - Number(days[1]) * 86_400_000).toISOString()

  const weeks = text.match(WEEKS_AGO_RE)
  if (weeks) return new Date(now.getTime() - Number(weeks[1]) * 7 * 86_400_000).toISOString()

  const months = text.match(MONTHS_AGO_RE)
  if (months) return new Date(now.getTime() - Number(months[1]) * 30 * 86_400_000).toISOString()

  const absolute = text.match(/\b(\d{1,2})\s+([\p{L}]+),?\s+(20\d{2})\b/iu)
  if (absolute) {
    const month = MONTHS[absolute[2]!.toLocaleLowerCase('ru')]
    if (month != null) return new Date(Date.UTC(Number(absolute[3]), month, Number(absolute[1]), 12)).toISOString()
  }

  const dotted = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/)
  if (dotted) return new Date(Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]), 12)).toISOString()
  return null
}

function parseAge(text: string): number | null {
  const match = text.match(/\b(\d{2})\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani|an|yil)\b/iu)
  if (!match) return null
  const age = Number(match[1])
  return age >= 14 && age <= 90 ? age : null
}

function parseExperience(text: string): number | null {
  if (/без опыта|no experience|fără experiență|ish tajribasi talab qilinmaydi/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|experience|experiență|ish tajribasi)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|years?|ani|an|yil)/iu)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|years?|ani|an|yil)\b[^\n]{0,30}(?:опыт|experience|experiență)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const currency = /(?:\$|USD|доллар)/iu.test(text) ? 'USD'
    : /(?:€|EUR|евро)/iu.test(text) ? 'EUR'
      : /(?:UZS|сум|so(?:'|’)m)/iu.test(text) ? 'UZS'
        : /(?:KZT|₸|тенге|тг\b)/iu.test(text) ? 'KZT'
          : /(?:UAH|грн|грив)/iu.test(text) ? 'UAH'
            : /(?:RON|lei\b)/iu.test(text) ? 'RON'
              : ({ UZ: 'UZS', KZ: 'KZT', UA: 'UAH', RO: 'RON' } as Record<string, string>)[country]
  const money = text.match(/(?:от\s*)?(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|to)\s*(\d[\d\s.,]{2,}))?\s*(?:UZS|KZT|UAH|RON|USD|EUR|сум|so(?:'|’)m|тенге|грн|lei|\$|€|₸)/iu)
  if (!money) return {}
  const parse = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = parse(money[1]!)
  const second = money[2] ? parse(money[2]) : first
  if (!Number.isFinite(first) || first <= 0) return {}
  return { salaryMin: Math.min(first, second), salaryMax: Math.max(first, second), currency }
}

const CITIES: Record<string, Array<[string, RegExp]>> = {
  UZ: [
    ['Tashkent', /\b(?:ташкент|tashkent|toshkent)\b/iu], ['Samarkand', /\b(?:самарканд|samarqand|samarkand)\b/iu],
    ['Bukhara', /\b(?:бухара|buxoro|bukhara)\b/iu], ['Namangan', /\b(?:наманган|namangan)\b/iu],
    ['Andijan', /\b(?:андижан|andijon|andijan)\b/iu], ['Fergana', /\b(?:фергана|фаргана|farg(?:'|’)ona|fergana)\b/iu],
    ['Nukus', /\b(?:нукус|nukus)\b/iu], ['Qarshi', /\b(?:карши|qarshi|karshi)\b/iu],
  ],
  KZ: [
    ['Almaty', /\b(?:алматы|almaty)\b/iu], ['Astana', /\b(?:астана|astana)\b/iu],
    ['Shymkent', /\b(?:шымкент|shymkent)\b/iu], ['Karaganda', /\b(?:караганда|karaganda)\b/iu],
    ['Atyrau', /\b(?:атырау|atyrau)\b/iu], ['Aktobe', /\b(?:актобе|aktobe)\b/iu], ['Aktau', /\b(?:актау|aktau)\b/iu],
  ],
  UA: [
    ['Kyiv', /\b(?:киев|київ|kyiv|kiev)\b/iu], ['Kharkiv', /\b(?:харьков|харків|kharkiv|kharkov)\b/iu],
    ['Dnipro', /\b(?:днепр|дніпро|dnipro)\b/iu], ['Odesa', /\b(?:одесса|одеса|odesa|odessa)\b/iu],
    ['Lviv', /\b(?:львов|львів|lviv)\b/iu], ['Vinnytsia', /\b(?:винница|вінниця|vinnytsia)\b/iu],
  ],
  RO: [
    ['Bucharest', /\b(?:bucharest|bucurești|bucuresti|бухарест)\b/iu], ['Cluj-Napoca', /\b(?:cluj(?:-napoca)?|клуж)\b/iu],
    ['Iași', /\b(?:iași|iasi|яссы)\b/iu], ['Timișoara', /\b(?:timișoara|timisoara|тимишоара)\b/iu],
    ['Brașov', /\b(?:brașov|brasov|брашов)\b/iu], ['Constanța', /\b(?:constanța|constanta|констанца)\b/iu],
  ],
}

function cityFrom(text: string, country: string): string | null {
  for (const [city, re] of CITIES[country] || []) if (re.test(text)) return city
  return null
}

function employment(text: string): CvProfile['employmentTypes'] {
  const out = new Set<'full_time' | 'part_time'>()
  if (/полная занятость|полный день|full[- ]?time|to['’]?liq bandlik|normă întreagă/iu.test(text)) out.add('full_time')
  if (/неполная занятость|неполный день|частичная занятость|part[- ]?time|qisman bandlik|part[- ]time/iu.test(text)) out.add('part_time')
  return [...out]
}

function contacts(text: string): CvProfile['contacts'] {
  const phone = text.match(/(?:\+?\d[\d\s()\-]{7,}\d)/)?.[0]?.replace(/\s+/g, ' ')
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(telegram ? { telegram } : {}) }
}

function blockAnchors(html: string, source: WebCvSource): CandidateBlock[] {
  const matches: Array<{ index: number; end: number; href: string; title: string }> = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1]!, source.root)
    source.linkRe.lastIndex = 0
    if (!source.linkRe.test(href)) continue
    const title = htmlText(match[2]!)
    if (!title || title.length > (source.maxTitleChars ?? 240)) continue
    matches.push({ index: match.index, end: re.lastIndex, href, title })
  }

  // A card usually contains several links to the same profile — the card
  // itself, "expand", "report". Cutting at the next matching anchor therefore
  // cut cards in half and produced one empty block per secondary link. Group by
  // profile instead: a card runs from its first anchor to the first anchor of
  // the next distinct profile, which is what "the containing card" means here.
  const byProfile: Array<{ href: string; first: number; end: number; titles: string[] }> = []
  for (const item of matches) {
    const current = byProfile[byProfile.length - 1]
    if (current && current.href === item.href) {
      current.end = Math.max(current.end, item.end)
      current.titles.push(item.title)
      continue
    }
    byProfile.push({ href: item.href, first: item.index, end: item.end, titles: [item.title] })
  }

  return byProfile.map((item, index) => {
    // Activity markers are rendered just before or just after the card, so keep
    // a margin on both sides without spilling into the next profile.
    const start = Math.max(0, item.first - 350)
    const nextStart = byProfile[index + 1]?.first
    const end = nextStart ?? Math.min(html.length, item.end + 5_000)
    const raw = html.slice(start, end)
    // The longest anchor text is the card; the short ones are its controls.
    const title = item.titles.reduce((longest, candidate) => (candidate.length > longest.length ? candidate : longest), '')
    return { href: item.href, title, html: raw, text: htmlText(raw) }
  })
}

function profileBase(source: WebCvSource, block: CandidateBlock, activity: string, partial: Partial<CvProfile>): CvProfile {
  const publicContacts = contacts(block.text)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)
  const idToken = block.href.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(-180)
  const originalText = block.text.slice(0, 4_000)
  return normalizeCandidate({
    id: `web-${source.key}-${idToken}`,
    source: 'telegram',
    origin: 'web',
    sourceKey: source.key,
    country: source.country,
    name: partial.name || '',
    role: partial.role || block.title,
    url: block.href,
    publishedAt: partial.publishedAt ?? null,
    updatedAt: partial.updatedAt ?? activity,
    activityAt: activity,
    createdAt: activity,
    originalText,
    description: originalText,
    tags: [source.label, 'Web CV', source.country],
    contacts: publicContacts,
    contact: publicContacts.telegram || publicContacts.email || publicContacts.phone || block.href,
    contactType: hasDirect ? 'direct' : 'platform',
    age: partial.age ?? parseAge(block.text),
    isAdult: (partial.age ?? parseAge(block.text)) == null ? true : (partial.age ?? parseAge(block.text))! >= 18,
    city: partial.city ?? cityFrom(block.text, source.country),
    experienceYears: partial.experienceYears ?? parseExperience(block.text),
    employmentTypes: partial.employmentTypes ?? employment(block.text),
    remote: partial.remote ?? /удал[её]н|remote|masofadan|la distanță/iu.test(block.text),
    relocationReady: partial.relocationReady ?? /возможен переезд|готов\p{L}* к переезду|ko['’]?chib o['’]?tish|relocat/iu.test(block.text),
    ...parseSalary(block.text, source.country),
    ...partial,
  })
}

function parseFlagma(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null
  const afterTitle = block.text.split(block.title).slice(1).join(block.title)
  const name = afterTitle.match(/\n([^\n]{2,100}?),\s*\d{2}\s*(?:лет|год|года|yil|ani)/iu)?.[1]?.trim() || ''
  return profileBase(source, block, activity!, { name, role: block.title })
}

function parseCareerist(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null
  const after = block.text.split(block.title).slice(1).join(block.title)
  const lines = after.split('\n').map((line) => line.trim()).filter(Boolean)
  const name = lines.find((line) => !/^(?:город|возраст|опыт работы|последнее место работы|отправить приглашение|подробнее|\d[\d\s]*\s*(?:руб|₽))/iu.test(line)
    && !cityFrom(line, 'UZ') && line.length <= 100) || ''
  const exp = after.match(/Опыт работы:\s*\n?\s*(\d+)\s*(?:год|года|лет)(?:\s+и\s+(\d+)\s+месяц)?/iu)
  const experienceYears = exp ? Number(exp[1]) + Number(exp[2] || 0) / 12 : /Без опыта/iu.test(after) ? 0 : null
  return profileBase(source, block, activity!, { name, role: block.title, experienceYears, updatedAt: activity })
}

// Longest alternative first: "года" must not match as "год" plus a stray "а".
const KZ_AGE_LINE_RE = /^(\d{2})\s*(?:года|лет|год)\s*,?\s*(.*)$/iu
const KZ_SALARY_LINE_RE = /(\d[\d\s]{2,})\s*(?:KZT|₸|тенге)/iu

/**
 * The card is a sequence of lines: name, age, city, desired role, salary, then
 * skill chips and a summary. Positions are read relative to the age line,
 * which is the one reliably recognisable row, so a reordered or renamed
 * wrapper does not break the parse.
 */
function parseRabotaKz(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null

  const lines = block.title.split('\n').map((line) => line.trim()).filter(Boolean)
  const ageIndex = lines.findIndex((line) => KZ_AGE_LINE_RE.test(line))
  // Secondary anchors ("Развернуть", "Пожаловаться") point at the same profile
  // and carry no card; without them the URL-keyed map would overwrite a real
  // profile with an empty one.
  if (ageIndex < 0 && lines.length < 3) return null

  const ageMatch = ageIndex >= 0 ? lines[ageIndex]!.match(KZ_AGE_LINE_RE) : null
  const age = ageMatch ? Number(ageMatch[1]) : parseAge(block.text)
  const name = ageIndex > 0 ? lines[ageIndex - 1]! : ''
  const city = ageMatch?.[2]?.trim() || cityFrom(block.text, 'KZ')

  const salaryIndex = lines.findIndex((line) => KZ_SALARY_LINE_RE.test(line))
  // The desired role sits directly under the age/city row.
  const roleIndex = ageIndex >= 0 ? ageIndex + 1 : 0
  const role = (salaryIndex === roleIndex ? '' : lines[roleIndex] || '').trim()

  // Chips between the salary and the free-text summary are the candidate's
  // own skill list; the long line after them is the summary.
  const skills = salaryIndex >= 0
    ? lines.slice(salaryIndex + 1).filter((line) => line.length >= 3 && line.length <= 70).slice(0, 12)
    : []

  return profileBase(source, block, activity!, {
    name,
    role: role || block.title.split('\n')[0] || '',
    city,
    age: Number.isFinite(age) ? age : null,
    skills,
    updatedAt: activity,
  })
}

function parseTalent(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null
  const after = block.text.split(block.title).slice(1).join(block.title)
  const city = cityFrom(after, 'UA')
  let name = ''
  if (city) {
    const cityNames = CITIES.UA.find(([value]) => value === city)?.[1]
    if (cityNames) {
      const nameMatch = after.match(new RegExp(`(?:^|\\n)([^\\n]{2,100}?)\\s+(?:${cityNames.source.replace(/^\\b|\\b$/g, '')})\\b`, 'iu'))
      name = nameMatch?.[1]?.trim() || ''
    }
  }
  return profileBase(source, block, activity!, {
    name,
    role: block.title,
    city,
    updatedAt: activity,
    relocationReady: /возможен переезд|можливий переїзд/iu.test(after),
  })
}

const SOURCES: WebCvSource[] = [
  {
    key: 'flagma-uz', label: 'Flagma UZ', country: 'UZ', root: 'https://flagma.uz/ru/resume/',
    pageUrl: (page) => page === 1 ? 'https://flagma.uz/ru/resume/' : `https://flagma.uz/ru/resume/page-${page}/`,
    linkRe: /flagma\.uz\/(?:ru\/)?(?:rezyume|resume)-[^?#]*-rr\d+\.html/i, parse: parseFlagma,
  },
  {
    key: 'careerist-uz', label: 'Careerist UZ', country: 'UZ', root: 'https://uzbekistan.careerist.ru/resume/',
    pageUrl: (page) => page === 1 ? 'https://uzbekistan.careerist.ru/resume/' : `https://uzbekistan.careerist.ru/resume/?page=${page - 1}`,
    linkRe: /(?:uzbekistan|tashkent|nukus|andijan|termez|gulistan|samarkand|bukhara|fergana|namangan)\.careerist\.ru\/resume\/[^?#]+\.html/i,
    parse: parseCareerist,
  },
  {
    key: 'rabotakz', label: 'Rabota.kz', country: 'KZ', root: 'https://rabota.kz/cv/list', maxTitleChars: 900,
    pageUrl: (page) => page === 1 ? 'https://rabota.kz/cv/list' : `https://rabota.kz/cv/list?page=${page}`,
    linkRe: /rabota\.kz\/cv\/list\/[a-z0-9-]{8,}/i, parse: parseRabotaKz,
  },
  {
    key: 'talent-ua', label: 'Talent.UA', country: 'UA', root: 'https://talent.ua/ru/resumes/search',
    pageUrl: (page) => page === 1 ? 'https://talent.ua/ru/resumes/search' : `https://talent.ua/ru/resumes/search/page${page}`,
    linkRe: /talent\.ua\/ru\/resumes\/\d+/i, parse: parseTalent,
  },
  {
    key: 'flagma-ro', label: 'Flagma RO', country: 'RO', root: 'https://flagma.ro/ru/resume/',
    pageUrl: (page) => page === 1 ? 'https://flagma.ro/ru/resume/' : `https://flagma.ro/ru/resume/page-${page}/`,
    linkRe: /flagma\.ro\/(?:ru\/)?(?:rezyume|resume)-[^?#]*-rr\d+\.html/i, parse: parseFlagma,
  },
]

function configuredSources(): WebCvSource[] {
  const raw = process.env.HIRING_WEB_CV_SOURCES?.trim()
  if (!raw) return SOURCES
  const enabled = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  return SOURCES.filter((source) => enabled.has(source.key))
}

export interface WebSourceAudit {
  key: string
  label: string
  country: string
  pagesFetched: number
  blocksFound: number
  parsed: number
  rejected: number
  rejectReasons: string[]
  /** Why blocks were rejected: no activity date, outside the window, or an
   *  unrecognised card shape. Separates a stale board from a broken parser. */
  rejectedNoDate: number
  rejectedStale: number
  rejectedShape: number
  rejectSamples: string[]
  fieldCounts: {
    name: number
    age: number
    city: number
    role: number
    salary: number
    activity: number
  }
  withinWindow: number
  deduplicated: number
  fetchDurationMs: number
  newestActivityAt: string | null
  oldestActivityAt: string | null
  httpErrors: string[]
  samples: string[]
}

/** The registry, for audits and for the source filter the UI exposes. */
export function listWebSources(): Array<{ key: string; label: string; country: string }> {
  return SOURCES.map((source) => ({ key: source.key, label: source.label, country: source.country }))
}

/**
 * Walks a source the way the crawler does, but reports every stage instead of
 * only the profiles. This is how a dead source is told apart from a blocked
 * one, a parser failure or a genuinely low-yield board.
 */
export async function auditWebSource(key: string, maxPages = 2): Promise<WebSourceAudit> {
  const source = SOURCES.find((item) => item.key === key)
  if (!source) throw new Error(`unknown web source: ${key}`)

  const startedAt = Date.now()
  const audit: WebSourceAudit = {
    key: source.key,
    label: source.label,
    country: source.country,
    pagesFetched: 0,
    blocksFound: 0,
    parsed: 0,
    rejected: 0,
    rejectReasons: [],
    rejectedNoDate: 0,
    rejectedStale: 0,
    rejectedShape: 0,
    rejectSamples: [],
    fieldCounts: { name: 0, age: 0, city: 0, role: 0, salary: 0, activity: 0 },
    withinWindow: 0,
    deduplicated: 0,
    fetchDurationMs: 0,
    newestActivityAt: null,
    oldestActivityAt: null,
    httpErrors: [],
    samples: [],
  }

  const cutoff = cutoffDate().getTime()
  const byUrl = new Map<string, CvProfile>()

  for (let page = 1; page <= maxPages; page += 1) {
    let html = ''
    try {
      html = await fetchPage(source.pageUrl(page))
      audit.pagesFetched += 1
    } catch (error) {
      audit.httpErrors.push(`page ${page}: ${(error as Error).message}`)
      break
    }

    const blocks = blockAnchors(html, source)
    audit.blocksFound += blocks.length
    if (!blocks.length) {
      // Blocks are what the link pattern finds; none means the listing markup
      // changed, the page is empty, or an anti-bot wall replaced it.
      audit.rejectReasons.push(`page ${page}: no candidate blocks in ${html.length} bytes`)
      break
    }

    for (const block of blocks) {
      const profile = source.parse(block, source)
      if (!profile) {
        audit.rejected += 1
        const activity = activityDate(block.text)
        if (!activity) audit.rejectedNoDate += 1
        else if (!isRecent(activity)) audit.rejectedStale += 1
        else audit.rejectedShape += 1
        if (audit.rejectSamples.length < 3) {
          audit.rejectSamples.push(
            `${activity ? (isRecent(activity) ? 'shape' : 'stale ' + activity.slice(0, 10)) : 'no-date'}: ` +
            `${block.title.replace(/\n/g, ' | ').slice(0, 90)}`,
          )
        }
        continue
      }
      audit.parsed += 1
      if (profile.name) audit.fieldCounts.name += 1
      if (profile.age != null) audit.fieldCounts.age += 1
      if (profile.city) audit.fieldCounts.city += 1
      if (profile.role) audit.fieldCounts.role += 1
      if (profile.salaryMin != null || profile.salaryMax != null) audit.fieldCounts.salary += 1
      if (profile.activityAt) audit.fieldCounts.activity += 1

      const stamp = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
      if (Number.isFinite(stamp)) {
        const iso = new Date(stamp).toISOString()
        if (!audit.newestActivityAt || iso > audit.newestActivityAt) audit.newestActivityAt = iso
        if (!audit.oldestActivityAt || iso < audit.oldestActivityAt) audit.oldestActivityAt = iso
        if (stamp >= cutoff) audit.withinWindow += 1
      }

      byUrl.set(profile.url, profile)
      if (audit.samples.length < 3) {
        audit.samples.push(
          `${(profile.role || profile.name || '(no role)').slice(0, 44)} | ${profile.city || '-'} | ` +
          `${profile.activityAt?.slice(0, 10) || '-'} | ${profile.url.slice(0, 60)}`,
        )
      }
    }
  }

  audit.deduplicated = byUrl.size
  if (audit.rejected) audit.rejectReasons.push(`${audit.rejected} blocks the parser could not turn into a profile`)
  audit.fetchDurationMs = Date.now() - startedAt
  return audit
}

export function hiringWebSourceHandles(): string[] {
  if (process.env.HIRING_WEB_CV_SOURCE === 'off') return []
  return configuredSources().map((source) => `web:${source.key}`)
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ru,en;q=0.8' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`${new URL(url).host} -> ${response.status}`)
  return response.text()
}

async function fetchSource(source: WebCvSource): Promise<{ profiles: CvProfile[]; fetched: number }> {
  const byUrl = new Map<string, CvProfile>()
  let fetched = 0
  for (let page = 1; page <= Math.max(1, Number(process.env.HIRING_WEB_CV_MAX_PAGES) || MAX_PAGES); page++) {
    const html = await fetchPage(source.pageUrl(page))
    const blocks = blockAnchors(html, source)
    if (!blocks.length) break
    fetched += blocks.length
    let recentOnPage = 0
    for (const block of blocks) {
      const profile = source.parse(block, source)
      if (!profile) continue
      recentOnPage += 1
      byUrl.set(profile.url, profile)
    }
    // Listings are sorted newest-first. Once a page has candidate links but no
    // profiles inside the three-month activity window, deeper pages are older.
    if (!recentOnPage) break
  }
  return { profiles: [...byUrl.values()], fetched }
}

function storeKey(profile: CvProfile): string {
  return profile.url || profile.id
}

async function persistWebProfiles(profiles: CvProfile[], diagnostic: HiringSourceDiagnostic): Promise<number> {
  const now = new Date().toISOString()
  let existing: StoredProfile[] = []
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (raw) existing = JSON.parse(raw) as StoredProfile[]
  } catch {
    // If Redis is cold, hydrate from Postgres below before writing a new store.
  }
  if (!existing.length && hiringDbEnabled()) {
    existing = (await loadDbCandidates()).map((profile) => ({ ...profile, lastSeen: now }))
  }

  const byKey = new Map<string, StoredProfile>()
  for (const profile of existing) byKey.set(storeKey(profile), profile)
  for (const profile of profiles) byKey.set(storeKey(profile), { ...profile, lastSeen: now })

  const cutoff = cutoffDate().getTime()
  const kept = [...byKey.values()].filter((profile) => {
    // Web boards have already passed source-specific candidate parsing. Do not
    // run Telegram vacancy heuristics over them here.
    const time = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
    return Number.isFinite(time) && time >= cutoff && time <= Date.now() + 48 * 60 * 60 * 1000
  })

  await useRedis().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
  if (hiringDbEnabled()) await saveDbCandidates(profiles, diagnostic)
  return kept.length
}

export async function refreshHiringWebSource(handle: string): Promise<{ fetched: number; stored: number; candidates: number } | null> {
  if (process.env.HIRING_WEB_CV_SOURCE === 'off') return null
  const key = handle.replace(/^web:/i, '').toLowerCase()
  const source = configuredSources().find((item) => item.key === key)
  if (!source) return null
  const checkedAt = new Date().toISOString()

  try {
    const result = await fetchSource(source)
    const diagnostic: HiringSourceDiagnostic = {
      handle: `web:${source.key}`,
      country: source.country,
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      checkedAt,
    }
    const stored = await persistWebProfiles(result.profiles, diagnostic)
    console.log(`[hiring:web] ${source.key} fetched=${result.fetched} candidates=${result.profiles.length} store=${stored}`)
    return { fetched: result.fetched, candidates: result.profiles.length, stored }
  } catch (error) {
    const diagnostic: HiringSourceDiagnostic = {
      handle: `web:${source.key}`,
      country: source.country,
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
