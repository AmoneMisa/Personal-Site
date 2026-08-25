import type { CvProfile } from '../../../shared/contracts/hiring'
import type { HiringTelegramChannelDescriptor } from '../../../shared/hiring/sources/telegramChannels'
import { extractCandidateName } from '../../utils/hiringCandidateFields'
import { isLikelyTelegramVacancy } from '../../utils/sources'
import {
  classifySharedHiringMessage,
  detectEmploymentTypes,
  detectHiringIntent,
  detectLexiconCity,
  detectLexiconDistrict,
  detectProfessionMatches,
  detectWorkModes,
  parseHiringExperience,
  parseHiringSalary,
  parseSharedLanguageContext,
  resolveSharedProfessionContext,
} from '../../utils/hiringLexicon'

export type TelegramCandidateChannel = HiringTelegramChannelDescriptor

export interface TelegramMessageOutcome {
  profile: CvProfile | null
  candidateMarker: boolean
  reason?: 'expired' | 'vacancy' | 'quality'
}

const MAX_CANDIDATE_AGE_MONTHS = 3
const FUTURE_DATE_TOLERANCE_MS = 48 * 60 * 60 * 1000

const CANDIDATE_FORM_RE =
  /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,8}(?:ism(?:i|im)?(?:\s*[-–—]\s*(?:familya|familiya))?|familya|familiya|f\.?i\.?o\.?|фио|имя|yoshi|yoshim|tug(?:['’‘])ilgan\s+yili|возраст|qidirayotgan\s+kasb|so(?:['’‘])ralgan\s+ish\s+(?:joyi|turi)|yashash\s+manzili|ma(?:['’‘])lumoti|ожидаемая\s+работа|желаемая\s+(?:должность|работа)|tajribasi?|опыт\s+работы)\s*[:—-]/imu

const CV_MARKER_RE = /(?:резюме|resume|\bcv\b|curriculum vitae|анкета|профиль кандидата|профіль кандидата|кандидат(?:ка)?|candidate profile|mening\s+(?:cv|rezume)|my\s+cv)/iu
const FIRST_PERSON_RE = /(?:^|\n)\s*[^\p{L}\p{N}\n]{0,6}(?:я[\s—,-]|я\s+(?:ищу|шукаю)|(?:ищу|шукаю)\b|men[\s,]|mening[\s,]|my name is|i am a|i'm a|ismim\b)/iu
const PERSONAL_PROFILE_RE = /(?:\b(?:1[6-9]|[2-6]\d)\s*(?:лет|года?|рок(?:и|ів)?|years?\s+old)\b|\b(?:студент(?:ка|ом|кой)?|student)\b)/iu
const CONTACT_RE = /(?:\+?\d[\d\s()\-]{7,}|@[a-z0-9_]{4,}|(?:telegram|телефон|phone|tel|aloqa|murojaat|bog(?:'|’)lanish)\s*[:—-])/iu
const SECTION_PATTERNS = {
  experience: /(?:опыт|досвід|experience|staj|tajriba|ish\s+tajribasi)/iu,
  skills: /(?:skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko(?:'|’)nikmalar)/iu,
  education: /(?:education|образован|освіт|o(?:'|’)qish|ta(?:'|’)lim|университет|університет|university|college|institut)/iu,
  languages: /(?:languages|языки|мови|til(?:lar)?|language skills)/iu,
  contact: /(?:contact|контакт|telegram|телефон|phone|tel|bog(?:'|’)lanish|aloqa)/iu,
}

function candidateCutoff(): number {
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_CANDIDATE_AGE_MONTHS)
  return cutoff.getTime()
}

function recentCandidateDate(dateIso: string | null | undefined): string | null {
  if (!dateIso) return null
  const date = new Date(dateIso)
  if (!Number.isFinite(date.getTime())) return null
  const now = new Date()
  if (date.getTime() < candidateCutoff() || date.getTime() > now.getTime() + FUTURE_DATE_TOLERANCE_MS) return null
  return date.toISOString()
}

function field(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]\\s*([^\\n]{2,220})`, 'iu'))
  return match?.[1]?.trim()
}

function blockAfter(text: string, names: string): string | undefined {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:—-]?\\s*\\n([\\s\\S]{10,800}?)(?=\\n[^\\p{L}\\p{N}\\n]{0,8}(?:experience|опыт|досвід|skills|навыки|навички|education|образован|освіта|languages|языки|мови|contact|контакт|телефон)\\s*[:—-]|$)`, 'iu'))
  return match?.[1]?.replace(/\s+/g, ' ').trim()
}

function cvSectionCount(text: string): number {
  return Object.values(SECTION_PATTERNS).filter((pattern) => pattern.test(text)).length
}

export function isLikelyCvPost(text: string, cvFeed = false): boolean {
  const value = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').trim()
  const compact = value.replace(/\s+/g, ' ')
  if (compact.length < 30) return false
  if (/^(?:колеги[,!\s]*)?(?:вітаю[,!\s]*)?рекомендую\s+(?:класного\s+)?кандидат\p{L}*[.!\s]+(?:контакт\p{L}*\s+та\s+)?резюме\s+додаю\.?$/iu.test(compact)) return false

  const kind = classifySharedHiringMessage(value)
  if (['vacancy', 'vacancy_digest', 'recruitment_ad', 'course', 'job_service', 'closed_vacancy', 'spam'].includes(kind)) return false
  const explicitIntent = kind === 'candidate' || detectHiringIntent(value).intent === 'candidate'
  const candidateForm = CANDIDATE_FORM_RE.test(value)
  if (!explicitIntent && !candidateForm && isLikelyTelegramVacancy(compact)) return false

  const hasCvMarker = CV_MARKER_RE.test(value)
  const firstPerson = FIRST_PERSON_RE.test(value)
  const hasPersonalProfile = PERSONAL_PROFILE_RE.test(value)
  const hasRole = detectProfessionMatches(value, 1).length > 0
  const hasContact = CONTACT_RE.test(value)
  const sections = cvSectionCount(value)
  const parsedExperience = parseHiringExperience(value)
  const hasExperience = parsedExperience?.minYears != null || parsedExperience?.maxYears != null

  if (explicitIntent && (firstPerson || candidateForm || hasRole || hasContact || sections >= 1)) return true
  if (hasCvMarker && (candidateForm || hasRole || sections >= 1 || hasContact)) return true
  if (cvFeed && (firstPerson || hasCvMarker || candidateForm) && (hasRole || sections >= 1 || hasExperience || hasContact)) return true
  if (firstPerson && hasRole && (candidateForm || hasPersonalProfile || sections >= 1 || hasExperience || hasContact)) return true
  return false
}

function parseExperience(text: string): number | undefined {
  const parsed = parseHiringExperience(text)
  const years = parsed?.minYears ?? parsed?.maxYears ?? null
  return years != null && years > 0 && years <= 55 ? years : undefined
}

function parseRole(text: string): string {
  const profession = resolveSharedProfessionContext(text, { mode: 'candidate' }) as {
    desiredProfession?: { matched?: string; canonical?: string } | null
    currentProfession?: { matched?: string; canonical?: string } | null
  }
  const target = profession.desiredProfession || profession.currentProfession
  return String(target?.matched || target?.canonical || '').trim().slice(0, 180)
}

function parseSkills(text: string): string[] {
  const skillsLine = field(text, "skills|навыки|навички|умею|стек|stack|technologies|texnologiyalar|ko['’]nikmalar")
  if (!skillsLine) return []
  return [...new Set(skillsLine.split(/[,;/|•·]+/).map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 60))].slice(0, 20)
}

function parseLanguages(text: string): string[] {
  const parsed = parseSharedLanguageContext(text, 'candidate') as Array<{
    language: string
    name: string
    level: string | null
    cefr: string | null
  }>
  if (parsed.length) {
    return parsed.slice(0, 8).map((item) => {
      const level = item.cefr || item.level
      return level ? `${item.name} — ${level}` : item.name
    })
  }
  const raw = field(text, 'languages|языки|мови|til(?:lar)?|language skills') || blockAfter(text, 'languages|языки|мови|til(?:lar)?')
  return raw ? raw.split(/[,;/|•·]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8) : []
}

export function detectCity(text: string, country: string): string | null {
  return detectLexiconCity(text, country)
}

function fallbackChannelCity(channel: TelegramCandidateChannel): string | null {
  return detectLexiconCity(channel.location || '', channel.country)
}

export function detectDistrict(text: string, city: string | null): string | null {
  const explicit = field(text, 'район|р-н|district|туман|tumani')
  return detectLexiconDistrict(explicit || text, city) || explicit || null
}

function parseSalary(text: string, country: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const parsed = parseHiringSalary(text)
  if (!parsed || (parsed.min == null && parsed.max == null)) return {}
  const currency = parsed.currency
    || ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country]
  return {
    salaryMin: parsed.min ?? parsed.max ?? undefined,
    salaryMax: parsed.max ?? parsed.min ?? undefined,
    currency,
  }
}

export function telegramMessageToProfile(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramCandidateChannel,
  needle: string,
): CvProfile | null {
  const createdAt = recentCandidateDate(opts.dateIso)
  if (!createdAt) return null
  const lowerText = text.toLocaleLowerCase('ru')
  const localToChannel = !channel.includeAny?.length
    || channel.includeAny.some((marker) => lowerText.includes(marker.toLocaleLowerCase('ru')))
  if (channel.requireCandidateMarker && detectHiringIntent(text).intent !== 'candidate') return null
  if (!isLikelyCvPost(text, channel.cvFeed)) return null

  const name = extractCandidateName(text)
  const role = parseRole(text)
  const skills = parseSkills(text)
  if (needle && !`${name} ${role} ${text} ${skills.join(' ')}`.toLocaleLowerCase('ru').includes(needle)) return null

  const explicitLocation = field(text, 'location|city|локация|локація|город|місто|shahar|yashash (?:manzili|joyi)|hozirgi manzil|manzil|hudud')
  const explicitCity = explicitLocation ? detectCity(explicitLocation, channel.country) || explicitLocation : null
  const city = localToChannel
    ? explicitCity || detectCity(text, channel.country) || fallbackChannelCity(channel)
    : explicitCity || null
  const district = detectDistrict(text, city)
  const contact = field(text, 'contact|контакт|telegram|phone|телефон|tel|telefon|boglanish|aloqa|murojaat')
  const employmentType = detectEmploymentTypes(text)[0]
    || field(text, 'employment|format|занятость|зайнятість|график|графік|ish vaqti|bandlik')
  const education = field(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || blockAfter(text, "education|образование|освіта|o['’]qish|ta['’]lim|ma['’]lumoti|diplom") || null
  const hashtags = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)].map((match) => match[1]!)
  const salary = parseSalary(text, channel.country)

  return {
    id: opts.id,
    source: 'telegram',
    sourceCountry: channel.country,
    country: localToChannel ? channel.country : '',
    name,
    role,
    experienceYears: parseExperience(text),
    ...salary,
    city,
    district,
    remote: detectWorkModes(`${role} ${text}`).includes('remote'),
    url: opts.url,
    createdAt,
    originalText: text,
    description: text,
    skills,
    languages: parseLanguages(text),
    education,
    tags: [...channel.tags, channel.country, `@${channel.handle}`, ...hashtags].slice(0, 10),
    contact,
    employmentType,
  }
}

function looksLikeVacancy(text: string): boolean {
  const kind = classifySharedHiringMessage(text)
  if (kind === 'vacancy' || kind === 'closed_vacancy') return true
  return isLikelyTelegramVacancy(text.replace(/\s+/g, ' '))
}

export function classifyTelegramMessage(
  text: string,
  opts: { id: string; url: string; dateIso: string | null | undefined },
  channel: TelegramCandidateChannel,
  needle: string,
): TelegramMessageOutcome {
  const candidateMarker = detectHiringIntent(text).intent === 'candidate'
  if (!recentCandidateDate(opts.dateIso)) return { profile: null, candidateMarker, reason: 'expired' }

  const profile = telegramMessageToProfile(text, opts, channel, needle)
  if (profile) return { profile, candidateMarker }
  return { profile: null, candidateMarker, reason: looksLikeVacancy(text) ? 'vacancy' : 'quality' }
}
