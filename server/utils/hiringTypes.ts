// CV/resume profiles posted by candidates (people looking for work).
// This is intentionally separate from the /jobs vacancy aggregator.

export type HiringSource = 'telegram'

export const HIRING_SOURCES: HiringSource[] = ['telegram']

export interface CvProfile {
  id: string
  source: HiringSource
  country: string
  /** Candidate full name when known. */
  name: string
  /** Target role / headline on the CV. */
  role: string
  experienceYears?: number | null
  /** Expected compensation when the CV mentions it. */
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  city?: string | null
  remote?: boolean | null
  photo?: string | null
  photos?: string[]
  url: string
  createdAt: string | null
  /** Full CV body (Telegram post text). */
  description: string
  skills?: string[]
  languages?: string[]
  education?: string | null
  tags?: string[]
  contact?: string | null
  employmentType?: string | null
}

export interface CountryMeta {
  code: string
  name: string
  currency: string
  cities?: string[]
}
