import {
  buildCvProfile,
  scoreJob as packageScoreJob,
  type CvProfile,
} from '~~/shared/hiring/ats/scoreCore'

// Linguistic evidence comes from parsing-lexicon; this adapter only applies site-specific ATS policy.
export { buildCvProfile }
export type { CvProfile }

export function scoreColor(score: number): string {
  if (score >= 75) return '#34d399' // green: strong match
  if (score >= 60) return '#fbbf24' // yellow: promising, but with noticeable gaps
  if (score >= 45) return '#fb923c' // orange: weak-to-moderate match
  return '#f87171' // red: poor match or eligibility blocker
}

export const scoreJob = packageScoreJob
