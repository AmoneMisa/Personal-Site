// Runtime-neutral jobs domain and transport contracts shared by Nuxt and workers.

export type RiskCategory = 'gambling' | 'adult' | 'scam'
export type WorkMode = 'remote' | 'hybrid' | 'office' | 'unknown'
export type Relocation = 'offered' | 'none' | 'unknown'
export type SalaryPeriod = 'hour' | 'month' | 'year'
export type Seniority = 'intern' | 'junior' | 'middle' | 'senior' | 'staff' | 'principal' | 'lead'
export type EmployerType = 'direct' | 'agency' | 'board' | 'telegram'
export type SponsorshipConfidence = 'explicit' | 'verified' | 'historical'
export type EmploymentKind = 'fulltime' | 'parttime' | 'contract' | 'internship' | 'temporary'

export const EMPLOYMENT_KINDS: EmploymentKind[] = [
  'fulltime',
  'parttime',
  'contract',
  'internship',
  'temporary',
]

export interface LanguageReq {
  language: string
  level?: string
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
  postedAt: string
  description?: string
  employmentType?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  applyUrl?: string
  country?: string
  city?: string
  workMode?: WorkMode
  relocation?: Relocation
  foreignerFriendly?: boolean
  sponsorshipConfidence?: SponsorshipConfidence
  sponsorshipEvidence?: string[]
  noExperience?: boolean
  employmentKind?: EmploymentKind
  languages?: LanguageReq[]
  skills?: string[]
  niceToHave?: string[]
  skillDetails?: JobSkillDetail[]
  niceToHaveDetails?: JobSkillDetail[]
  experienceMinYears?: number
  experienceMaxYears?: number
  salaryPeriod?: SalaryPeriod
  salaryUsd?: number
  salaryGross?: boolean
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
  riskCategory?: RiskCategory | null
  riskReasons?: string[]
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
  | 'linkedin'
  | 'facebook'
  | 'threads'
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
  'linkedin',
  'facebook',
  'threads',
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
  countries: string[]
  cities: string[]
  includeRu?: boolean
  includeBy?: boolean
  workMode?: WorkMode
  relocation?: Relocation
  employmentKind?: EmploymentKind
  hasSalary?: boolean
  maxExperienceYears?: number
  foreignerFriendly?: boolean
  hideRiskyIndustries?: boolean
  noExperience?: boolean
  language?: string
  languageLevel?: string
  excludeLanguages: string[]
  skills: string[]
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
  rates?: Record<string, number>
}
