import type { Job, SponsorshipConfidence } from './jobTypes'

export type VisaSponsorshipStatus =
  | 'explicit'
  | 'verified'
  | 'historical'
  | 'not_offered'
  | 'unknown'

const NEGATIVE_SPONSORSHIP_RE = /(?:\bno\s+(?:visa\s+|immigration\s+|employment\s+)?sponsorship\b|\b(?:will\s+not|cannot|can't|unable\s+to|not\s+able\s+to)\s+sponsor\b|\bdo(?:es)?\s+not\s+(?:offer|provide)\s+(?:visa\s+|immigration\s+|employment\s+)?sponsorship\b|\bwithout\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+)?(?:employer\s+|visa\s+)?sponsorship\b|\bmust\s+(?:be\s+)?(?:legally\s+)?authoriz\w+\s+to\s+work[^.!?]{0,80}\bwithout\s+(?:current\s+or\s+future\s+)?sponsorship\b|\bmust\s+not\s+require\s+(?:current\s+or\s+future\s+)?(?:visa\s+|employment\s+)?sponsorship\b|\b(?:current\s+and\/or\s+future|current\s+or\s+future)\s+sponsorship\s+(?:is\s+)?not\s+(?:available|provided|offered)\b|\bsponsorship\s+(?:is\s+)?not\s+(?:available|provided|offered)\b|\bno\s+c2c(?:\s+or\s+visa\s+sponsorship)?\b)/i

const EXPLICIT_SPONSORSHIP_RE = /(?:\bwill\s+sponsor\b|\bwe\s+sponsor\b|\b(?:can|may)\s+sponsor\b|\bopen\s+to\s+(?:visa\s+)?sponsorship\b|\bvisa\s+sponsorship\s+(?:is\s+)?(?:available|provided|offered|possible)\b|\b(?:h-?1b|h1-b)\s+(?:visa\s+)?sponsorship\b|\bh-?1b\s+transfer\b|\bimmigration\s+sponsorship\b|\bemployment\s+visa\s+sponsorship\b|\bwork\s+visa\s+sponsorship\b|\bsponsor(?:ing)?\s+(?:qualified|eligible|selected)\s+candidates\b|\beligible\s+for\s+(?:visa\s+)?sponsorship\b|\bvisa\s+support\b|\bwork\s+visa\s+support\b)/i

export const TEMPORARY_WORK_AUTH_RE = /\b(?:opt|cpt|stem\s+opt)\b/i

function sponsorshipText(job: Pick<Job, 'title' | 'description' | 'tags' | 'sponsorshipEvidence'>): string {
  return [
    job.title,
    job.description,
    ...(job.tags || []),
    ...(job.sponsorshipEvidence || []),
  ].filter(Boolean).join(' ')
}

/**
 * Classify sponsorship evidence conservatively. Explicit negative wording always
 * wins over board/company history so a role that says "no sponsorship" is never
 * surfaced as sponsor-friendly merely because the employer sponsored before.
 * OPT/CPT/STEM OPT and generic work-authorization wording by themselves are not
 * H-1B sponsorship evidence.
 */
export function visaSponsorshipStatus(
  job: Pick<Job,
    | 'title'
    | 'description'
    | 'tags'
    | 'foreignerFriendly'
    | 'sponsorshipConfidence'
    | 'sponsorshipEvidence'
  >,
): VisaSponsorshipStatus {
  const text = sponsorshipText(job)

  if (NEGATIVE_SPONSORSHIP_RE.test(text)) return 'not_offered'

  if (EXPLICIT_SPONSORSHIP_RE.test(text)) {
    return job.sponsorshipConfidence === 'verified' ? 'verified' : 'explicit'
  }

  const confidence = job.sponsorshipConfidence as SponsorshipConfidence | undefined
  if (confidence === 'explicit' || confidence === 'verified' || confidence === 'historical') {
    return confidence
  }

  // Preserve the existing enrichment signal. It is already based on positive
  // visa/foreigner wording; treating it as explicit avoids throwing away useful
  // detections while still keeping pure unknowns out of the sponsorship filter.
  if (job.foreignerFriendly === true) return 'explicit'

  return 'unknown'
}

/**
 * USA "For foreigners" means there is actual positive sponsorship evidence:
 * explicit/verified wording, historical sponsor evidence, or the legacy positive
 * enrichment flag. Unknown vacancies (including empty descriptions) are not
 * silently treated as sponsor-friendly.
 */
export function keepUsaForeignerCandidate(
  job: Parameters<typeof visaSponsorshipStatus>[0],
): boolean {
  const status = visaSponsorshipStatus(job)
  return status === 'explicit' || status === 'verified' || status === 'historical'
}
