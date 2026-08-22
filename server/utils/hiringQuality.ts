// Deterministic repair layer for candidate cards.
//
// Source adapters intentionally stay conservative. This layer fixes structured
// facts that can be proven from the original CV text, including legacy records
// already persisted before a parser rule was added. It never guesses gender,
// remote status, location, or a profession from a person's name. Semantic AI
// enrichment remains authoritative for ambiguous free-form text.

import type { CvProfile } from './hiringTypes'
import { detectMentionedProfessions } from './hiringNormalize'

const STATUS_ONLY_RE = /^(?:talaba|student|студент(?:ка)?|студент(?:ка)?ка|o(?:'|’)quvchi|учащ(?:ийся|аяся))$/iu

const SPECIAL_PROFESSIONS: Array<{ name: string; re: RegExp }> = [
  {
    name: 'HR / Recruiter',
    re: /#(?:hr|hrd|hrbp|hrgeneralist|peopleops)\b|\b(?:hr\s+lead|head\s+of\s+hr|people\s+partner|talent\s+operations|кадров\p{L}*\s+аудит)\b/iu,
  },
  {
    name: 'Sales Manager',
    re: /(?:sotuv|savdo)\s+(?:menejer|menejr|menedjer|manager)|\bsales\s+manager\b|менеджер\s+(?:по\s+)?продаж|менеджер\s+з\s+продаж/iu,
  },
  {
    name: 'Backend Developer',
    re: /\bbackend\s+(?:developer|engineer)\b|\bback[- ]?end\s+(?:developer|engineer)\b|backend\s+dasturchi|серверн(?:ый|ий)\s+разработчик/iu,
  },
  {
    name: 'Frontend Developer',
    re: /\bfrontend\s+(?:developer|engineer)\b|\bfront[- ]?end\s+(?:developer|engineer)\b|frontend\s+dasturchi/iu,
  },
  {
    name: 'AI / ML Engineer',
    re: /\b(?:ai|artificial\s+intelligence|machine\s+learning|ml)\s*(?:\/\s*(?:ai|ml))?\s*(?:engineer|developer)\b|\b(?:engineer|developer)\s+(?:ai|ml|machine\s+learning)\b/iu,
  },
  {
    name: 'Penetration Tester',
    re: /\b(?:penetration\s+tester|penetration\s+testing|pentest(?:er|ing)?)\b|пентест(?:ер|инг)?/iu,
  },
  {
    name: 'Network Administrator',
    re: /\b(?:network\s+administrator|network\s+admin)\b|(?:tarmoq|тармоқ)[^\n]{0,70}(?:administrator|admin(?:strator)?i?|администратор)/iu,
  },
  {
    name: 'System Administrator',
    re: /\b(?:system\s+administrator|system\s+admin|sysadmin)\b|(?:tizim|тизим)[^\n]{0,50}(?:administrator|admin(?:strator)?i?|администратор)|системн(?:ый|ий)\s+администратор/iu,
  },
  {
    name: 'Cybersecurity Specialist',
    re: /\b(?:cybersecurity|cyber\s+security|information\s+security)\b|кибербезопасност|кібербезпек|информационн(?:ая|ой)\s+безопасност|інформаційн(?:а|ої)\s+безпек|axborot\s+xavfsizligi/iu,
  },
  {
    name: 'Data Scientist',
    re: /\bdata\s+scientist\b|\bdata\s+science\b|дата\s+саентист/iu,
  },
  {
    name: 'Data Engineer',
    re: /\bdata\s+engineer\b|инженер\s+данных|інженер\s+даних/iu,
  },
]

const COUNTRY_ALIASES: Array<{ code: string; name: string; re: RegExp }> = [
  { code: 'CA', name: 'Canada', re: /(?<![\p{L}\p{N}])(?:canada|канада)(?![\p{L}\p{N}])/iu },
  { code: 'US', name: 'United States', re: /(?<![\p{L}\p{N}])(?:usa|u\.?s\.?a\.?|united\s+states|сша)(?![\p{L}\p{N}])/iu },
  { code: 'RO', name: 'Romania', re: /(?<![\p{L}\p{N}])(?:romania|румыния|румунія|românia)(?![\p{L}\p{N}])/iu },
  { code: 'UA', name: 'Ukraine', re: /(?<![\p{L}\p{N}])(?:ukraine|украина|україна)(?![\p{L}\p{N}])/iu },
  { code: 'UZ', name: 'Uzbekistan', re: /(?<![\p{L}\p{N}])(?:uzbekistan|узбекистан|o(?:'|’)zbekiston)(?![\p{L}\p{N}])/iu },
  { code: 'KZ', name: 'Kazakhstan', re: /(?<![\p{L}\p{N}])(?:kazakhstan|казахстан|қазақстан)(?![\p{L}\p{N}])/iu },
  { code: 'KG', name: 'Kyrgyzstan', re: /(?<![\p{L}\p{N}])(?:kyrgyzstan|киргизия|кыргызстан)(?![\p{L}\p{N}])/iu },
]

function field(text: string, names: string): string | null {
  const match = text.match(new RegExp(`(?:^|\\n)[^\\p{L}\\p{N}\\n]{0,8}(?:${names})\\s*[:：—-]\\s*([^\\n]{1,220})`, 'iu'))
  return match?.[1]?.trim() || null
}

function cleanToken(value: string): string {
  return value.replace(/^[#@\s]+|[#@\s]+$/g, '').replace(/\s+/g, ' ').trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function intentLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /(?:maqsad|мақсад|goal|цель|мета|ish\s+topish|ищу\s+работ|шукаю\s+робот|looking\s+for\s+(?:a\s+)?job)/iu.test(line))
    .slice(0, 4)
    .join('\n')
}

function candidateTargetContext(profile: CvProfile, text: string): string {
  const roleFieldRaw = field(
    text,
    "желаемая (?:работа|должность)|бажана (?:робота|посада)|target role|desired (?:role|position)|position|role|должность|посада|lavozim|kasbi|kasb|qidirayotgan kasb|so(?:'|’)ralgan ish turi",
  )
  const roleField = roleFieldRaw && !STATUS_ONLY_RE.test(cleanToken(roleFieldRaw)) ? roleFieldRaw : ''
  const goal = field(text, 'maqsad|мақсад|goal|цель|мета') || ''
  const headline = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 4).join('\n')

  // Technology/stack is deliberately NOT part of target context. JavaScript or
  // PostgreSQL are skills, not desired professions. A profession must come from
  // an explicit role/goal/headline or from AI semantic extraction.
  return [profile.role || '', ...(profile.professions || []), roleField, goal, intentLines(text), headline].join('\n')
}

function repairProfessions(profile: CvProfile, text: string): string[] {
  const current = unique(profile.professions?.length ? profile.professions : [profile.role || ''])
  const target = candidateTargetContext(profile, text)
  const specific = SPECIAL_PROFESSIONS.filter((rule) => rule.re.test(target)).map((rule) => rule.name)
  if (!specific.length && !current.length) {
    const technologies = field(text, 'texnologiya|technologies|technology|stack') || ''
    if (/\bflutter\b|\bdart\b/iu.test(technologies)) return ['Mobile Developer']
    const softwareSignals = (technologies.match(/\b(?:python|java(?:script)?|typescript|php|react|next\.?\s*js|fastapi|flask|sql|html|css)\b/giu) || []).length
    if (softwareSignals >= 2) return ['Software Developer']
    const headline = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8).join('\n')
    const headlineProfessions = detectMentionedProfessions(headline)
    if (headlineProfessions.length) return headlineProfessions
  }
  if (!specific.length) return current

  return unique(specific)
}

function structuredName(text: string): string | null {
  const value = field(text, "xodim|hodim|ism(?:i|im)?|f\\.?i\\.?o\\.?|фио|піб|full name|name|имя|ім(?:ʼ|')я")
  if (value) {
    const cleaned = value.replace(/[📚🕑🌐💰📞🇺🇿].*$/u, '').trim()
    if (cleaned.length >= 2 && cleaned.length <= 100) return cleaned
  }
  const linkedIn = text.match(/(?:резюме|resume)\s*\|\s*(\p{Lu}\p{Ll}+(?:\s+\p{Lu}(?:\p{Ll}+|\.))?)/u)?.[1]
    || text.match(/(?:^|\n)(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+)+)\s+-\s+(?:HR|Developer|Engineer|Manager|Designer)\b/u)?.[1]
  if (linkedIn) return linkedIn
  const introduced = text.match(/(?:^|\n)(?:вітаю,?\s+)?мене\s+звати\s+(\p{Lu}\p{Ll}+)/iu)?.[1]
  if (introduced) return introduced
  const handleName = text.match(/@(\p{Lu}\p{Ll}{2,})(?:_|\p{Lu}|\d)/u)?.[1]
  if (handleName) return handleName
  return text.match(/(?:^|\n)(\p{Lu}\p{Ll}+)\s+\d+\+?\s+(?:рок\p{L}*|лет|years?)\s+(?:у|в|in)\s+(?:HR|IT)\b/iu)?.[1] || null
}

function explicitLocation(text: string): string | null {
  const labelled = field(text, 'location|локация|локація|country|страна|країна')
  if (labelled) return labelled

  // Candidate feeds frequently use compact headlines such as
  // `Локація #Canada` without punctuation between label and value.
  const compact = text.match(/(?:^|\n)[^\p{L}\p{N}\n]{0,8}(?:location|локация|локація|country|страна|країна)\s+(#?[\p{L}][^\n]{0,120})/iu)
  return compact?.[1]?.trim() || null
}

function countryFromLocation(value: string | null): { code: string; name: string } | null {
  if (!value) return null
  const match = COUNTRY_ALIASES.find((country) => country.re.test(value))
  return match ? { code: match.code, name: match.name } : null
}

function cityFromLocation(value: string | null, country: { code: string; name: string } | null): string | null {
  if (!value || !country) return null
  const cleaned = cleanToken(value)
  if (!cleaned) return null
  if (COUNTRY_ALIASES.some((item) => item.re.test(cleaned) && cleaned.replace(item.re, '').replace(/[,#\s-]+/g, '') === '')) return null

  const first = cleanToken(cleaned.split(',')[0] || '')
  if (!first || COUNTRY_ALIASES.some((item) => item.re.test(first))) return null
  if (/^(?:europe|europa|європа|европа|штати|states)$/iu.test(first)) return null
  return first.slice(0, 80)
}

function explicitRemote(text: string): boolean | null {
  if (/(?:onsite|on-site|office\s+only|тільки\s+офіс|только\s+офис|без\s+удал[её]нк|не\s+рассматрива\p{L}*\s+удал[её]н|ofisda\s+ish)/iu.test(text)) return false
  if (/(?:\bremote\b|\bremotely\b|удал[её]н(?:но|ка|ный|ная)?|віддален(?:о|а|ий)?|дистанц(?:ионно|ійно)|masofaviy|онлайн\s+работ|online\s+work)/iu.test(text)) return true
  return null
}

function approximateExperience(text: string): number | null {
  const uz = text.match(/\b(\d+(?:[.,]\d+)?)\s*yil(?:ga)?\s+(?:yaqin|atrofida)\s+tajriba/iu)
    || text.match(/tajriba\p{L}*[^\n\d]{0,40}(\d+(?:[.,]\d+)?)\s*yil/iu)
  if (!uz) return null
  const years = Number(uz[1]!.replace(',', '.'))
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function uzSalary(text: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> | null {
  const raw = field(text, 'narxi|narx')
  if (!raw) return null
  const match = raw.match(/(\d[\d\s.,]*\d|\d)/)
  if (!match) return null
  let value = Number(match[1]!.replace(/[\s,]/g, ''))
  if (!Number.isFinite(value) || value <= 0) return null
  if (/\b(?:mln|million)\b/iu.test(raw)) value *= 1_000_000
  else if (/\b(?:ming|thousand)\b/iu.test(raw)) value *= 1_000
  const currency = /(?:\$|usd|dollar)/iu.test(raw) ? 'USD' : 'UZS'
  return {
    salaryMin: Math.round(value),
    salaryMax: /\+/.test(raw) ? null : Math.round(value),
    currency,
  }
}

/**
 * Training, bootcamp and recruitment-program announcements belong to Job Finder,
 * not the candidate board. Requiring multiple program signals avoids rejecting a
 * real candidate merely because their CV says they previously completed a course.
 */
// Charity and fundraising appeals: someone is being helped, not hired.
const APPEAL_RE =
  /(?:шелтер|притулок|прихисток|благодійн\p{L}*|благотворительн\p{L}*|донат\p{L}*|пожертв\p{L}*|збір\s+(?:кошт|грош)\p{L}*|сбор\s+средств|допоможіть|допомогти\s+(?:родин|дідус|бабус)\p{L}*|потребує\s+допомоги|нуждается\s+в\s+помощи|опікунств\p{L}*|інвалідніст\p{L}*|карта\s+для\s+допомоги|реквізити\s+для|monobank|банка\s+збор)/iu

/** True when the post asks for help rather than offering work. */
export function isCharityAppeal(text: string): boolean {
  if (!text) return false
  const matches = text.match(new RegExp(APPEAL_RE.source, 'giu')) || []
  // One mention can be incidental ("маю досвід роботи у благодійному фонді");
  // two or more make it the subject of the post.
  return matches.length >= 2
}

export function isRecruitingOpportunity(text: string): boolean {
  const value = text.replace(/\s+/g, ' ').trim()
  if (!value) return false

  const signals = [
    /(?:\blaboratory\b|\bacademy\b|\bbootcamp\b|\btraining\s+program\b|\binternship\s+program\b|лабораторія|лаборатория|академія|академия|буткемп)/iu,
    /(?:запрошує|приглашает|приглашаем|набір|набор)[^.]{0,100}(?:кандидат|учасник|участник)/iu,
    /(?:(?:реєстрац|регистрац)\p{L}*\s+до|\bregistration\b\s+(?:until|by))/iu,
    /(?:(?:старт|початок)\s*[—:,-]?\s*\d{1,2}\s+\p{L}+|\bstart\b\s*[—:,-]?\s*\d{1,2})/iu,
    /(?:кількість\s+місць|количество\s+мест|\blimited\s+spots\b|менторськ|менторск|\bmentorship\b)/iu,
  ].filter((pattern) => pattern.test(value)).length

  return signals >= 2
}

/** Repair only facts supported by the original source text. */
export function repairCandidateProfile(profile: CvProfile): CvProfile {
  const text = profile.originalText || profile.description || ''
  if (!text) return profile

  const professions = repairProfessions(profile, text)
  const location = explicitLocation(text)
  const detectedCountry = countryFromLocation(location)
  const detectedCity = cityFromLocation(location, detectedCountry)
  const remoteSignal = explicitRemote(text)
  const experience = profile.experienceYears ?? approximateExperience(text)
  const salary = profile.salaryMin == null && profile.salaryMax == null ? uzSalary(text) : null

  let city = profile.city ?? null
  if (detectedCountry) {
    // Old Telegram parsing treated `Локація: #Canada` as a city while leaving
    // the channel's country (UA) in place. Country-only location values must not
    // survive as a fake city.
    const currentCity = cleanToken(city || '')
    if (!detectedCity && COUNTRY_ALIASES.some((item) => item.re.test(currentCity))) city = null
    else if (detectedCity) city = detectedCity
  }

  return {
    ...profile,
    name: profile.name || structuredName(text) || '',
    role: professions[0] || profile.role,
    professions,
    country: detectedCountry?.code || profile.country,
    city,
    remote: remoteSignal ?? (profile.remote === true ? true : null),
    experienceYears: experience,
    ...(salary || {}),
  }
}
