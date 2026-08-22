// CV/resume profiles posted by candidates (people looking for work).
// This is intentionally separate from the /jobs vacancy aggregator.

import type { Seniority } from './jobTypes'

// `source` identifies the transport family. Keep custom adapters assignable
// without forcing the legacy full-refresh registry to know every queued source;
// `origin` + `sourceKey` retain the precise provider identity.
export type HiringSource = 'telegram' | (string & {})
export type CandidateOrigin = 'telegram' | 'web' | 'facebook' | 'threads' | 'linkedin'
export type CandidateEmploymentType = 'full_time' | 'part_time'
export type CandidateContactType = 'direct' | 'platform'
export type CandidateGender = 'male' | 'female' | 'unknown'

export interface ProfessionExperience {
  profession: string
  years: number
}

// Full-store refresh remains Telegram-only. Web/social sources are fanned out
// by the durable per-source queue so one blocked provider cannot delay all CVs.
export const HIRING_SOURCES: HiringSource[] = ['telegram']

export interface CvProfile {
  id: string
  source: HiringSource
  /** Actual origin of the profile; defaults to telegram for legacy records. */
  origin?: CandidateOrigin
  /** Stable source adapter key, e.g. flagma-uz or rabotakz. */
  sourceKey?: string
  /** Human provider name for display: "Telegram", "Careerist UZ", "Flagma RO". */
  sourceLabel?: string
  /**
   * Set when the store has already run this profile through normalization,
   * repair and profession experience. Readers use it to skip work that would
   * otherwise be repeated on every request. See DERIVED_VERSION.
   */
  derived?: string
  /** Where the candidate is, when known. Empty when the post does not say. */
  country: string
  /** The channel country this profile came from — never a claim about the candidate. */
  sourceCountry?: string
  /** Candidate full name when present in the source. Empty when not provided. */
  name: string
  /** Primary normalized desired profession/headline. Kept for backwards compatibility. */
  role: string
  /** All normalized professions the candidate is explicitly looking for now. */
  professions?: string[]
  /** Normalized professions explicitly mentioned as previous work. */
  previousProfessions?: string[]
  /** Explicitly role-bound experience, independent from the currently desired role. */
  professionExperience?: ProfessionExperience[]
  /** Candidate circumstances useful to employers, e.g. Student or Parental leave. */
  features?: string[]
  age?: number | null
  /** Explicitly stated gender only; unknown when the source does not provide it. */
  gender?: CandidateGender
  /** Defaults to true when age is unavailable, per product requirements. */
  isAdult?: boolean
  /** Experience relevant to the currently desired profession only. */
  experienceYears?: number | null
  /** Expected compensation when the candidate mentions it. */
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
  /** Canonical link to the original candidate post/profile. */
  url: string
  /** Original publication date when the source exposes it. */
  publishedAt?: string | null
  /** Last candidate-controlled CV update when the source exposes it. */
  updatedAt?: string | null
  /** Freshness signal used by web boards: updatedAt ?? publishedAt. */
  activityAt?: string | null
  /** Backwards-compatible activity timestamp used by current store/search code. */
  createdAt: string | null
  /** Original public source text. Never synthesized by AI. */
  originalText: string
  /** Search/display copy; currently the same source text as originalText. */
  description: string
  skills?: string[]
  languages?: string[]
  education?: string | null
  tags?: string[]
  contact?: string | null
  /** When the candidate asks to be contacted, e.g. "8:00 - 22:00". */
  contactHours?: string | null
  /** Whether a direct public contact exists or the employer must use the source platform. */
  contactType?: CandidateContactType
  /** Raw employment wording from the source, retained for traceability. */
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
