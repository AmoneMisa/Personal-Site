import { useRedis } from '~~/server/utils/redis'
import { hiringDbEnabled, loadDbCandidates, saveDbCandidates } from './hiringDb'
import { emptyWebCursor, loadWebCursors, saveWebCursor, type WebCursor } from './hiringCursors'
import { normalizeCandidate } from './hiringNormalize'
import type { CvProfile } from './hiringTypes'
import {
  recordWebDiagnostic,
  type SourceRun,
  type WebSourceDiagnostic,
} from './hiringDiagnostics'
import { withHiringStoreLock } from './hiringStoreLock'

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
const AGO = '(?:\\s*(?:назад|тому|раніше|oldin|ago|în urmă))'
const WEEKS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:недел(?:ю|и|ь)|тижн(?:ів|і|я)|hafta|weeks?|săptămân\\p{L}*)${AGO}`, 'iu')
const MONTHS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:месяц\\p{L}*|місяц\\p{L}*|oy|months?|lun\\p{L}*)${AGO}`, 'iu')

function activityDate(text: string): string | null {
  const now = new Date()
  if (TODAY_RE.test(text)) return now.toISOString()
  if (YESTERDAY_RE.test(text)) return new Date(now.getTime() - 86_400_000).toISOString()

  // An explicit date beats any relative reading: cards that print one put it
  // first, while a work history further down is full of durations.
  const absolute = text.match(/(?<![\p{L}\p{N}])(\d{1,2})\s+([\p{L}]+),?\s+(20\d{2})(?![\p{L}\p{N}])/iu)
  if (absolute) {
    const month = MONTHS[absolute[2]!.toLocaleLowerCase('ru')]
    if (month != null) return new Date(Date.UTC(Number(absolute[3]), month, Number(absolute[1]), 12)).toISOString()
  }

  const dotted = text.match(/(?<![\d])(\d{1,2})[./-](\d{1,2})[./-](20\d{2})(?![\d])/)
  if (dotted) return new Date(Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]), 12)).toISOString()

  const hours = text.match(HOURS_AGO_RE)
  if (hours) return new Date(now.getTime() - Number(hours[1]) * 3_600_000).toISOString()

  const days = text.match(DAYS_AGO_RE)
  if (days) return new Date(now.getTime() - Number(days[1]) * 86_400_000).toISOString()

  const weeks = text.match(WEEKS_AGO_RE)
  if (weeks) return new Date(now.getTime() - Number(weeks[1]) * 7 * 86_400_000).toISOString()

  const months = text.match(MONTHS_AGO_RE)
  if (months) return new Date(now.getTime() - Number(months[1]) * 30 * 86_400_000).toISOString()
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
    // careerist.ru is a Russian platform and quotes its Uzbek listings in roubles.
    : /(?:RUB|руб|₽)/iu.test(text) ? 'RUB'
    : /(?:€|EUR|евро)/iu.test(text) ? 'EUR'
      : /(?:UZS|сум|so(?:'|’)m)/iu.test(text) ? 'UZS'
        : /(?:KZT|₸|тенге|тг\b)/iu.test(text) ? 'KZT'
          : /(?:UAH|грн|грив)/iu.test(text) ? 'UAH'
            : /(?:RON|lei\b)/iu.test(text) ? 'RON'
              : ({ UZ: 'UZS', KZ: 'KZT', UA: 'UAH', RO: 'RON' } as Record<string, string>)[country]
  // The amount and its currency often sit on separate rows of a card, so a
  // single newline between them is allowed.
  const money = text.match(/(?:от\s*)?(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|to)\s*(\d[\d\s.,]{2,}))?\s*\n?\s*(?:UZS|KZT|UAH|RON|RUB|USD|EUR|сум|so(?:'|’)m|тенге|грн|руб\p{L}*|lei|\$|€|₸|₽)/iu)
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

// "Michael P. , 54 года, Одесса, UA | Высшее образование" — the demographics
// row carries age, city and the candidate's own country code, which is not
// necessarily the country of the site the CV was posted on.
// The row may or may not start with the name: "Michael P. , 54 года, Одесса,
// UA" and ", 32 ani, București" are both shapes this site produces.
const FLAGMA_DEMOGRAPHICS_RE =
  /^\s*([^,|\n\d][^,|\n]{1,58})?\s*,?\s*(\d{2})\s*(?:года|лет|год|yil|ani|de ani)\s*,\s*([^,|\n]{2,60}?)\s*(?:,\s*([A-Z]{2})\b)?\s*(?:\||$)/mu
const FLAGMA_TARGET_RE = /(?:ищу|шукаю|qidiraman|caut)\s+(?:в|у|in)\s+([^\n]{3,120})/iu
const FLAGMA_EDUCATION_RE = /(?:Образование|Освіта|Ta['’]lim|Studii)\s*:?\s*([^\n]{3,240})/iu

/**
 * Shared Flagma card parser. Fields are read independently: a card missing a
 * salary, an age or a city still yields a profile as long as it has a URL, a
 * role and a recent date.
 */
function parseFlagma(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null

  const lines = block.text.split('\n').map((line) => line.trim()).filter(Boolean)
  const demographicsIndex = lines.findIndex((line) => FLAGMA_DEMOGRAPHICS_RE.test(line))
  const demographics = demographicsIndex >= 0 ? lines[demographicsIndex]!.match(FLAGMA_DEMOGRAPHICS_RE) : null

  // The name is either the prefix of the demographics row or the row above it.
  const inlineName = demographics?.[1]?.replace(/[,|]+$/, '').trim() || ''
  const rowAbove = demographicsIndex > 0 ? lines[demographicsIndex - 1]!.replace(/[,|]+$/, '').trim() : ''
  const nameCandidate = inlineName || rowAbove
  const name = nameCandidate && nameCandidate.length <= 100 && !/^\d|€|\$|₸|сум|lei|сохранить|save/iu.test(nameCandidate)
    ? nameCandidate
    : ''

  const age = demographics ? Number(demographics[2]) : parseAge(block.text)
  const city = demographics?.[3]?.trim() || cityFrom(block.text, source.country)
  // A candidate on flagma.ro may live in Ukraine and be looking for work in
  // Romania; the card says so, and the site's country must not overwrite it.
  const candidateCountry = demographics?.[4]?.toUpperCase() || ''

  const targets = block.text.match(FLAGMA_TARGET_RE)?.[1]?.trim() || ''
  const education = block.text.match(FLAGMA_EDUCATION_RE)?.[1]?.trim() || null
  const experienceYears = /без опыта работы|no experience|fără experiență/iu.test(block.text)
    ? 0
    : parseExperience(block.text)

  return profileBase(source, block, activity!, {
    name,
    role: block.title,
    city,
    age: age != null && age >= 14 && age <= 90 ? age : null,
    education,
    experienceYears,
    // Looking for work somewhere other than where they live is a relocation.
    relocationReady: targets ? true : undefined,
    ...(candidateCountry ? { country: candidateCountry, sourceCountry: source.country } : {}),
  })
}

/** Value printed under a label row, e.g. "Город" then "Ташкент". */
function labelledValue(lines: string[], label: RegExp): string | null {
  const index = lines.findIndex((line) => label.test(line))
  if (index < 0) return null
  const value = lines[index + 1]?.trim()
  return value && value.length <= 80 ? value : null
}

function parseCareerist(block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const activity = activityDate(block.text)
  if (!isRecent(activity)) return null
  const after = block.text.split(block.title).slice(1).join(block.title)
  const lines = after.split('\n').map((line) => line.trim()).filter(Boolean)

  // "Город" carries the city the candidate states; fall back to matching the
  // dictionary over the card only when the label is missing.
  const labelledCity = labelledValue(lines, /^город$/iu)
  const city = labelledCity && !/^\d/.test(labelledCity)
    ? labelledCity
    : cityFrom(after, 'UZ')

  // The name is the row before the "Город" label — the card puts it there —
  // but it must not be the salary or a label itself.
  const cityLabelIndex = lines.findIndex((line) => /^город$/iu.test(line))
  const nameCandidate = cityLabelIndex > 0 ? lines[cityLabelIndex - 1]! : ''
  const name = nameCandidate
    && nameCandidate.length <= 100
    && !/^(?:возраст|опыт работы|последнее место работы|отправить приглашение|подробнее|руб|\d)/iu.test(nameCandidate)
    ? nameCandidate
    : ''

  const labelledAge = labelledValue(lines, /^возраст$/iu)
  const age = labelledAge ? parseAge(labelledAge) : null

  const exp = after.match(/Опыт работы:\s*\n?\s*(\d+)\s*(?:год|года|лет)(?:\s+и\s+(\d+)\s+месяц)?/iu)
  const experienceYears = exp ? Number(exp[1]) + Number(exp[2] || 0) / 12 : /Без опыта/iu.test(after) ? 0 : null
  return profileBase(source, block, activity!, { name, role: block.title, city, age, experienceYears, updatedAt: activity })
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

      const previous = byUrl.get(profile.url)
      byUrl.set(profile.url, previous ? mergeSameCandidate(previous, profile) : profile)
      if (audit.samples.length < 3) {
        audit.samples.push(
          `${(profile.role || profile.name || '(no role)').slice(0, 44)} | ${profile.city || '-'} | ` +
          `${profile.activityAt?.slice(0, 10) || '-'} | ${profile.url}`,
        )
      }
    }
  }

  audit.deduplicated = byUrl.size
  if (audit.rejected) audit.rejectReasons.push(`${audit.rejected} blocks the parser could not turn into a profile`)
  audit.fetchDurationMs = Date.now() - startedAt
  return audit
}

/** One crawl round for a source, without storing anything. For diagnostics. */
export async function crawlWebSource(key: string, cursor?: WebCursor): Promise<WebSourceRun> {
  const source = SOURCES.find((item) => item.key === key)
  if (!source) throw new Error(`unknown web source: ${key}`)
  return fetchSource(source, cursor || emptyWebCursor(source.key))
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

/**
 * Stable identity for a profile: the source's own id where its URLs carry one
 * — "-rr486.html", "/cv/list/<hex>", "-6863660.html" — and the canonical URL
 * otherwise. Used to recognise a profile we have already crawled.
 */
export function webProfileId(url: string): string {
  const patterns = [/-rr(\d+)\.html/i, /\/cv\/list\/([a-z0-9]{8,})/i, /-(\d{5,})\.html/i, /\/resumes\/(\d+)/i]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]!
  }
  return url
}

export interface WebSourceRun {
  profiles: CvProfile[]
  fetched: number
  pages: number
  parsed: number
  rejected: number
  duplicate: number
  cursor: WebCursor
  newestActivityAt: string | null
  oldestActivityAt: string | null
  /** The run stopped early because it reached the previous cursor. */
  reachedCursor: boolean
}

/**
 * Reads a listing newest-first and stops at the first profile already seen and
 * unchanged. Without the cursor every refresh re-walked a fixed page count
 * whether or not anything had been posted since.
 */
async function fetchSource(source: WebCvSource, cursor: WebCursor): Promise<WebSourceRun> {
  const byUrl = new Map<string, CvProfile>()
  const run: WebSourceRun = {
    profiles: [],
    fetched: 0,
    pages: 0,
    parsed: 0,
    rejected: 0,
    duplicate: 0,
    cursor: { ...cursor },
    newestActivityAt: null,
    oldestActivityAt: null,
    reachedCursor: false,
  }

  const maxPages = Math.max(1, Number(process.env.HIRING_WEB_CV_MAX_PAGES) || MAX_PAGES)
  let newestSeen: CvProfile | null = null
  let reachedKnown = false

  for (let page = 1; page <= maxPages && !reachedKnown; page++) {
    const html = await fetchPage(source.pageUrl(page))
    run.pages += 1
    const blocks = blockAnchors(html, source)
    if (!blocks.length) break
    run.fetched += blocks.length

    let recentOnPage = 0
    for (const block of blocks) {
      const profile = source.parse(block, source)
      if (!profile) {
        run.rejected += 1
        continue
      }
      run.parsed += 1
      recentOnPage += 1

      const activity = profile.activityAt || profile.updatedAt || null
      if (activity) {
        if (!run.newestActivityAt || activity > run.newestActivityAt) run.newestActivityAt = activity
        if (!run.oldestActivityAt || activity < run.oldestActivityAt) run.oldestActivityAt = activity
      }
      if (!newestSeen) newestSeen = profile

      // Reaching the profile that was newest last round means everything below
      // it has already been read. Identity alone decides that: most boards
      // print relative dates ("2 hours ago"), which resolve to a different
      // instant on every parse, so an activity comparison would never match
      // and the crawl would walk the full page budget every time.
      //
      // If that profile has since disappeared from the listing, no stop fires
      // and the round falls back to the bounded page walk.
      const identity = webProfileId(profile.url)
      if (cursor.lastSeenProfileId && identity === cursor.lastSeenProfileId) {
        reachedKnown = true
        run.reachedCursor = true
        break
      }

      const previous = byUrl.get(profile.url)
      if (previous) run.duplicate += 1
      byUrl.set(profile.url, previous ? mergeSameCandidate(previous, profile) : profile)
    }

    // Listings are sorted newest-first. Once a page has candidate links but no
    // profiles inside the three-month activity window, deeper pages are older.
    if (!recentOnPage) break
  }

  if (newestSeen) {
    run.cursor = {
      sourceKey: source.key,
      lastSeenProfileId: webProfileId(newestSeen.url),
      lastSeenUrl: newestSeen.url,
      lastSeenUpdatedAt: newestSeen.activityAt || newestSeen.updatedAt || null,
      lastSuccessAt: new Date().toISOString(),
    }
  }

  run.profiles = [...byUrl.values()]
  return run
}

/**
 * Two cards for one profile URL are the same person listed under two desired
 * roles. Keep one identity and collect the roles instead of overwriting.
 */
function mergeSameCandidate(existing: CvProfile, incoming: CvProfile): CvProfile {
  const professions = [...new Set([
    ...(existing.professions || []),
    ...(incoming.professions || []),
    ...(existing.role ? [existing.role] : []),
    ...(incoming.role ? [incoming.role] : []),
  ].map((value) => value.trim()).filter(Boolean))]

  const newer = Date.parse(incoming.activityAt || '') > Date.parse(existing.activityAt || '') ? incoming : existing
  return {
    ...existing,
    ...Object.fromEntries(Object.entries(incoming).filter(([, value]) => value != null && value !== '')),
    // The first card's role stays the headline; the rest join the list.
    role: existing.role || incoming.role,
    professions,
    skills: [...new Set([...(existing.skills || []), ...(incoming.skills || [])])],
    activityAt: newer.activityAt,
    updatedAt: newer.updatedAt,
    originalText: existing.originalText,
  }
}

function storeKey(profile: CvProfile): string {
  return profile.url || profile.id
}

interface PersistResult {
  /** Everything in the store after the write, all sources included. */
  stored: number
  /** Profiles from this source still inside the retention window. */
  shown: number
  /** Profiles from this source the retention window dropped. */
  expired: number
}

async function persistWebProfiles(
  profiles: CvProfile[],
  diagnostic: SourceRun,
  sourceKey: string,
): Promise<PersistResult> {
  const persisted = await withHiringStoreLock(async () => {
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
    const fromSource = (profile: StoredProfile) => profile.sourceKey === sourceKey
    const beforeRetention = [...byKey.values()].filter(fromSource).length
    const kept = [...byKey.values()].filter((profile) => {
      // Web boards have already passed source-specific candidate parsing. Do not
      // run Telegram vacancy heuristics over them here.
      const time = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
      return Number.isFinite(time) && time >= cutoff && time <= Date.now() + 48 * 60 * 60 * 1000
    })

    await useRedis().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
    const shown = kept.filter(fromSource).length
    return { stored: kept.length, shown, expired: Math.max(0, beforeRetention - shown) }
  })
  if (hiringDbEnabled()) await saveDbCandidates(profiles, diagnostic)
  return persisted
}

export async function refreshHiringWebSource(handle: string): Promise<{ fetched: number; stored: number; candidates: number } | null> {
  if (process.env.HIRING_WEB_CV_SOURCE === 'off') return null
  const key = handle.replace(/^web:/i, '').toLowerCase()
  const source = configuredSources().find((item) => item.key === key)
  if (!source) return null
  const checkedAt = new Date().toISOString()
  const startedAt = Date.now()
  const cursor = (await loadWebCursors()).get(source.key) || emptyWebCursor(source.key)

  try {
    const run = await fetchSource(source, cursor)
    const diagnostic: WebSourceDiagnostic = {
      handle: `web:${source.key}`,
      key: source.key,
      label: source.label,
      country: source.country,
      status: run.profiles.length ? 'ok' : 'empty',
      fetched: run.fetched,
      candidates: run.profiles.length,
      pages: run.pages,
      blocks: run.fetched,
      parsed: run.parsed,
      rejected: run.rejected,
      duplicate: run.duplicate,
      expired: 0,
      shown: 0,
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: run.newestActivityAt,
      oldestActivityAt: run.oldestActivityAt,
      lastSeenProfileId: run.cursor.lastSeenProfileId,
      lastSuccessAt: run.cursor.lastSuccessAt,
      reachedCursor: run.reachedCursor,
      checkedAt,
    }

    const persisted = await persistWebProfiles(run.profiles, diagnostic, source.key)
    diagnostic.shown = persisted.shown
    diagnostic.expired = persisted.expired
    recordWebDiagnostic(diagnostic)
    // Only after a successful write: a cursor advanced past profiles that were
    // never stored would skip them on every later run.
    await saveWebCursor(run.cursor)

    console.log(
      `[hiring:web] ${source.key} pages=${run.pages} blocks=${run.fetched} parsed=${run.parsed}`
      + ` rejected=${run.rejected} dup=${run.duplicate} shown=${persisted.shown} expired=${persisted.expired}`
      + ` cursor=${run.cursor.lastSeenProfileId || '-'}${run.reachedCursor ? ' (stopped at cursor)' : ''}`
      + ` store=${persisted.stored} in ${diagnostic.fetchDurationMs}ms`,
    )
    return { fetched: run.fetched, candidates: run.profiles.length, stored: persisted.stored }
  } catch (error) {
    const diagnostic: WebSourceDiagnostic = {
      handle: `web:${source.key}`,
      key: source.key,
      label: source.label,
      country: source.country,
      status: 'error',
      fetched: 0,
      candidates: 0,
      pages: 0,
      blocks: 0,
      parsed: 0,
      rejected: 0,
      duplicate: 0,
      expired: 0,
      shown: 0,
      fetchDurationMs: Date.now() - startedAt,
      newestActivityAt: null,
      oldestActivityAt: null,
      // The cursor is untouched on failure, so the next run retries from here.
      lastSeenProfileId: cursor.lastSeenProfileId,
      lastSuccessAt: cursor.lastSuccessAt,
      reachedCursor: false,
      checkedAt,
      error: (error as Error).message,
    }
    recordWebDiagnostic(diagnostic)
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}
