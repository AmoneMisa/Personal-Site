import type { Seniority } from './jobs'

export type HiringSource = 'telegram' | (string & {})
export type CandidateOrigin = 'telegram' | 'web' | 'facebook' | 'threads' | 'linkedin'
export type CandidateEmploymentType = 'full_time' | 'part_time'
export type CandidateContactType = 'direct' | 'platform'
export type CandidateGender = 'male' | 'female' | 'unknown'

export interface ProfessionExperience {
  profession: string
  years: number
}

export const HIRING_SOURCES: HiringSource[] = ['telegram']

export interface CvProfile {
  id: string
  source: HiringSource
  origin?: CandidateOrigin
  sourceKey?: string
  sourceLabel?: string
  derived?: string
  country: string
  sourceCountry?: string
  name: string
  role: string
  professions?: string[]
  previousProfessions?: string[]
  professionExperience?: ProfessionExperience[]
  features?: string[]
  age?: number | null
  gender?: CandidateGender
  isAdult?: boolean
  experienceYears?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  city?: string | null
  district?: string | null
  remote?: boolean | null
  relocationReady?: boolean | null
  employmentTypes?: CandidateEmploymentType[]
  photo?: string | null
  photos?: string[]
  url: string
  publishedAt?: string | null
  updatedAt?: string | null
  activityAt?: string | null
  createdAt: string | null
  originalText: string
  description: string
  skills?: string[]
  languages?: string[]
  education?: string | null
  tags?: string[]
  contact?: string | null
  contactHours?: string | null
  contactType?: CandidateContactType
  employmentType?: string | null
  seniority?: Seniority | null
  contacts?: { telegram?: string; email?: string; phone?: string }
  score?: number
}

export interface CountryMeta {
  code: string
  name: string
  currency: string
  cities?: string[]
}
