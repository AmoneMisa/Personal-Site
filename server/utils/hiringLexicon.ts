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
const COMPAT_MONEY_NUMBER = '(?:\\d{1,3}(?:[ \\u00a0]\\d{3})+(?:[.,]\\d+)?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)'
const COMPAT_RANGE_RE = new RegExp(`([$€£₴₽₺₾₩₹₼֏¥￥])?\\s*(${COMPAT_MONEY_NUMBER})\\s*(?:-|–|—|to)\\s*([$€£₴₽₺₾₩₹₼֏¥￥])?\\s*(${COMPAT_MONEY_NUMBER})\\s*(USD|EUR|GBP|UAH|RUB|TRY|GEL|KRW|INR|AZN|AMD|JPY|CNY)?`, 'giu')
const SALARY_CONTEXT_RE = /\b(?:salary|base\s+pay|pay\s+range|compensation|annual\s+pay|зарплат|оклад|оплат|компенсац)\b/i
const SYMBOL_CURRENCY: Record<string, string> = {
  '$': 'USD', '€': 'EUR', '£': 'GBP', '₴': 'UAH', '₽': 'RUB', '₺': 'TRY',
  '₾': 'GEL', '₩': 'KRW', '₹': 'INR', '₼': 'AZN', '֏': 'AMD', '¥': 'JPY', '￥': 'JPY',
}

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

function parseCompatMoneyNumber(raw: string): number | null {
  let value = raw.replace(/\u00a0/g, ' ').trim().replace(/\s+/g, '')
  if (!value) return null
  const comma = value.lastIndexOf(',')
  const dot = value.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.'
    value = decimal === ','
      ? value.replace(/\./g, '').replace(',', '.')
      : value.replace(/,/g, '')
  } else {
    const separator = comma >= 0 ? ',' : dot >= 0 ? '.' : null
    if (separator) {
      const escaped = separator === '.' ? '\\.' : ','
      const grouping = new RegExp(`^\\d{1,3}(?:${escaped}\\d{3})+$`)
      if (grouping.test(value)) value = value.split(separator).join('')
      else if (separator === ',') value = value.replace(',', '.')
    }
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compatPeriod(window: string): SalaryPeriod | undefined {
  if (/\b(?:annual|annually|yearly|per\s+year)\b/i.test(window)) return 'year'
  if (/\b(?:hourly|per\s+hour)\b/i.test(window)) return 'hour'
  if (/\b(?:monthly|per\s+month)\b/i.test(window)) return 'month'
  if (/\b(?:weekly|per\s+week)\b/i.test(window)) return 'week'
  if (/\b(?:daily|per\s+day)\b/i.test(window)) return 'day'
  return undefined
}

function explicitSalaryRange(text: string): { min: number; max: number; currency?: string; period?: SalaryPeriod } | null {
  COMPAT_RANGE_RE.lastIndex = 0
  let best: { min: number; max: number; currency?: string; period?: SalaryPeriod; score: number; start: number } | null = null
  for (const match of text.matchAll(COMPAT_RANGE_RE)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    const window = text.slice(Math.max(0, start - 70), Math.min(text.length, end + 70))
    const code = match[5]?.toUpperCase()
    const symbol = match[1] || match[3]
    const hasCurrency = Boolean(code || symbol)
    const hasSalaryContext = SALARY_CONTEXT_RE.test(window)
    if (!hasCurrency && !hasSalaryContext) continue

    const first = parseCompatMoneyNumber(match[2])
    const second = parseCompatMoneyNumber(match[4])
    if (first == null || second == null) continue
    const min = Math.min(first, second)
    const max = Math.max(first, second)
    const score = (hasCurrency ? 6 : 0) + (hasSalaryContext ? 5 : 0) + (compatPeriod(window) ? 2 : 0)
    const candidate = { min, max, currency: code || (symbol ? SYMBOL_CURRENCY[symbol] : undefined), period: compatPeriod(window), score, start }
    if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.start < best.start)) best = candidate
  }
  return best ? { min: best.min, max: best.max, currency: best.currency, period: best.period } : null
}

export function parseHiringSalary(text: string) {
  const normalized = normalizeSalaryRangeForInstalledLexicon(text)
  const parsed = parseHiringSalaryWithContext(normalized, { currencyFallback: 'language' })
  const explicitRange = explicitSalaryRange(text)
  const leakedPeriod = leakedJobsSalaryPeriod(text)

  if (!parsed && !explicitRange) return parsed
  if (!explicitRange) {
    if (!leakedPeriod || parsed?.period === leakedPeriod) return parsed
    return Object.freeze({ ...parsed, period: leakedPeriod })
  }

  return Object.freeze({
    ...(parsed || {
      gross: null,
      negotiable: false,
      approximate: false,
      currencySource: explicitRange.currency ? 'explicit' : 'unknown',
      currencyCountry: null,
    }),
    min: explicitRange.min,
    max: explicitRange.max,
    currency: explicitRange.currency || parsed?.currency || null,
    period: leakedPeriod || explicitRange.period || parsed?.period || null,
    currencySource: explicitRange.currency ? 'explicit' : parsed?.currencySource || 'unknown',
  })
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
