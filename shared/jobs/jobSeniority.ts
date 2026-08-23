import type { Job, Seniority } from '../contracts/jobs'

/**
 * Keep Staff, Principal and Lead distinct instead of collapsing all of them to
 * Lead. Title evidence wins; the description is only used as a fallback when a
 * generic title omits the level.
 */
export function detectDetailedJobSeniority(title: string, description = ''): Seniority | null {
  const classify = (value: string, titleOnly = false): Seniority | null => {
    if (/\bprincipal\b/i.test(value)) return 'principal'
    if (/\bstaff\b/i.test(value)) return 'staff'
    if (/\b(?:team\s*lead|tech\s*lead|lead\s+(?:software\s+)?(?:engineer|developer|frontend|backend|designer|analyst))\b|тимлид|техлид|ведущ\w*/i.test(value)) return 'lead'
    if (/\bsenior\b|старш\w*|сеньор/i.test(value)) return 'senior'
    if (/\bmid(?:dle)?(?:[-+\s]|$)|\bmid[- ]?level\b|мидл|средн(?:ий|яя)\s+(?:уров|разработ)/i.test(value)) return 'middle'
    if (/\bjunior\b|джун\w*|младш\w*/i.test(value)) return 'junior'
    if (/\b(?:intern|internship|trainee)\b|стаж[ёе]р|стажир/i.test(value)) return 'intern'

    if (!titleOnly) {
      if (/\bprincipal[- ]level\b/i.test(value)) return 'principal'
      if (/\bstaff[- ]level\b/i.test(value)) return 'staff'
      if (/\blead[- ]level\b/i.test(value)) return 'lead'
    }
    return null
  }

  return classify(title, true) || classify(description)
}

export function normalizeJobSeniority(job: Job): Job {
  const seniority = detectDetailedJobSeniority(job.title || '', job.description || '')
  if (!seniority || seniority === job.seniority) return job
  return { ...job, seniority }
}
