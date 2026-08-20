// CV/resume profiles posted by candidates (people looking for work).
// This is intentionally separate from the /jobs vacancy aggregator.

import type { Seniority } from './jobTypes'

export type HiringSource = 'telegram'

export const HIRING_SOURCES: HiringSource[] = ['telegram']

export interface CvProfile {
  id: string
  source: HiringSource
  country: string
  /** Candidate full name when present in the source. Empty when not provided. */
  name: string
  /** Primary normalized profession/headline. Kept for backwards compatibility. */
  role: string
  /** All normalized professions the candidate is explicitly looking for. */
  professions?: string[]
  /** Candidate circumstances useful to employers, e.g. Student or Parental leave. */
  features?: string[]
  experienceYears?: number | null
  /** Expected compensation when the candidate mentions it. */
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  city?: string | null
  district?: string | null
  remote?: boolean | null
  photo?: string | null
  photos?: string[]
  /** Canonical link to the original Telegram message. */
  url: string
  createdAt: string | null
  /** Original message text, preserved verbatim apart from Telegram HTML decoding. */
  originalText: string
  /** Search/display copy; currently the same source text as originalText. */
  description: string
  skills?: string[]
  languages?: string[]
  education?: string | null
  tags?: string[]
  contact?: string | null
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
