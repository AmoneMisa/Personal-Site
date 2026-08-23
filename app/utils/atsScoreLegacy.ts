import { canonicalSkillName, extractSkillNames } from '~~/shared/jobSkills'

// Client-side ATS (Applicant Tracking System) match scoring.
// The CV never leaves the browser. Unlike a keyword-only matcher, this scorer
// separates technical overlap from seniority, required experience, role scope,
// education and employment eligibility. Hard blockers can therefore keep an
// otherwise keyword-rich vacancy from being shown as a strong match.

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
const REQUIRED_MARKER_RE = /\b(requirements?|qualifications?|minimum qualifications?|required skills?|must[- ]?have|you have|what (?:we|you) (?:are looking for|need|bring)|you(?:'|’)ll need|who you are|ideal candidate|what makes you a fit)\b|требован|квалификац|обязательн|необходим(?:о|ые|ый)|что мы (?:жд[её]м|ожидаем)|кого мы ищем|вимог|кваліфікац|обов['’]?язков|необхідн|кого ми шукаємо/i
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

// ---- CV evidence -----------------------------------------------------------

type CvSection = 'experience' | 'projects' | 'profile' | 'skills' | 'education' | 'other'
type Seniority = 'intern' | 'junior' | 'middle' | 'senior' | 'staff' | 'lead' | 'principal' | 'manager' | 'director'
type DegreeLevel = 'secondary' | 'bachelor' | 'master' | 'doctorate'

const CV_SECTION_HEADING_RE = /^\s*(profile|professional profile|summary|professional summary|about me|work experience|professional experience|experience|employment|employment history|projects?|pet projects?|hobbies|skills|technical skills|tech stack|education|languages?|contact|additional information)\s*:?[\s]*$/i

function cvSectionKind(heading: string): CvSection {
  const h = heading.toLowerCase()
  if (/work experience|professional experience|^experience$|employment/.test(h)) return 'experience'
  if (/project|hobbies/.test(h)) return 'projects'
  if (/profile|summary|about me/.test(h)) return 'profile'
  if (/skills|tech stack/.test(h)) return 'skills'
  if (/education/.test(h)) return 'education'
  return 'other'
}

function cvSectionText(raw: string, wanted: CvSection): string {
  const lines = raw.replace(/\r/g, '').split('\n')
  const collected: string[] = []
  let section: CvSection = 'other'
  let sawHeading = false

  for (const line of lines) {
    const trimmed = line.trim()
    const heading = CV_SECTION_HEADING_RE.exec(trimmed)
    if (heading?.[1]) {
      section = cvSectionKind(heading[1])
      sawHeading = true
      continue
    }
    if (section === wanted && trimmed) collected.push(trimmed)
  }
  return sawHeading ? collected.join('\n') : ''
}

const SECTION_EVIDENCE_WEIGHT: Record<CvSection, number> = {
  experience: 1,
  projects: 0.7,
  profile: 0.55,
  skills: 0.4,
  education: 0.35,
  other: 0.45,
}

function skillEvidenceFromCv(raw: string): Map<string, number> {
  const evidence = new Map<string, number>()
  const lines = raw.replace(/\r/g, '').split('\n')
  let section: CvSection = 'other'

  const add = (text: string, weight: number) => {
    for (const skill of extractSkills(text)) {
      evidence.set(skill, Math.max(evidence.get(skill) || 0, weight))
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const heading = CV_SECTION_HEADING_RE.exec(trimmed)
    if (heading?.[1]) {
      section = cvSectionKind(heading[1])
      continue
    }
    if (trimmed) add(trimmed, SECTION_EVIDENCE_WEIGHT[section])
  }

  // PDF extractors occasionally flatten headings into the surrounding text. Do
  // not lose skills entirely in that case; they get weak generic evidence only.
  for (const skill of extractSkills(raw)) {
    if (!evidence.has(skill)) evidence.set(skill, 0.45)
  }
  return evidence
}

function monthIndex(year: number, month = 1): number {
  return year * 12 + Math.max(1, Math.min(12, month)) - 1
}

function parsedCvExperienceYears(raw: string, referenceDate: Date): number | undefined {
  // Education often contains date ranges too. Prefer the explicit Work Experience
  // section so a 2015-2019 degree can never become four fake years of employment.
  const experienceSection = cvSectionText(raw, 'experience')
  const datedSource = experienceSection || raw
  const intervals: Array<[number, number]> = []
  const ranges = /\b(19\d{2}|20\d{2})(?:[-/.](0?[1-9]|1[0-2]))?\s*(?:-|–|—|to)\s*(?:(present|current|now)|((?:19|20)\d{2})(?:[-/.](0?[1-9]|1[0-2]))?)/gi

  for (const match of datedSource.matchAll(ranges)) {
    const startYear = Number(match[1])
    const startMonth = Number(match[2] || 1)
    const endYear = match[3] ? referenceDate.getFullYear() : Number(match[4])
    const endMonth = match[3] ? referenceDate.getMonth() + 1 : Number(match[5] || 12)
    if (!startYear || !endYear) continue
    const start = monthIndex(startYear, startMonth)
    const end = monthIndex(endYear, endMonth)
    if (end >= start && end - start <= 12 * 50) intervals.push([start, end])
  }

  intervals.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const interval of intervals) {
    const last = merged[merged.length - 1]
    if (!last || interval[0] > last[1] + 1) merged.push([...interval])
    else last[1] = Math.max(last[1], interval[1])
  }
  const datedMonths = merged.reduce((sum, [start, end]) => sum + end - start + 1, 0)
  const datedYears = datedMonths ? datedMonths / 12 : 0

  let explicitYears = 0
  const explicit = /\b(?:over|more than|at least|about|approximately|approx\.?|around)?\s*(\d{1,2}(?:[.,]\d)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:hands[- ]on\s+|professional\s+|commercial\s+)?experience\b/gi
  for (const match of raw.matchAll(explicit)) {
    const years = Number(match[1]?.replace(',', '.'))
    if (Number.isFinite(years) && years >= 0 && years <= 50) explicitYears = Math.max(explicitYears, years)
  }

  const result = Math.max(datedYears, explicitYears)
  return result > 0 ? Math.round(result * 10) / 10 : undefined
}

function detectSeniority(text: string): Seniority | undefined {
  const target = /\b(?:looking|searching)\s+for\s+(?:an?\s+)?(?:a\s+)?(intern|junior|middle|mid|senior|staff|principal|lead)\b/i.exec(text)?.[1]
  const normalize = (value: string): Seniority => value.toLowerCase() === 'mid' ? 'middle' : value.toLowerCase() as Seniority
  if (target) return normalize(target)

  const checks: Array<[Seniority, RegExp]> = [
    ['director', /\b(?:engineering\s+)?director\b|директор/i],
    ['principal', /\bprincipal\b(?=[^,;\n]{0,60}\b(?:engineer|developer|architect)\b)/i],
    ['staff', /\bstaff\b(?=[^,;\n]{0,60}\b(?:engineer|developer|architect)\b)/i],
    ['lead', /\b(?:team\s*lead|tech\s*lead|lead\s+(?:engineer|developer|frontend|backend))\b|тимлид|техлид|ведущ\w*/i],
    ['manager', /\bengineering manager\b|руководител/i],
    ['senior', /\bsenior\b(?=[^,;\n]{0,60}\b(?:engineer|developer|frontend|backend|software)\b)|сеньор|старш\w*\s+(?:разработ|инженер)/i],
    ['middle', /\b(?:middle|mid[- ]?level)\b(?=[^,;\n]{0,60}\b(?:engineer|developer|frontend|backend|software)\b)|мидл/i],
    ['junior', /\bjunior\b(?=[^,;\n]{0,60}\b(?:engineer|developer|frontend|backend|software)\b)|джун\w*|младш\w*/i],
    ['intern', /\b(?:intern|trainee)\b|стаж[ёе]р|стажир/i],
  ]
  return checks.find(([, pattern]) => pattern.test(text))?.[0]
}

function degreeLevel(text: string): DegreeLevel | undefined {
  if (/\b(?:ph\.?d\.?|doctorate|doctoral degree)\b|доктор(?:ская| наук)/i.test(text)) return 'doctorate'
  if (/master['’]?s degree|master degree|магистр|магістр/i.test(text)) return 'master'
  if (/bachelor['’]?s degree|bachelor degree|бакалавр/i.test(text)) return 'bachelor'
  if (/secondary education|среднее образование|середня освіта/i.test(text)) return 'secondary'
  return undefined
}

function degreeFields(text: string): Set<string> {
  const fields = new Set<string>()
  if (/computer science|computer engineering|software engineering|information technology|informatics|інформатик|информатик/i.test(text)) fields.add('computer_science')
  if (/\bengineering\b|инженерн|інженерн/i.test(text)) fields.add('engineering')
  if (/\b(?:civil\s+)?law\b|legal studies|юридич|юриспруд|право\b/i.test(text)) fields.add('law')
  if (/forensic|criminal investigation|криминалист|криміналіст|следствен|слідч/i.test(text)) fields.add('forensics')
  if (/business|economics|finance|management|эконом|економ/i.test(text)) fields.add('business')
  return fields
}

function hasUsWorkAuthorization(text: string): boolean {
  return /\b(?:u\.?s\.?|united states)\s+citizen\b|\bgreen card\b|\bpermanent resident\b|\bemployment authorization document\b|\bEAD\b|\bauthoriz\w+\s+to\s+work\s+in\s+(?:the\s+)?(?:u\.?s\.?|united states)(?:[^.!?]{0,50}\bwithout\s+sponsorship\b)?|\bno\s+(?:visa\s+)?sponsorship\s+required\b/i.test(text)
}

function hasNonUsCitizenship(text: string): boolean {
  const match = /\bcitizenship\s*[:\-]\s*([^\n|,;]{2,45})/i.exec(text)
  if (!match?.[1]) return false
  return !/^\s*(?:u\.?s\.?a?|united states|american)\b/i.test(match[1])
}

function requiresUsSponsorship(text: string): boolean | undefined {
  if (hasUsWorkAuthorization(text)) return false
  if (/\b(?:require|requires|requiring|need|needs|seeking)\b[^.!?]{0,60}\b(?:visa|employment)\s+sponsorship\b|\bneed\s+(?:an?\s+)?(?:h-?1b|work visa)\b/i.test(text)) return true
  if (hasNonUsCitizenship(text)) return true
  return undefined
}

export interface CvProfile {
  skills: Set<string>
  skillEvidence: Map<string, number>
  terms: Set<string>
  raw: string
  experienceYears?: number
  seniority?: Seniority
  degreeLevel?: DegreeLevel
  degreeFields: Set<string>
  requiresUsSponsorship?: boolean
}

export function buildCvProfile(cvText: string, referenceDate: Date = new Date()): CvProfile {
  return {
    skills: extractSkills(cvText),
    skillEvidence: skillEvidenceFromCv(cvText),
    terms: extractTerms(cvText),
    raw: cvText,
    experienceYears: parsedCvExperienceYears(cvText, referenceDate),
    seniority: detectSeniority(cvText),
    degreeLevel: degreeLevel(cvText),
    degreeFields: degreeFields(cvText),
    requiresUsSponsorship: requiresUsSponsorship(cvText),
  }
}

// ---- Job requirements ------------------------------------------------------

function detectRequiredExperience(text: string): number | undefined {
  const values: number[] = []
  const patterns = [
    /\b(\d{1,2}(?:[.,]\d)?)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?[^.;\n]{0,120}\bexperience\b/gi,
    /\b(?:at least|minimum of|min\.?)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:years?|yrs?)\b/gi,
    /(?:опыт|досвід)\s+(?:работы\s+)?(?:от\s+)?(\d{1,2}(?:[.,]\d)?)\s*(?:лет|год\w*|рок\w*)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]?.replace(',', '.'))
      if (Number.isFinite(value) && value >= 0 && value <= 40) values.push(value)
    }
  }
  return values.length ? Math.max(...values) : undefined
}

const SENIORITY_RANK: Record<Seniority, number> = {
  intern: 0,
  junior: 1,
  middle: 2,
  senior: 3,
  staff: 4,
  lead: 4,
  manager: 4,
  principal: 5,
  director: 6,
}

function seniorityScore(candidate: Seniority | undefined, required: Seniority | undefined): { score: number, gap: number } {
  if (!required) return { score: 100, gap: 0 }
  if (!candidate) return { score: 45, gap: 1 }
  const gap = SENIORITY_RANK[required] - SENIORITY_RANK[candidate]
  if (gap <= 0) return { score: 100, gap }
  if (gap === 1) return { score: 65, gap }
  if (gap === 2) return { score: 30, gap }
  return { score: 10, gap }
}

function experienceScore(candidate: number | undefined, required: number | undefined): { score: number, gap: number } {
  if (required === undefined) return { score: 100, gap: 0 }
  if (candidate === undefined) return { score: 35, gap: required }
  if (candidate >= required) return { score: 100, gap: 0 }
  const ratio = required > 0 ? candidate / required : 1
  const score = ratio >= 0.85 ? 75 : ratio >= 0.7 ? 55 : ratio >= 0.5 ? 35 : 15
  return { score, gap: Math.max(0, Math.round((required - candidate) * 10) / 10) }
}

type ScopeCode = 'architecture' | 'leadership' | 'mentoring' | 'scale' | 'ownership'
const SCOPE_SIGNALS: Array<{ code: ScopeCode, label: string, job: RegExp, cv: RegExp }> = [
  {
    code: 'architecture',
    label: 'Architecture / system design',
    job: /\barchitect(?:ure|ing)?\b|\bsystem design\b|\btechnical roadmap\b|\blong[- ]term solutions?\b/i,
    cv: /\barchitect(?:ed|ure|ing)?\b|\bsystem design\b|\btechnical roadmap\b|\bsolution architecture\b/i,
  },
  {
    code: 'leadership',
    label: 'Technical leadership',
    job: /\btechnical leader(?:ship)?\b|\bengineering standards\b|\bdrive product vision\b|\blead technical\b/i,
    cv: /\btechnical leader(?:ship)?\b|\bengineering standards\b|\bled\s+(?:a\s+)?(?:team|project|initiative)\b|\btech(?:nical)? lead\b/i,
  },
  {
    code: 'mentoring',
    label: 'Mentoring engineers',
    job: /\bmentor(?:ing|ed)?\s+(?:other\s+)?(?:engineers?|developers?|team members?)\b|\bcoach(?:ing|ed)?\s+(?:engineers?|developers?)\b/i,
    cv: /\bmentor(?:ing|ed)?\s+(?:other\s+)?(?:engineers?|developers?|team members?)\b|\bcoach(?:ing|ed)?\s+(?:engineers?|developers?)\b/i,
  },
  {
    code: 'scale',
    label: 'Large-scale systems',
    job: /\b(?:millions?|billions?)\s+of\s+(?:users|people|requests|events)\b|\bat scale\b|\bhigh[- ]scale\b|\blarge[- ]scale\b/i,
    cv: /\b(?:millions?|billions?)\s+of\s+(?:users|requests|events)\b|\bat scale\b|\bhigh[- ]scale\b|\blarge[- ]scale\b|\bhigh[- ]traffic\b/i,
  },
  {
    code: 'ownership',
    label: 'Product / feature ownership',
    job: /\bown\s+(?:critical\s+)?(?:features?|systems?|services?|roadmap)\b|\bproduct owner\b|\bdrive product\b/i,
    cv: /\bown(?:ed|ership)?\s+(?:features?|systems?|services?|roadmap|product)\b|\bproduct owner\b|\bdrove\s+(?:a\s+)?(?:feature|product|initiative)\b/i,
  },
]

function scopeScore(jobText: string, cvText: string): { score: number, missing: string[], requiredCount: number } {
  const required = SCOPE_SIGNALS.filter((signal) => signal.job.test(jobText))
  if (!required.length) return { score: 100, missing: [], requiredCount: 0 }
  const matched = required.filter((signal) => signal.cv.test(cvText))
  return {
    score: Math.round((matched.length / required.length) * 100),
    missing: required.filter((signal) => !signal.cv.test(cvText)).map((signal) => signal.label),
    requiredCount: required.length,
  }
}

const DEGREE_RANK: Record<DegreeLevel, number> = {
  secondary: 0,
  bachelor: 1,
  master: 2,
  doctorate: 3,
}

function jobDegreeRequirement(requiredText: string): { level?: DegreeLevel, field?: string, equivalentExperience: boolean } {
  const level = degreeLevel(requiredText)
  let field: string | undefined
  if (/computer science|computer engineering|software engineering|information technology|informatics|related\s+(?:technical|engineering|computer)\s+field/i.test(requiredText)) {
    field = 'computer_science'
  } else if (/\bengineering\b[^.;\n]{0,60}\bdegree\b|\bdegree\b[^.;\n]{0,60}\bengineering\b/i.test(requiredText)) {
    field = 'engineering'
  }
  return {
    level,
    field,
    equivalentExperience: /equivalent\s+(?:professional\s+|work\s+)?experience|or\s+equivalent\s+experience/i.test(requiredText),
  }
}

function educationScore(profile: CvProfile, requirement: ReturnType<typeof jobDegreeRequirement>): { score: number, fieldMismatch: boolean, levelMismatch: boolean } {
  if (!requirement.level && !requirement.field) return { score: 100, fieldMismatch: false, levelMismatch: false }
  const candidateRank = profile.degreeLevel ? DEGREE_RANK[profile.degreeLevel] : -1
  const requiredRank = requirement.level ? DEGREE_RANK[requirement.level] : -1
  const levelMismatch = requiredRank >= 0 && candidateRank < requiredRank
  const fieldMismatch = !!requirement.field
    && !profile.degreeFields.has(requirement.field)
    && !(requirement.field === 'computer_science' && profile.degreeFields.has('engineering'))

  if (levelMismatch) return { score: requirement.equivalentExperience ? 45 : 10, fieldMismatch, levelMismatch }
  if (fieldMismatch) return { score: requirement.equivalentExperience ? 60 : 35, fieldMismatch, levelMismatch }
  return { score: 100, fieldMismatch, levelMismatch }
}

const NO_SPONSORSHIP_RE = /(?:\bno\s+(?:visa\s+|immigration\s+|employment\s+)?sponsorship\b|\b(?:will\s+not|cannot|can't|unable\s+to|not\s+able\s+to)\s+sponsor\b|\bwithout\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+)?(?:employer\s+|visa\s+)?sponsorship\b|\bmust\s+(?:be\s+)?(?:legally\s+)?authoriz\w+\s+to\s+work[^.!?]{0,100}\bwithout\s+(?:current\s+or\s+future\s+)?sponsorship\b|\bsponsorship\s+(?:is\s+)?not\s+(?:available|provided|offered)\b|\bmay\s+not\s+be\s+able\s+to\b[^.!?]{0,220}\b(?:sponsor|support|provide)\b[^.!?]{0,90}\bsponsorship\b|\b(?:will|can|may)\s+not\b[^.!?]{0,120}\b(?:support|provide)\b[^.!?]{0,80}\bsponsorship\b)/i

function isUsRole(job: { country?: string, location?: string, title?: string, description?: string }): boolean {
  if ((job.country || '').toUpperCase() === 'US') return true
  return /(?:\bunited states\b|\busa\b|\bu\.s\.?\b|\bsan mateo\s*,?\s*ca\b)/i.test(`${job.location || ''} ${job.title || ''} ${(job.description || '').slice(0, 1200)}`)
}

export interface AtsBlocker {
  code: 'visa_sponsorship'
  label: string
  critical: true
}

export interface AtsBreakdown {
  skills: number
  experience: number
  seniority: number
  scope: number
  education: number
  relevance: number
}

export interface AtsResult {
  score: number // display score 0..100; critical blockers are capped below 50
  fitScore: number // professional fit before eligibility blocker cap
  eligible: boolean
  blockers: AtsBlocker[]
  breakdown: AtsBreakdown
  matched: string[]
  missing: string[]
}

interface AtsJob {
  title: string
  description?: string
  tags?: string[]
  skills?: string[]
  niceToHave?: string[]
  experienceMinYears?: number
  seniority?: string | null
  education?: string
  country?: string
  location?: string
  foreignerFriendly?: boolean
  sponsorshipConfidence?: string
  sponsorshipEvidence?: string[]
}

/**
 * Score a vacancy against a CV profile.
 *
 * Overall professional fit:
 *   skills 30% · required experience 20% · seniority 20% · principal/lead scope
 *   15% · education 10% · lexical relevance 5%.
 *
 * Skills are evidence-weighted: a technology demonstrated in work experience is
 * stronger than the same word appearing only in a Skills list. Severe seniority,
 * experience and principal-scope gaps cap the fit so three matching framework
 * names can never produce an 80%+ result for a fundamentally different role.
 *
 * Employment eligibility is separate. A confirmed no-sponsorship US vacancy is a
 * critical blocker when the CV indicates sponsorship is needed. The professional
 * fit is retained as `fitScore`, while the display `score` is capped below 50 so
 * the existing card UI renders the vacancy red instead of green.
 */
export function scoreJob(profile: CvProfile, job: AtsJob): AtsResult {
  const titleText = job.title || ''
  const tagText = (job.tags || []).join(' ')
  const description = job.description || ''
  const buckets = bucketJobText(description)

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
  const missingSkills: string[] = []

  const evidenceFor = (skill: string): number => profile.skillEvidence.get(skill) ?? (profile.skills.has(skill) ? 0.45 : 0)

  for (const skill of required) {
    possible += 4
    const evidence = evidenceFor(skill)
    if (evidence > 0) {
      earned += 4 * evidence
      matchedRequired.push(skill)
    } else {
      missingSkills.push(skill)
    }
  }
  for (const skill of optional) {
    possible += 1
    const evidence = evidenceFor(skill)
    if (evidence > 0) {
      earned += evidence
      matchedOptional.push(skill)
    }
  }
  for (const skill of context) {
    possible += 0.35
    const evidence = evidenceFor(skill)
    if (evidence > 0) {
      earned += 0.35 * evidence
      matchedContext.push(skill)
    }
  }
  const skillsScore = possible > 0 ? Math.round((earned / possible) * 100) : 60

  const requiredExperience = job.experienceMinYears ?? detectRequiredExperience(`${buckets.required} ${description}`)
  const exp = experienceScore(profile.experienceYears, requiredExperience)

  const requiredSeniority = detectSeniority(titleText) || (job.seniority ? detectSeniority(job.seniority) : undefined)
  const seniority = seniorityScore(profile.seniority, requiredSeniority)

  const scope = scopeScore(`${titleText} ${buckets.required} ${description}`, profile.raw)
  const educationRequirement = jobDegreeRequirement(`${buckets.required} ${job.education || ''}`)
  const education = educationScore(profile, educationRequirement)

  const keywordSource = buckets.required || buckets.optional
    ? `${buckets.required} ${buckets.optional}`
    : `${titleText} ${tagText} ${buckets.context.slice(0, 1800)}`
  const jobTerms = extractTerms(keywordSource)
  const relevanceScore = jobTerms.size ? Math.round(coverage(profile.terms, jobTerms) * 100) : 60

  const breakdown: AtsBreakdown = {
    skills: Math.max(0, Math.min(100, skillsScore)),
    experience: exp.score,
    seniority: seniority.score,
    scope: scope.score,
    education: education.score,
    relevance: relevanceScore,
  }

  let fitScore = Math.round(
    breakdown.skills * 0.30
    + breakdown.experience * 0.20
    + breakdown.seniority * 0.20
    + breakdown.scope * 0.15
    + breakdown.education * 0.10
    + breakdown.relevance * 0.05,
  )

  // Caps are intentionally asymmetric. A large mismatch in role level/scope must
  // dominate generic keyword overlap, while small gaps remain recoverable.
  if (seniority.gap >= 3) fitScore = Math.min(fitScore, 45)
  else if (seniority.gap === 2) fitScore = Math.min(fitScore, 58)
  if (exp.gap >= 2) fitScore = Math.min(fitScore, 55)
  if (education.fieldMismatch && !educationRequirement.equivalentExperience) fitScore = Math.min(fitScore, 60)
  if (scope.requiredCount >= 3 && scope.score < 40) fitScore = Math.min(fitScore, 45)
  fitScore = Math.max(0, Math.min(100, fitScore))

  const blockers: AtsBlocker[] = []
  const sponsorshipText = `${description} ${tagText} ${(job.sponsorshipEvidence || []).join(' ')}`
  if (isUsRole(job) && profile.requiresUsSponsorship === true && NO_SPONSORSHIP_RE.test(sponsorshipText)) {
    blockers.push({
      code: 'visa_sponsorship',
      label: 'Visa sponsorship unavailable',
      critical: true,
    })
  }

  const missingCriteria: string[] = []
  if (requiredExperience !== undefined && exp.gap > 0) {
    missingCriteria.push(`${requiredExperience}+ years experience`)
  }
  if (requiredSeniority && seniority.gap > 0) {
    const label = requiredSeniority.charAt(0).toUpperCase() + requiredSeniority.slice(1)
    missingCriteria.push(`${label} seniority`)
  }
  missingCriteria.push(...scope.missing)
  if (education.fieldMismatch && educationRequirement.field === 'computer_science') missingCriteria.push('Computer Science / related degree')
  else if (education.levelMismatch && educationRequirement.level) missingCriteria.push(`${educationRequirement.level} degree`)

  const matched = [...matchedRequired, ...matchedOptional, ...matchedContext]
  const blockerLabels = blockers.map((blocker) => blocker.label)
  const missing = [...blockerLabels, ...missingCriteria, ...missingSkills]
    .filter((value, index, values) => values.indexOf(value) === index)

  return {
    score: blockers.length ? Math.min(fitScore, 49) : fitScore,
    fitScore,
    eligible: blockers.length === 0,
    blockers,
    breakdown,
    matched: matched.slice(0, 12),
    missing: missing.slice(0, 12),
  }
}

export function scoreColor(score: number): string {
  if (score >= 75) return '#34d399' // green: strong match
  if (score >= 50) return '#fbbf24' // amber: partial / review gaps
  return '#f87171' // red: weak match or eligibility blocker
}
