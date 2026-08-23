import { useStateStore } from '~~/server/utils/stateStore'
import { hiringDbEnabled, loadDbCandidates, saveDbCandidates } from './hiringDb'
import { normalizeCandidate } from './hiringNormalize'
import type { SourceRun } from './hiringDiagnostics'
import { activityDate, cityFrom, htmlText, parseAge } from './hiringWebFields'
import type { CvProfile } from './hiringTypes'
import { withHiringStoreLock } from './hiringStoreLock'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 25_000
const STORE_KEY = 'hiring:store:v4'
const STORE_TTL_SECONDS = 100 * 86_400
const MAX_AGE_MONTHS = 3

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }
type SecondaryKey = 'novarobota-ua' | 'layboard-kz' | 'amountwork-ro'

type FetchResult = { profiles: CvProfile[]; fetched: number }

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

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru,uk,en,ro;q=0.8',
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

function recent(value: string | null | undefined): value is string {
  if (!value) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && time >= cutoff() && time <= Date.now() + 48 * 60 * 60 * 1000
}

function maxActivity(...values: Array<string | null>): string | null {
  const times = values.map((value) => value ? Date.parse(value) : Number.NaN).filter(Number.isFinite)
  return times.length ? new Date(Math.max(...times)).toISOString() : null
}

function parseExperience(text: string): number | null {
  if (/без опыта|без досвіду|no experience|fără experiență/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|досвід(?: роботи)?|experience|experiență)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani)/iu)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani)\b[^\n]{0,40}(?:опыт|досвід|experience|experiență)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function parseSalary(text: string, fallback: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const match = text.match(
    /(?:от|від|de la)?\s*(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|to|până la)\s*(\d[\d\s.,]{2,}))?\s*(грн|UAH|KZT|₸|тенге|USD|\$|EUR|€|RON|lei|руб\.?|₽)/iu,
  )
  if (!match) return {}
  const number = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = number(match[1]!)
  const second = match[2] ? number(match[2]) : undefined
  if (!Number.isFinite(first) || first <= 0) return {}
  const token = match[3]!.toUpperCase()
  const currency = /ГРН|UAH/.test(token) ? 'UAH'
    : /KZT|₸|ТЕНГЕ/.test(token) ? 'KZT'
      : /USD|\$/.test(token) ? 'USD'
        : /EUR|€/.test(token) ? 'EUR'
          : /RON|LEI/.test(token) ? 'RON'
            : /РУБ|₽/.test(token) ? 'RUB'
              : fallback
  return {
    salaryMin: second && Number.isFinite(second) ? Math.min(first, second) : first,
    salaryMax: second && Number.isFinite(second) ? Math.max(first, second) : undefined,
    currency,
  }
}

function contacts(text: string): CvProfile['contacts'] {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  const phone = text.match(/(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,12}/)?.[0]
  return {
    ...(phone ? { phone: phone.replace(/\s+/g, ' ').trim() } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
  }
}

function profile(input: {
  key: SecondaryKey
  country: 'UA' | 'KZ' | 'RO'
  label: string
  id: string
  role: string
  name?: string
  age?: number | null
  city?: string | null
  activity: string
  url: string
  text: string
  salaryCurrency: string
  /** Read from the card's own salary field, where the board has one. */
  salary?: Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'>
  contactType?: 'direct' | 'platform'
}): CvProfile {
  const publicContacts = contacts(input.text)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)
  const age = input.age ?? parseAge(input.text)
  return normalizeCandidate({
    id: `web-${input.key}-${input.id}`,
    source: 'telegram',
    origin: 'web',
    sourceKey: input.key,
    country: input.country,
    name: input.name || '',
    role: input.role,
    professions: [input.role],
    age,
    isAdult: age == null ? true : age >= 18,
    experienceYears: parseExperience(input.text),
    city: input.city ?? cityFrom(input.text, input.country),
    remote: /удал[её]н|віддален|remote|online|онлайн|la distanță/iu.test(input.text) ? true : null,
    relocationReady: /возможен переезд|готов\p{L}* к переезду|можливий переїзд|relocat/iu.test(input.text) ? true : null,
    employmentTypes: [
      ...(/полная занятость|повна зайнятість|full[- ]?time|permanent/iu.test(input.text) ? ['full_time' as const] : []),
      ...(/неполная занятость|неповна зайнятість|part[- ]?time|подработка|підробіток/iu.test(input.text) ? ['part_time' as const] : []),
    ],
    publishedAt: input.activity,
    updatedAt: input.activity,
    activityAt: input.activity,
    createdAt: input.activity,
    url: input.url,
    originalText: input.text.slice(0, 4_000),
    description: input.text.slice(0, 4_000),
    tags: [input.label, 'Web CV', input.country],
    contacts: publicContacts,
    contact: publicContacts.telegram || publicContacts.email || publicContacts.phone || input.url,
    contactType: input.contactType || (hasDirect ? 'direct' : 'platform'),
    ...parseSalary(input.text, input.salaryCurrency),
    ...(input.salary || {}),
  })
}

function linkBlocks(html: string, re: RegExp, base: string): Array<{ url: string; title: string; text: string }> {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  const byUrl = new Map<string, { url: string; title: string; text: string }>()
  for (let i = 0; i < matches.length; i++) {
    const url = absoluteUrl(matches[i]![1]!, base)
    if (!url || !re.test(url)) continue
    const title = stripHtml(matches[i]![2]!)
    if (title.length < 2 || title.length > 300) continue
    const start = matches[i]!.index || 0
    const end = matches[i + 1]?.index ?? Math.min(html.length, start + 6_000)
    const text = htmlLines(html.slice(Math.max(0, start - 1_000), end)).join('\n')
    const previous = byUrl.get(url)
    if (!previous || title.length < previous.title.length) byUrl.set(url, { url, title, text })
  }
  return [...byUrl.values()]
}

/**
 * NovaRobota renders its listing as a table of cards, each field in its own
 * element: `.resume_title`, `.person_name`, `.price`, `.age`, `.city`,
 * `.publish_date`. The generic block reader gave the text that happened to sit
 * around the link, which is how a candidate ended up named `ass="row">`.
 */
function novaField(card: string, cls: string): string {
  const match = card.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]{0,300}?)</`, 'i'))
  return match ? htmlText(match[1]!).trim() : ''
}

function novaCards(html: string): string[] {
  const marker = /<div class="resume_one[^"]*">/g
  const starts = [...html.matchAll(marker)].map((match) => match.index!)
  return starts.map((from, index) => html.slice(from, starts[index + 1] ?? html.length))
}

async function fetchNovaRobota(): Promise<FetchResult> {
  const maxPages = Math.max(1, Math.min(10, Number(process.env.HIRING_NOVAROBOTA_MAX_PAGES) || 5))
  const byUrl = new Map<string, CvProfile>()
  let fetched = 0

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1 ? 'https://novarobota.ua/resume' : `https://novarobota.ua/resume?page=${page}`
    const html = await fetchHtml(pageUrl)
    const cards = novaCards(html)
    if (!cards.length) break
    let fresh = 0

    for (const card of cards) {
      const link = card.match(/<a[^>]*href="([^"]*\/resume\/[^"]*-\d+)"[^>]*class="[^"]*resume_title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      if (!link) continue
      fetched += 1

      const url = absoluteUrl(link[1]!, pageUrl)
      if (!url) continue
      // The card's own "posted" field, not a date from anywhere in its text.
      const activity = activityDate(novaField(card, 'publish_date'))
      if (!recent(activity)) continue

      const cityText = novaField(card, 'city')
      const cv = profile({
        key: 'novarobota-ua', country: 'UA', label: 'NovaRobota',
        id: url.match(/-(\d+)\/?$/)?.[1] || url,
        role: htmlText(link[2]!),
        name: novaField(card, 'person_name'),
        age: parseAge(novaField(card, 'age')),
        // "Работа за границей" is a preference, not a place.
        city: cityFrom(cityText, 'UA') || (/за границей|за кордоном/iu.test(cityText) ? null : cityText || null),
        activity: activity!,
        url,
        text: htmlText(card),
        salaryCurrency: 'UAH',
        salary: chipSalary(novaField(card, 'price')),
        contactType: 'platform',
      })
      byUrl.set(cv.url, cv)
      fresh += 1
    }
    if (!fresh) break
  }
  return { profiles: [...byUrl.values()], fetched }
}

function layboardActivity(text: string): string | null {
  const online = text.match(/(?:был\(а\) в сети|last online)[^\d]{0,20}(\d{1,2})[.-](\d{1,2})[.-](20\d{2})(?:\s+(\d{1,2}):(\d{2}))?/iu)
  let onlineIso: string | null = null
  if (online) {
    onlineIso = new Date(Date.UTC(
      Number(online[3]), Number(online[2]) - 1, Number(online[1]),
      Number(online[4] || 12), Number(online[5] || 0),
    )).toISOString()
  }
  return maxActivity(onlineIso, activityDate(text))
}

/**
 * Layboard renders each CV as a complete card: the title link, the candidate's
 * name, chips for salary, age and location, and a "last online" stamp. Reading
 * the text that happens to sit before the link — which is what the generic
 * block reader gives — recovered a role and nothing else.
 */
function layboardCards(html: string): string[] {
  const marker = '<div class="resume__card">'
  return html.split(marker).slice(1).map((part) => {
    const stop = part.indexOf('<div class="pagination')
    return stop > 0 ? part.slice(0, stop) : part
  })
}

function spanText(card: string, cls: string): string {
  // Matched as a substring of the class attribute: these cards carry several
  // classes per element ("vacancies-list-user vacancies-list-owner").
  const match = card.match(new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]{0,300}?)</span>`, 'i'))
  return match ? htmlText(match[1]!).replace(/^[\\s,]+/, '').trim() : ''
}

function chipSalary(chip: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const amounts = [...chip.matchAll(/\d[\d\s]*/g)]
    .map((match) => Number(match[0].replace(/\s+/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!amounts.length) return {}
  const currency = /\$|usd/iu.test(chip) ? 'USD'
    : /руб|rub|₽/iu.test(chip) ? 'RUB'
      : /€|eur/iu.test(chip) ? 'EUR'
        : /₸|тенге|kzt/iu.test(chip) ? 'KZT'
          : /грн|uah|₴/iu.test(chip) ? 'UAH'
            : /lei|ron/iu.test(chip) ? 'RON'
              // "Другая валюта" is the board's own "some other currency": the
              // number is real but unitless, so it is not a salary we can show.
              : ''
  return currency ? { salaryMin: Math.min(...amounts), salaryMax: Math.max(...amounts), currency } : {}
}

async function fetchLayboard(): Promise<FetchResult> {
  const maxPages = Math.max(1, Math.min(8, Number(process.env.HIRING_LAYBOARD_MAX_PAGES) || 3))
  const byUrl = new Map<string, CvProfile>()
  let fetched = 0

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = page === 1
      ? 'https://layboard.com/rezume/kazahstan'
      : `https://layboard.com/rezume/kazahstan?page=${page}`
    const html = await fetchHtml(pageUrl)
    const cards = layboardCards(html)
    if (!cards.length) break
    let fresh = 0

    for (const card of cards) {
      const link = card.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*card__title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      if (!link) continue
      fetched += 1

      const url = absoluteUrl(link[1]!, pageUrl)
      if (!url) continue
      const text = htmlText(card)
      const activity = layboardActivity(text)
      if (!recent(activity)) continue

      // The chips carry salary, age and location in whatever order the card
      // has them, so each is recognised by its content rather than position.
      const chips = [...card.matchAll(/class="org__info[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)]
        .map((match) => htmlText(match[1]!).trim())
        .filter(Boolean)
      const age = chips.map((chip) => parseAge(chip)).find((value) => value != null) ?? null
      const place = chips.find((chip) => !/\d/.test(chip)) || ''
      const salary = chips.map(chipSalary).find((value) => value.salaryMin != null) || {}

      const cv = profile({
        key: 'layboard-kz', country: 'KZ', label: 'Layboard',
        id: url.match(/\/rezume\/(\d+)\//)?.[1] || url,
        role: htmlText(link[2]!),
        name: htmlText(card.match(/class="name"[^>]*>([\s\S]*?)<\/a>/i)?.[1] || ''),
        age,
        city: cityFrom(place, 'KZ') || cityFrom(text, 'KZ'),
        activity: activity!,
        url,
        text,
        salaryCurrency: 'KZT',
        salary,
        contactType: 'platform',
      })
      byUrl.set(cv.url, cv)
      fresh += 1
    }
    if (!fresh) break
  }
  return { profiles: [...byUrl.values()], fetched }
}

/**
 * Amountwork lists each CV as a `.vacancies-list-item`: the title link, the
 * candidate's name, the asked salary, the countries they are looking in with
 * the city, and the posting date. Read as loose text, the first line that was
 * not a salary or a date turned out to be the search form.
 */
function amountworkCards(html: string): string[] {
  const starts = [...html.matchAll(/<div class="vacancies-list-item[^"]*">/g)].map((match) => match.index!)
  return starts.map((from, index) => html.slice(from, starts[index + 1] ?? html.length))
}

async function fetchAmountwork(): Promise<FetchResult> {
  const pageUrl = 'https://amountwork.com/resume/in/rumyniya'
  const html = await fetchHtml(pageUrl)
  const cards = amountworkCards(html)
  const profiles: CvProfile[] = []
  let fetched = 0

  for (const card of cards) {
    const link = card.match(/<a[^>]*href="([^"]*\/r\/\d+\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!link) continue
    fetched += 1

    const url = absoluteUrl(link[1]!, pageUrl)
    if (!url) continue
    const activity = activityDate(spanText(card, 'vacancies-list-date bottom'))
    if (!recent(activity)) continue

    profiles.push(profile({
      key: 'amountwork-ro', country: 'RO', label: 'Amountwork',
      id: url.match(/\/r\/(\d+)\//)?.[1] || url,
      role: htmlText(link[2]!),
      name: spanText(card, 'vacancies-list-user'),
      city: cityFrom(spanText(card, 'city') || htmlText(card), 'RO'),
      activity: activity!,
      url,
      text: htmlText(card),
      salaryCurrency: 'EUR',
      salary: chipSalary(spanText(card, 'vacancies-list-salary')),
      contactType: 'platform',
    }))
  }
  return { profiles, fetched }
}

const LOADERS: Record<SecondaryKey, { country: 'UA' | 'KZ' | 'RO'; load: () => Promise<FetchResult> }> = {
  'novarobota-ua': { country: 'UA', load: fetchNovaRobota },
  'layboard-kz': { country: 'KZ', load: fetchLayboard },
  'amountwork-ro': { country: 'RO', load: fetchAmountwork },
}

function enabledKeys(): SecondaryKey[] {
  if (process.env.HIRING_SECONDARY_WEB_CV_SOURCE === 'off') return []
  const raw = process.env.HIRING_SECONDARY_WEB_CV_SOURCES?.trim()
  const all = Object.keys(LOADERS) as SecondaryKey[]
  if (!raw) return all
  const allowed = new Set(raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))
  return all.filter((key) => allowed.has(key))
}

/** One crawl of a secondary source, without storing anything. For diagnostics. */
export async function crawlSecondaryWebSource(key: string) {
  const entry = LOADERS[key as SecondaryKey]
  if (!entry) throw new Error(`unknown secondary web source: ${key}`)
  return entry.load()
}

export function hiringSecondaryWebSourceHandles(): string[] {
  return enabledKeys().map((key) => `web:${key}`)
}

async function persist(profiles: CvProfile[], diagnostic: SourceRun): Promise<number> {
  const stored = await withHiringStoreLock(async () => {
    const now = new Date().toISOString()
    let existing: StoredProfile[] = []
    try {
      const raw = await useStateStore().get(STORE_KEY)
      if (raw) existing = JSON.parse(raw) as StoredProfile[]
    } catch {
      // Postgres fallback below.
    }
    if (!existing.length && hiringDbEnabled()) {
      existing = (await loadDbCandidates()).map((item) => ({ ...item, lastSeen: now }))
    }

    const byKey = new Map<string, StoredProfile>()
    for (const item of existing) byKey.set(item.url || item.id, item)
    for (const item of profiles) byKey.set(item.url || item.id, { ...item, lastSeen: now })

    const oldest = cutoff()
    const kept = [...byKey.values()].filter((item) => {
      const time = Date.parse(item.activityAt || item.updatedAt || item.createdAt || '')
      return Number.isFinite(time) && time >= oldest && time <= Date.now() + 48 * 60 * 60 * 1000
    })
    await useStateStore().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
    return kept.length
  })
  if (hiringDbEnabled()) await saveDbCandidates(profiles, diagnostic)
  return stored
}

export async function refreshHiringSecondaryWebSource(
  handle: string,
): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  const key = handle.replace(/^web:/i, '').toLowerCase() as SecondaryKey
  if (!enabledKeys().includes(key) || !LOADERS[key]) return null
  const checkedAt = new Date().toISOString()
  const entry = LOADERS[key]

  try {
    const result = await entry.load()
    const diagnostic: SourceRun = {
      handle: `web:${key}`,
      country: entry.country,
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      checkedAt,
    }
    const stored = await persist(result.profiles, diagnostic)
    console.log(`[hiring:web] ${key} fetched=${result.fetched} candidates=${result.profiles.length} store=${stored}`)
    return { fetched: result.fetched, candidates: result.profiles.length, stored }
  } catch (error) {
    const diagnostic: SourceRun = {
      handle: `web:${key}`,
      country: entry.country,
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
