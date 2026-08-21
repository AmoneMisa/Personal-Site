// Deterministic repair layer for candidate cards.
//
// Source adapters intentionally stay conservative. This layer fixes structured
// facts that can be proven from the original CV text, including legacy records
// already persisted before a parser rule was added. It never guesses gender,
// remote status, location, or a profession from a person's name.

import type { CvProfile } from './hiringTypes'

const GENERIC_PROFESSIONS = new Set([
  'Engineer',
  'Administrator',
  'Manager',
  'Specialist',
])

const SPECIAL_PROFESSIONS: Array<{ name: string; re: RegExp }> = [
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

function candidateTargetContext(profile: CvProfile, text: string): string {
  const roleField = field(
    text,
    "желаемая (?:работа|должность)|бажана (?:робота|посада)|target role|desired (?:role|position)|position|role|должность|посада|lavozim|kasb|qidirayotgan kasb|so(?:'|’)ralgan ish turi|texnologiya|technology",
  )
  const technology = field(text, "texnologiya|technology|технология|технології")
  const headline = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 6).join('\n')
  return [profile.role || '', ...(profile.professions || []), roleField || '', technology || '', headline].join('\n')
}

function repairProfessions(profile: CvProfile, text: string): string[] {
  const current = unique(profile.professions?.length ? profile.professions : [profile.role || ''])
  const target = candidateTargetContext(profile, text)
  const specific = SPECIAL_PROFESSIONS.filter((rule) => rule.re.test(target)).map((rule) => rule.name)
  if (!specific.length) return current

  return unique([
    ...specific,
    ...current.filter((profession) => !GENERIC_PROFESSIONS.has(profession) && !/^Engineer$/iu.test(profession)),
  ])
}

function structuredName(text: string): string | null {
  const value = field(text, "xodim|hodim|ism(?:i|im)?|f\\.?i\\.?o\\.?|фио|піб|full name|name|имя|ім(?:ʼ|')я")
  if (!value) return null
  const cleaned = value.replace(/[📚🕑🌐💰📞🇺🇿].*$/u, '').trim()
  return cleaned.length >= 2 && cleaned.length <= 100 ? cleaned : null
}

function explicitLocation(text: string): string | null {
  return field(text, 'location|локация|локація|country|страна|країна')
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
  return { salaryMin: Math.round(value), salaryMax: Math.round(value), currency }
}

/**
 * Training, bootcamp and recruitment-program announcements belong to Job Finder,
 * not the candidate board. Requiring multiple program signals avoids rejecting a
 * real candidate merely because their CV says they previously completed a course.
 */
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
