import {
  buildCvProfile,
  scoreColor,
  scoreJob as legacyScoreJob,
  type CvProfile,
} from '../../internal/legacy/atsScoreCore'

export { buildCvProfile, scoreColor }
export type { CvProfile }

type AtsJob = Parameters<typeof legacyScoreJob>[1]
type AtsResult = ReturnType<typeof legacyScoreJob>

const LONG_FORM_NO_SPONSORSHIP_RE = /(?:\bmay\s+not\s+be\s+able\s+to\b[^\n!?]{0,450}\b(?:sponsor|support|provide)\b[^\n!?]{0,180}\bsponsorship\b|\b(?:will|can|may)\s+not\b[^\n!?]{0,220}\b(?:sponsor|support|provide)\b[^\n!?]{0,160}\bsponsorship\b|\bnot\s+(?:currently\s+)?(?:able\s+to\s+)?(?:sponsor|support|provide)\b[^\n!?]{0,160}\bsponsorship\b)/i

function isUsRole(job: AtsJob): boolean {
  if (String(job.country || '').toUpperCase() === 'US') return true
  return /(?:\bunited states\b|\busa\b|\bu\.s\.?\b|\bsan mateo\s*,?\s*ca\b)/i.test(
    `${job.location || ''} ${job.title || ''} ${(job.description || '').slice(0, 1800)}`,
  )
}

export function scoreJob(profile: CvProfile, job: AtsJob): AtsResult {
  const result = legacyScoreJob(profile, job)
  if (
    !result.blockers.some((blocker) => blocker.code === 'visa_sponsorship')
    && profile.requiresUsSponsorship === true
    && isUsRole(job)
    && LONG_FORM_NO_SPONSORSHIP_RE.test(`${job.description || ''} ${(job.tags || []).join(' ')}`)
  ) {
    const blocker = {
      code: 'visa_sponsorship' as const,
      label: 'Visa sponsorship unavailable',
      critical: true as const,
    }
    return {
      ...result,
      score: Math.min(result.fitScore, 49),
      eligible: false,
      blockers: [...result.blockers, blocker],
      missing: [blocker.label, ...result.missing.filter((item) => item !== blocker.label)].slice(0, 12),
    }
  }
  return result
}
