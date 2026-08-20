// Candidate profile normalization + deduplication.
// Free-form posts are normalized without overwriting the original message.

import { canonicalSkillName, extractSkillDetails } from '~~/shared/jobSkills'
import type { CandidateEmploymentType, CvProfile } from './hiringTypes'
import type { Seniority } from './jobTypes'

const B = '(?<![\\p{L}\\p{N}])'
const E = '(?![\\p{L}\\p{N}])'
const rule = (body: string) => new RegExp(`${B}(?:${body})${E}`, 'iu')

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ['lead', rule("tech\\s*lead|team\\s*lead|teamlead|tim\\s*lid|lead|head\\s+of|руководител\\p{L}*|тимлид\\p{L}*|лид")],
  ['senior', rule('senior|sr\\.?|синьор\\p{L}*|сеньор\\p{L}*|ведущий|старший')],
  ['middle', rule('middle|mid-?level|mid|мидл\\p{L}*|миддл\\p{L}*|средний\\s+уровень')],
  ['junior', rule('junior|jr\\.?|джуниор\\p{L}*|джун|младший|trainee|intern(?:ship)?|стажер|стажёр|начинающий')],
]

const JUNIOR_CONTRADICTION_YEARS = 4

export function detectSeniority(text: string, experienceYears?: number | null): Seniority | null {
  for (const [level, re] of SENIORITY_RULES) {
    if (!re.test(text)) continue
    if (level === 'junior' && (experienceYears ?? 0) >= JUNIOR_CONTRADICTION_YEARS) break
    return level
  }
  if (experienceYears == null) return null
  if (experienceYears >= 6) return 'senior'
  if (experienceYears >= 3) return 'middle'
  if (experienceYears >= 1) return 'junior'
  return null
}

export function normalizeSkills(rawSkills: string[] | undefined, text: string): string[] {
  const out = new Set<string>()
  for (const raw of rawSkills || []) {
    const canonical = canonicalSkillName(raw)
    if (canonical) out.add(canonical)
    else {
      const trimmed = raw.trim().replace(/\s{2,}/g, ' ')
      if (trimmed.length >= 2 && trimmed.length <= 60) out.add(trimmed)
    }
  }
  for (const { name } of extractSkillDetails(text)) out.add(name)
  return [...out]
}

interface ProfessionRule { name: string; re: RegExp }
const PROFESSION_RULES: ProfessionRule[] = [
  { name: 'Sales Manager', re: /\b(?:sales\s+manager|account\s+manager)\b|менеджер\s+(?:по\s+)?продаж|менеджер\s+з\s+продаж|sotuv\s+menejer/iu },
  { name: 'Project Manager', re: /\bproject\s+manager\b|проектн(?:ый|ий)\s+менеджер|менеджер\s+проект|керівник\s+проєкт/iu },
  { name: 'Product Manager', re: /\bproduct\s+manager\b|продакт\s*менеджер|менеджер\s+продукт/iu },
  { name: 'HR / Recruiter', re: /\b(?:hr|human\s+resources|recruiter|talent\s+acquisition)\b|рекрутер|сорсер|кадровик|hr[-\s]?менеджер/iu },
  { name: 'Office Manager', re: /\boffice\s+manager\b|офис[-\s]?менеджер|офіс[-\s]?менеджер/iu },
  { name: 'Administrator', re: /\badministrator\b|администратор|адміністратор/iu },
  { name: 'Manager', re: /\bmanager\b|менеджер|menejer/iu },
  { name: 'Accountant', re: /\baccountant\b|бухгалтер|buxgalter/iu },
  { name: 'Cashier', re: /\bcashier\b|кассир|касир|kassir/iu },
  { name: 'Salesperson', re: /\b(?:salesperson|sales\s+assistant|shop\s+assistant|seller)\b|продавец|продавець|продавчин|sotuvchi/iu },
  { name: 'Courier', re: /\bcourier\b|курьер|кур'єр|kuryer/iu },
  { name: 'Driver', re: /\bdriver\b|водитель|водій|haydovchi|shafyor/iu },
  { name: 'Security Guard', re: /\bsecurity(?:\s+guard)?\b|охранник|охоронець|охорона|qorovul/iu },
  { name: 'Cleaner', re: /\b(?:cleaner|cleaning|housekeeper)\b|уборщик|уборщица|уборка|прибиральник|прибиральниц|домработниц|farrosh/iu },
  { name: 'Bartender', re: /\b(?:bartender|barman)\b|бармен|barmen/iu },
  { name: 'Barista', re: /\bbarista\b|бариста/iu },
  { name: 'Waiter', re: /\b(?:waiter|waitress)\b|официант|офіціант|afitsant/iu },
  { name: 'Cook / Chef', re: /\b(?:cook|chef)\b|повар|кухар|ошпаз|oshpaz/iu },
  { name: 'Fitness Trainer', re: /\b(?:fitness|gym|personal)\s+(?:trainer|coach)\b|тренер\s+(?:в\s+)?(?:спортзал|спортзале|спортзалі|фитнес|фітнес)|фитнес[-\s]?тренер|фітнес[-\s]?тренер/iu },
  { name: 'Trainer / Coach', re: /\b(?:trainer|coach)\b|тренер|коуч/iu },
  { name: 'Doctor', re: /\bdoctor\b|врач|лікар|доктор|shifokor/iu },
  { name: 'Nurse', re: /\bnurse\b|медсестр|медбрат|медична\s+сестр|hamshira/iu },
  { name: 'Tutor', re: /\btutor\b|репетитор|repetitor/iu },
  { name: 'Kindergarten Teacher', re: /\bkindergarten\s+teacher\b|воспитател|виховател|tarbiyachi/iu },
  { name: 'Nanny', re: /\bnanny\b|няня|нянечк|enaga/iu },
  { name: 'Teacher', re: /\bteacher\b|учитель|вчитель|преподавател|викладач|o(?:'|’)qituvchi/iu },
  { name: 'Software Developer', re: /\b(?:software\s+)?(?:developer|programmer|frontend|front-end|backend|back-end|full[- ]?stack|android|ios)\b|разработчик|розробник|программист|програміст|dasturchi/iu },
  { name: 'QA Engineer', re: /\b(?:qa|quality\s+assurance|tester|test\s+engineer)\b|тестировщик|тестувальник/iu },
  { name: 'DevOps Engineer', re: /\bdevops\b/iu },
  { name: 'Designer', re: /\b(?:designer|ui\/?ux)\b|дизайнер/iu },
  { name: 'Analyst', re: /\banalyst\b|аналитик|аналітик/iu },
  { name: 'Engineer', re: /\bengineer\b|инженер|інженер|muhandis/iu },
  { name: 'Marketer', re: /\b(?:marketer|marketing\s+specialist|smm)\b|маркетолог|smm[-\s]?специалист/iu },
  { name: 'Customer Support', re: /\b(?:customer\s+support|support\s+specialist|call\s*center)\b|поддержк|підтримк|колл[-\s]?центр|call[-\s]?центр/iu },
  { name: 'Construction Worker', re: /\b(?:builder|construction\s+worker)\b|строител|будівельник|разнорабоч|різнороб|qurilish/iu },
  { name: 'Welder', re: /\bwelder\b|сварщик|зварювальник|payvandchi/iu },
  { name: 'Electrician', re: /\belectrician\b|электрик|електрик/iu },
  { name: 'Plumber', re: /\bplumber\b|сантехник|сантехнік/iu },
  { name: 'Mechanic', re: /\bmechanic\b|механик|механік/iu },
  { name: 'Warehouse Worker', re: /\bwarehouse\b|кладовщик|комплектовщик|комірник|склад(?:ской|ський)?\s+работник/iu },
  { name: 'Loader', re: /\bloader\b|грузчик|вантажник/iu },
  { name: 'Seamstress', re: /\bseamstress\b|швея|швачка|tikuvchi/iu },
  { name: 'Operator', re: /\boperator\b|оператор/iu },
]

const SPECIFIC_MANAGER_ROLES = new Set(['Sales Manager', 'Project Manager', 'Product Manager', 'HR / Recruiter', 'Office Manager'])

function cleanRole(raw: string | undefined): string {
  return (raw || '').trim().replace(/^[#\-–—•*\s]+/, '').replace(/[.;,]+$/, '').replace(/\s{2,}/g, ' ').slice(0, 180)
}

function collectProfessions(source: string): string[] {
  const matches: Array<{ name: string; index: number }> = []
  for (const profession of PROFESSION_RULES) {
    const match = profession.re.exec(source)
    if (match?.index != null) matches.push({ name: profession.name, index: match.index })
  }
  matches.sort((a, b) => a.index - b.index)
  const names = [...new Set(matches.map((item) => item.name))]
  if (names.some((name) => SPECIFIC_MANAGER_ROLES.has(name))) {
    const generic = names.indexOf('Manager')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Fitness Trainer')) {
    const generic = names.indexOf('Trainer / Coach')
    if (generic >= 0) names.splice(generic, 1)
  }
  return names
}

export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {
  // Desired-role text wins. Previous employment elsewhere in the CV must not
  // silently become a current target profession.
  const target = cleanRole(rawRole)
  const targetMatches = target ? collectProfessions(target) : []
  if (targetMatches.length) return targetMatches

  // If no structured desired role exists, only inspect the beginning of the post
  // where job-seeker intent/headlines normally live; avoid deep work-history text.
  const fallbackMatches = collectProfessions(text.slice(0, 900))
  if (fallbackMatches.length) return fallbackMatches
  return target ? [target] : []
}

export function normalizeRole(role: string | undefined, text: string): string {
  return normalizeProfessions(role, text)[0] || cleanRole(role)
}

function workHistoryBlock(text: string): string {
  const explicit = text.match(/(?:^|\n)\s*(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous\s+(?:jobs?|positions?)|tajriba|ish\s+tajribasi)\s*[:—-]?\s*([\s\S]{1,2600}?)(?=\n\s*(?:навыки|навички|skills|образование|освіта|education|контакт|contact|ожидания|salary|языки|мови|languages)\s*[:—-]|$)/iu)
  if (explicit?.[1]) return explicit[1]

  // Unstructured posts often use "работал/работала ..." without a heading.
  return text.split('\n').filter((line) =>
    /(?:работал[аи]?|працюва(?:в|ла)|worked\s+(?:as|at)|ishlagan|ishladim|ishlaganman)/iu.test(line),
  ).join('\n')
}

export function normalizePreviousProfessions(text: string): string[] {
  const history = workHistoryBlock(text)
  return history ? collectProfessions(history) : []
}

interface FeatureRule { name: string; re: RegExp }
const FEATURE_RULES: FeatureRule[] = [
  { name: 'Student', re: /\bstudent\b|студент|студентк|talaba/iu },
  { name: 'Parental leave', re: /декрет|в\s+декрете|у\s+декреті|maternity\s+leave|parental\s+leave/iu },
  { name: 'No experience', re: /без\s+опыта|без\s+досвіду|no\s+experience|tajriba\s+yo(?:'|’)q/iu },
  { name: 'Part-time', re: /подработк|підробіт|part[-\s]?time|неполный\s+день|неповн(?:ий|а)\s+день|yarim\s+stavka/iu },
  { name: 'Night shift', re: /ночн(?:ая|ую|ой)\s+смен|нічн(?:а|у|ої)\s+змін|night\s+shift|tungi\s+smena/iu },
  { name: 'Open to relocation', re: /готов\p{L}*\s+к\s+переезду|готов\p{L}*\s+переехать|готов\p{L}*\s+до\s+переїзду|relocat(?:e|ion)|ko(?:'|’)chib\s+o(?:'|’)tish/iu },
]

export function extractCandidateFeatures(text: string): string[] {
  return FEATURE_RULES.filter((feature) => feature.re.test(text)).map((feature) => feature.name)
}

export function extractContacts(text: string): { telegram?: string; email?: string; phone?: string } {
  const out: { telegram?: string; email?: string; phone?: string } = {}
  const tg = text.match(/@[A-Za-z0-9_]{4,32}/)
  if (tg) out.telegram = tg[0]
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (email) out.email = email[0]
  const phone = text.match(/\+?\d[\d\s().-]{8,}\d/)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    if (digits.length >= 9 && digits.length <= 15) out.phone = phone[0].trim()
  }
  return out
}

export function extractAge(text: string): number | null {
  const patterns = [
    /(?:возраст|вік|age|yosh)\s*[:—-]?\s*(\d{1,2})/iu,
    /(?:мне|мені)\s+(\d{1,2})\s*(?:лет|рок(?:и|ів)?)/iu,
    /(?:^|\n)\s*(\d{1,2})\s*(?:лет|рок(?:и|ів)?|yosh)\b/iu,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const age = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(age) && age >= 14 && age <= 90) return age
  }
  return null
}

export function detectRelocationReady(text: string): boolean | null {
  if (/не\s+готов\p{L}*\s+к\s+переезду|не\s+розгляда\p{L}*\s+переїзд|not\s+(?:open|ready)\s+to\s+relocat/iu.test(text)) return false
  if (/готов\p{L}*\s+к\s+переезду|готов\p{L}*\s+переехать|готов\p{L}*\s+до\s+переїзду|relocat(?:e|ion)|ko(?:'|’)chib\s+o(?:'|’)tish/iu.test(text)) return true
  return null
}

export function normalizeEmploymentTypes(text: string, raw?: string | null): CandidateEmploymentType[] {
  const source = `${raw || ''}\n${text}`
  const out = new Set<CandidateEmploymentType>()
  if (/full[-\s]?time|полный\s+(?:рабочий\s+)?день|полная\s+занятость|повн(?:ий|а)\s+(?:робочий\s+)?день|повна\s+зайнятість|to(?:'|’)liq\s+(?:ish|stavka)/iu.test(source)) out.add('full_time')
  if (/part[-\s]?time|неполный\s+(?:рабочий\s+)?день|частичная\s+занятость|подработк|неповн(?:ий|а)\s+(?:робочий\s+)?день|часткова\s+зайнятість|підробіт|yarim\s+stavka/iu.test(source)) out.add('part_time')
  return [...out]
}

export function normalizeCandidate(profile: CvProfile): CvProfile {
  const originalText = profile.originalText || profile.description || ''
  const text = `${profile.name || ''}\n${profile.role || ''}\n${originalText}`
  const contacts = extractContacts(text)
  const professions = normalizeProfessions(profile.role, originalText)
  const age = profile.age ?? extractAge(originalText)
  const employmentTypes = profile.employmentTypes?.length
    ? profile.employmentTypes
    : normalizeEmploymentTypes(originalText, profile.employmentType)

  return {
    ...profile,
    originalText,
    description: profile.description || originalText,
    role: professions[0] || normalizeRole(profile.role, originalText),
    professions,
    previousProfessions: profile.previousProfessions?.length
      ? profile.previousProfessions
      : normalizePreviousProfessions(originalText),
    features: [...new Set([...(profile.features || []), ...extractCandidateFeatures(originalText)])],
    age,
    isAdult: age == null ? true : age >= 18,
    relocationReady: profile.relocationReady ?? detectRelocationReady(originalText),
    employmentTypes,
    skills: normalizeSkills(profile.skills, originalText),
    seniority: profile.seniority ?? detectSeniority(text, profile.experienceYears),
    contact: profile.contact || contacts.telegram || contacts.email || contacts.phone || null,
    contacts: profile.contacts ?? contacts,
  }
}

function fingerprint(profile: CvProfile): string {
  const contact = profile.contacts?.telegram || profile.contacts?.email || profile.contacts?.phone
  if (contact) return `c:${contact.toLowerCase()}`
  const text = `${(profile.professions || []).join(' ')} ${profile.role || ''} ${profile.originalText || profile.description || ''}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-zа-яёіїґ0-9]+/g, '')
    .slice(0, 400)
  if (text.length >= 40) return `t:${text}`
  return `k:${profile.source}:${profile.id}`
}

export function dedupeCandidates(profiles: CvProfile[]): CvProfile[] {
  const best = new Map<string, CvProfile>()
  for (const profile of profiles) {
    const key = fingerprint(profile)
    const current = best.get(key)
    if (!current) {
      best.set(key, profile)
      continue
    }
    const a = Date.parse(profile.createdAt || '') || 0
    const b = Date.parse(current.createdAt || '') || 0
    if (a > b) best.set(key, profile)
  }
  return [...best.values()]
}
