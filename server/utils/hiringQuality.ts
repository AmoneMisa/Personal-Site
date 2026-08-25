// Deterministic repair layer for candidate cards.
//
// Source adapters intentionally stay conservative. This layer fixes structured
// facts that can be proven from the original CV text, including legacy records
// already persisted before a parser rule was added. It never guesses gender,
// remote status, location, or a profession from a person's name. Semantic AI
// enrichment remains authoritative for ambiguous free-form text.

import type { CvProfile } from './hiringTypes'
import { detectMentionedProfessions } from './hiringNormalize'
import {
  detectCandidateProfessionLabels,
  detectCandidateRemotePreference,
  detectLexiconCity,
  extractCandidateGoalField,
  extractCandidateLocationField,
  extractCandidateRoleField,
  extractCandidateSkillField,
  extractCandidateTargetContext,
  isCandidateStatusOnly,
  normalizeHiringCountry,
  resolveSharedCountryFromText,
} from './hiringLexicon'

function field(text: string, names: string): string | null {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:：—-]\\s*([^\\n]{1,220})`, 'iu'))
  return match?.[1]?.trim() || null
}

function cleanToken(value: string): string {
  return value.replace(/^[#@\s]+|[#@\s]+$/g, '').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function candidateTargetContext(profile: CvProfile, text: string): string {
  const roleFieldRaw = extractCandidateRoleField(text)
  const roleField = roleFieldRaw && !isCandidateStatusOnly(cleanToken(roleFieldRaw)) ? roleFieldRaw : ''
  const goal = extractCandidateGoalField(text) || ''
  const target = extractCandidateTargetContext(text)
  const headline = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 4).join('\n')
  return [profile.role || '', ...(profile.professions || []), roleField, goal, target, headline].join('\n')
}

function repairProfessions(profile: CvProfile, text: string): string[] {
  const current = unique(profile.professions?.length ? profile.professions : [profile.role || ''])
  const target = candidateTargetContext(profile, text)
  const semantic = [...detectCandidateProfessionLabels(target)]
  if (semantic.length) return unique(semantic)
  if (!current.length) {
    const technologies = extractCandidateSkillField(text) || ''
    const inferred = [...detectCandidateProfessionLabels('', `${technologies} ${(profile.skills || []).join(' ')}`)]
    if (inferred.length) return unique(inferred)
    const headline = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8).join('\n')
    const headlineProfessions = detectMentionedProfessions(headline)
    if (headlineProfessions.length) return headlineProfessions
  }
  return current
}

function structuredName(text: string): string | null {
  const value = field(text, "xodim|hodim|ism(?:i|im)?|f\\.?i\\.?o\\.?|фио|піб|full name|name|имя|ім(?:ʼ|')я")
  if (value) {
    const cleaned = value.replace(/[📚🕑🌐💰📞🇺🇿].*$/u, '').trim()
    if (cleaned.length >= 2 && cleaned.length <= 100) return cleaned
  }
  const linkedIn = text.match(/(?:резюме|resume)\s*\|\s*(\p{Lu}\p{Ll}+(?:\s+\p{Lu}(?:\p{Ll}+|\.))?)/u)?.[1]
    || text.match(/(?:^|\n)(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)+)\s+-\s+(?:HR|Developer|Engineer|Manager|Designer)\b/u)?.[1]
  if (linkedIn) return linkedIn
  const introduced = text.match(/(?:^|\n)(?:вітаю,?\s+)?мене\s+звати\s+(\p{Lu}\p{Ll}+)/iu)?.[1]
  if (introduced) return introduced
  const handleName = text.match(/@(\p{Lu}\p{Ll}{2,})(?:_|\p{Lu}|\d)/u)?.[1]
  if (handleName) return handleName
  return text.match(/(?:^|\n)(\p{Lu}\p{Ll}+)\s+\d+\+?\s+(?:рок\p{L}*|лет|years?)\s+(?:у|в|in)\s+(?:HR|IT)\b/iu)?.[1] || null
}

function explicitLocation(text: string): string | null {
  return extractCandidateLocationField(text)
}

function countryFromLocation(value: string | null): { code: string; name: string } | null {
  if (!value) return null
  const code = resolveSharedCountryFromText(value)
  return code ? { code, name: cleanToken(value) } : null
}

function cityFromLocation(value: string | null, country: { code: string; name: string } | null): string | null {
  if (!value || !country) return null
  const cleaned = cleanToken(value)
  if (!cleaned) return null
  const known = detectLexiconCity(cleaned, country.code)
  if (known) return known
  const first = cleanToken(cleaned.split(',')[0] || '')
  if (!first || normalizeHiringCountry(first)) return null
  if (/^(?:europe|europa|європа|европа|штати|states)$/iu.test(first)) return null
  return first.slice(0, 80)
}

function approximateExperience(text: string): number | null {
  const uz = text.match(/\b(\d+(?:[.,]\d+)?)\s*yil(?:ga)?\s+(?:yaqin|atrofida)\s+tajriba/iu)
    || text.match(/tajriba\p{L}*[^\n\d]{0,40}(\d+(?:[.,]\d+)?)\s*yil/iu)
  if (!uz) return null
  const years = Number(uz[1]!.replace(',', '.'))
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function uzSalary(text: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> | null {
  const raw = field(text, 'narxi|narx')
  if (!raw) return null
  const match = raw.match(/(\d[\d\s.,]*\d|\d)/)
  if (!match) return null
  let value = Number(match[1]!.replace(/[\s,]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  if (/\b(?:mln|million)\b/iu.test(raw)) value *= 1_000_000
  else if (/\b(?:ming|thousand)\b/iu.test(raw)) value *= 1_000
  const currency = /(?:\$|usd|dollar)/iu.test(raw) ? 'USD' : 'UZS'
  return {
    salaryMin: Math.round(value),
    salaryMax: /\+/.test(raw) ? null : Math.round(value),
    currency,
  }
}

/**
 * Training, bootcamp and recruitment-program announcements belong to Job Finder,
 * not the candidate board. Requiring multiple program signals avoids rejecting a
 * real candidate merely because their CV says they previously completed a course.
 */
// Charity and fundraising appeals: someone is being helped, not hired.
const APPEAL_RE =
  /(?:шелтер|притулок|прихисток|благодійн\p{L}*|благотворительн\p{L}*|донат\p{L}*|пожертв\p{L}*|збір\s+(?:кошт|грош)\p{L}*|сбор\s+средств|допоможіть|допомогти\s+(?:родин|дідус|бабус)\p{L}*|потребує\s+допомоги|нуждается\s+в\s+помощи|опікунств\p{L}*|інвалідніст\p{L}*|карта\s+для\s+допомоги|реквізити\s+для|monobank|банка\s+збор)/iu

/** True when the post asks for help rather than offering work. */
export function isCharityAppeal(text: string): boolean {
  if (!text) return false
  const matches = text.match(new RegExp(APPEAL_RE.source, 'giu')) || []
  // One mention can be incidental ("маю досвід роботи у благодійному фонді");
  // two or more make it the subject of the post.
  return matches.length >= 2
}

export function isRecruitingOpportunity(text: string): boolean {
  const value = text.replace(/\s+/g, ' ').trim()
  if (!value) return false

  const signals = [
    /(?:\blaboratory\b|\bacademy\b|\bbootcamp\b|\btraining\s+program\b|\binternship\s+program\b|лабораторія|лаборатория|академія|академия|буткемп)/iu,
    /(?:запрошує|приглашает|приглашаем|набір|набор)[^.]{0,100}(?:кандидат|учасник|участник)/iu,
    /(?:(?:реєстрац|регистрац)\p{L}*\s+до|\bregistration\b\s+(?:until|by))/iu,
    /(?:(?:старт|початок)\s*[—:,-]?\s*\d{1,2}\s+\p{L}+|\bstart\b\s*[—:,-]?\s*\d{1,2})/iu,
    /(?:кількість\s+місць|количество\s+мест|\blimited\s+spots\b|менторськ|менторск|\bmentorship\b)/iu,
  ].filter((pattern) => pattern.test(value)).length

  return signals >= 2
}

/** Repair only facts supported by the original source text. */
export function repairCandidateProfile(profile: CvProfile): CvProfile {
  const text = profile.originalText || profile.description || ''
  if (!text) return profile

  const professions = repairProfessions(profile, text)
  const location = explicitLocation(text)
  const detectedCountry = countryFromLocation(location)
  const detectedCity = cityFromLocation(location, detectedCountry)
  const remoteSignal = detectCandidateRemotePreference(text)
  const experience = profile.experienceYears ?? approximateExperience(text)
  const salary = profile.salaryMin == null && profile.salaryMax == null ? uzSalary(text) : null

  let city = profile.city ?? null
  if (detectedCountry) {
    // Old Telegram parsing treated `Локація: #Canada` as a city while leaving
    // the channel's country (UA) in place. Country-only location values must not
    // survive as a fake city.
    const currentCity = cleanToken(city || '')
    if (!detectedCity && normalizeHiringCountry(currentCity)) city = null
    else if (detectedCity) city = detectedCity
  }

  return {
    ...profile,
    name: profile.name || structuredName(text) || '',
    role: professions[0] || profile.role,
    professions,
    country: detectedCountry?.code || profile.country,
    city,
    remote: remoteSignal ?? (profile.remote === true ? true : null),
    experienceYears: experience,
    ...(salary || {}),
  }
}
