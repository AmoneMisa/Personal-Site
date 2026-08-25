// Best-effort enrichment: infers structured attributes from a vacancy's text.
// The upstream APIs don't provide these fields, so we derive them heuristically
// from title + description + tags (EN/RU/UK/UZ keywords). Results are approximate
// and meant to power filtering and statistics, not to be authoritative.

import { classifySuspicion } from './suspicious'
import type {
  EmployerType,
  EmploymentKind,
  Job,
  LanguageReq,
  Relocation,
  SalaryPeriod,
  Seniority,
  WorkMode,
} from './jobTypes'
import { toUsd } from './currency'
import {
  detectEmploymentTypes,
  detectExperienceRequirement,
  detectLexiconCity,
  detectProbation,
  detectSharedManagementRole,
  detectSharedSeniority,
  detectWorkModes,
  detectWorkSchedules,
  parseHiringExperience,
  parseHiringSalary,
  parseSharedHiringContext,
  parseSharedLanguageContext,
  resolveSharedCountryFromText,
} from './hiringLexicon'
import {
  extractSkillDetails,
  extractSkillNames,
  getSkillMeta,
  type SkillDetail,
} from '~~/shared/jobSkills'

// ---- HTML → plain text ----
// Many boards return HTML (sometimes HTML-encoded, occasionally double-encoded)
// in titles/descriptions, so cards were showing raw "<p>…&quot;content-intro…"
// or "&nbsp;"/"&#26;" markup. Strip tags + decode entities to clean plain text.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°',
  // Common Latin-1 accented letters (EU job posts: German/French/Spanish/etc.).
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ',
  ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', yacute: 'ý', euro: '€', pound: '£', copy: '©', reg: '®', trade: '™',
}
function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const cp =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10)
      if (!Number.isFinite(cp)) return m
      return cp >= 0x20 ? String.fromCodePoint(cp) : ' ' // drop control chars (e.g. &#26;)
    }
    // Entity names are case-sensitive (&Auml; ≠ &auml;); try exact, then lowercase.
    return NAMED_ENTITIES[code] ?? NAMED_ENTITIES[code.toLowerCase()] ?? m
  })
}
export function cleanText(raw: string | undefined): string {
  if (!raw) return ''
  let s = raw
  // Two passes so single- and double-encoded HTML both end up as plain text.
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ') // drop scripts/styles
      .replace(/<\/?(p|div|li|ul|ol|br|h[1-6]|tr|section)[^>]*>/gi, ' ') // blocks → space
      .replace(/<[^>]+>/g, ' ') // strip any remaining tags
      .replace(/<[^>]*$/g, ' ') // strip a trailing tag cut off by truncation
    s = decodeEntities(s)
  }
  return s.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---- Currency → USD ----
// Live rates live in ./currency (fetched from an exchange-rate API, cached in
// Redis, with a static fallback). `toUsd` is imported at the top of this file.

// ---- Pay-period normalization ----
// Salaries arrive in different periods (hourly/monthly/yearly) with no explicit
// field, so we detect the period and normalize `salaryUsd` to an ANNUAL figure so
// stats/sort compare like-for-like. PER_YEAR is the multiplier that turns an
// amount at the given period into a yearly amount (160 work hours/month assumed).
export const HOURS_PER_MONTH = 160
export const PER_YEAR: Partial<Record<SalaryPeriod, number>> = {
  hour: 12 * HOURS_PER_MONTH, // 1920
  month: 12,
  year: 1,
}

type ExtractedSalary = Pick<
  Job,
  'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'
>

function explicitSalaryPeriod(text: string): SalaryPeriod | undefined {
  return parseHiringSalary(text)?.period || undefined
}

/** Infer a salary range from free text using the shared multilingual money parser. */
export function extractSalaryFromText(raw: string | undefined): ExtractedSalary {
  if (!raw) return {}
  const parsed = parseHiringSalary(cleanText(raw))
  if (!parsed || (parsed.min == null && parsed.max == null)) return {}
  return {
    salaryMin: parsed.min ?? undefined,
    salaryMax: parsed.max ?? undefined,
    salaryCurrency: parsed.currency ?? undefined,
    salaryPeriod: parsed.period ?? undefined,
  }
}

// Sources that quote monthly salaries by convention (CIS boards) when text gives
// no explicit period. Everything else defaults to yearly (typical for remote/EU/US).
const MONTHLY_SOURCES = new Set<Job['source']>([
  'jooble',
  'rss',
  'devkg',
  'ishgo',
  'itjobsuz',
  'telegram',
  'olx',
])

function detectSalaryPeriod(job: Job, text: string): SalaryPeriod {
  const explicit = explicitSalaryPeriod(text)
  if (explicit) return explicit
  return MONTHLY_SOURCES.has(job.source) ? 'month' : 'year'
}

// Annual midpoint in USD (undefined when no usable salary/rate).
function salaryUsd(job: Job, period: SalaryPeriod): number | undefined {
  const lo = toUsd(job.salaryMin, job.salaryCurrency)
  const hi = toUsd(job.salaryMax, job.salaryCurrency)
  const mid = lo && hi ? (lo + hi) / 2 : lo || hi
  const factor = PER_YEAR[period]
  if (!mid || !factor) return undefined
  return Math.round(mid * factor)
}

// ---- Country detection from location text ----
// Country and city aliases live in parsing-lexicon; this module only
// decides which vacancy fields have precedence.
export function resolveCountry(text: string): string | undefined {
  return resolveSharedCountryFromText(text) || undefined
}

function detectCountry(job: Job): string {
  const loc = (job.location || '').trim()
  if (/worldwide|anywhere|global|remote/i.test(loc) && !/[,]/.test(loc)) return 'REMOTE'
  // Prefer the location field; but many boards (notably DOU.ua) leave it as a
  // placeholder like "See listing" and only name the city/country in the title,
  // so fall back to the title + tags before giving up.
  const byLoc = resolveCountry(loc)
  if (byLoc) return byLoc
  const byTitle = resolveCountry(`${job.title} ${job.tags.join(' ')}`)
  if (byTitle) return byTitle
  // Board-level fallback: DOU.ua is a Ukraine-only board.
  if (/dou/i.test(job.company) || /dou/i.test(job.id)) return 'UA'
  if (job.remote) return 'REMOTE'
  return 'OTHER'
}

function detectCity(job: Job, country: string): string | undefined {
  const first = cleanText(job.location).split(/[,|·]/)[0]?.trim()
  if (!first || first.length > 80) return undefined
  if (/^(remote|worldwide|anywhere|global|other|see listing)$/i.test(first)) return undefined
  const knownCity = detectLexiconCity(first, country)
  if (resolveCountry(first) === country && !knownCity) return undefined
  return knownCity || first
}

// ---- Shared vacancy context ----
function detectWorkMode(text: string, job: Job): WorkMode {
  const modes = detectWorkModes(text)
  if (modes.includes('hybrid')) return 'hybrid'
  if (modes.includes('remote') || job.remote) return 'remote'
  if (modes.includes('onsite')) return 'office'
  return 'unknown'
}

function sharedHiringContext(text: string, title: string) {
  return parseSharedHiringContext(text, { mode: 'vacancy', title }) as {
    kind: Job['hiringKind']
    relocation: 'offered' | 'required' | 'notOffered' | null
    workAuthorization: string[]
    travel: string | null
    benefits: string[]
    application: string[]
    openingCount: number | null
    vacancyStatus: string | null
    educationContext: string | null
    contracts: string[]
  }
}

function detectRelocation(context: ReturnType<typeof sharedHiringContext>): Relocation {
  if (context.relocation === 'offered') return 'offered'
  if (context.relocation === 'notOffered') return 'none'
  return 'unknown'
}

function detectForeignerFriendly(context: ReturnType<typeof sharedHiringContext>): boolean | undefined {
  if (context.workAuthorization.includes('sponsorshipOffered')) return true
  if (context.workAuthorization.some((item) => ['noSponsorship', 'workPermitRequired', 'citizenshipRequired'].includes(item))) return false
  return undefined
}

function detectNoExperience(text: string): boolean {
  return detectExperienceRequirement(text) === 'noExperience'
}

function detectExperienceYears(text: string): { min?: number, max?: number } {
  const parsed = parseHiringExperience(text)
  return {
    min: parsed?.minYears ?? undefined,
    max: parsed?.maxYears ?? undefined,
  }
}

function detectEmploymentKind(job: Job, text: string): EmploymentKind | undefined {
  const detected = detectEmploymentTypes(`${job.employmentType || ''} ${text}`)[0]
  const map: Record<string, EmploymentKind> = {
    full_time: 'fulltime',
    part_time: 'parttime',
    contract: 'contract',
    project: 'project',
    freelance: 'freelance',
    internship: 'internship',
    temporary: 'temporary',
    volunteer: 'volunteer',
    seasonal: 'seasonal',
  }
  return detected ? map[detected] : undefined
}

function detectSeniority(title: string, text: string): Seniority | null {
  return detectSharedSeniority(`${title}\n${text}`) as Seniority | null
}

function detectManagementRole(title: string, text: string): boolean | undefined {
  return detectSharedManagementRole(title, text) || undefined
}

function detectSalaryGross(text: string): boolean | undefined {
  return parseHiringSalary(text)?.gross ?? undefined
}

function detectSalaryNegotiable(text: string): boolean | undefined {
  return parseHiringSalary(text)?.negotiable || undefined
}

function detectSchedule(text: string): string | undefined {
  const schedule = detectWorkSchedules(text)[0]
  const labels: Record<string, string> = {
    fiveTwo: '5/2', twoTwo: '2/2', sixOne: '6/1', threeThree: '3/3', oneThree: '1/3',
    twentyFourFortyEight: '24/48', shift: 'Shift work', flexible: 'Flexible', day: 'Day',
    night: 'Night', rotational: 'Rotational',
  }
  return schedule ? labels[schedule] || schedule : undefined
}

function detectContractType(text: string, context?: ReturnType<typeof sharedHiringContext>): string | undefined {
  const contract = context?.contracts?.[0]
  const labels: Record<string, string> = {
    employmentContract: 'Employment contract', civilContract: 'Civil contract',
    freelance: 'Freelance', contractor: 'Contractor', b2b: 'B2B',
  }
  if (contract) return labels[contract] || contract
  if (/\bB2B\b/i.test(text)) return 'B2B'
  return undefined
}

function detectEducation(text: string): string | undefined {
  if (/master['’]?s degree|master degree|магистр|магістр/i.test(text)) return "Master's degree"
  if (/bachelor['’]?s degree|bachelor degree|бакалавр/i.test(text)) return "Bachelor's degree"
  if (/higher education|высшее образование|вища освіта|олий маълумот/i.test(text)) return 'Higher education'
  if (/secondary education|среднее образование|середня освіта/i.test(text)) return 'Secondary education'
  return undefined
}

function detectDeadline(text: string): string | undefined {
  const marker = /(?:application\s+deadline|apply\s+by|closing\s+date|deadline|дедлайн|срок(?:\s+подачи)?|термін(?:\s+подання)?)[\s:–—-]{0,8}([^.;\n]{3,45})/i.exec(text)
  if (!marker?.[1]) return undefined
  const date = marker[1].match(/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|янв\w*|фев\w*|мар\w*|апр\w*|ма[йя]|июн\w*|июл\w*|авг\w*|сен\w*|окт\w*|ноя\w*|дек\w*)\.?\s+\d{2,4})\b/i)
  return date?.[0]?.trim()
}

function detectApplicationLanguage(text: string): string | undefined {
  const match = /(?:submit|send|provide)[^.;\n]{0,35}(?:application|resume|résumé|cv)[^.;\n]{0,20}\b(?:in|на)\s+(english|russian|ukrainian|uzbek|kazakh|romanian|английском|русском|украинском|українською|узбекском|казахском|румынском)\b/i.exec(text)
  if (!match?.[1]) return undefined
  const value = match[1].toLowerCase()
  if (/english|англий/.test(value)) return 'English'
  if (/russian|русск/.test(value)) return 'Russian'
  if (/ukrain|укра/.test(value)) return 'Ukrainian'
  if (/uzbek|узбек/.test(value)) return 'Uzbek'
  if (/kazakh|казах/.test(value)) return 'Kazakh'
  if (/romanian|румын/.test(value)) return 'Romanian'
  return match[1]
}

const BOARD_SOURCES = new Set<Job['source']>([
  'remotive', 'remoteok', 'arbeitnow', 'themuse', 'jobicy', 'adzuna', 'jooble',
  'rss', 'devkg', 'ishgo', 'itjobsuz', 'olx',
])

function detectEmployerType(job: Job, text: string): EmployerType {
  if (job.source === 'telegram') return 'telegram'
  const agencyText = `${job.company} ${text.slice(0, 600)}`
  if (/recruit(?:ment|ing) agency|staffing agency|talent agency|кадров(?:ое|е) агентство|рекрут(?:ингов|инг)\w* агентство|агентство по подбору/i.test(agencyText)) return 'agency'
  if (BOARD_SOURCES.has(job.source)) return 'board'
  return 'direct'
}

// ---- Languages + contextual requirement relation ----
function detectLanguages(text: string): LanguageReq[] {
  return (parseSharedLanguageContext(text, 'vacancy') as Array<{
    name: string
    relation: 'required' | 'preferred' | 'notRequired' | 'candidateHas' | null
    level: string | null
    cefr: string | null
  }>).map((item) => ({
    language: item.name,
    level: item.cefr || item.level || undefined,
    requirement: item.relation && item.relation !== 'candidateHas' ? item.relation : undefined,
  }))
}

// Most skills use literal Unicode-aware aliases from shared/jobSkills. A small
// contextual layer handles grammatical phrases where important words are not
// adjacent (for example, "analyse onboarding funnel data").
function contextualSkillNames(text: string): string[] {
  const patterns: [string, RegExp][] = [
    ['Corporate Governance', /\b(?:group|company|corporate) governance\b/i],
    ['Data Analysis', /\banalys(?:e|is|ing)\b[^.;\n]{0,60}\b(?:data|metrics?|funnels?)\b|\b(?:data|metrics?|funnels?)\b[^.;\n]{0,60}\banalys(?:e|is|ing)\b/i],
    ['Conversion Funnel', /\b(?:conversion|onboarding|registration)[- ](?:to[- ]\w+\s+)?funnel\b|\bonboarding funnel\b/i],
    ['Cross-functional Collaboration', /\bcross[- ]function(?:al|ally)\b/i],
  ]
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name)
}

function matchSkillDetails(text: string): SkillDetail[] {
  const details = extractSkillDetails(text)
  const names = new Set(details.map(({ name }) => name))
  for (const name of contextualSkillNames(text)) {
    if (names.has(name)) continue
    const meta = getSkillMeta(name)
    if (!meta) continue
    details.push({ name, ...meta })
    names.add(name)
  }
  return details
}

// ---- "Will be a plus" (nice to have) ----
const PLUS_MARKERS =
  /(will be a plus|is a plus|as a plus|nice to have|would be a plus|plus:|плюсом|будет плюсом|буде плюсом|перевагою|преимуществом|will be an advantage)/i

function detectNiceToHave(text: string): string[] {
  const m = PLUS_MARKERS.exec(text)
  if (!m) return []
  // Take a window after the marker and match skills within it.
  const seg = text.slice(m.index, m.index + 220)
  const inSeg = extractSkillNames(seg)
  // Only skills that appear in the plus-segment (nice-to-have, not core).
  return inSeg
}

const TOOL_SUBCATEGORIES = /Databases|DevOps|Productivity|Spreadsheets|UI & UX|CRM|Accounting Software|CAD|Retail, POS|Low Code|Analytics & AI|QA & Security/i

function detectTools(details: SkillDetail[]): string[] {
  return details
    .filter(({ subcategory }) => TOOL_SUBCATEGORIES.test(subcategory))
    .map(({ name }) => name)
}

export function enrichJob(job: Job): Job {
  if (job.workMode !== undefined && job.employerType !== undefined) return job // already enriched
  const title = cleanText(job.title) || job.title
  const description = cleanText(job.description)
  const extractedSalary = extractSalaryFromText(description)
  const clean = {
    ...job,
    title,
    description: description || undefined,
    salaryMin: job.salaryMin ?? extractedSalary.salaryMin,
    salaryMax: job.salaryMax ?? extractedSalary.salaryMax,
    salaryCurrency: job.salaryCurrency ?? extractedSalary.salaryCurrency,
  }
  const text = `${title} \n ${job.tags.join(' ')} \n ${description}`
  const hiringContext = sharedHiringContext(text, title)
  const allSkillDetails = matchSkillDetails(text)
  const skills = allSkillDetails.map(({ name }) => name)
  const niceToHave = detectNiceToHave(text)
  const coreDetails = allSkillDetails.filter(({ name }) => !niceToHave.includes(name))
  const niceToHaveDetails = allSkillDetails.filter(({ name }) => niceToHave.includes(name))
  const core = coreDetails.map(({ name }) => name)
  const hasSalary = clean.salaryMin !== undefined || clean.salaryMax !== undefined
  const experience = detectExperienceYears(text)
  const experienceMinYears = experience.min
  const country = detectCountry(clean)
  const salaryPeriod = hasSalary
    ? job.salaryPeriod ?? extractedSalary.salaryPeriod ?? detectSalaryPeriod(clean, text)
    : undefined
  // Hard-blocked industry + "this posting never says what you'd do" warning.
  const suspicion = classifySuspicion({
    title,
    company: clean.company,
    description,
    salaryMin: clean.salaryMin,
    salaryMax: clean.salaryMax,
    salaryCurrency: clean.salaryCurrency,
  })
  return {
    ...clean,
    country,
    city: detectCity(clean, country),
    workMode: detectWorkMode(text, job),
    relocation: detectRelocation(hiringContext),
    employmentKind: detectEmploymentKind(clean, text),
    foreignerFriendly: detectForeignerFriendly(hiringContext),
    noExperience: detectNoExperience(text) || experienceMinYears === 0,
    experienceMinYears,
    experienceMaxYears: experience.max,
    languages: detectLanguages(text),
    skills: core,
    niceToHave,
    skillDetails: coreDetails,
    niceToHaveDetails,
    tools: detectTools(coreDetails),
    seniority: detectSeniority(title, text),
    managementRole: detectManagementRole(title, text),
    employerType: detectEmployerType(clean, text),
    salaryGross: detectSalaryGross(text),
    salaryNegotiable: detectSalaryNegotiable(text),
    schedule: detectSchedule(text),
    workSchedules: detectWorkSchedules(text),
    probationKind: detectProbation(text),
    experienceRequirement: detectExperienceRequirement(text),
    contractType: detectContractType(text, hiringContext),
    education: hiringContext.educationContext || detectEducation(text),
    deadline: detectDeadline(text),
    applicationLanguage: detectApplicationLanguage(text),
    hiringKind: hiringContext.kind,
    vacancyStatus: hiringContext.vacancyStatus || undefined,
    workAuthorization: hiringContext.workAuthorization,
    travelRequirement: hiringContext.travel || undefined,
    benefits: hiringContext.benefits,
    applicationRequirements: hiringContext.application,
    openingCount: hiringContext.openingCount ?? undefined,
    salaryPeriod,
    salaryUsd: salaryPeriod ? salaryUsd(clean, salaryPeriod) : undefined,
    ...suspicion,
  }
}
