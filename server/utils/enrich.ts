// Best-effort enrichment: infers structured attributes from a vacancy's text.
// The upstream APIs don't provide these fields, so we derive them heuristically
// from title + description + tags (EN/RU/UK/UZ keywords). Results are approximate
// and meant to power filtering and statistics, not to be authoritative.

import type { Job, LanguageReq, Relocation, SalaryPeriod, WorkMode } from './jobTypes'

// ---- Currency → USD (APPROXIMATE static rates; update as needed) ----
// Russia/Belarus intentionally omitted (excluded elsewhere).
const USD_RATES: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, PLN: 0.25, UAH: 0.024, KZT: 0.0019,
  UZS: 0.000079, AZN: 0.59, GEL: 0.37, AMD: 0.0026, KGS: 0.011, MDL: 0.056,
  TJS: 0.092, TMT: 0.286, TRY: 0.030, CAD: 0.73, CHF: 1.12, INR: 0.012,
}

export function toUsd(amount: number | undefined, currency: string | undefined): number | undefined {
  if (!amount || amount <= 0) return undefined
  const rate = USD_RATES[(currency || 'USD').toUpperCase()]
  if (!rate) return undefined
  return Math.round(amount * rate)
}

// ---- Pay-period normalization ----
// Salaries arrive in different periods (hourly/monthly/yearly) with no explicit
// field, so we detect the period and normalize `salaryUsd` to an ANNUAL figure so
// stats/sort compare like-for-like. PER_YEAR is the multiplier that turns an
// amount at the given period into a yearly amount (160 work hours/month assumed).
export const HOURS_PER_MONTH = 160
export const PER_YEAR: Record<SalaryPeriod, number> = {
  hour: 12 * HOURS_PER_MONTH, // 1920
  month: 12,
  year: 1,
}

// Sources that quote monthly salaries by convention (CIS boards) when text gives
// no explicit period. Everything else defaults to yearly (typical for remote/EU/US).
const MONTHLY_SOURCES = new Set<Job['source']>(['headhunter', 'jooble', 'rss'])

function detectSalaryPeriod(job: Job, text: string): SalaryPeriod {
  if (/per hour|\/\s?h(ou)?r\b|hourly|\bp\/h\b|в час|за час|годину|годин\b/i.test(text)) return 'hour'
  if (/per month|monthly|\/\s?mo(nth)?\b|в месяц|на месяц|в мес\b|у місяць/i.test(text)) return 'month'
  if (/per year|yearly|annual(ly)?|per annum|\bp\.?a\.?\b|\/\s?y(ea)?r\b|в год|на год|у рік|за рік/i.test(text)) {
    return 'year'
  }
  return MONTHLY_SOURCES.has(job.source) ? 'month' : 'year'
}

// Annual midpoint in USD (undefined when no usable salary/rate).
function salaryUsd(job: Job, period: SalaryPeriod): number | undefined {
  const lo = toUsd(job.salaryMin, job.salaryCurrency)
  const hi = toUsd(job.salaryMax, job.salaryCurrency)
  const mid = lo && hi ? (lo + hi) / 2 : lo || hi
  if (!mid) return undefined
  return Math.round(mid * PER_YEAR[period])
}

// ---- Country detection from location text ----
const COUNTRY_PATTERNS: [string, RegExp][] = [
  ['UZ', /uzbek|tashkent|ташкент|узбек|toshkent|samarkand|самарканд/i],
  ['UA', /ukrain|kyiv|kiev|lviv|kharkiv|україн|украин|киї?в|львів|харків|одеса|dnipro/i],
  ['KZ', /kazakh|almaty|astana|казах|алматы|астана|нур-султан/i],
  ['GE', /georgia|tbilisi|груз|тбилиси|batumi/i],
  ['AZ', /azerbaij|baku|азербайдж|баку/i],
  ['AM', /armenia|yerevan|армен|ереван/i],
  ['KG', /kyrgyz|bishkek|киргиз|кыргыз|бишкек/i],
  ['MD', /moldova|chisinau|молдов|кишин/i],
  ['TJ', /tajik|dushanbe|таджик|душанбе/i],
  ['TM', /turkmen|ashgabat|туркмен|ашхабад/i],
  ['PL', /poland|warsaw|krak|polska|польш|варшав|краков/i],
  ['DE', /german|berlin|munich|герман|берлин|deutschland/i],
  ['GB', /united kingdom|london|england|британ|лондон/i],
  ['US', /united states|\busa\b|new york|сша|remote us/i],
]

function detectCountry(job: Job): string {
  const loc = (job.location || '').trim()
  if (/worldwide|anywhere|global|remote/i.test(loc) && !/[,]/.test(loc)) return 'REMOTE'
  for (const [code, re] of COUNTRY_PATTERNS) if (re.test(loc)) return code
  if (job.remote) return 'REMOTE'
  return 'OTHER'
}

// ---- Work mode ----
function detectWorkMode(text: string, job: Job): WorkMode {
  if (/hybrid|гибрид|гібрид|part[- ]?remote/i.test(text)) return 'hybrid'
  if (/\bremote\b|удал[её]нк|віддален|home ?office|\bwfh\b|дистанцион/i.test(text) || job.remote) {
    if (/on[- ]?site|in[- ]?office|в офис|в офіс/i.test(text) && !job.remote) return 'hybrid'
    return 'remote'
  }
  if (/on[- ]?site|in[- ]?office|\boffice\b|в офисе|в офіс|офіс|офис/i.test(text)) return 'office'
  return 'unknown'
}

// ---- Relocation ----
function detectRelocation(text: string): Relocation {
  if (/no relocation|without relocation|без переезд|без релокац|no reloc/i.test(text)) return 'none'
  if (/relocation|reloc\b|переезд|релокац|релокейт|переїзд|relocation package|help.*relocat/i.test(text)) {
    return 'offered'
  }
  return 'unknown'
}

// ---- Foreigner-friendly (visa sponsorship / open to foreigners) ----
function detectForeignerFriendly(text: string): boolean {
  return /visa sponsor|visa support|work permit|sponsorship|for foreigners|open to foreigner|иностранц|для иностран|іноземц|relocation package|work visa/i.test(
    text,
  )
}

// ---- Languages + levels ----
const LANGUAGES: [string, RegExp][] = [
  ['English', /english|англий|англ\.|англійськ/i],
  ['German', /german|deutsch|немецк|німецьк/i],
  ['Russian', /russian|русск|російськ/i],
  ['Ukrainian', /ukrainian|українськ|украинск/i],
  ['Uzbek', /uzbek|узбекск|o'zbek/i],
  ['French', /french|français|французск/i],
  ['Spanish', /spanish|español|испанск/i],
  ['Polish', /polish|polski|польск/i],
  ['Turkish', /turkish|türkçe|турецк/i],
]

const LEVEL_RE =
  /\b(a1|a2|b1|b2|c1|c2|pre-?intermediate|upper[- ]?intermediate|intermediate|elementary|advanced|proficient|fluent|native|beginner|basic|conversational|свободн|разговорн|базов|начальн|средн)\b/i

function normalizeLevel(raw: string): string {
  const s = raw.toLowerCase()
  if (/^[abc][12]$/.test(s)) return s.toUpperCase()
  if (/upper/.test(s)) return 'Upper-Intermediate'
  if (/pre-?inter/.test(s)) return 'Pre-Intermediate'
  if (/inter|средн|разговорн|conversational/.test(s)) return 'Intermediate'
  if (/advanc|proficient|свободн/.test(s)) return 'Advanced'
  if (/fluent/.test(s)) return 'Fluent'
  if (/native/.test(s)) return 'Native'
  if (/element|basic|beginner|базов|начальн/.test(s)) return 'Basic'
  return raw
}

function detectLanguages(text: string): LanguageReq[] {
  const out: LanguageReq[] = []
  for (const [name, re] of LANGUAGES) {
    const m = re.exec(text)
    if (!m) continue
    // Look for a level within ~40 chars around the language mention.
    const start = Math.max(0, m.index - 40)
    const window = text.slice(start, m.index + 40)
    const lvl = LEVEL_RE.exec(window)
    out.push({ language: name, level: lvl?.[1] ? normalizeLevel(lvl[1]) : undefined })
  }
  return out
}

// ---- Skills dictionary (extend freely) ----
export const SKILLS: string[] = [
  'javascript', 'typescript', 'react', 'vue', 'nuxt', 'next.js', 'angular', 'svelte',
  'node.js', 'python', 'django', 'flask', 'fastapi', 'java', 'spring', 'kotlin', 'go',
  'golang', 'rust', 'c++', 'c#', '.net', 'php', 'laravel', 'ruby', 'rails', 'scala',
  'swift', 'objective-c', 'flutter', 'dart', 'android', 'ios', 'react native',
  'sql', 'postgresql', 'mysql', 'mariadb', 'mongodb', 'redis', 'elasticsearch',
  'graphql', 'rest', 'grpc', 'kafka', 'rabbitmq', 'docker', 'kubernetes', 'terraform',
  'ansible', 'aws', 'gcp', 'azure', 'ci/cd', 'git', 'linux', 'nginx', 'microservices',
  'html', 'css', 'sass', 'tailwind', 'webpack', 'vite', 'redux', 'jest', 'cypress',
  'playwright', 'selenium', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'spark',
  'machine learning', 'data science', 'nlp', 'devops', 'figma', 'jira', 'agile', 'scrum',
]

function matchSkills(text: string): string[] {
  const hay = ' ' + text.toLowerCase() + ' '
  const found = new Set<string>()
  for (const skill of SKILLS) {
    // Word-ish boundary match; skills may contain . + # / so escape.
    const esc = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, 'i').test(hay)) found.add(skill)
  }
  return [...found]
}

// ---- "Will be a plus" (nice to have) ----
const PLUS_MARKERS =
  /(will be a plus|is a plus|as a plus|nice to have|would be a plus|plus:|плюсом|будет плюсом|буде плюсом|перевагою|преимуществом|will be an advantage)/i

function detectNiceToHave(text: string, skills: string[]): string[] {
  const m = PLUS_MARKERS.exec(text)
  if (!m) return []
  // Take a window after the marker and match skills within it.
  const seg = text.slice(m.index, m.index + 220)
  const inSeg = matchSkills(seg)
  // Only skills that appear in the plus-segment (nice-to-have, not core).
  return inSeg
}

export function enrichJob(job: Job): Job {
  if (job.workMode !== undefined) return job // already enriched
  const text = `${job.title} \n ${job.tags.join(' ')} \n ${job.description || ''}`
  const skills = matchSkills(text)
  const niceToHave = detectNiceToHave(text, skills)
  const core = skills.filter((s) => !niceToHave.includes(s))
  const salaryPeriod = detectSalaryPeriod(job, text)
  return {
    ...job,
    country: detectCountry(job),
    workMode: detectWorkMode(text, job),
    relocation: detectRelocation(text),
    foreignerFriendly: detectForeignerFriendly(text),
    languages: detectLanguages(text),
    skills: core,
    niceToHave,
    salaryPeriod,
    salaryUsd: salaryUsd(job, salaryPeriod),
  }
}
