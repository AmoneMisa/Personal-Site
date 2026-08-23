import type { CvProfile } from './hiringTypes'
import { extractCandidateGender } from './hiringCandidateFields'

export type HiringCandidateLocale = 'en' | 'ru'

const HIDDEN_NAME_RE = /^(?:[?？�\uFFFD]{2,}|(?:фио|имя|name|full name)?\s*(?:скрыт\p{L}*|hidden|yashiril\p{L}*|ascuns)|не\s+указано|not\s+specified|anonymous|аноним)$/iu
const GENERIC_ROLE_RE = /^(?:ищу\s+(?:работу|подработку)(?:\s+(?:онлайн|удал[её]нно))?|подработка|работа|работу|любая\s+работа|любая\s+занятость|не\s*важно|без\s+разницы|нет\s+разницы|farqi\s+yo['’ʻʼ‘`]?q|ish\s+qidir(?:yapman|aman)|ish\s+izlayapman|ish\s+kerak|onlayn|online|удал[её]нно|remote)$/iu
const REMOTE_GENERIC_RE = /(?:онлайн|online|onlayn|удал[её]н|remote|masofaviy)/iu
const HORECA_GENERIC_RE = /(?:ищу|нужна|нужен|работа|ишу)?[^\n]{0,40}(?:кафе|кафетер|ресторан|общепит|horeca)(?:[^\n]{0,40}(?:работ|подработ))?/iu
const FINANCE_GENERIC_RE = /^(?:финансы?\s*[,/&+]\s*банки?|банки?\s*[,/&+]\s*финансы?|finance\s*[,/&+]\s*banking)$/iu
const WATER_SUPPLY_RE = /^(?:suv\s+ta['’ʻʼ‘`]?minoti|водоснабжение)$/iu
const OPERATIVE_OFFICER_RE = /^(?:оперативник|оперуполномоченн\p{L}*|оперативный\s+уполномоченн\p{L}*)$/iu
const STRONG_GENERIC_KEYS = new Set([
  'Any Role',
  'Restaurant / Cafe Worker',
  'Finance / Banking Specialist',
  'Water Supply Specialist',
  'Operative Officer',
])

function smartNameCase(value: string): string {
  const trimmed = value.trim().replace(/\s{2,}/g, ' ')
  if (!trimmed) return ''
  const letters = trimmed.match(/\p{L}/gu) || []
  if (!letters.length) return trimmed
  const upper = trimmed.match(/\p{Lu}/gu) || []
  if (upper.length / letters.length < 0.8) return trimmed
  return trimmed.toLocaleLowerCase('ru').replace(/(^|[\s-])(\p{L})/gu, (_m, boundary: string, letter: string) => (
    `${boundary}${letter.toLocaleUpperCase('ru')}`
  ))
}

export function publicCandidateName(name: string | null | undefined, locale: HiringCandidateLocale): string {
  const raw = String(name || '').trim()
  if (!raw || HIDDEN_NAME_RE.test(raw)) return locale === 'en' ? 'Name hidden' : 'ФИО скрыто'
  return smartNameCase(raw)
}

function normalizeRoleKey(value: string): string {
  const raw = value.trim().replace(/\s{2,}/g, ' ')
  if (!raw) return ''
  if (OPERATIVE_OFFICER_RE.test(raw)) return 'Operative Officer'
  if (FINANCE_GENERIC_RE.test(raw)) return 'Finance / Banking Specialist'
  if (WATER_SUPPLY_RE.test(raw)) return 'Water Supply Specialist'
  if (HORECA_GENERIC_RE.test(raw) && !/(?:официант|повар|бариста|бармен|кассир|waiter|cook|chef|barista|bartender)/iu.test(raw)) {
    return 'Restaurant / Cafe Worker'
  }
  if (GENERIC_ROLE_RE.test(raw)) return 'Any Role'
  return raw
}

export function publicCandidateProfessionKeys(profile: CvProfile): string[] {
  // The current desired-title field is stronger than stale/inferred professions.
  // This matters for Flagma cards such as role="Онлайн" with previous work
  // "Воспитатель": the previous profession must not replace the current target.
  const roleKey = normalizeRoleKey(profile.role || '')
  if (STRONG_GENERIC_KEYS.has(roleKey)) return [roleKey]

  const raw = profile.professions?.length ? profile.professions : [profile.role].filter(Boolean)
  const normalized = [...new Set(raw.map((value) => normalizeRoleKey(String(value || ''))).filter(Boolean))]
  if (normalized.length) return normalized

  const text = profile.originalText || profile.description || ''
  if (HORECA_GENERIC_RE.test(text)) return ['Restaurant / Cafe Worker']
  if (REMOTE_GENERIC_RE.test(text) || GENERIC_ROLE_RE.test(profile.role || '')) return ['Any Role']
  return []
}

export function publicCandidateRemote(profile: CvProfile): boolean | null | undefined {
  const text = `${profile.role || ''}\n${profile.originalText || profile.description || ''}`
  if (REMOTE_GENERIC_RE.test(text)) return true
  return profile.remote
}

export function publicCandidateGender(profile: CvProfile): CvProfile['gender'] {
  const text = `${profile.name || ''}\n${profile.originalText || profile.description || ''}`
  // Re-read the source text before trusting a previously stored/inferred value.
  // This fixes rows such as "Zilola (Мужчина)" where a name-based guess may
  // have been persisted before the explicit marker was parsed.
  return extractCandidateGender(text) || profile.gender
}

interface LanguageRule { labelRu: string; labelEn: string; re: RegExp }
const LANGUAGE_RULES: LanguageRule[] = [
  { labelRu: 'Русский', labelEn: 'Russian', re: /русск\p{L}*|russian|rus\s+tili/iu },
  { labelRu: 'Узбекский', labelEn: 'Uzbek', re: /узбекск\p{L}*|uzbek|o['’ʻʼ‘`]?zbek\s+tili/iu },
  { labelRu: 'Таджикский', labelEn: 'Tajik', re: /таджикск\p{L}*|tajik|tojik\s+tili/iu },
  { labelRu: 'Английский', labelEn: 'English', re: /английск\p{L}*|english|ingliz\s+tili/iu },
  { labelRu: 'Казахский', labelEn: 'Kazakh', re: /казахск\p{L}*|kazakh|qozoq\s+tili/iu },
  { labelRu: 'Кыргызский', labelEn: 'Kyrgyz', re: /кыргызск\p{L}*|киргизск\p{L}*|kyrgyz|qirg['’ʻʼ‘`]?iz\s+tili/iu },
  { labelRu: 'Украинский', labelEn: 'Ukrainian', re: /украинск\p{L}*|українськ\p{L}*|ukrainian/iu },
  { labelRu: 'Турецкий', labelEn: 'Turkish', re: /турецк\p{L}*|turkish|turk\s+tili/iu },
  { labelRu: 'Румынский', labelEn: 'Romanian', re: /румынск\p{L}*|rom[aâ]n\p{L}*|romanian/iu },
]

const LEVELS: Array<{ ru: string; en: string; re: RegExp }> = [
  { ru: 'родной', en: 'native', re: /родн\p{L}*|native|ona\s+tili/iu },
  { ru: 'свободный', en: 'fluent', re: /свободн\p{L}*|fluent|erkin/iu },
  { ru: 'профессиональный', en: 'professional', re: /профессиональн\p{L}*|professional/iu },
  { ru: 'разговорный', en: 'conversational', re: /разговорн\p{L}*|conversational/iu },
  { ru: 'средний', en: 'intermediate', re: /intermediate|средн\p{L}*\s+уров/iu },
  { ru: 'базовый', en: 'basic', re: /базов\p{L}*|basic|boshlang['’ʻʼ‘`]?ich/iu },
]

function languageLevel(text: string, index: number, locale: HiringCandidateLocale): string | null {
  const nearby = text.slice(Math.max(0, index - 45), Math.min(text.length, index + 70))
  const cefr = nearby.match(/(?:^|[^A-Z])(A1|A2|B1|B2|C1|C2)(?=$|[^A-Z])/i)?.[1]?.toUpperCase()
  if (cefr) return cefr
  const level = LEVELS.find((item) => item.re.test(nearby))
  return level ? (locale === 'en' ? level.en : level.ru) : null
}

export function publicCandidateLanguages(profile: CvProfile, locale: HiringCandidateLocale): string[] {
  const text = profile.originalText || profile.description || ''
  const out = new Set<string>((profile.languages || []).filter(Boolean))
  for (const language of LANGUAGE_RULES) {
    const match = language.re.exec(text)
    if (!match?.index && match?.index !== 0) continue
    const label = locale === 'en' ? language.labelEn : language.labelRu
    const level = languageLevel(text, match.index, locale)
    out.add(level ? `${label} — ${level}` : label)
  }
  return [...out]
}

function amountWithUnit(rawNumber: string, rawUnit: string | undefined): number | null {
  const value = Number(rawNumber.replace(/\s+/g, '').replace(',', '.'))
  if (!Number.isFinite(value) || value <= 0) return null
  const unit = rawUnit || ''
  if (/(?:млн|миллион|million|mln)/iu.test(unit)) return Math.round(value * 1_000_000)
  if (/(?:тыс|тысяч|thousand|ming)/iu.test(unit)) return Math.round(value * 1_000)
  return Math.round(value)
}

/**
 * Repairs mixed-unit salary phrases. A single global multiplier turns
 * "от 500 тысяч до 1 миллиона" into 500,000,000–1,000,000; each bound must
 * carry its own unit.
 */
export function publicCandidateSalary(profile: CvProfile): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const text = profile.originalText || profile.description || ''
  const mixed = text.match(
    /(?:от|from)?\s*(\d+(?:[.,]\d+)?)\s*(тыс\p{L}*|thousand|ming|млн\p{L}*|миллион\p{L}*|million|mln)?\s*(?:сум|so['’ʻʼ‘`]?m|UZS)?\s*(?:до|[-–—]|to)\s*(\d+(?:[.,]\d+)?)\s*(тыс\p{L}*|thousand|ming|млн\p{L}*|миллион\p{L}*|million|mln)?/iu,
  )
  if (!mixed || (!mixed[2] && !mixed[4] && !/(?:зарплат|зп|salary|maosh|oylik|ish\s+haqi)/iu.test(mixed[0]))) {
    return { salaryMin: profile.salaryMin, salaryMax: profile.salaryMax, currency: profile.currency }
  }
  const first = amountWithUnit(mixed[1]!, mixed[2])
  const second = amountWithUnit(mixed[3]!, mixed[4])
  if (first == null || second == null) return { salaryMin: profile.salaryMin, salaryMax: profile.salaryMax, currency: profile.currency }
  return {
    salaryMin: Math.min(first, second),
    salaryMax: Math.max(first, second),
    currency: /\$|USD|доллар/iu.test(mixed[0]) ? 'USD' : profile.currency || 'UZS',
  }
}
