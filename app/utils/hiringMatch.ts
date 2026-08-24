import { canonicalSkillName } from '~~/shared/jobSkills'
import { expandHiringProfessionFilters } from '~~/shared/hiringProfessionGroups'
import { hiringProfessionLabel } from '~~/shared/hiringProfessionLabels'

export interface HiringMatchFilters {
  professions: string[]
  skills: string[]
}

export interface HiringMatchCandidate {
  role?: string
  professions?: string[]
  skills?: string[]
  tags?: string[]
}

export interface HiringCandidateMatch {
  score: number
  matched: number
  total: number
  matchedSkillKeys: string[]
  matchedProfessionTokens: string[]
}

function normalizedToken(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

export function canonicalHiringSkill(value: string): string {
  return canonicalSkillName(value) || String(value || '').trim()
}

function skillKey(value: string): string {
  return normalizedToken(canonicalHiringSkill(value))
}

function professionTokens(value: string): string[] {
  return expandHiringProfessionFilters([value]).flatMap((profession) => [
    normalizedToken(profession),
    normalizedToken(hiringProfessionLabel(profession, 'ru')),
    normalizedToken(hiringProfessionLabel(profession, 'en')),
  ])
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function scoreHiringCandidate(
  candidate: HiringMatchCandidate,
  filters: HiringMatchFilters,
): HiringCandidateMatch | null {
  const professionCriteria = unique(filters.professions.map((value) => value.trim()).filter(Boolean))
  const skillCriteria = unique(filters.skills.map(skillKey).filter(Boolean))
  const total = professionCriteria.length + skillCriteria.length
  if (!total) return null

  const ownedProfessionTokens = new Set([
    ...(candidate.professions || []).flatMap(professionTokens),
    ...String(candidate.role || '').split(',').flatMap(professionTokens),
  ])
  const ownedSkillKeys = new Set([
    ...(candidate.skills || []).map(skillKey),
    ...(candidate.tags || []).map(skillKey),
  ].filter(Boolean))

  const matchedProfessionTokens: string[] = []
  let matchedProfessions = 0
  for (const profession of professionCriteria) {
    const tokens = unique(professionTokens(profession))
    if (!tokens.some((token) => ownedProfessionTokens.has(token))) continue
    matchedProfessions += 1
    matchedProfessionTokens.push(...tokens)
  }

  const matchedSkillKeys = skillCriteria.filter((key) => ownedSkillKeys.has(key))
  const matched = matchedProfessions + matchedSkillKeys.length

  return {
    score: Math.round((matched / total) * 100),
    matched,
    total,
    matchedSkillKeys,
    matchedProfessionTokens: unique(matchedProfessionTokens),
  }
}

export function tagMatchesHiringFilters(tag: string, match: HiringCandidateMatch | null): boolean {
  if (!match) return false
  return match.matchedSkillKeys.includes(skillKey(tag))
    || match.matchedProfessionTokens.includes(normalizedToken(tag))
}
