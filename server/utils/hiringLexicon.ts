import {
  CANDIDATE_FIELD_TERMS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_REQUIREMENTS,
  GEOGRAPHY_CITIES,
  HIRING_INTENT,
  PROBATION_TERMS,
  SCHEDULE_TERMS,
  UA_CITY_CATALOG,
  WORK_MODES,
  aliasesOf,
  aliasesToRegex,
  canonicalCountryCode,
  findCanonical,
} from '@whiteslove/parsing-lexicon'

const matcher = (entry: { canonical?: string; aliases?: Record<string, readonly string[]> }) =>
  aliasesToRegex([entry.canonical || '', ...aliasesOf(entry)].filter(Boolean))

export const SHARED_CANDIDATE_INTENT_RE = matcher(HIRING_INTENT.candidate)
export const SHARED_EMPLOYER_INTENT_RE = matcher(HIRING_INTENT.employer)

export function candidateFieldRegex(key: keyof typeof CANDIDATE_FIELD_TERMS): RegExp {
  return matcher(CANDIDATE_FIELD_TERMS[key])
}

const HIRING_CITIES = [
  ...GEOGRAPHY_CITIES.filter((city) => city.country !== 'UA'),
  ...UA_CITY_CATALOG,
]
const CITY_MATCHERS = HIRING_CITIES.map((city) => ({
  city,
  re: aliasesToRegex([city.canonical, ...aliasesOf(city)]),
}))

export function detectLexiconCity(text: string, country?: string | null): string | null {
  const code = country ? canonicalCountryCode(country) : null
  return CITY_MATCHERS.find(({ city, re }) => (!code || city.country === code) && re.test(text))?.city.canonical || null
}

export function normalizeHiringCountry(value: string | null | undefined): string | null {
  return value ? canonicalCountryCode(value) : null
}

export type CandidateEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'project'
  | 'freelance'
  | 'temporary'
  | 'internship'
  | 'volunteer'
  | 'seasonal'

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

export type WorkMode = 'remote' | 'hybrid' | 'onsite'
export function detectWorkModes(text: string): WorkMode[] {
  const values = new Set<WorkMode>()
  for (const entry of WORK_MODES) {
    if (findCanonical(text, [entry], { partial: true })) values.add(entry.canonical as WorkMode)
  }
  return [...values]
}

export type WorkSchedule = 'fiveTwo' | 'twoTwo' | 'shift' | 'flexible' | 'day' | 'night' | 'rotational'
export function detectWorkSchedules(text: string): WorkSchedule[] {
  const values = new Set<WorkSchedule>()
  for (const entry of SCHEDULE_TERMS) {
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
  for (const entry of Object.values(EXPERIENCE_REQUIREMENTS)) {
    if (findCanonical(text, [entry], { partial: true })) return entry.canonical as 'noExperience' | 'experienceRequired'
  }
  return null
}
