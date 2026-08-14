// Best-effort enrichment: infers structured attributes from a vacancy's text.
// The upstream APIs don't provide these fields, so we derive them heuristically
// from title + description + tags (EN/RU/UK/UZ keywords). Results are approximate
// and meant to power filtering and statistics, not to be authoritative.

import type { Job, LanguageReq, Relocation, SalaryPeriod, WorkMode } from './jobTypes'
import { toUsd } from './currency'
import {
  extractSkillDetails,
  extractSkillNames,
  getSkillMeta,
  type SkillDetail,
} from '../../shared/jobSkills'

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
export const PER_YEAR: Record<SalaryPeriod, number> = {
  hour: 12 * HOURS_PER_MONTH, // 1920
  month: 12,
  year: 1,
}

type ExtractedSalary = Pick<
  Job,
  'salaryMin' | 'salaryMax' | 'salaryCurrency' | 'salaryPeriod'
>

const SALARY_CONTEXT_RE =
  /salary|compensation|pay range|base pay|remuneration|зарплат|оплат[аы]|оклад|доход|вилка|ставка|maosh|маош/i
const MONEY_RE =
  /([$€£₴])?\s*(\d{1,3}(?:[,\s.]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*[kк]|\d{4,9})(?:\s*(USD|EUR|GBP|UAH|UZS|KZT|KGS|TJS|TMT|PLN|RON|MDL|GEL|AMD|AZN|TRY|CAD|CHF))?/gi

function salaryCurrency(text: string): string | undefined {
  const aliases: [RegExp, string][] = [
    [/\bUSD\b|\$|доллар/i, 'USD'],
    [/\bEUR\b|€/i, 'EUR'],
    [/\bGBP\b|£/i, 'GBP'],
    [/\bUAH\b|₴|грн/i, 'UAH'],
    [/\bUZS\b|с[уў]м|so['’]?m/i, 'UZS'],
    [/\bKZT\b|тенге/i, 'KZT'],
    [/\bKGS\b|киргизск\w*\s+сом/i, 'KGS'],
    [/\bTJS\b|сомон/i, 'TJS'],
    [/\bTMT\b|манат/i, 'TMT'],
    [/\bPLN\b|zł/i, 'PLN'],
    [/\bRON\b|\blei\b/i, 'RON'],
  ]
  return aliases.find(([pattern]) => pattern.test(text))?.[1]
}

function salaryAmount(raw: string): number | undefined {
  const compact = raw.replace(/\s+/g, '').toLowerCase()
  const thousands = /[kк]$/.test(compact)
  const numeric = compact.replace(/[kк]$/, '')
  let parsed: number
  if (thousands) {
    parsed = Number.parseFloat(numeric.replace(',', '.')) * 1000
  } else if (/^\d{1,3}([,.])\d{3}(?:\1\d{3})*(?:[,.]\d+)?$/.test(numeric)) {
    parsed = Number(numeric.replace(/[,.]/g, ''))
  } else {
    parsed = Number(numeric.replace(',', '.'))
  }
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined
}

function explicitSalaryPeriod(text: string): SalaryPeriod | undefined {
  if (/per hour|\/\s?h(ou)?r\b|hourly|\bp\/h\b|в час|за час|годину|годин\b/i.test(text)) return 'hour'
  if (/per month|monthly|\/\s?mo(nth)?\b|в месяц|на месяц|в мес\b|у місяць/i.test(text)) return 'month'
  if (/per year|yearly|annual(ly)?|per annum|\bp\.?a\.?\b|\/\s?y(ea)?r\b|в год|на год|у рік|за рік/i.test(text)) {
    return 'year'
  }
  return undefined
}

/** Infer a salary range from salary/compensation sentences in a description. */
export function extractSalaryFromText(raw: string | undefined): ExtractedSalary {
  if (!raw) return {}
  const text = cleanText(raw)
  const segments = text.split(/(?<=[.!?])\s+/).filter((segment) => SALARY_CONTEXT_RE.test(segment))

  for (const segment of segments) {
    const currency = salaryCurrency(segment)
    if (!currency) continue
    const amounts = [...segment.matchAll(MONEY_RE)]
      .map((match) => salaryAmount(match[2] || ''))
      .filter((amount): amount is number => amount !== undefined)
    if (!amounts.length) continue

    const first = amounts[0]!
    const second = amounts[1]
    const period = explicitSalaryPeriod(segment)
    if (second !== undefined) {
      return {
        salaryMin: Math.min(first, second),
        salaryMax: Math.max(first, second),
        salaryCurrency: currency,
        salaryPeriod: period,
      }
    }
    if (/up to|maximum|max\.?|до\s/i.test(segment)) {
      return { salaryMax: first, salaryCurrency: currency, salaryPeriod: period }
    }
    return { salaryMin: first, salaryCurrency: currency, salaryPeriod: period }
  }
  return {}
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
  ['RO', /romania|bucharest|bucurești|bucuresti|румын|румун|бухарест/i],
  ['TJ', /tajik|dushanbe|таджик|душанбе/i],
  ['TM', /turkmen|ashgabat|туркмен|ашхабад/i],
  ['PL', /poland|warsaw|krak|polska|польш|варшав|краков/i],
  ['DE', /german|berlin|munich|герман|берлин|deutschland/i],
  ['GB', /united kingdom|london|england|британ|лондон/i],
  ['US', /united states|\busa\b|new york|сша|remote us/i],
  ['CN', /\bchina\b|beijing|shanghai|shenzhen|guangzhou|hangzhou|китай|пекин|шанхай/i],
  ['JP', /\bjapan\b|tokyo|osaka|kyoto|япони|токио|осака/i],
  ['KR', /south korea|\bkorea\b|seoul|busan|коре|сеул/i],
]

// Resolve a free-text blob (EN/RU/UK; country name OR capital city) to an ISO-2
// code, or undefined. Exported so the location filter can match typed queries
// like "Узбекистан"/"Ташкент"/"Uzbekistan" against a job's detected country.
export function resolveCountry(text: string): string | undefined {
  if (!text) return undefined
  for (const [code, re] of COUNTRY_PATTERNS) if (re.test(text)) return code
  return undefined
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

// ---- Work mode ----
function detectWorkMode(text: string, job: Job): WorkMode {
  if (/hybrid|гибрид|гібрид|part[- ]?remote/i.test(text)) return 'hybrid'
  if (/\bremote\b|удал[её]нк|віддален|home ?office|\bwfh\b|дистанцион/i.test(text) || job.remote) {
    if (/on[- ]?site|in[- ]?office|в офис|в офіс/i.test(text) && !job.remote) return 'hybrid'
    return 'remote'
  }
  if (/on[- ]?site|in[- ]?office|\boffice\b|в офисе|в офіс|офіс|офис|с рабочего места|иш жойидан|ish joyidan/i.test(text)) return 'office'
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

// ---- Entry level / no prior experience required ----
// Explicit "no experience" phrasing OR an entry-level role type (trainee/intern/
// junior/graduate), across EN/RU/UK. Heuristic — meant for the "without experience"
// filter, not an authoritative seniority label.
function detectNoExperience(text: string): boolean {
  if (
    /no experience (required|needed|necessary)|without (any )?experience|no prior experience|entry[- ]level|без опыта|без досвід|досвід не потр|опыт работы не|опыт не требуется/i.test(
      text,
    )
  ) {
    return true
  }
  return /\b(trainee|intern|internship|graduate|junior)\b|джун\w*|джуніор|стаж[ёе]р|стажир|стажув|стажов|початківц|начинающ/i.test(
    text,
  )
}

function detectExperienceMinYears(text: string): number | undefined {
  const years: number[] = []
  const patterns = [
    /\b(\d{1,2}(?:[.,]\d)?)\s*(?:[-–]\s*\d{1,2}(?:[.,]\d)?)?\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?[^.;\n]{0,60}\bexperience\b/gi,
    /\b(?:at least|minimum of|min\.?)\s*(\d{1,2}(?:[.,]\d)?)\s*(?:years?|yrs?)\b/gi,
    /(?:опыт|досвід)\s+(?:работы\s+)?(?:от\s+)?(\d{1,2}(?:[.,]\d)?)\s*(?:[-–]\s*\d{1,2}(?:[.,]\d)?)?\s*(?:лет|год[а]?|рок[иів]?)/gi,
    /\b(\d{1,2}(?:[.,]\d)?)\s*(?:[-–]\s*\d{1,2}(?:[.,]\d)?)?\s*(?:йил|yil)(?:дан)?[^.;\n]{0,32}(?:тажриб|tajriba)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(String(match[1]).replace(',', '.'))
      if (Number.isFinite(value) && value >= 0 && value <= 40) years.push(value)
    }
  }
  return years.length ? Math.max(...years) : undefined
}

// ---- Languages + levels ----
const LANGUAGES: [string, RegExp][] = [
  ['English', /english|англий|англ\.|англійськ/i],
  ['German', /german|deutsch|немецк|німецьк/i],
  ['Russian', /russian|русск|російськ/i],
  ['Ukrainian', /ukrainian|українськ|украинск/i],
  ['Uzbek', /uzbek|узбекск|o'zbek/i],
  ['Kazakh', /kazakh|қазақ|казахск/i],
  ['French', /french|français|французск/i],
  ['Spanish', /spanish|español|испанск/i],
  ['Polish', /polish|polski|польск/i],
  ['Turkish', /turkish|türkçe|турецк/i],
  ['Japanese', /japanese|日本語|японск/i],
]

function normalizeLevel(raw: string): string {
  const s = raw.toLowerCase()
  if (/^[abc][12]$/.test(s)) return s.toUpperCase()
  if (/upper/.test(s)) return 'Upper-Intermediate'
  if (/pre-?inter/.test(s)) return 'Pre-Intermediate'
  if (/inter|средн|разговорн|conversational/.test(s)) return 'Intermediate'
  if (/advanc|proficient|свободн/.test(s)) return 'Advanced'
  if (/fluent/.test(s)) return 'Fluent'
  if (/native/.test(s)) return 'Native'
  if (/business/.test(s)) return 'Business'
  if (/element|basic|beginner|базов|начальн/.test(s)) return 'Basic'
  return raw
}

function detectLanguages(text: string): LanguageReq[] {
  const out: LanguageReq[] = []
  for (const [name, re] of LANGUAGES) {
    const m = re.exec(text)
    if (!m) continue
    // Prefer a level directly adjacent to the language. This distinguishes
    // "Business level English and native level Japanese" correctly.
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30)
    const beforeLevel = before.match(
      /\b(a1|a2|b1|b2|c1|c2|pre-?intermediate|upper[- ]?intermediate|intermediate|elementary|advanced|proficient|fluent|native|business|beginner|basic|conversational)\s*(?:level|proficiency)?\s*$/i,
    )
    const afterLevel = after.match(
      /^\s*(?:[-:(),]|at|level|proficiency)*\s*(a1|a2|b1|b2|c1|c2|pre-?intermediate|upper[- ]?intermediate|intermediate|elementary|advanced|proficient|fluent|native|business|beginner|basic|conversational)\b/i,
    )
    const listLevel = /\bfluent\s+in\s+[^.;\n]{0,100}$/i.test(before) ? 'fluent' : undefined
    const rawLevel = beforeLevel?.[1] || afterLevel?.[1] || listLevel
    out.push({ language: name, level: rawLevel ? normalizeLevel(rawLevel) : undefined })
  }
  return out
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

export function enrichJob(job: Job): Job {
  if (job.workMode !== undefined) return job // already enriched
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
  const allSkillDetails = matchSkillDetails(text)
  const skills = allSkillDetails.map(({ name }) => name)
  const niceToHave = detectNiceToHave(text)
  const coreDetails = allSkillDetails.filter(({ name }) => !niceToHave.includes(name))
  const niceToHaveDetails = allSkillDetails.filter(({ name }) => niceToHave.includes(name))
  const core = coreDetails.map(({ name }) => name)
  const hasSalary = clean.salaryMin !== undefined || clean.salaryMax !== undefined
  const experienceMinYears = detectExperienceMinYears(text)
  const salaryPeriod = hasSalary
    ? job.salaryPeriod ?? extractedSalary.salaryPeriod ?? detectSalaryPeriod(clean, text)
    : undefined
  return {
    ...clean,
    country: detectCountry(clean),
    workMode: detectWorkMode(text, job),
    relocation: detectRelocation(text),
    foreignerFriendly: detectForeignerFriendly(text),
    noExperience: detectNoExperience(text) || experienceMinYears === 0,
    experienceMinYears,
    languages: detectLanguages(text),
    skills: core,
    niceToHave,
    skillDetails: coreDetails,
    niceToHaveDetails,
    salaryPeriod,
    salaryUsd: salaryPeriod ? salaryUsd(clean, salaryPeriod) : undefined,
  }
}
