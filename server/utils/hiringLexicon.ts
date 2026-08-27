import {
  CANDIDATE_FIELD_TERMS,
  HIRING_INTENT,
  HIRING_INTENT_EXTENSIONS,
  aliasesOf,
  aliasesToRegex,
  canonicalCountryCode,
  canonicalTashkentDistrict,
  classifyHiringIntent,
  classifyHiringMessage,
  matchSeniority,
  parseExperience,
  parseHiringContext,
  parseLanguageContext,
  resolveProfessionContext,
} from '@whiteslove/parsing-lexicon'
import { detectCityFromText } from '@whiteslove/parsing-lexicon/geography-detection'
import { parseHiringSalaryWithContext } from '@whiteslove/parsing-lexicon/hiring-salary-context'
import {
  matchExtendedProfessions,
  matchesSourceCandidateIntent,
} from '@whiteslove/parsing-lexicon/hiring-source-aliases'
import {
  detectEmploymentTypes as detectSharedEmploymentTypes,
  detectExperienceRequirement as detectSharedExperienceRequirement,
  detectProbation as detectSharedProbation,
  detectWorkModes as detectSharedWorkModes,
  detectWorkSchedules as detectSharedWorkSchedules,
  type HiringProbationKind,
  type HiringWorkSchedule,
} from '@whiteslove/parsing-lexicon/hiring-work-semantics'
import type { CandidateEmploymentType, CandidateWorkMode } from '../../shared/contracts/hiring'
import type { SalaryPeriod } from '../../shared/contracts/jobs'

export {
  detectCountryCodeFromText as resolveSharedCountryFromText,
} from '@whiteslove/parsing-lexicon/geography-detection'
export {
  detectCandidateFeatureCodes,
  detectCandidateProfessionLabels,
  detectCandidateRelocationPreference,
  detectCandidateRemotePreference,
  detectDegreeRequirement as detectSharedDegreeRequirement,
  detectHiringScopeSignals as detectSharedHiringScopeSignals,
  detectManagementRole as detectSharedManagementRole,
  extractCandidateContactHours,
  extractCandidateGoalField,
  extractCandidateGoalRole,
  extractCandidateLocationField,
  extractCandidateRoleField,
  extractCandidateSalaryField,
  extractCandidateSkillField,
  extractCandidateTargetContext,
  extractCandidateWorkHistory,
  isCandidateNonRoleValue,
  isCandidateNonTargetContext,
  isCandidateStatusOnly,
  isFlexibleCandidateRole,
} from '@whiteslove/parsing-lexicon/hiring-semantics'

const matcher = (entry: { canonical?: string; aliases?: Record<string, readonly string[]> }) =>
  aliasesToRegex([entry.canonical || '', ...aliasesOf(entry)].filter(Boolean))

export const SHARED_CANDIDATE_INTENT_RE = aliasesToRegex([
  HIRING_INTENT.candidate.canonical,
  ...aliasesOf(HIRING_INTENT.candidate),
  HIRING_INTENT_EXTENSIONS.candidate.canonical,
  ...aliasesOf(HIRING_INTENT_EXTENSIONS.candidate),
].filter(Boolean))
export const SHARED_EMPLOYER_INTENT_RE = matcher(HIRING_INTENT.employer)

export function candidateFieldRegex(key: keyof typeof CANDIDATE_FIELD_TERMS): RegExp {
  return matcher(CANDIDATE_FIELD_TERMS[key])
}

export function detectLexiconCity(text: string, country?: string | null): string | null {
  return detectCityFromText(text, country)?.canonical || null
}

export function detectLexiconDistrict(text: string, city?: string | null): string | null {
  return city === 'Tashkent' ? canonicalTashkentDistrict(text) : null
}

export function normalizeHiringCountry(value: string | null | undefined): string | null {
  return value ? canonicalCountryCode(value) : null
}

export function detectEmploymentTypes(text: string): CandidateEmploymentType[] {
  return [...detectSharedEmploymentTypes(text)] as CandidateEmploymentType[]
}

export function detectWorkModes(text: string): CandidateWorkMode[] {
  return [...detectSharedWorkModes(text)] as CandidateWorkMode[]
}

export type WorkSchedule = HiringWorkSchedule
export function detectWorkSchedules(text: string): WorkSchedule[] {
  return [...detectSharedWorkSchedules(text)]
}

export type ProbationKind = HiringProbationKind
export function detectProbation(text: string): ProbationKind | null {
  return detectSharedProbation(text)
}

export function detectExperienceRequirement(text: string): 'noExperience' | 'experienceRequired' | null {
  return detectSharedExperienceRequirement(text)
}

function hasExtendedCandidateIntent(text: string): boolean {
  return SHARED_CANDIDATE_INTENT_RE.test(text) || matchesSourceCandidateIntent(text)
}

export function detectHiringIntent(text: string) {
  const parsed = classifyHiringIntent(text)
  if (parsed.intent || !hasExtendedCandidateIntent(text)) return parsed
  return { ...parsed, intent: 'candidate' as const, score: Math.max(parsed.score || 0, 0.9) }
}

export function classifySharedHiringMessage(text: string) {
  const kind = classifyHiringMessage(text)
  return kind === 'unknown' && hasExtendedCandidateIntent(text) ? 'candidate' : kind
}

const DISPLAY_CANONICAL_OVERRIDES: Record<string, string> = {
  oil_gas_worker: 'oil_&_gas_worker',
  finance_banking_specialist: 'finance_/_banking_specialist',
  it_specialist: 'IT_specialist',
  logistics_manager: 'logistics_specialist',
}

export function detectProfessionMatches(text: string, limit = 8) {
  return matchExtendedProfessions(text, { limit }).map((match) => ({
    ...match,
    canonical: DISPLAY_CANONICAL_OVERRIDES[match.canonical] || match.canonical,
  }))
}

export function resolveSharedProfessionContext(text: string, options: { mode?: 'vacancy' | 'candidate' | null; title?: string } = {}) {
  return resolveProfessionContext(text, options)
}

export function detectSharedSeniority(text: string) {
  return matchSeniority(text)?.canonical || null
}

export function parseHiringExperience(text: string) {
  return parseExperience(text)
}

const JOBS_I18N_PERIOD_RE = /\bjobs\.per(hour|day|shift|week|month|year|project|piece)\b/i
const DUPLICATED_RANGE_CURRENCY_RE = /([–—-])\s*([$€£₴₽₺₾₩₹₼֏¥￥])\s*(?=\d)/g
const EXPLICIT_POSITIVE_VISA_SPONSORSHIP_RE = /\bwe\s+do\s+sponsor\s+visas?\b/i

function leakedJobsSalaryPeriod(text: string): SalaryPeriod | undefined {
  const raw = text.match(JOBS_I18N_PERIOD_RE)?.[1]?.toLowerCase()
  if (!raw) return undefined
  return raw as SalaryPeriod
}

function normalizeSalaryRangeForInstalledLexicon(text: string): string {
  // parsing-lexicon <= 0.2.7 can parse "$55 — 65" but a repeated symbol before
  // the upper bound interrupts its numeric range matcher. Keep the first symbol
  // for currency detection and remove only the redundant second symbol.
  return text.replace(DUPLICATED_RANGE_CURRENCY_RE, '$1 ')
}

export function parseHiringSalary(text: string) {
  const normalized = normalizeSalaryRangeForInstalledLexicon(text)
  const parsed = parseHiringSalaryWithContext(normalized, { currencyFallback: 'language' })
  if (!parsed) return parsed
  const leakedPeriod = leakedJobsSalaryPeriod(text)
  if (!leakedPeriod || parsed.period === leakedPeriod) return parsed
  return Object.freeze({ ...parsed, period: leakedPeriod })
}

export function parseSharedLanguageContext(text: string, mode: 'vacancy' | 'candidate' | null = null) {
  return parseLanguageContext(text, { mode })
}

export function parseSharedHiringContext(text: string, options: { mode?: 'vacancy' | 'candidate' | null; title?: string } = {}) {
  const parsed = parseHiringContext(text, options)
  if (!EXPLICIT_POSITIVE_VISA_SPONSORSHIP_RE.test(text) || parsed.workAuthorization.includes('sponsorshipOffered')) return parsed
  return Object.freeze({
    ...parsed,
    workAuthorization: Object.freeze([...parsed.workAuthorization, 'sponsorshipOffered']),
  })
}