// Shared job model + query types for the jobFinder aggregator.

import type { RiskCategory } from './suspicious'
export type { RiskCategory }

export type WorkMode = 'remote' | 'hybrid' | 'office' | 'unknown'
export type Relocation = 'offered' | 'none' | 'unknown'
export type SalaryPeriod = 'hour' | 'month' | 'year'
export type Seniority = 'junior' | 'middle' | 'senior' | 'lead'
export type EmployerType = 'direct' | 'agency' | 'board' | 'telegram'
// Normalized employment type. "project"/freelance/B2B collapse into 'contract'.
export type EmploymentKind = 'fulltime' | 'parttime' | 'contract' | 'internship' | 'temporary'
export const EMPLOYMENT_KINDS: EmploymentKind[] = [
  'fulltime',
  'parttime',
  'contract',
  'internship',
  'temporary',
]

export interface LanguageReq {
  language: string // e.g. "English"
  level?: string // e.g. "B2", "Fluent"
}

export interface JobSkillDetail {
  name: string
  category: string
  subcategory: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  url: string
  source: JobSource
  remote: boolean
  tags: string[]
  postedAt: string // ISO 8601
  description?: string
  employmentType?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  applyUrl?: string

  // --- derived by enrich.ts (best-effort, inferred from text) ---
  country?: string // ISO-2 code, or 'REMOTE' / 'OTHER'
  city?: string
  workMode?: WorkMode
  relocation?: Relocation
  foreignerFriendly?: boolean // visa sponsorship / open to foreigners
  noExperience?: boolean // entry-level: no prior experience required (trainee/intern/junior/"без опыта")
  employmentKind?: EmploymentKind // normalized from employmentType + text
  languages?: LanguageReq[]
  skills?: string[]
  niceToHave?: string[] // "will be a plus"
  skillDetails?: JobSkillDetail[]
  niceToHaveDetails?: JobSkillDetail[]
  experienceMinYears?: number // minimum required professional experience
  experienceMaxYears?: number // maximum stated experience range, when present
  salaryPeriod?: SalaryPeriod // detected pay period of salaryMin/salaryMax (best-effort)
  salaryUsd?: number // normalized ANNUAL midpoint in USD for stats/sort (undefined if no salary)
  salaryGross?: boolean // true = gross/before tax, false = net/after tax
  salaryNegotiable?: boolean
  seniority?: Seniority | null
  managementRole?: boolean
  education?: string
  schedule?: string
  contractType?: string
  deadline?: string
  tools?: string[]
  applicationLanguage?: string
  employerType?: EmployerType
  // Hard-blocked industry (gambling / adult / scam). Hidden by default in the
  // Job Finder; riskReasons records why, so the decision stays auditable.
  riskCategory?: RiskCategory | null
  riskReasons?: string[]
  // Soft warning: the posting never makes clear what the work actually is.
  // Shown as a badge only — it never removes the vacancy on its own.
  suspicious?: boolean
  suspicionReasons?: string[]
}

export type JobSource =
  | 'remotive'
  | 'remoteok'
  | 'arbeitnow'
  | 'themuse'
  | 'jobicy'
  | 'adzuna'
  | 'jooble'
  | 'rss'
  | 'companies'
  | 'devkg'
  | 'ishgo'
  | 'itjobsuz'
  | 'telegram'
  | 'olx'

export const FREE_SOURCES: JobSource[] = [
  'remotive',
  'remoteok',
  'arbeitnow',
  'themuse',
  'jobicy',
  'devkg',
  'telegram',
]

export const OPTIONAL_SOURCES: JobSource[] = [
  'adzuna',
  'jooble',
  'rss',
  'companies',
  'ishgo',
  'itjobsuz',
  'olx',
]

export const ALL_SOURCES: JobSource[] = [...FREE_SOURCES, ...OPTIONAL_SOURCES]

export type SortKey = 'date' | 'oldest' | 'title' | 'company' | 'salary'

export interface JobQuery {
  q: string
  location: string
  remote?: boolean
  sources: JobSource[]
  sort: SortKey
  maxAgeDays: number
  salaryMin?: number
  page: number
  pageSize: number

  // --- new advanced filters ---
  countries: string[] // ISO-2 codes (any-of); empty = any country
  cities: string[] // free-text city/location terms (any-of), may span countries
  includeRu?: boolean // opt-in to Russia postings (excluded by default)
  includeBy?: boolean // opt-in to Belarus postings (excluded by default)
  workMode?: WorkMode
  relocation?: Relocation
  employmentKind?: EmploymentKind // full-time / part-time / contract(project) / internship / temporary
  hasSalary?: boolean // only vacancies that show a salary
  maxExperienceYears?: number // drop roles requiring MORE than this many years
  foreignerFriendly?: boolean
  // Hide gambling / adult / scam-bait postings. Defaults to TRUE — the query
  // parser opts out only on an explicit "false".
  hideRiskyIndustries?: boolean
  noExperience?: boolean // only entry-level / no-experience-required roles
  language?: string // e.g. "english"
  languageLevel?: string // e.g. "b2"
  excludeLanguages: string[] // drop vacancies requiring any of these languages
  skills: string[] // all must be present
}

export interface SalaryStat {
  count: number
  medianUsd: number
  avgUsd: number
  minUsd: number
  maxUsd: number
}

export interface JobStats {
  salary: SalaryStat
  bySource: Partial<Record<JobSource, { count: number; medianUsd: number }>>
  byCountry: Record<string, { count: number; medianUsd: number }>
  byWorkMode: Record<WorkMode, number>
  foreignerFriendly: number
  byLanguage: Record<string, number>
  topSkills: { skill: string; count: number }[]
}

export interface JobResponse {
  jobs: Job[]
  total: number
  page: number
  pageSize: number
  sources: Partial<Record<JobSource, number>>
  stats: JobStats
  // Live currency → USD rates (USD per 1 unit) used for this response, so the
  // client can convert/display salaries in sync with the server. Filled by the
  // route from the shared fx cache (server/utils/currency.ts).
  rates?: Record<string, number>
}
