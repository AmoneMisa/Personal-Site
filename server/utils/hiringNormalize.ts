// Candidate profile normalization + deduplication.
// Free-form posts are normalized without overwriting the original message.

import { canonicalSkillName, extractSkillDetails } from '~~/shared/jobSkills'
import type { CandidateEmploymentType, CvProfile } from './hiringTypes'
import type { Seniority } from './jobTypes'
import { extractCandidateAge, extractCandidateGender, extractCandidateName } from './hiringCandidateFields'
import { ishBorLocationFromText, trimIshBorProfileText } from './hiringIshBorFields'
import { careeristRoleFromText, trimCareeristProfileText } from './hiringCareeristFields'
import { parseSalary as parseWebSalary } from './hiringWebFields'
import {
  detectProfessionMatches,
  detectSharedSeniority,
  resolveSharedProfessionContext,
} from './hiringLexicon'

const JUNIOR_CONTRADICTION_YEARS = 4

export function detectSeniority(text: string, experienceYears?: number | null): Seniority | null {
  const shared = detectSharedSeniority(text) as Seniority | null
  if (shared) {
    // Explicit staff/principal/lead/head/director/vp/chief must never collapse to senior.
    if ((shared === 'intern' || shared === 'junior') && (experienceYears ?? 0) >= JUNIOR_CONTRADICTION_YEARS) {
      return (experienceYears ?? 0) >= 6 ? 'senior' : 'middle'
    }
    return shared
  }
  if (experienceYears == null) return null
  if (experienceYears >= 6) return 'senior'
  if (experienceYears >= 3) return 'middle'
  if (experienceYears >= 1) return 'junior'
  return null
}

function addSkill(out: Set<string>, raw: string) {
  const canonical = canonicalSkillName(raw)
  if (canonical) out.add(canonical)
  else {
    const trimmed = raw.trim().replace(/\s{2,}/g, ' ')
    if (trimmed.length >= 2 && trimmed.length <= 60) out.add(trimmed)
  }
}

export function normalizeSkills(rawSkills: string[] | undefined, text: string): string[] {
  const out = new Set<string>()
  for (const raw of rawSkills || []) addSkill(out, raw)

  // Structured UZ CV cards commonly call this field `Texnologiya`, singular.
  // Keep unknown but meaningful entries (e.g. DRF, Telegram Bot) instead of
  // relying only on the canonical skill catalogue.
  const structured = text.match(
    /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:skills|навыки|навички|стек|stack|technologies|texnologiya(?:lar)?|ko(?:'|’)nikmalar)\s*[:—-]\s*([^\n]{2,500})/iu,
  )?.[1]
  if (structured) {
    for (const raw of structured.split(/[,;/|•·]+/)) {
      if (raw.trim()) addSkill(out, raw)
    }
  }

  for (const { name } of extractSkillDetails(text)) out.add(name)
  return [...out]
}

const PROFESSION_ACRONYMS = new Map<string, string>([
  ['qa', 'QA'], ['hr', 'HR'], ['ui', 'UI'], ['ux', 'UX'], ['ai', 'AI'], ['ml', 'ML'],
  ['seo', 'SEO'], ['sre', 'SRE'], ['dba', 'DBA'], ['crm', 'CRM'], ['erp', 'ERP'], ['pmo', 'PMO'],
])

function formatProfessionCanonical(canonical: string): string {
  return canonical.split('_').map((part) =>
    PROFESSION_ACRONYMS.get(part) || `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
  ).join(' ')
}

function collectProfessions(source: string): string[] {
  return [...new Set(
    detectProfessionMatches(source, 16).map((match) => formatProfessionCanonical(match.canonical)),
  )]
}

const NON_TARGET_CONTEXT_RE = /(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous|раньше|ранее|прежде|работал|работала|працював|працювала|worked\s+(?:as|at)|oldin|avval|ishlagan|ishladim|tajriba|диплом|diplom|mutaxassisligim)/iu
const TARGET_CONTEXT_RE = /(?:ищу\s+(?:работу|подработку)|шукаю\s+(?:роботу|підробіток)|желаемая\s+(?:должность|работа)|бажана\s+(?:посада|робота)|target\s+role|desired\s+(?:role|position)|looking\s+for\s+(?:a\s+)?(?:job|work)|open\s+to\s+work|menga\s+ish\s+kerak|ish\s+(?:kerak|qidiryapman|qidiraman|izlayapman)|ish\s+joyi\s+kerak|lavozim|kasb|soha|soxa|maqsad(?:im)?)/iu

function cleanRole(raw: string | undefined): string {
  return (raw || '').trim().replace(/^[#\-–—•*\s]+/, '').replace(/[.;,]+$/, '').replace(/\s{2,}/g, ' ').slice(0, 180)
}

function comparableRoleText(raw: string | undefined): string {
  return cleanRole(raw).toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
}

function collectProfessions(source: string): string[] {
  const matches: Array<{ name: string; index: number }> = []
  for (const profession of PROFESSION_RULES) {
    const match = profession.re.exec(source)
    if (match?.index != null) matches.push({ name: profession.name, index: match.index })
  }
  matches.sort((a, b) => a.index - b.index)
  const names = [...new Set(matches.map((item) => item.name))]
  if (names.some((name) => SPECIFIC_MANAGER_ROLES.has(name))) {
    const generic = names.indexOf('Manager')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Production Manager') || names.includes('Engineering Manager') || names.includes('Chief Executive Officer') || names.includes('Chief Technology Officer')) {
    const generic = names.indexOf('General Manager')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.some((name) => SPECIFIC_DEVELOPER_ROLES.has(name))) {
    for (const genericName of ['Software Developer', 'IT Specialist']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
  }
  if (names.some((name) => SPECIFIC_TECH_ROLES.has(name))) {
    for (const genericName of ['Engineer', 'IT Specialist']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
  }
  if (names.includes('System Administrator')) {
    const generic = names.indexOf('Administrator')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Fitness Trainer')) {
    const generic = names.indexOf('Trainer / Coach')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Dentist')) {
    const generic = names.indexOf('Doctor')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('English Teacher')) {
    const generic = names.indexOf('Teacher')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Call Center Operator') || names.includes('Chat Operator')) {
    for (const genericName of ['Customer Support', 'Operator']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
  }
  if (names.includes('Chief Accountant')) {
    const generic = names.indexOf('Accountant')
    if (generic >= 0) names.splice(generic, 1)
  }
  return names
}

export function detectMentionedProfessions(source: string): string[] {
  return collectProfessions(source)
}

function normalizeProvidedProfessions(items: string[] | undefined): string[] {
  const out: string[] = []
  for (const item of items || []) {
    const clean = cleanRole(item)
    if (!clean) continue
    const matches = collectProfessions(clean)
    for (const value of (matches.length ? matches : [clean])) {
      if (!out.includes(value)) out.push(value)
    }
  }
  return out
}

function targetContext(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const picked: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!TARGET_CONTEXT_RE.test(lines[i]!)) continue
    for (let offset = 0; offset < 3 && i + offset < lines.length; offset += 1) {
      const line = lines[i + offset]!
      if (offset > 0 && NON_TARGET_CONTEXT_RE.test(line)) break
      picked.push(line)
    }
  }
  return picked.join('\n')
}

function extractGoalRole(text: string): string {
  // Uzbek CV cards often put unrelated past experience and the actual target
  // into one "Maqsad" paragraph. Prefer the explicit "X sifatida ish topish"
  // construction so the earlier profession cannot become the desired role.
  const asRole = text.match(
    /\b((?:(?:frontend|front-end|backend|back-end|full[- ]?stack|mobile|android|ios)\s+)?(?:dasturchi|developer|programmer))\s+sifatida\s+(?:ish\s+(?:topish|qidirish|izlash)|ishlash)\b/iu,
  )
  return cleanRole(asRole?.[1])
}

export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {
  const target = cleanRole(rawRole)
  if (FLEXIBLE_ROLE_RE.test(target)) return ['Any Role']
  if (NON_ROLE_RE.test(target)) return []

  const resolved = resolveSharedProfessionContext(text, { mode: 'candidate', title: target }) as {
    desiredProfession?: { canonical?: string } | null
    mentionedProfessions?: Array<{ canonical?: string }>
  }
  const desired = resolved.desiredProfession?.canonical
  if (desired) return [formatProfessionCanonical(desired)]

  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {
    const targetMatches = collectProfessions(target)
    if (targetMatches.length) return targetMatches
  }

  const contextualMatches = collectProfessions(targetContext(text))
  if (contextualMatches.length) return contextualMatches
  return target && !NON_TARGET_CONTEXT_RE.test(target) ? [target] : []
}

export function normalizeRole(role: string | undefined, text: string): string {
  return normalizeProfessions(role, text)[0] || cleanRole(role)
}

function workHistoryBlock(text: string): string {
  const explicit = text.match(/(?:^|\n)\s*(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous\s+(?:jobs?|positions?)|tajriba|ish\s+tajribasi)\s*[:—-]?\s*([\s\S]{1,2600}?)(?=\n\s*(?:навыки|навички|skills|образование|освіта|education|контакт|contact|ожидания|salary|языки|мови|languages)\s*[:—-]|$)/iu)
  if (explicit?.[1]) return explicit[1]

  return text.split(/\n|(?<=[.!?])\s+/u).filter((line) =>
    /(?:работал[аи]?|працюва(?:в|ла)|worked\s+(?:as|at)|oldin|avval|ishlagan|ishladim|ishlaganman|tajriba(?:m)?\s+bor)/iu.test(line),
  ).join('\n')
}

export function normalizePreviousProfessions(text: string): string[] {
  const history = workHistoryBlock(text)
  return history ? collectProfessions(history) : []
}

interface FeatureRule { name: string; re: RegExp }
const FEATURE_RULES: FeatureRule[] = [
  { name: 'Student', re: /\bstudent\b|студент|студентк|talaba/iu },
  { name: 'Parental leave', re: /декрет|в\s+декрете|у\s+декреті|maternity\s+leave|parental\s+leave/iu },
  { name: 'No experience', re: /без\s+опыта|без\s+досвіду|no\s+experience|tajriba\s+yo(?:'|’)q/iu },
  { name: 'Part-time', re: /подработк|підробіт|part[-\s]?time|неполный\s+день|неповн(?:ий|а)\s+день|yarim\s+stavka/iu },
  { name: 'Night shift', re: /ночн(?:ая|ую|ой)\s+смен|нічн(?:а|у|ої)\s+змін|night\s+shift|tungi\s+smena/iu },
  { name: 'Open to relocation', re: /готов\p{L}*\s+к\s+переезду|готов\p{L}*\s+переехать|готов\p{L}*\s+до\s+переїзду|relocat(?:e|ion)|ko(?:'|’)chib\s+o(?:'|’)tish/iu },
]

export function extractCandidateFeatures(text: string): string[] {
  return FEATURE_RULES.filter((feature) => feature.re.test(text)).map((feature) => feature.name)
}

// "Murojaat qilish vaqti: 8:00 - 22:00" is on nearly every structured UZ card
// and answers a real question — when may I call this person. Deliberately not
// matched on a bare "ish vaqti", which is the working schedule the candidate
// wants, not the hours they answer the phone.
const CONTACT_HOURS_RE =
  /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:murojaat\s+qilish\s+vaqti|aloqa\s+vaqti|qo(?:'|’)ng(?:'|’)iroq\s+vaqti|bog(?:'|’)lanish\s+vaqti|время\s+(?:связи|звонков|для\s+связи)|звонить\s+(?:с|в)|contact\s+(?:hours|time)|call\s+time)\s*[:—-]?\s*([^\n]{3,60})/iu;

export function extractContactHours(text: string): string | null {
  const raw = text.match(CONTACT_HOURS_RE)?.[1];
  if (!raw) return null;
  const cleaned = raw.replace(/\s{2,}/g, ' ').replace(/[.;,]+$/, '').trim();
  // A time range is what makes this field worth showing at all.
  return /\b24\s*\/\s*7\b|\d{1,2}[:.]\d{2}|\d{1,2}\s*[-–—]\s*\d{1,2}/.test(cleaned) ? cleaned.slice(0, 60) : null;
}

export function extractContacts(text: string): { telegram?: string; email?: string; phone?: string } {
  const out: { telegram?: string; email?: string; phone?: string } = {}
  const tg = text.match(/@[A-Za-z0-9_]{4,32}/)
  if (tg) out.telegram = tg[0]
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (email) out.email = email[0]
  const phone = text.match(/\+?\d[\d\s().-]{8,}\d/)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    if (digits.length >= 9 && digits.length <= 15) out.phone = phone[0].trim()
  }
  return out
}

export function extractAge(text: string): number | null {
  return extractCandidateAge(text)
}

function parseMoneyNumber(raw: string): number | null {
  let value = raw.trim().replace(/\s+/g, '')
  if (!value) return null
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/[.,]/g, '')
  else value = value.replace(',', '.')
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function defaultCurrency(country: string): string | null {
  return ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country.toUpperCase()] || null
}

export function extractCandidateSalary(
  text: string,
  country: string,
): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const field = text.match(
    /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:narxi?|salary|expected\s+salary|зарплата|зп|бажана\s+зарплата|oylik|maosh|ish\s+haqi)\s*[:—-]\s*([^\n]{1,120})/iu,
  )?.[1]
  if (!field) return {}

  const values = (field.match(/\d[\d\s.,]*\d|\d/g) || [])
    .map(parseMoneyNumber)
    .filter((value): value is number => value != null && value > 0)
    .slice(0, 2)
  if (!values.length) return {}

  const multiplier = /(?:млн|million|mln)/iu.test(field) ? 1_000_000
    : /(?:тыс|тис|thousand|ming)/iu.test(field) ? 1_000
      : 1
  const amounts = values.map((value) => Math.round(value * multiplier))
  const currency = /(?:\$|usd|доллар)/iu.test(field) ? 'USD'
    : /(?:uzs|сум|so(?:'|’)m)/iu.test(field) ? 'UZS'
      : /(?:uah|грн|грив)/iu.test(field) ? 'UAH'
        : /(?:kzt|₸|тенге|тг)/iu.test(field) ? 'KZT'
          : /(?:kgs|сом)/iu.test(field) ? 'KGS'
            : defaultCurrency(country)

  if (amounts.length > 1) {
    return { salaryMin: Math.min(...amounts), salaryMax: Math.max(...amounts), currency }
  }
  if (/\+|(?:^|\s)(?:от|від|from)\s/iu.test(field)) {
    return { salaryMin: amounts[0], currency }
  }
  return { salaryMin: amounts[0], salaryMax: amounts[0], currency }
}

export function detectRelocationReady(text: string): boolean | null {
  if (/не\s+готов\p{L}*\s+к\s+переезду|не\s+розгляда\p{L}*\s+переїзд|not\s+(?:open|ready)\s+to\s+relocat/iu.test(text)) return false
  if (/готов\p{L}*\s+к\s+переезду|готов\p{L}*\s+переехать|готов\p{L}*\s+до\s+переїзду|relocat(?:e|ion)|ko(?:'|’)chib\s+o(?:'|’)tish/iu.test(text)) return true
  return null
}

const REMOTE_POSITIVE_RE = /\bremote\b|удал[её]н\p{L}*|віддален|дистанцион|masofaviy|(?<!\p{L})onlayn(?!\p{L})|online\s+(?:work|job)|онлайн\s+работ/iu
const REMOTE_NEGATIVE_RE = /только\s+офис|офисн(?:ый|ая)\s+формат|офлайн|удал[её]нк\p{L}*\s+не\s+рассматрива|remote\s+(?:not|no)|faqat\s+ofis|ofisda\s+ishlash/iu

export function normalizeRemotePreference(
  raw: boolean | null | undefined,
  text: string,
  origin: CvProfile['origin'],
): boolean | null {
  if (REMOTE_NEGATIVE_RE.test(text)) return false
  if (REMOTE_POSITIVE_RE.test(text)) return true
  // Legacy Telegram parsing used RegExp.test(), so every post without a remote
  // marker was persisted as false. Treat that false as unknown; web adapters
  // can still preserve an explicit structured false from their source.
  if ((origin ?? 'telegram') === 'telegram' && raw === false) return null
  return raw ?? null
}

function numericExperience(segment: string): number | null {
  const direct = segment.match(
    /(?:опыт(?:\s+работы)?|досвід(?:\s+роботи)?|experience|staj|tajriba(?:m)?)\s*[:—-]?\s*(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil|йил)?/iu,
  )
  const reverse = segment.match(
    /(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil(?:lik)?|йил(?:лик)?)[^\n.!?]{0,100}(?:опыт|досвід|experience|staj|tajriba(?:m)?)/iu,
  )
  const value = direct?.[1] || reverse?.[1]
  if (!value) return null
  const years = Number(value.replace(',', '.'))
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function sameProfessionFamily(a: string, b: string): boolean {
  if (a === b) return true
  return /Developer$/u.test(a) && /Developer$/u.test(b)
}

export function normalizeRelevantExperience(
  raw: number | null | undefined,
  targetProfessions: string[],
  text: string,
): number | null | undefined {
  if (raw == null) return raw
  const years = Number(raw)
  if (!Number.isFinite(years)) return null

  const mentions = text
    .split(/\n|(?<=[.!?])\s+/u)
    .map((segment) => ({ segment, years: numericExperience(segment) }))
    .filter((item) => item.years != null && Math.abs(item.years - years) < 0.001)
  if (!mentions.length || !targetProfessions.length) return raw

  const hasRelevantEvidence = mentions.some(({ segment }) => {
    const mentioned = collectProfessions(segment)
    // A generic "3 years experience" remains valid. We reject only when the
    // source explicitly ties those years to a different profession.
    if (!mentioned.length) return true
    return mentioned.some((profession) =>
      targetProfessions.some((target) => sameProfessionFamily(profession, target)),
    )
  })
  return hasRelevantEvidence ? raw : null
}

export function normalizeEmploymentTypes(text: string, raw?: string | null): CandidateEmploymentType[] {
  const source = `${raw || ''}\n${text}`
  const out = new Set<CandidateEmploymentType>()
  if (/full[-\s]?time|(?<!\p{L})полный\s+(?:рабочий\s+)?день|(?<!\p{L})полная\s+занятость|(?<!\p{L})повн(?:ий|а)\s+(?:робочий\s+)?день|(?<!\p{L})повна\s+зайнятість|to(?:'|’)liq\s+(?:ish|stavka)/iu.test(source)) out.add('full_time')
  if (/part[-\s]?time|неполный\s+(?:рабочий\s+)?день|неполная\s+занятость|частичная\s+занятость|подработк|неповн(?:ий|а)\s+(?:робочий\s+)?день|часткова\s+зайнятість|підробіт|yarim\s+stavka/iu.test(source)) out.add('part_time')
  return [...out]
}

/** Removes text ligatures emitted by icon fonts from older stored web cards. */
function stripUiArtifacts(value: string): string {
  return value
    .replace(/\b(?:local_shipping|location_on|work_outline|account_circle)\b/giu, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .trim()
}

const RABOTA_UI_LINE_RE = /^(?:в избранное|скачать|скрыть|пожаловаться|развернуть)$/iu
const RABOTA_HEADER_RE = /^(?:найдено\s+[\d\s]+\s+резюме\s+в\s+казахстане|[\d\s]+\s+резюме\s+людей,\s+ищущих\s+работу\s+в\s+казахстане\.)/iu

/** Removes search-page chrome duplicated inside Rabota.kz resume cards. */
export function trimRabotaKzProfileText(value: string): string {
  const seen = new Set<string>()
  return stripUiArtifacts(value)
    .split('\n')
    .filter((line) => {
      const key = line.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim()
      if (!key || RABOTA_UI_LINE_RE.test(key) || RABOTA_HEADER_RE.test(key) || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Removes author/time/translation controls and engagement counters from Threads captures. */
export function trimThreadsProfileText(value: string, candidateName = ''): string {
  const normalizedName = candidateName.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim()
  const lines = stripUiArtifacts(value).split('\n')
  const translateAt = lines.findIndex((line) => /^translate$/iu.test(line.trim()))
  const content = (translateAt >= 0 ? lines.slice(0, translateAt) : lines)
    .filter((line, index) => {
      const key = line.toLocaleLowerCase('ru').replace(/\s+/g, ' ').trim()
      if (!key || /^\d+[smhdw]$/iu.test(key) || /^translate$/iu.test(key)) return false
      if (index === 0 && ((normalizedName && key === normalizedName) || (/^@?[a-z0-9._]{4,40}$/iu.test(key) && /^\d+[smhdw]$/iu.test(lines[1]?.trim() || '')))) return false
      return true
    })
  while (content.length && /^\d{1,5}$/.test(content.at(-1)!.trim())) content.pop()
  return content.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function sourceProfileText(profile: CvProfile, value: string): string {
  const clean = stripUiArtifacts(value)
  if (profile.sourceKey === 'rabotakz') return trimRabotaKzProfileText(clean)
  if (profile.origin === 'threads' || profile.sourceKey?.startsWith('threads-')) return trimThreadsProfileText(clean, profile.name)
  if (profile.sourceKey === 'ishbor-uz') return trimIshBorProfileText(clean)
  if (profile.sourceKey === 'careerist-uz') return trimCareeristProfileText(clean)
  if (profile.sourceKey?.startsWith('flagma')) return trimFlagmaProfileText(clean)
  return clean
}

/** Removes ad-loader JavaScript leaked by incomplete Flagma card fragments. */
function trimFlagmaProfileText(value: string): string {
  return stripUiArtifacts(value)
    .replace(
      /(?:^|\n)\s*try\s*\{\s*(?:\r?\n)?\s*\(?\s*(?:adsbygoogle|window\.adsbygoogle)[\s\S]{0,500}?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]{0,500}?\}(?=\s*\n|$)/giu,
      '\n',
    )
    .split('\n')
    .filter((line) => !/^\s*(?:сохранить|save|\(?\s*adsbygoogle\b|window\.adsbygoogle\b|console\.log\s*\(|try\s*\{|\}?\s*catch\s*\([^)]*\)\s*\{|\}\s*;?)\s*$/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizedCandidateSkills(profile: CvProfile, text: string): string[] {
  const rabotaKz = profile.sourceKey === 'rabotakz'
  const skipTextExtraction = profile.sourceKey === 'careerist-uz' || profile.sourceKey === 'ishbor-uz' || rabotaKz
  const rawSkills = skipTextExtraction
    ? rabotaKz
      ? (profile.skills || []).filter((skill) => (
          skill.length <= 60
          && !/(?:19|20)\d{2}|по\s+настоящее\s+время|колледж|университет|институт|училище|сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август/iu.test(skill)
        ))
      : []
    : profile.sourceKey?.startsWith('flagma')
      ? (profile.skills || []).filter((skill) => canonicalSkillName(skill) != null)
      : profile.skills
  const normalized = normalizeSkills(rawSkills, skipTextExtraction ? '' : text)
  if (!profile.sourceKey?.startsWith('flagma')) return normalized

  const history = workHistoryBlock(text)
  return normalized.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Marketplace names are legitimate skills only when stated as skills.
    // In `Administrator, Uzum market, Buxoro` the same token is the employer.
    const company = new RegExp(
      `(?:^|[,;])\\s*${escaped}\\s+(?:market|marketplace|group|company|llc|ooo)\\s*(?:[,.;]|$)`,
      'iu',
    )
    const explicitSkill = new RegExp(
      `(?:skills|навыки|навички|stack|texnologiya(?:lar)?)\\s*[:—-][^\\n]{0,300}(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      'iu',
    )
    return !company.test(history) || explicitSkill.test(text)
  })
}

const HIDDEN_NAME_RE = /^(?:(?:фио|піб|name)?\s*(?:скрыт\p{L}*|прихован\p{L}*|hidden|yashiril\p{L}*|ascuns)|onlayn|online|resume|резюме|[?？�\uFFFD]{2,})$/iu
const EMPLOYMENT_AS_EDUCATION_RE = /занятост|зайнятіст|удал[её]нн|дистанцион|remote|full[- ]?time|part[- ]?time|график\s+работ|bandlik/iu
const FLEXIBLE_ROLE_RE = /^(?:нет|без)\s+разницы(?:\s+.*)?$|^не\s*важно(?:\s+.*)?$|^farqi\s+yo['’ʻʼ‘`]?q$|^любая\s+(?:работа|занятость)(?:\s+.*)?$/iu
const NON_ROLE_RE = /^(?:удал[её]нно|работа\s+на\s+удал[её]н\p{L}*\s+основе|remote|onlayn|online|farqi\s+yo['’ʻʼ‘`]?q|bilmaym\p{L}*|ish\s+ker(?:e|a)\s+onlayn|любая\s+(?:работа|занятость)|немає|нет|не\s+указано|not\s+specified)$/iu

function normalizeCandidateEducation(profile: CvProfile, text: string): string | null | undefined {
  const raw = profile.education?.trim() || ''
  const withoutPreviewBoilerplate = raw.replace(/\s*[·|]\s*Location:\s*[\s\S]*$/iu, '').trim()
  if (withoutPreviewBoilerplate && !EMPLOYMENT_AS_EDUCATION_RE.test(withoutPreviewBoilerplate)) return withoutPreviewBoilerplate
  if (profile.sourceKey?.startsWith('flagma')) {
    const demographics = text.match(
      /\|\s*([^\n|]{0,120}(?:образован\p{L}*|освіт\p{L}*|studii|ta(?:['’])?lim)[^\n|]{0,120})/iu,
    )?.[1]?.trim()
    if (demographics && !EMPLOYMENT_AS_EDUCATION_RE.test(demographics)) return demographics
    const shortDemographics = text.match(/\|\s*([^\n|]{2,80})/u)?.[1]?.trim()
    if (shortDemographics && /(?:высш|средн|бакалавр|магистр|колледж|лицей|образован)/iu.test(shortDemographics)) {
      return shortDemographics
    }
  }
  return raw ? null : profile.education
}

function validStoredContact(value: string | null | undefined): string | null {
  const raw = value?.trim() || ''
  if (!raw) return null
  if (/^https?:\/\//iu.test(raw) || /^@[A-Za-z0-9_]{4,32}$/u.test(raw) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15 ? raw : null
}

function normalizeMixedScriptName(value: string): string {
  if ((value.match(/\p{Script=Cyrillic}/gu) || []).length < 2) return value
  const confusables: Record<string, string> = {
    A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  }
  return value.replace(/[ABCEHKMOPTXY]/g, (letter) => confusables[letter] || letter)
}

function normalizeCandidateNameCase(value: string): string {
  if (!value || value !== value.toLocaleLowerCase('ru') || !/\p{L}/u.test(value)) return value
  return value.replace(/(^|[\s-])(\p{L})/gu, (_match, boundary: string, letter: string) => (
    `${boundary}${letter.toLocaleUpperCase('ru')}`
  ))
}

export function normalizeCandidate(profile: CvProfile): CvProfile {
  // Repair rows parsed before Material Icon ligatures were removed from the
  // source HTML. Underscored glyph names are presentation markup, not CV text.
  const rawSourceText = stripUiArtifacts(profile.originalText || profile.description || '')
  const originalText = sourceProfileText(profile, rawSourceText)
  const goalRole = extractGoalRole(originalText)
  const sourceRole = profile.sourceKey === 'careerist-uz' ? careeristRoleFromText(originalText) : null
  const rawEffectiveRoleCandidate = cleanRole(goalRole || sourceRole || profile.role)
  const roleDuplicatesName = Boolean(comparableRoleText(rawEffectiveRoleCandidate))
    && comparableRoleText(rawEffectiveRoleCandidate) === comparableRoleText(profile.name)
  const rawEffectiveRole = roleDuplicatesName ? '' : rawEffectiveRoleCandidate
  const flexibleRole = FLEXIBLE_ROLE_RE.test(rawEffectiveRole)
  const effectiveRole = flexibleRole ? 'Any Role' : NON_ROLE_RE.test(rawEffectiveRole) ? '' : rawEffectiveRole
  // Repair already-stored rows where a loose adapter saved the whole labelled
  // line ("familya: ...") as the name. New parses and old data then converge.
  const rawName = profile.name?.trim() || ''
  const roleAsName = profile.origin === 'web' && rawName.split(/\s+/u).length <= 3
    && collectProfessions(rawName).length > 0
  const nameCandidate = rawName && !HIDDEN_NAME_RE.test(rawName) && !roleAsName
    ? extractCandidateName(rawName) || rawName
    : extractCandidateName(originalText)
  const name = normalizeCandidateNameCase(normalizeMixedScriptName(HIDDEN_NAME_RE.test(nameCandidate) ? '' : nameCandidate))
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 100)
  const text = `${name}\n${effectiveRole || ''}\n${originalText}`
  const extractedContacts = extractContacts(text)
  const contacts = {
    ...(extractedContacts.telegram ? { telegram: extractedContacts.telegram } : {}),
    ...(extractedContacts.email ? { email: extractedContacts.email } : {}),
    ...(extractedContacts.phone ? { phone: extractedContacts.phone } : {}),
    ...(profile.contacts || {}),
  }
  // AI-enriched/current structured professions must survive subsequent feed and
  // Elasticsearch normalization. Only derive from free text when none exist.
  const providedProfessions = profile.sourceKey === 'careerist-uz' || flexibleRole || !effectiveRole
    ? []
    : normalizeProvidedProfessions(profile.professions)
  const professions = providedProfessions.length
    ? providedProfessions
    : normalizeProfessions(effectiveRole, originalText)
  const storedAge = profile.age != null && profile.age >= 14 && profile.age <= 90 ? profile.age : null
  const age = storedAge ?? extractAge(originalText)
  const parsedEmploymentTypes = normalizeEmploymentTypes(originalText, profile.employmentType)
  const employmentTypes = profile.sourceKey?.startsWith('flagma')
    ? parsedEmploymentTypes
    : profile.employmentTypes?.length ? profile.employmentTypes : parsedEmploymentTypes
  const relevantExperience = normalizeRelevantExperience(profile.experienceYears, professions, originalText)
  // Month-based durations (20 years 4 months) are repeating IEEE fractions.
  // One decimal is enough for the source precision and keeps JSON/UI readable.
  const experienceYears = relevantExperience == null ? null : Number(relevantExperience.toFixed(1))
  const storedCity = profile.city == null ? profile.city : stripUiArtifacts(profile.city) || null
  const city = profile.sourceKey === 'ishbor-uz'
    ? ishBorLocationFromText(rawSourceText) || storedCity
    : storedCity
  const remote = normalizeRemotePreference(profile.remote, originalText, profile.origin)
  const extractedSalary = profile.sourceKey === 'careerist-uz'
    ? parseWebSalary(originalText, profile.country)
    : profile.salaryMin == null && profile.salaryMax == null
      ? extractCandidateSalary(originalText, profile.country)
      : {}
  const replaceStoredSalary = profile.sourceKey === 'careerist-uz' && extractedSalary.salaryMin != null
  const salaryMin = replaceStoredSalary ? extractedSalary.salaryMin : profile.salaryMin ?? extractedSalary.salaryMin
  const salaryMax = replaceStoredSalary ? extractedSalary.salaryMax : profile.salaryMax ?? extractedSalary.salaryMax
  const currency = replaceStoredSalary ? extractedSalary.currency : profile.currency ?? extractedSalary.currency
  const education = normalizeCandidateEducation(profile, originalText)
  const gender = profile.gender === 'male' || profile.gender === 'female'
    ? profile.gender
    : extractCandidateGender(originalText)

  return {
    ...profile,
    name,
    originalText,
    description: sourceProfileText(profile, profile.description || originalText),
    role: professions[0] || (effectiveRole ? normalizeRole(effectiveRole, originalText) : ''),
    professions,
    previousProfessions: profile.previousProfessions?.length
      ? normalizeProvidedProfessions(profile.previousProfessions)
      : normalizePreviousProfessions(originalText),
    features: [...new Set([...(profile.features || []), ...extractCandidateFeatures(originalText)])],
    age,
    gender,
    isAdult: age == null ? true : age >= 18,
    experienceYears,
    city,
    education,
    salaryMin,
    salaryMax,
    currency,
    remote,
    relocationReady: profile.relocationReady ?? detectRelocationReady(originalText),
    employmentTypes,
    skills: normalizedCandidateSkills(profile, originalText),
    seniority: profile.seniority ?? detectSeniority(text, experienceYears),
    contact: validStoredContact(profile.contact) || contacts.telegram || contacts.email || contacts.phone
      || (profile.contactType === 'platform' ? profile.url : null),
    contactHours: profile.contactHours ?? extractContactHours(originalText),
    contacts,
  }
}

function fingerprint(profile: CvProfile): string {
  const contact = profile.contacts?.telegram || profile.contacts?.email || profile.contacts?.phone
  if (contact) return `c:${contact.toLowerCase()}`
  const name = (profile.name || '').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
  if (profile.origin === 'web' && name.length >= 4 && !HIDDEN_NAME_RE.test(profile.name || '')) {
    const source = (profile.sourceKey || profile.source || '').toLocaleLowerCase('ru')
    const city = (profile.city || '').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
    const professions = [...(profile.professions || [])].sort().join(',').toLocaleLowerCase('en')
    const salary = `${profile.salaryMin ?? ''}:${profile.salaryMax ?? ''}:${profile.currency || ''}`
    return `p:${source}:${name}:${city}:${profile.age ?? ''}:${professions}:${salary}`
  }
  const text = `${(profile.professions || []).join(' ')} ${profile.role || ''} ${profile.originalText || profile.description || ''}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-zа-яёіїґ0-9]+/g, '')
    .slice(0, 400)
  if (text.length >= 40) return `t:${text}`
  return `k:${profile.source}:${profile.id}`
}

export function dedupeCandidates(profiles: CvProfile[]): CvProfile[] {
  const best = new Map<string, CvProfile>()
  for (const profile of profiles) {
    const key = fingerprint(profile)
    const current = best.get(key)
    if (!current) {
      best.set(key, profile)
      continue
    }
    const a = Date.parse(profile.createdAt || '') || 0
    const b = Date.parse(current.createdAt || '') || 0
    if (a > b) best.set(key, profile)
  }
  return [...best.values()]
}
