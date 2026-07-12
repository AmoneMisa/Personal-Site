// Shared job model + query types for the jobFinder aggregator.

export type WorkMode = 'remote' | 'hybrid' | 'office' | 'unknown'
export type Relocation = 'offered' | 'none' | 'unknown'
export type SalaryPeriod = 'hour' | 'month' | 'year'

export interface LanguageReq {
  language: string // e.g. "English"
  level?: string // e.g. "B2", "Fluent"
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

  // --- derived by enrich.ts (best-effort, inferred from text) ---
  country?: string // ISO-2 code, or 'REMOTE' / 'OTHER'
  workMode?: WorkMode
  relocation?: Relocation
  foreignerFriendly?: boolean // visa sponsorship / open to foreigners
  languages?: LanguageReq[]
  skills?: string[]
  niceToHave?: string[] // "will be a plus"
  salaryPeriod?: SalaryPeriod // detected pay period of salaryMin/salaryMax (best-effort)
  salaryUsd?: number // normalized ANNUAL midpoint in USD for stats/sort (undefined if no salary)
}

export type JobSource =
  | 'remotive'
  | 'remoteok'
  | 'arbeitnow'
  | 'headhunter'
  | 'themuse'
  | 'jobicy'
  | 'adzuna'
  | 'jooble'
  | 'rss'
  | 'companies'

export const FREE_SOURCES: JobSource[] = [
  'remotive',
  'remoteok',
  'arbeitnow',
  'headhunter',
  'themuse',
  'jobicy',
]

export const OPTIONAL_SOURCES: JobSource[] = ['adzuna', 'jooble', 'rss', 'companies']

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
  includeRu?: boolean // opt-in to Russia postings (excluded by default)
  includeBy?: boolean // opt-in to Belarus postings (excluded by default)
  workMode?: WorkMode
  relocation?: Relocation
  foreignerFriendly?: boolean
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
}
