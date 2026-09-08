import {
  buildHiringAtsProfile,
  scoreHiringAts,
  type HiringAtsJob,
  type HiringAtsProfile,
} from '@whiteslove/parsing-lexicon/hiring-ats'

// Parsing, skill evidence, scoring and eligibility rules are package-owned.
// This compatibility facade keeps the site's established call sites stable.
export type CvProfile = HiringAtsProfile
export type AtsJob = HiringAtsJob & Readonly<{
  foreignerFriendly?: boolean
  sponsorshipConfidence?: string
}>
export type AtsResult = ReturnType<typeof scoreHiringAts>

export function buildCvProfile(cvText: string, referenceDate: Date = new Date()): CvProfile {
  return buildHiringAtsProfile(cvText, { fuzzySkills: true, referenceDate })
}

export function scoreJob(profile: CvProfile, job: AtsJob): AtsResult {
  return scoreHiringAts(profile, job, { fuzzySkills: true })
}
