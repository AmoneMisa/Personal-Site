// Field parsing for public CV boards: dates, ages, salaries, cities, contacts.
//
// Split out from the crawler so it can be exercised without a Redis or a
// network: three separate bugs here came from JavaScript's word boundary,
// which knows ASCII word characters only and never fires next to Cyrillic —
// city names, ages and freshness stamps all matched nothing for months
// without failing loudly. Anything matching non-Latin text belongs here,
// behind a test.

import type { CvProfile } from './hiringTypes'

export const MAX_AGE_MONTHS = 3

export const MONTHS: Record<string, number> = {
  январь: 0, января: 0, february: 1, февраль: 1, февраля: 1,
  март: 2, марта: 2, april: 3, апрель: 3, апреля: 3,
  may: 4, май: 4, мая: 4, june: 5, июнь: 5, июня: 5,
  july: 6, июль: 6, июля: 6, august: 7, август: 7, августа: 7,
  september: 8, сентябрь: 8, сентября: 8, october: 9, октябрь: 9, октября: 9,
  november: 10, ноябрь: 10, ноября: 10, december: 11, декабрь: 11, декабря: 11,
  ianuarie: 0, februarie: 1, martie: 2, aprilie: 3, mai: 4, iunie: 5,
  iulie: 6, septembrie: 8, octombrie: 9, noiembrie: 10, decembrie: 11,
  січня: 0, лютого: 1, березня: 2, квітня: 3, травня: 4, червня: 5,
  липня: 6, серпня: 7, вересня: 8, жовтня: 9, листопада: 10, грудня: 11,
}

export function decodeEntities(value: string): string {
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

export function htmlText(value: string): string {
  return decodeEntities(value)
    // Stripping tags alone leaves the *contents* of scripts and styles behind,
    // which is how ad-loader JavaScript ended up inside candidate profiles.
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Material Icons use their text content as a glyph name. Keeping that
    // content turns a Careerist city into e.g. "Tashkent local_shipping".
    .replace(/<([a-z][\w:-]*)\b[^>]*class=["'][^"']*(?:material-icons|material-symbols)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

export function absoluteUrl(raw: string, base: string): string {
  try {
    const url = new URL(decodeEntities(raw), base)
    url.hash = ''
    return url.toString()
  } catch {
    return raw
  }
}

export function cutoffDate(): Date {
  const value = new Date()
  value.setUTCMonth(value.getUTCMonth() - MAX_AGE_MONTHS)
  return value
}

export function isRecent(iso: string | null): boolean {
  if (!iso) return false
  const time = Date.parse(iso)
  return Number.isFinite(time) && time >= cutoffDate().getTime() && time <= Date.now() + 48 * 60 * 60 * 1000
}

// Unicode-aware boundaries. JavaScript's \b only knows ASCII word characters,
// so it never fires next to Cyrillic or Romanian letters.
export const B = '(?<![\\p{L}\\p{N}])'
export const E = '(?![\\p{L}\\p{N}])'
export const TODAY_RE = new RegExp(`${B}(?:сегодня|сьогодні|bugun|today|astăzi|azi)${E}`, 'iu')
export const YESTERDAY_RE = new RegExp(`${B}(?:вчера|вчора|kecha|yesterday|ieri)${E}`, 'iu')
export const HOURS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:ч\\.?|час(?:а|ов)?|год(?:ину|ини)|soat|hours?|hrs?|ore|oră)${E}`, 'iu')
export const DAYS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,3})\\s*(?:дн(?:я|ей|і|ів)?|день|days?|kun|zile|zi)${E}`, 'iu')
export const AGO = '(?:\\s*(?:назад|тому|раніше|oldin|ago|în urmă))'
export const WEEKS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:недел(?:ю|и|ь)|тижн(?:ів|і|я)|hafta|weeks?|săptămân\\p{L}*)${AGO}`, 'iu')
export const MONTHS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:мес(?:яц\\p{L}*)?\\.?|міс(?:яц\\p{L}*)?\\.?|oy|months?|lun\\p{L}*)${AGO}`, 'iu')
// Well outside the retention window, but a dated profile can be reported as
// stale, where an undated one is indistinguishable from a parser failure.
export const YEARS_AGO_RE = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*(?:год(?:а|ов)?|лет|рік|рок(?:и|ів)|yil|years?|ani|an)${AGO}`, 'iu')

export function activityDate(text: string): string | null {
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

  const years = text.match(YEARS_AGO_RE)
  if (years) return new Date(now.getTime() - Number(years[1]) * 365 * 86_400_000).toISOString()
  return null
}

/**
 * "19 августа" — a day and a month with no year, which some boards print for
 * anything older than a couple of days. Only ever applied to a field already
 * known to hold a date: run loose over a whole card it would happily read a
 * line of work history. The year is the most recent one that is not ahead of
 * today.
 */
export function dayMonthDate(text: string): string | null {
  const match = text.match(new RegExp(`${B}(\\d{1,2})\\s+(\\p{L}+)${E}`, 'iu'))
  if (!match) return null
  const month = MONTHS[match[2]!.toLocaleLowerCase('ru')]
  if (month == null) return null
  const now = new Date()
  const day = Number(match[1])
  let value = Date.UTC(now.getUTCFullYear(), month, day, 12)
  if (value > now.getTime() + 48 * 60 * 60 * 1000) value = Date.UTC(now.getUTCFullYear() - 1, month, day, 12)
  return new Date(value).toISOString()
}

export function parseAge(text: string): number | null {
  const match = text.match(new RegExp(`(?<![\\d])(\\d{2})\\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani|an|yil)${E}`, 'iu'))
    // Boards with a fielded card print the number on its own, behind a label.
    || text.match(/(?:возраст|вік|yoshi|age|vârsta)\s*[:—-]?\s*(\d{2})(?![\d])/iu)
  if (!match) return null
  const age = Number(match[1])
  return age >= 14 && age <= 90 ? age : null
}

export function parseExperience(text: string): number | null {
  if (/без опыта|no experience|fără experiență|ish tajribasi talab qilinmaydi/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|experience|experiență|ish tajribasi)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|years?|ani|an|yil)/iu)
    || text.match(new RegExp(`(?<![\\d])(\\d+(?:[.,]\\d+)?)\\s*(?:лет|год(?:а)?|years?|ani|an|yil)${E}[^\\n]{0,30}(?:опыт|experience|experiență)`, 'iu'))
  return match ? Number(match[1]!.replace(',', '.')) : null
}

export function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  // The amount and its currency often sit on separate rows of a card, so a
  // single newline between them is allowed.
  const money = text.match(/(?:от\s*)?(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|to)\s*(\d[\d\s.,]{2,}))?\s*\n?\s*(UZS|KZT|UAH|RON|RUB|USD|EUR|сум|so(?:'|’)m|тенге|грн|руб\p{L}*|lei|\$|€|₸|₽)/iu)
  if (!money) return {}
  const unit = money[3] || ''
  const currency = /(?:\$|USD|доллар)/iu.test(unit) ? 'USD'
    // careerist.ru is a Russian platform and quotes its Uzbek listings in roubles.
    : /(?:RUB|руб|₽)/iu.test(unit) ? 'RUB'
      : /(?:€|EUR|евро)/iu.test(unit) ? 'EUR'
        : /(?:UZS|сум|so(?:'|’)m)/iu.test(unit) ? 'UZS'
          : /(?:KZT|₸|тенге|тг(?![\p{L}\p{N}]))/iu.test(unit) ? 'KZT'
            : /(?:UAH|грн|грив)/iu.test(unit) ? 'UAH'
              : /(?:RON|lei\b)/iu.test(unit) ? 'RON'
                : ({ UZ: 'UZS', KZ: 'KZT', UA: 'UAH', RO: 'RON' } as Record<string, string>)[country]
  const parse = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = parse(money[1]!)
  const second = money[2] ? parse(money[2]) : first
  if (!Number.isFinite(first) || first <= 0) return {}
  return { salaryMin: Math.min(first, second), salaryMax: Math.max(first, second), currency }
}

/**
 * City patterns need their own boundaries: JavaScript's \b is ASCII-only, so
 * every Cyrillic alternative here silently never matched — "Роман Киев" did
 * not resolve to Kyiv, and neither did any Uzbek or Kazakh city spelled in
 * Cyrillic. Only the Latin spellings ever worked.
 */
export function cityRe(alternatives: string): RegExp {
  // A Cyrillic place name is almost never written in the nominative in running
  // text — "живу в Ташкенте", "работа в Киеве", "из Алматы" — so a short
  // case ending is allowed after the alias. The ending is restricted to
  // Cyrillic, which keeps Latin aliases matching whole words only: otherwise
  // "osh" would swallow the Uzbek "oshpaz".
  return new RegExp(`${B}(?:${alternatives})(?:\\p{Script=Cyrillic}{1,3})?${E}`, 'iu')
}

export const CITIES: Record<string, Array<[string, RegExp]>> = {
  UZ: [
    ['Tashkent Region', cityRe('ташкент(?:ская)?\\s+(?:обл(?:асть)?\\.?|region)|toshkent\\s+viloyati|tashkent\\s+region')],
    ['Tashkent', cityRe('ташкент|tashkent|toshkent')], ['Samarkand', cityRe('самарканд|samarqand|samarkand')],
    ['Bukhara', cityRe('бухара|buxoro|bukhara')], ['Namangan', cityRe('наманган\\p{L}*|namangan')],
    ['Andijan', cityRe('андижан|andijon|andijan')], ['Fergana', cityRe("фергана|фаргана|farg(?:'|’)ona|fergana")],
    ['Nukus', cityRe('нукус|nukus')], ['Qarshi', cityRe('карши|qarshi|karshi')],
    ['Navoi', cityRe('навои|navoi')],
    // Uzbek boards often give a region rather than a city, and a region is
    // still a more useful location than nothing.
    ['Karakalpakstan', cityRe('каракалпакстан|qoraqalpog(?:\'|’)iston|karakalpakstan')],
    ['Kashkadarya', cityRe('кашкадар\\p{L}*|qashqadaryo|kashkadarya')],
    ['Surkhandarya', cityRe('сурхандар\\p{L}*|surxondaryo|surkhandarya')],
    ['Jizzakh', cityRe('джизак\\p{L}*|jizzax|jizzakh')],
    ['Syrdarya', cityRe('сырдар\\p{L}*|sirdaryo|syrdarya')],
    ['Khorezm', cityRe('хорезм\\p{L}*|xorazm|khorezm')],
  ],
  KZ: [
    ['Almaty', cityRe('алматы|almaty')], ['Astana', cityRe('астана|astana')],
    ['Shymkent', cityRe('шымкент|shymkent')], ['Karaganda', cityRe('караганда|karaganda')],
    ['Atyrau', cityRe('атырау|atyrau')], ['Aktobe', cityRe('актобе|aktobe')], ['Aktau', cityRe('актау|aktau')],
  ],
  UA: [
    ['Kyiv', cityRe('киев|київ|kyiv|kiev')], ['Kharkiv', cityRe('харьков|харків|kharkiv|kharkov')],
    ['Dnipro', cityRe('днепр|дніпро|dnipro')], ['Odesa', cityRe('одесс|одес|odesa|odessa')],
    ['Lviv', cityRe('львов|львів|lviv')], ['Vinnytsia', cityRe('винниц|вінниц|vinnytsia')],
    ['Zaporizhzhia', cityRe('запорожье|запоріжжя|zaporizhzhia')], ['Poltava', cityRe('полтава|poltava')],
  ],
  KG: [
    ['Bishkek', cityRe('бишкек|bishkek')], ['Osh', cityRe('ош|osh')],
    ['Karakol', cityRe('каракол|karakol')], ['Jalal-Abad', cityRe('джалал[- ]?абад|jalal[- ]?abad')],
  ],
  RO: [
    ['Bucharest', cityRe('bucharest|bucurești|bucuresti|бухарест')], ['Cluj-Napoca', cityRe('cluj(?:-napoca)?|клуж')],
    ['Iași', cityRe('iași|iasi|яссы')], ['Timișoara', cityRe('timișoara|timisoara|тимишоара')],
    ['Brașov', cityRe('brașov|brasov|брашов')], ['Constanța', cityRe('constanța|constanta|констанца')],
  ],
}

export function cityFrom(text: string, country: string): string | null {
  for (const [city, re] of CITIES[country] || []) if (re.test(text)) return city
  return null
}

export function employment(text: string): CvProfile['employmentTypes'] {
  const out = new Set<'full_time' | 'part_time'>()
  if (/(?<!\p{L})(?:полная занятость|полный день)|full[- ]?time|to['’]?liq bandlik|normă întreagă/iu.test(text)) out.add('full_time')
  if (/неполная занятость|неполный день|частичная занятость|part[- ]?time|qisman bandlik|part[- ]time/iu.test(text)) out.add('part_time')
  return [...out]
}

/**
 * A run of digits is not a phone number. Cards are full of salaries
 * ("4 000 000"), employment dates ("2007 - 2009") and ids, and the previous
 * pattern took the first of them and published it as the way to reach the
 * candidate. A real number here carries at least nine digits, and a pair of
 * years is never one.
 */
function phoneNumber(text: string): string | null {
  for (const match of text.matchAll(/\+?\d[\d\s()\-]{7,}\d/g)) {
    const raw = match[0]
    if (/(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}/.test(raw)) continue
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 15) continue
    return raw.replace(/\s+/g, ' ').trim()
  }
  return null
}

export function contacts(text: string): CvProfile['contacts'] {
  const phone = phoneNumber(text) || undefined
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  return { ...(phone ? { phone } : {}), ...(email ? { email } : {}), ...(telegram ? { telegram } : {}) }
}
