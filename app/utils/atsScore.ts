import { canonicalSkillName, extractSkillNames } from '~~/shared/jobSkills'

// Client-side ATS (Applicant Tracking System) match scoring.
// The CV never leaves the browser. The scorer deliberately separates actual
// requirements from optional/contextual mentions so boilerplate such as an EEO
// paragraph or a "recruitment process" note cannot become a fake missing skill.

/** Canonical skills present in a block of free text. */
function extractSkills(text: string): Set<string> {
  return new Set(extractSkillNames(text))
}

/** Map a pre-normalized skill string (e.g. from the server) to a canonical label. */
function canonical(skill: string): string | undefined {
  return canonicalSkillName(skill)
}

function canonicalSet(values: string[] | undefined): Set<string> {
  const result = new Set<string>()
  for (const value of values || []) {
    const normalized = canonical(value)
    if (normalized) result.add(normalized)
  }
  return result
}

// Headings/phrases that usually introduce qualifications. Keep this multilingual:
// vacancy sources in the feed regularly mix English, Russian and Ukrainian text.
const REQUIRED_MARKER_RE = /\b(requirements?|qualifications?|minimum qualifications?|required skills?|must[- ]?have|what (?:we|you) (?:are looking for|need|bring)|you(?:'|’)ll need|who you are|ideal candidate|what makes you a fit)\b|требован|квалификац|обязательн|необходим(?:о|ые|ый)|что мы (?:жд[её]м|ожидаем)|кого мы ищем|вимог|кваліфікац|обов['’]?язков|необхідн|кого ми шукаємо/i
const OPTIONAL_MARKER_RE = /\b(nice to have|preferred qualifications?|preferred skills?|bonus points?|would be a plus|plus if|desirable)\b|желательн|будет плюсом|буде плюсом|преимуществ|бажан/i
const HARD_REQUIREMENT_RE = /\b(must|need to|required|proficien(?:t|cy)|expertise in|experience (?:with|in)|knowledge of|familiarity with|hands[- ]on)\b|обязател|требуется|необходим|знание|опыт (?:с|в)|владение|умение|потрібн|необхідн|досвід (?:з|у|в)|знання/i
const NOISE_RE = /\b(equal opportunity|eeo|diversity and inclusion|reasonable accommodation|candidate privacy|privacy notice|background check|recruit(?:ment|ing) process|talent acquisition team|compensation range|pay transparency)\b|процесс найма|процес найму|политик[аи] конфиденциальности|політик[аи] конфіденційності/i
const SECTION_BREAK_RE = /\b(what we offer|benefits|perks|about us|about the company|our company|compensation|salary|responsibilities|what you(?:'|’)ll do|your role)\b|что мы предлагаем|условия работы|о компании|про компанію|обязанности|обов['’]?язки/i

type TextBucket = 'required' | 'optional' | 'context' | 'noise'
interface TextBuckets {
  required: string
  optional: string
  context: string
  noise: string
}

function splitDescription(text: string): string[] {
  return text
    .replace(/[•●▪◦·]/g, '. ')
    .split(/\n+|(?<=[.!?;])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Extract requirement-bearing parts of a description instead of treating every
 * company/benefits/legal paragraph as a candidate requirement.
 */
function bucketJobText(text: string): TextBuckets {
  const buckets: Record<TextBucket, string[]> = {
    required: [], optional: [], context: [], noise: [],
  }
  let active: 'required' | 'optional' | null = null
  let activeTtl = 0

  for (const segment of splitDescription(text)) {
    if (NOISE_RE.test(segment)) {
      buckets.noise.push(segment)
      active = null
      activeTtl = 0
      continue
    }

    buckets.context.push(segment)

    const optionalMarker = OPTIONAL_MARKER_RE.test(segment)
    const requiredMarker = REQUIRED_MARKER_RE.test(segment)
    if (optionalMarker) {
      active = 'optional'
      activeTtl = 6
      buckets.optional.push(segment)
      continue
    }
    if (requiredMarker) {
      active = 'required'
      activeTtl = 8
      buckets.required.push(segment)
      continue
    }

    if (SECTION_BREAK_RE.test(segment)) {
      active = null
      activeTtl = 0
    }

    if (HARD_REQUIREMENT_RE.test(segment)) {
      buckets.required.push(segment)
      continue
    }

    if (active && activeTtl > 0) {
      buckets[active].push(segment)
      activeTtl -= 1
    }
  }

  return {
    required: buckets.required.join(' '),
    optional: buckets.optional.join(' '),
    context: buckets.context.join(' '),
    noise: buckets.noise.join(' '),
  }
}

const TERM_STOP_WORDS = new Set([
  // English vacancy boilerplate / grammar.
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'our', 'are', 'will', 'have', 'has',
  'who', 'what', 'when', 'where', 'which', 'their', 'they', 'them', 'about', 'within', 'across', 'using', 'including',
  'work', 'working', 'team', 'teams', 'role', 'company', 'years', 'year', 'experience', 'skills', 'skill', 'strong',
  'good', 'excellent', 'ability', 'knowledge', 'looking', 'required', 'requirements', 'preferred', 'responsibilities',
  'opportunity', 'candidate', 'position', 'professional', 'develop', 'development', 'build', 'building', 'software',
  'engineer', 'engineering', 'help', 'support', 'ensure', 'provide', 'plus', 'nice', 'must', 'need', 'needs',
  // Russian / Ukrainian equivalents that otherwise dominate lexical overlap.
  'для', 'что', 'как', 'или', 'это', 'мы', 'вы', 'ваш', 'ваша', 'ваши', 'наш', 'наша', 'наши', 'работа', 'работы',
  'работать', 'опыт', 'лет', 'года', 'год', 'команда', 'команды', 'знание', 'знания', 'навыки', 'требования',
  'обязанности', 'будет', 'нужно', 'необходимо', 'умение', 'разработка', 'разработки', 'позиция', 'кандидат',
  'або', 'це', 'ми', 'ви', 'робота', 'працювати', 'досвід', 'років', 'роки', 'знання', 'навички', 'вимоги',
  'обовязки', 'потрібно', 'необхідно', 'розробка', 'розробки',
])

function extractTerms(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[’']/g, '')
  const words = normalized.match(/[a-zа-яёіїєґ][a-zа-яёіїєґ0-9+#.-]{2,}/gi) || []
  return new Set(words.filter((word) => !TERM_STOP_WORDS.has(word) && !/^\d+$/.test(word)))
}

function coverage(have: Set<string>, wanted: Set<string>): number {
  if (!wanted.size) return 0
  let found = 0
  for (const value of wanted) if (have.has(value)) found += 1
  return found / wanted.size
}

export interface CvProfile {
  skills: Set<string> // canonical skill labels found in the CV
  terms: Set<string> // significant free-text terms for a small lexical relevance component
  raw: string
}

export function buildCvProfile(cvText: string): CvProfile {
  return { skills: extractSkills(cvText), terms: extractTerms(cvText), raw: cvText }
}

export interface AtsResult {
  score: number // 0..100
  matched: string[]
  missing: string[]
}

/**
 * Score a vacancy against a CV profile.
 *
 * Weighting intentionally distinguishes four signals:
 * - explicit requirements (4x);
 * - preferred/nice-to-have skills (1x);
 * - other role-context skills (0.5x, useful for relevance but not "missing");
 * - a small free-text overlap component (15% max).
 *
 * Only explicit/high-confidence requirements are exposed as `missing`, so an
 * unrelated word found in company boilerplate can no longer produce a red tag.
 */
export function scoreJob(profile: CvProfile, job: {
  title: string
  description?: string
  tags?: string[]
  skills?: string[]
  niceToHave?: string[]
}): AtsResult {
  const titleText = job.title || ''
  const tagText = (job.tags || []).join(' ')
  const description = job.description || ''
  const buckets = bucketJobText(description)

  // A title is authoritative enough to imply a requirement (e.g. "React
  // Developer"). Source tags are not: boards often put marketing/HR topics into
  // tags, so those stay contextual unless the vacancy requirements confirm them.
  const titleSkills = extractSkills(titleText)
  const tagSkills = extractSkills(tagText)
  const requiredTextSkills = extractSkills(buckets.required)
  const optionalTextSkills = extractSkills(buckets.optional)
  const contextTextSkills = extractSkills(buckets.context)
  const noiseSkills = extractSkills(buckets.noise)
  const serverRequired = canonicalSet(job.skills)
  const serverOptional = canonicalSet(job.niceToHave)

  const required = new Set<string>([...titleSkills, ...requiredTextSkills])
  const optional = new Set<string>(optionalTextSkills)
  const context = new Set<string>()

  // Server-normalized skills are useful, but the server sees the whole vacancy.
  // Promote them to a hard requirement only when requirement/title text confirms
  // the skill. Otherwise they remain weak context and do not become red misses.
  for (const skill of serverRequired) {
    if (noiseSkills.has(skill) && !required.has(skill)) continue
    if (requiredTextSkills.has(skill) || titleSkills.has(skill)) required.add(skill)
    else context.add(skill)
  }

  for (const skill of serverOptional) {
    if (noiseSkills.has(skill) && !optionalTextSkills.has(skill)) continue
    optional.add(skill)
  }

  for (const skill of [...tagSkills, ...contextTextSkills]) {
    if (noiseSkills.has(skill) || required.has(skill) || optional.has(skill)) continue
    context.add(skill)
  }

  // Never double-count the same skill in weaker buckets.
  for (const skill of required) {
    optional.delete(skill)
    context.delete(skill)
  }
  for (const skill of optional) context.delete(skill)

  let possible = 0
  let earned = 0
  const matchedRequired: string[] = []
  const matchedOptional: string[] = []
  const matchedContext: string[] = []
  const missing: string[] = []

  for (const skill of required) {
    possible += 4
    if (profile.skills.has(skill)) {
      earned += 4
      matchedRequired.push(skill)
    } else {
      missing.push(skill)
    }
  }
  for (const skill of optional) {
    possible += 1
    if (profile.skills.has(skill)) {
      earned += 1
      matchedOptional.push(skill)
    }
  }
  for (const skill of context) {
    possible += 0.5
    if (profile.skills.has(skill)) {
      earned += 0.5
      matchedContext.push(skill)
    }
  }

  const skillCoverage = possible > 0 ? earned / possible : 0
  const keywordSource = buckets.required || buckets.optional
    ? `${buckets.required} ${buckets.optional}`
    : `${titleText} ${tagText} ${buckets.context.slice(0, 1800)}`
  const jobTerms = extractTerms(keywordSource)
  const textCoverage = coverage(profile.terms || extractTerms(profile.raw), jobTerms)

  let score = 0
  if (possible > 0 && jobTerms.size > 0) score = Math.round((skillCoverage * 0.85 + textCoverage * 0.15) * 100)
  else if (possible > 0) score = Math.round(skillCoverage * 100)
  else if (jobTerms.size > 0) score = Math.round(textCoverage * 100)

  const matched = [...matchedRequired, ...matchedOptional, ...matchedContext]
  return {
    score: Math.max(0, Math.min(100, score)),
    matched: matched.slice(0, 12),
    missing: missing.slice(0, 10),
  }
}

export function scoreColor(score: number): string {
  if (score >= 70) return '#34d399' // green
  if (score >= 45) return '#fbbf24' // amber
  return '#f87171' // red
}
