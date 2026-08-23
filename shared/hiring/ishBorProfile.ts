import type { CvProfile } from '../contracts/hiring'
import { extractCandidateAge, extractCandidateName } from './candidateFields'
import { ishBorProfileHtml } from './ishBorFields'
import { cityFrom, cityRe, htmlText } from './webFields'
import type { IshBorSummary } from './sources/ishBorCrawler'
import { ISHBOR_SOURCE_KEY } from './sources/ishBorSource'

const MAX_AGE_MONTHS = 3

type NormalizeCandidate = (profile: CvProfile) => CvProfile

function htmlLines(value: string): string[] {
  return htmlText(value).split('\n').filter(Boolean)
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

function dottedIso(day: string, month: string, year: string): string | null {
  const value = Date.UTC(Number(year), Number(month) - 1, Number(day), 12)
  return Number.isFinite(value) && value <= Date.now() + 48 * 60 * 60 * 1000
    ? new Date(value).toISOString()
    : null
}

function detailActivity(html: string, text: string): string | null {
  const candidates: number[] = []
  for (const match of html.matchAll(
    /(?:dateModified|datePublished|article:modified_time|article:published_time)[^>\n]{0,180}(20\d{2}-\d{2}-\d{2}(?:T[^"'<\s]+)?)/giu,
  )) {
    const time = Date.parse(match[1]!)
    if (Number.isFinite(time) && time <= Date.now() + 48 * 60 * 60 * 1000) candidates.push(time)
  }
  for (const match of html.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/giu)) {
    const time = Date.parse(match[1]!)
    if (Number.isFinite(time) && time <= Date.now() + 48 * 60 * 60 * 1000) candidates.push(time)
  }
  for (const match of html.matchAll(
    /lucide:calendar[\s\S]{0,80}?(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/gi,
  )) {
    const iso = dottedIso(match[1]!, match[2]!, match[3]!)
    if (iso) candidates.push(Date.parse(iso))
  }
  for (const match of text.matchAll(
    /(?:опубликован[оа]?|размещен[оа]?|обновлен[оа]?|дата\s+(?:публикации|обновления)|joylashtirilgan|yangilangan)[^\d\n]{0,32}(\d{1,2})[./-](\d{1,2})[./-](20\d{2})/giu,
  )) {
    const iso = dottedIso(match[1]!, match[2]!, match[3]!)
    if (iso) candidates.push(Date.parse(iso))
  }
  return candidates.length ? new Date(Math.max(...candidates)).toISOString() : null
}

function field(text: string, names: string): string | null {
  const match = text.match(new RegExp(`(?:^|\\n)(?:${names})\\s*[:—-]\\s*([^\\n]{2,180})`, 'iu'))
  return match?.[1]?.trim() || null
}

function parseExperience(text: string): number | null {
  if (/без опыта|tajribasiz/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|стаж|tajriba\p{L}*)[^\d]{0,30}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|yil)/iu)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|yil)\b[^\n]{0,30}(?:опыт|стаж|tajriba)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function parseRole(text: string, fallback: string): string {
  return (field(text, "so(?:['’‘])ralgan ish (?:joyi|turi)|qidirayotgan kasb|lavozim|kasb") || fallback).slice(0, 180)
}

function parseSalary(text: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const labelled = text.match(
    /(?:зарплат[аы]|ожидани[ея]|желаемая\s+зарплата|maosh|oylik)[^\n\d]{0,35}(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|dan|gacha)\s*(\d[\d\s.,]{2,}))?\s*(UZS|сум|so(?:'|’)m|\$|USD|доллар)?/iu,
  )
  const explicitCurrency = text.match(
    /(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|dan|gacha)\s*(\d[\d\s.,]{2,}))?\s*(UZS|сум|so(?:'|’)m|\$|USD|доллар)\b/iu,
  )
  const match = labelled || explicitCurrency
  if (!match) return {}
  const parse = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = parse(match[1]!)
  const second = match[2] ? parse(match[2]) : undefined
  if (!Number.isFinite(first) || first <= 0) return {}
  const currencyToken = String(match[3] || '')
  const currency = /\$|USD|доллар/iu.test(currencyToken || text) ? 'USD' : 'UZS'
  return {
    salaryMin: second && Number.isFinite(second) ? Math.min(first, second) : first,
    salaryMax: second && Number.isFinite(second) ? Math.max(first, second) : undefined,
    currency,
  }
}

const DISTRICT_ALIASES: Array<[string, RegExp]> = [
  ['Chilanzar', cityRe('чиланзар|chilonzor|chilanzar')],
  ['Yunusabad', cityRe('юнасабад|yunusobod|yunusabad')],
  ['Mirabad', cityRe('мирабад|mirobod|mirabad')],
  ['Sergeli', cityRe('сергели|sergeli')],
  ['Uchtepa', cityRe('учтепа|uchtepa')],
  ['Almazar', cityRe('алмазар|olmazor|almazar')],
  ['Yakkasaray', cityRe('яккасарай|yakkasaroy|yakkasaray')],
  ['Yashnabad', cityRe('яшнабад|yashnobod|yashnabad')],
]

function detect(text: string, aliases: Array<[string, RegExp]>): string | null {
  return aliases.find(([, re]) => re.test(text))?.[0] || null
}

function contacts(text: string): CvProfile['contacts'] {
  const phone = text.match(/(?:\+998|998)\s*\(?\d{2}\)?[\s-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/)?.[0]
    || text.match(/\b\d{2}[\s-]\d{3}[\s-]\d{2}[\s-]\d{2}\b/)?.[0]
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  return {
    ...(phone ? { phone: phone.replace(/\s+/g, ' ').trim() } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
  }
}

function iconField(html: string, icon: string): string | null {
  const match = html.match(new RegExp(
    `lucide:${icon}"[^>]*></iconify-icon>\\s*(?:</div>\\s*)?<span[^>]*>([^<]{1,200})</span>`,
    'i',
  ))
  return match ? htmlText(match[1]!).trim() || null : null
}

function metaSalary(html: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const raw = html.match(/name="description"\s+content="[^"]*?💵:\s*([^."]{1,40})/i)?.[1]
  if (!raw) return {}
  const usd = /\$|usd|доллар/iu.test(raw)
  const millions = /(?:mln|mil|million|milliyon|млн|миллион)/iu.test(raw)
  const values = [...raw.matchAll(/\d[\d\s]*/g)]
    .map((match) => Number(match[0].replace(/\s+/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => (millions && value < 1_000 ? value * 1_000_000 : value))
    .filter((value) => (usd ? value >= 50 && value <= 100_000 : value >= 100_000 && value <= 500_000_000))
  if (!values.length) return {}
  return { salaryMin: Math.min(...values), salaryMax: Math.max(...values), currency: usd ? 'USD' : 'UZS' }
}

function iconExperience(html: string): number | null {
  const value = iconField(html, 'clock')
  if (!value) return null
  if (/нет опыта|tajriba(?:m)? yo(?:'|’)q|tajribasiz/iu.test(value)) return 0
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(?:год|года|лет|yil)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function iconName(html: string): string {
  const value = iconField(html, 'user') || ''
  const name = value.replace(/\s*\((?:женщина|мужчина|ayol|erkak|female|male)\)\s*$/iu, '').trim()
  return name.length >= 2 && name.length <= 80 && !/^\d/.test(name) ? name : ''
}

function triState(text: string, positive: RegExp, negative: RegExp): boolean | null {
  if (negative.test(text)) return false
  if (positive.test(text)) return true
  return null
}

export function parseIshBorProfile(
  summary: IshBorSummary,
  detailHtml: string,
  normalizeCandidate: NormalizeCandidate,
): CvProfile | null {
  const profileHtml = ishBorProfileHtml(detailHtml)
  const detailText = htmlLines(profileHtml).join('\n')
  const activity = detailActivity(detailHtml, detailText)
  if (!validRecent(activity)) return null

  const combined = `${summary.text}\n${detailText}`
  const publicContacts = contacts(detailText)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)
  const age = extractCandidateAge(combined)
  const role = parseRole(detailText, summary.role)
  const sourceId = summary.url.match(/\/id\/(\d+)/)?.[1] || summary.url
  const features: string[] = []
  if (/\b(?:student|talaba)\b|\bстудент\p{L}*\b/iu.test(combined)) features.push('Student')
  if (/без опыта|tajribasiz/iu.test(combined)) features.push('No experience')

  const relocationReady = triState(
    combined,
    /готов\p{L}* к переезду|возможен переезд|готов\p{L}* переехать|ko['’]?chib o['’]?tish/iu,
    /не готов\p{L}* к переезду|переезд не рассматрива/iu,
  )
  const remote = triState(
    combined,
    /удал[её]н(?:но|ная|ную)|дистанцион|онлайн\s+работ|remote|masofaviy/iu,
    /только офис|офисный формат|удал[её]нк\p{L}* не рассматрива/iu,
  )

  return normalizeCandidate({
    id: `web-${ISHBOR_SOURCE_KEY}-${sourceId}`,
    source: 'telegram',
    origin: 'web',
    sourceKey: ISHBOR_SOURCE_KEY,
    country: 'UZ',
    name: iconName(profileHtml) || extractCandidateName(detailText),
    role,
    professions: [role],
    previousProfessions: [],
    features,
    age,
    isAdult: age == null ? true : age >= 18,
    experienceYears: iconExperience(profileHtml) ?? parseExperience(combined),
    city: cityFrom(iconField(profileHtml, 'map-pin') || '', 'UZ') || cityFrom(combined, 'UZ'),
    district: detect(combined, DISTRICT_ALIASES),
    remote,
    relocationReady,
    employmentTypes: [
      ...(/полный день|полная занятость|to['’]?liq/iu.test(combined) ? ['full_time' as const] : []),
      ...(/неполный день|частичная занятость|подработка|qisman/iu.test(combined) ? ['part_time' as const] : []),
    ],
    education: iconField(profileHtml, 'graduation-cap')
      || field(detailText, "ma(?:['’‘])lumoti|ta(?:['’‘])lim|образование")
      || null,
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
    ...parseSalary(combined),
    ...metaSalary(detailHtml),
  })
}
