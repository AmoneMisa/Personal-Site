export interface HiringCvProfile {
  id: string
  source: string
  origin?: string
  sourceKey?: string
  sourceLabel?: string
  country: string
  name: string
  role: string
  professions?: string[]
  age?: number | null
  gender?: 'male' | 'female' | 'unknown'
  seniority?: string | null
  experienceYears?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  city?: string | null
  district?: string | null
  remote?: boolean | null
  url: string
  createdAt: string | null
  description: string
  skills?: string[]
  languages?: string[]
  education?: string | null
  tags?: string[]
  contact?: string | null
  contactHours?: string | null
  employmentType?: string | null
}

export interface HiringFeedResult {
  count: number
  profiles: HiringCvProfile[]
  rates?: Record<string, number>
  warming?: boolean
  sourceCounts?: Record<string, number>
  sourceErrors?: Array<{ source?: string; country?: string; handle?: string; error?: string }>
  meta?: {
    professions?: string[]
    sources?: HiringSourceOption[]
  }
  error?: string
}

export interface HiringCountryMeta {
  code: string
  name: string
  currency: string
  cities?: string[]
}

export interface HiringSourceOption {
  value: string
  label: string
  origin?: string
}

export type HiringView = "active" | "favorites" | "recent" | "hidden"
export type HiringSort = "recent" | "name_asc" | "name_desc" | "experience_desc" | "experience_asc" | "age_asc" | "age_desc" | "salary_desc" | "salary_asc"

export const HIRING_SORTS: HiringSort[] = ["recent", "name_asc", "name_desc", "experience_desc", "experience_asc", "age_asc", "age_desc", "salary_desc", "salary_asc"]
