// Candidate profile normalization + deduplication.
//
// Profiles arrive as free-form CV posts from several channels, so the same
// person can appear with different wording, and skills are written however the
// author felt like ("react.js", "REACT", "Реакт"). Everything the Hiring page
// filters or ranks on has to be canonical, which is what this module produces.
//
// It reuses the Job Finder's skill catalogue (shared/jobSkills) on purpose:
// candidates and vacancies must speak the same skill vocabulary, otherwise
// matching a candidate against a vacancy compares incomparable strings.

import { canonicalSkillName, extractSkillDetails } from '~~/shared/jobSkills'
import type { CvProfile } from './hiringTypes'
import type { Seniority } from './jobTypes'

// --- seniority -------------------------------------------------------------
// Boundaries use \p{L} lookarounds rather than \b: JS word boundaries only know
// ASCII, so \bтимлид never matches. Ordered — the first hit wins, so "senior"
// beats a passing mention of "junior".
const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const rule = (body: string) => new RegExp(`${B}(?:${body})${E}`, 'iu')

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ['lead', rule("tech\\s*lead|team\\s*lead|teamlead|tim\\s*lid|lead|head\\s+of|руководител\\p{L}*|тимлид\\p{L}*|лид")],
  ['senior', rule('senior|sr\\.?|синьор\\p{L}*|сеньор\\p{L}*|ведущий|старший')],
  ['middle', rule('middle|mid-?level|mid|мидл\\p{L}*|миддл\\p{L}*|средний\\s+уровень')],
  ['junior', rule('junior|jr\\.?|джуниор\\p{L}*|джун|младший|trainee|intern(?:ship)?|стажер|стажёр|начинающий')],
]

// Experience that clearly contradicts a "junior" mention wins: CVs routinely say
// things like "mentoring junior developers" or "grew from junior to senior", and
// those must not demote an experienced candidate.
const JUNIOR_CONTRADICTION_YEARS = 4

export function detectSeniority(text: string, experienceYears?: number | null): Seniority | null {
  for (const [level, re] of SENIORITY_RULES) {
    if (!re.test(text)) continue
    if (level === 'junior' && (experienceYears ?? 0) >= JUNIOR_CONTRADICTION_YEARS) break
    return level
  }
  // Nothing explicit (or a contradicted "junior") — derive it from experience.
  if (experienceYears == null) return null
  if (experienceYears >= 6) return 'senior'
  if (experienceYears >= 3) return 'middle'
  if (experienceYears >= 1) return 'junior'
  return null
}

// --- skills ----------------------------------------------------------------
// Canonicalize whatever the author wrote, then top up from the free text so a
// profile that never wrote a "Skills:" line still gets indexed skills.
export function normalizeSkills(rawSkills: string[] | undefined, text: string): string[] {
  const out = new Set<string>()
  for (const raw of rawSkills || []) {
    const canonical = canonicalSkillName(raw)
    if (canonical) out.add(canonical)
    else {
      // Keep an unrecognised skill, trimmed, rather than losing information.
      const trimmed = raw.trim().replace(/\s{2,}/g, ' ')
      if (trimmed.length >= 2 && trimmed.length <= 40) out.add(trimmed)
    }
  }
  for (const { name } of extractSkillDetails(text)) out.add(name)
  return [...out]
}

// --- role ------------------------------------------------------------------
// Strip the decorations CV posts wrap around a job title so roles group.
export function normalizeRole(role: string | undefined, text: string): string {
  const raw = (role || '').trim()
  const cleaned = raw
    .replace(/^[#\-–—•*\s]+/, '')
    .replace(/[.;,]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 120)
  if (cleaned) return cleaned
  const guess = text.match(/\b((?:senior|middle|junior|lead)?\s*(?:frontend|backend|full-?stack|mobile|qa|devops|data|ui\/?ux|product|project)\s*(?:developer|engineer|designer|manager|analyst)?)/i)
  return guess?.[1]?.trim() || ''
}

// --- contacts --------------------------------------------------------------
// Contacts are deterministic; never let a model invent or "fix" them.
export function extractContacts(text: string): { telegram?: string; email?: string; phone?: string } {
  const out: { telegram?: string; email?: string; phone?: string } = {}
  const tg = text.match(/@[A-Za-z0-9_]{4,32}/)
  if (tg) out.telegram = tg[0]
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (email) out.email = email[0]
  const phone = text.match(/\+?\d[\d\s().-]{8,}\d/)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    if (digits.length >= 9 && digits.length <= 15) out.phone = phone[0].trim()
  }
  return out
}

// --- normalization entry point --------------------------------------------
export function normalizeCandidate(profile: CvProfile): CvProfile {
  const text = `${profile.name || ''}\n${profile.role || ''}\n${profile.description || ''}`
  const contacts = extractContacts(text)
  return {
    ...profile,
    role: normalizeRole(profile.role, text),
    skills: normalizeSkills(profile.skills, text),
    seniority: profile.seniority ?? detectSeniority(text, profile.experienceYears),
    contact: profile.contact || contacts.telegram || contacts.email || contacts.phone || null,
    contacts: profile.contacts ?? contacts,
  }
}

// --- deduplication ---------------------------------------------------------
// The same CV is frequently reposted across channels and re-sent by the author.
// Identity first (a contact handle is the strongest signal), then a content
// fingerprint for reposts that changed only whitespace/emoji.
function fingerprint(profile: CvProfile): string {
  const contact = profile.contacts?.telegram || profile.contacts?.email || profile.contacts?.phone
  if (contact) return `c:${contact.toLowerCase()}`
  const text = `${profile.role || ''} ${profile.description || ''}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-zа-яёіїґ0-9]+/g, '')
    .slice(0, 400)
  if (text.length >= 40) return `t:${text}`
  return `k:${profile.source}:${profile.id}`
}

// Keeps the newest profile for each identity, so a refreshed CV wins.
export function dedupeCandidates(profiles: CvProfile[]): CvProfile[] {
  const best = new Map<string, CvProfile>()
  for (const profile of profiles) {
    const key = fingerprint(profile)
    const current = best.get(key)
    if (!current) {
      best.set(key, profile)
      continue
    }
    const a = Date.parse(profile.createdAt || '') || 0
    const b = Date.parse(current.createdAt || '') || 0
    if (a > b) best.set(key, profile)
  }
  return [...best.values()]
}
