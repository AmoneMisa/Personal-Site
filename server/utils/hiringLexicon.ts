import {
  CANDIDATE_FIELD_TERMS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_REQUIREMENTS,
  GEOGRAPHY_CITIES,
  HIRING_INTENT,
  HIRING_INTENT_EXTENSIONS,
  KZ_CITY_CATALOG,
  PROBATION_TERMS,
  SCHEDULE_TERMS,
  UA_CITY_CATALOG,
  UZ_CITY_CATALOG,
  WORK_MODES,
  WORK_SCHEDULE_EXTENSIONS,
  aliasesOf,
  aliasesToRegex,
  canonicalCountryCode,
  canonicalTashkentDistrict,
  classifyHiringIntent,
  classifyHiringMessage,
  findCanonical,
  matchSeniority,
  parseExperience,
  parseHiringContext,
  parseLanguageContext,
  parseSalary,
  resolveProfessionContext,
} from '@whiteslove/parsing-lexicon'
import {
  matchExtendedProfessions,
  matchesSourceCandidateIntent,
} from '@whiteslove/parsing-lexicon/hiring-source-aliases'
import type { CandidateEmploymentType, CandidateWorkMode } from '../../shared/contracts/hiring'

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

const HIRING_CITIES = [
  ...GEOGRAPHY_CITIES.filter((city) => !['UA', 'KZ', 'UZ'].includes(city.country || '')),
  ...KZ_CITY_CATALOG,
  ...UZ_CITY_CATALOG,
  ...UA_CITY_CATALOG,
]

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const cityInflectionRegex = (aliases: readonly string[]) => {
  const cyrillic = [...new Set(aliases.filter((alias) => /\p{Script=Cyrillic}/u.test(alias)))]
  if (!cyrillic.length) return null
  const patterns = cyrillic.map((alias) => {
    const maxSuffix = alias.replace(/[^\p{L}\p{N}]/gu, '').length > 3 ? 5 : 3
    return `${escapeRegex(alias)}(?:\\p{Script=Cyrillic}{0,${maxSuffix}})`
  })
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${patterns.join('|')})(?![\\p{L}\\p{N}])`, 'iu')
}

const CITY_MATCHERS = HIRING_CITIES.map((city) => {
  const aliases = [city.canonical, ...aliasesOf(city)]
  return {
    city,
    exact: aliasesToRegex(aliases),
    inflected: cityInflectionRegex(aliases),
  }
})

export function detectLexiconCity(text: string, country?: string | null): string | null {
  const code = country ? canonicalCountryCode(country) : null
  return CITY_MATCHERS.find(({ city, exact, inflected }) =>
    (!code || city.country === code) && (exact.test(text) || Boolean(inflected?.test(text))),
  )?.city.canonical || null
}

export function detectLexiconDistrict(text: string, city?: string | null): string | null {
  return city === 'Tashkent' ? canonicalTashkentDistrict(text) : null
}

export function normalizeHiringCountry(value: string | null | undefined): string | null {
  return value ? canonicalCountryCode(value) : null
}

const EMPLOYMENT_VALUE: Record<string, CandidateEmploymentType> = {
  fullTime: 'full_time',
  partTime: 'part_time',
  contract: 'contract',
  project: 'project',
  freelance: 'freelance',
  temporary: 'temporary',
  internship: 'internship',
  volunteer: 'volunteer',
  seasonal: 'seasonal',
}

export function detectEmploymentTypes(text: string): CandidateEmploymentType[] {
  const normalized = new Set<CandidateEmploymentType>()
  for (const entry of EMPLOYMENT_TYPES) {
    if (findCanonical(text, [entry], { partial: true })) {
      const value = EMPLOYMENT_VALUE[entry.canonical]
      if (value) normalized.add(value)
    }
  }
  return [...normalized]
}

export function detectWorkModes(text: string): CandidateWorkMode[] {
  const values = new Set<CandidateWorkMode>()
  for (const entry of WORK_MODES) {
    if (findCanonical(text, [entry], { partial: true })) values.add(entry.canonical as CandidateWorkMode)
  }
  return [...values]
}

export type WorkSchedule =
  | 'fiveTwo' | 'twoTwo' | 'sixOne' | 'threeThree' | 'oneThree' | 'twentyFourFortyEight'
  | 'shift' | 'flexible' | 'day' | 'night' | 'rotational'

export function detectWorkSchedules(text: string): WorkSchedule[] {
  const values = new Set<WorkSchedule>()
  for (const entry of [...SCHEDULE_TERMS, ...WORK_SCHEDULE_EXTENSIONS]) {
    if (findCanonical(text, [entry], { partial: true })) values.add(entry.canonical as WorkSchedule)
  }
  return [...values]
}

export type ProbationKind = 'probation' | 'noProbation' | 'paidProbation' | 'unpaidProbation'
export function detectProbation(text: string): ProbationKind | null {
  for (const entry of Object.values(PROBATION_TERMS)) {
    if (findCanonical(text, [entry], { partial: true })) return entry.canonical as ProbationKind
  }
  return null
}

export function detectExperienceRequirement(text: string): 'noExperience' | 'experienceRequired' | null {
  const parsed = parseExperience(text)
  if (parsed?.requirement === 'none') return 'noExperience'
  if (parsed?.requirement === 'required') return 'experienceRequired'
  for (const entry of Object.values(EXPERIENCE_REQUIREMENTS)) {
    if (findCanonical(text, [entry], { partial: true })) return entry.canonical as 'noExperience' | 'experienceRequired'
  }
  return null
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

export function parseHiringSalary(text: string) {
  return parseSalary(text)
}

export function parseSharedLanguageContext(text: string, mode: 'vacancy' | 'candidate' | null = null) {
  return parseLanguageContext(text, { mode })
}

export function parseSharedHiringContext(text: string, options: { mode?: 'vacancy' | 'candidate' | null; title?: string } = {}) {
  return parseHiringContext(text, options)
}
