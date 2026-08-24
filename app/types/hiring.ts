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
