import { detectMentionedProfessions } from './hiringNormalize'
import type { CvProfile, ProfessionExperience } from './hiringTypes'

interface ExperienceMention {
  years: number
  context: string
}

function validYears(raw: string): number | null {
  const years = Number(raw.replace(',', '.'))
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function experienceMentions(text: string): ExperienceMention[] {
  const mentions: ExperienceMention[] = []
  const segments = text.split(/\n|(?<=[.!?])\s+/u).map((segment) => segment.trim()).filter(Boolean)

  for (const segment of segments) {
    const reverse = segment.match(
      /(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil(?:lik)?|йил(?:лик)?)[^\n.!?]{0,140}?(?:опыт|досвід|experience|staj|tajriba(?:m)?)/iu,
    )
    if (reverse?.[1]) {
      const years = validYears(reverse[1])
      if (years != null) mentions.push({ years, context: reverse[0] })
      continue
    }

    const direct = segment.match(
      /(?:опыт(?:\s+работы)?|досвід(?:\s+роботи)?|experience|staj|tajriba(?:m)?)[^\n.!?]{0,100}?(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil|йил)?/iu,
    )
    if (!direct?.[1]) continue
    const years = validYears(direct[1])
    if (years == null) continue

    // In forms like "Experience: 3 years backend developer" the profession can
    // follow the numeric value. Keep only the remainder of this sentence/line,
    // never the next target-role sentence.
    const tailStart = (direct.index || 0) + direct[0].length
    const tail = segment.slice(tailStart, tailStart + 100)
    mentions.push({ years, context: `${direct[0]} ${tail}`.trim() })
  }

  return mentions
}

function normalizeExisting(items: ProfessionExperience[] | undefined): ProfessionExperience[] {
  const out = new Map<string, ProfessionExperience>()
  for (const item of items || []) {
    const profession = String(item?.profession || '').trim()
    const years = Number(item?.years)
    if (!profession || !Number.isFinite(years) || years < 0 || years > 60) continue
    const previous = out.get(profession)
    if (!previous || years > previous.years) out.set(profession, { profession, years })
  }
  return [...out.values()]
}

export function extractProfessionExperience(text: string): ProfessionExperience[] {
  const out = new Map<string, ProfessionExperience>()
  for (const mention of experienceMentions(text)) {
    for (const profession of detectMentionedProfessions(mention.context)) {
      const previous = out.get(profession)
      // Prefer the largest explicit duration instead of summing repeated CV
      // summaries, reposts or duplicate wording for the same profession.
      if (!previous || mention.years > previous.years) {
        out.set(profession, { profession, years: mention.years })
      }
    }
  }
  return [...out.values()]
}

function sameProfessionFamily(a: string, b: string): boolean {
  if (a === b) return true
  return /Developer$/u.test(a) && /Developer$/u.test(b)
}

function targetProfessions(profile: CvProfile): string[] {
  const structured = [...(profile.professions || []), profile.role || ''].filter(Boolean)
  const canonical = detectMentionedProfessions(structured.join(' '))
  return canonical.length ? canonical : structured
}

export function withProfessionExperience(profile: CvProfile): CvProfile {
  const byProfession = new Map<string, ProfessionExperience>()
  for (const item of [...normalizeExisting(profile.professionExperience), ...extractProfessionExperience(profile.originalText || profile.description || '')]) {
    const previous = byProfession.get(item.profession)
    if (!previous || item.years > previous.years) byProfession.set(item.profession, item)
  }

  const professionExperience = [...byProfession.values()]
  const targets = targetProfessions(profile)
  const targetEntries = professionExperience.filter((item) =>
    targets.some((target) => sameProfessionFamily(item.profession, target)),
  )
  const previousFromExperience = professionExperience
    .filter((item) => !targets.some((target) => sameProfessionFamily(item.profession, target)))
    .map((item) => item.profession)

  // A role-bound target duration is stronger than a missing generic duration.
  // Otherwise keep normalizeCandidate's value: it already rejects a duration
  // explicitly tied only to a different profession.
  const inferredTargetYears = targetEntries.length
    ? Math.max(...targetEntries.map((item) => item.years))
    : null

  return {
    ...profile,
    professionExperience,
    previousProfessions: [...new Set([...(profile.previousProfessions || []), ...previousFromExperience])],
    experienceYears: profile.experienceYears ?? inferredTargetYears,
  }
}
