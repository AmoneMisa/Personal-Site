import { canonicalSkillName, extractSkillNames } from '~~/shared/jobSkills'

// Client-side ATS (Applicant Tracking System) match scoring.
// The CV never leaves the browser: text is extracted locally and matched against
// each vacancy. Matching is done over a canonical *skill* dictionary (not raw word
// frequency), so the score reflects real tech-skill overlap — e.g. Java, Spring,
// Docker, Kubernetes, AWS — instead of noise words from the title/company.

/** Canonical skills present in a block of free text. */
function extractSkills(text: string): Set<string> {
  return new Set(extractSkillNames(text))
}

/** Map a pre-normalized skill string (e.g. from the server) to a canonical label. */
function canonical(skill: string): string | undefined {
  return canonicalSkillName(skill)
}

export interface CvProfile {
  skills: Set<string> // canonical skill labels found in the CV
  raw: string
}

export function buildCvProfile(cvText: string): CvProfile {
  return { skills: extractSkills(cvText), raw: cvText }
}

export interface AtsResult {
  score: number // 0..100
  matched: string[]
  missing: string[]
}

/**
 * Score a vacancy against a CV profile by canonical skill coverage.
 * required = skills asked for by the vacancy (server-normalized skills/niceToHave
 * plus any recognised in the title/tags/description). score = share the CV covers.
 */
export function scoreJob(profile: CvProfile, job: {
  title: string
  description?: string
  tags?: string[]
  skills?: string[]
  niceToHave?: string[]
}): AtsResult {
  const required = new Set<string>()
  for (const s of job.skills || []) { const c = canonical(s); if (c) required.add(c) }
  for (const s of job.niceToHave || []) { const c = canonical(s); if (c) required.add(c) }
  for (const s of extractSkills(`${job.title} ${(job.tags || []).join(' ')} ${job.description || ''}`)) {
    required.add(s)
  }

  if (required.size === 0) return { score: 0, matched: [], missing: [] }

  const matched: string[] = []
  const missing: string[] = []
  for (const skill of required) {
    if (profile.skills.has(skill)) matched.push(skill)
    else missing.push(skill)
  }

  const score = Math.round((matched.length / required.size) * 100)
  return { score, matched: matched.slice(0, 12), missing: missing.slice(0, 10) }
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#34d399' // green
  if (score >= 45) return '#fbbf24' // amber
  return '#f87171' // red
}
