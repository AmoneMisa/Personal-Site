// CV/resume profiles posted by candidates (people looking for work).
// This is intentionally separate from the /jobs vacancy aggregator.

// Seniority is the Job Finder's vocabulary, so a candidate and a vacancy can be
// compared without translating between two scales. Imported rather than restated
// here: two identical declarations could drift apart, which is the one thing that
// sharing the vocabulary is meant to rule out, and since everything under
// server/utils is auto-imported, only one of the two was being kept anyway.
import type { Seniority } from './jobTypes'

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
  // Normalized in hiringNormalize.ts so filtering and ranking work on canonical
  // values rather than whatever wording the CV author used.
  seniority?: Seniority | null
  contacts?: { telegram?: string; email?: string; phone?: string }
  // Relevance score from Elasticsearch; absent for the in-memory fallback.
  score?: number
}

export interface CountryMeta {
  code: string
  name: string
  currency: string
  cities?: string[]
}
