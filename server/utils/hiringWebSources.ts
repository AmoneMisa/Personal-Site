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
import {
  CITIES,
  MAX_AGE_MONTHS,
  absoluteUrl,
  activityDate,
  cityFrom,
  contacts,
  cutoffDate,
  dayMonthDate,
  decodeEntities,
  employment,
  htmlText,
  isRecent,
  parseAge,
  parseExperience,
  parseSalary,
} from './hiringWebFields'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 25_000
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
    const sliced = html.slice(start, end)
    // The margin can begin inside a tag; drop the truncated attribute soup so
    // it never reaches the profile text.
    const cut = start > 0 ? sliced.indexOf('>') : -1
    const trimmed = cut >= 0 && cut < 400 ? sliced.slice(cut + 1) : sliced
    // The margin can also open inside a <script>, leaving its closing tag and
    // the tail of an ad loader in the card: script contents only get stripped
    // when both tags are present. Drop anything before an unmatched closer.
    const orphan = trimmed.search(/<\/(?:script|style)>/i)
    const opens = trimmed.search(/<(?:script|style)/i)
    const raw = orphan >= 0 && (opens < 0 || orphan < opens)
      ? trimmed.slice(trimmed.indexOf('>', orphan) + 1)
      : trimmed
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
/**
 * Boards that hide the candidate name still print something in its place —
 * Flagma writes "ФИО скрыто" — and storing that verbatim gives every profile
 * on the board the same fake name. An empty name is the honest answer.
 */
function realName(value: string): string {
  if (!value || value.length > 100) return ''
  if (/скрыт|прихован|hidden|yashiring|ascuns/iu.test(value)) return ''
  return value
}

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
  const name = !/^\d|€|\$|₸|сум|lei|сохранить|save/iu.test(nameCandidate)
    ? realName(nameCandidate)
    : ''

  const age = demographics ? Number(demographics[2]) : parseAge(block.text)
  const city = demographics?.[3]?.trim() || cityFrom(block.text, source.country)
  // A candidate on flagma.ro may live in Ukraine and be looking for work in
  // Romania; the card says so, and the site's country must not overwrite it.
  const candidateCountry = demographics?.[4]?.toUpperCase() || ''

  const targets = block.text.match(FLAGMA_TARGET_RE)?.[1]?.trim() || ''
  // "ФИО скрыто , 20 лет, Ташкент | Среднее образование" — the education is
  // the tail of the demographics row, where the word comes after the value and
  // so is invisible to a "Образование: X" pattern. The line below it is the
  // work schedule, which is what was being shown as education instead.
  const demographicsTail = demographicsIndex >= 0
    ? (lines[demographicsIndex]!.split('|')[1] || '').trim()
    : ''
  const education = (/образован|освіт|ta['’]?lim|studii|образование/iu.test(demographicsTail) ? demographicsTail : '')
    || block.text.match(FLAGMA_EDUCATION_RE)?.[1]?.trim()
    || null
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

/**
 * Talent.UA renders whole cards server-side, each field in its own element:
 * the date, the candidate's name and city, an education/experience line, the
 * work-schedule line and the skill tags. Reading those directly is both more
 * accurate and steadier than guessing from the card's flattened text, which
 * is what the previous parser did — it recovered a name or a city for none of
 * the profiles it accepted.
 */
/**
 * The block a card belongs to keeps a margin of its neighbours on both sides,
 * and this listing prints the salary in the card header — near enough to the
 * boundary to be read off the wrong card. Cut to the card's own container.
 */
function talentCard(block: CandidateBlock): CandidateBlock {
  const anchor = Math.max(0, block.html.indexOf(block.href))
  const open = block.html.lastIndexOf('<div class="card">', anchor)
  const from = open >= 0 ? open : 0
  const close = block.html.indexOf('<div class="card">', from + 1)
  const html = close > from ? block.html.slice(from, close) : block.html.slice(from)
  return { ...block, html, text: htmlText(html) }
}

function parseTalent(source_block: CandidateBlock, source: WebCvSource): CvProfile | null {
  const block = talentCard(source_block)
  // "8 ч.", "Вчера", "19 августа" — the listing's own freshness stamp.
  const stamp = htmlText(block.html.match(/class="date"[^>]*>\s*<div>([\s\S]*?)<\/div>/i)?.[1] || '')
  const activity = (stamp && (activityDate(stamp) || dayMonthDate(stamp))) || activityDate(block.text)
  if (!isRecent(activity)) return null

  const info = block.html.match(/class="card__info[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
  const fields = [...info.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => htmlText(match[1]!))
    .filter(Boolean)
  // Both fields are optional and the city is always last: a card with one
  // value is showing a city, not a name.
  const cityText = fields[fields.length - 1] || ''
  const name = fields.length > 1 ? fields[0]! : ''

  const skills = [...block.html.matchAll(/<a[^>]*href="[^"]*resumes\/search\?tag=\d+"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => htmlText(match[1]!))
    .filter(Boolean)
    .slice(0, 20)

  return profileBase(source, block, activity!, {
    name,
    role: block.title,
    // Cities outside the known list keep the spelling the board printed.
    city: cityFrom(cityText, 'UA') || cityText || null,
    ...(skills.length ? { skills } : {}),
    updatedAt: activity,
    relocationReady: /возможен переезд|можливий переїзд/iu.test(block.text),
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
    linkRe: /(?:talent\.ua|rabota\.[a-z0-9.-]+\.ua)\/ru\/resumes\/\d+/i, parse: parseTalent,
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
