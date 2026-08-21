// Candidate profile normalization + deduplication.
// Free-form posts are normalized without overwriting the original message.

import { canonicalSkillName, extractSkillDetails } from '~~/shared/jobSkills'
import type { CandidateEmploymentType, CvProfile } from './hiringTypes'
import type { Seniority } from './jobTypes'
import { extractCandidateAge, extractCandidateName } from './hiringCandidateFields'

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

function addSkill(out: Set<string>, raw: string) {
  const canonical = canonicalSkillName(raw)
  if (canonical) out.add(canonical)
  else {
    const trimmed = raw.trim().replace(/\s{2,}/g, ' ')
    if (trimmed.length >= 2 && trimmed.length <= 60) out.add(trimmed)
  }
}

export function normalizeSkills(rawSkills: string[] | undefined, text: string): string[] {
  const out = new Set<string>()
  for (const raw of rawSkills || []) addSkill(out, raw)

  // Structured UZ CV cards commonly call this field `Texnologiya`, singular.
  // Keep unknown but meaningful entries (e.g. DRF, Telegram Bot) instead of
  // relying only on the canonical skill catalogue.
  const structured = text.match(
    /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:skills|навыки|навички|стек|stack|technologies|texnologiya(?:lar)?|ko(?:'|’)nikmalar)\s*[:—-]\s*([^\n]{2,500})/iu,
  )?.[1]
  if (structured) {
    for (const raw of structured.split(/[,;/|•·]+/)) {
      if (raw.trim()) addSkill(out, raw)
    }
  }

  for (const { name } of extractSkillDetails(text)) out.add(name)
  return [...out]
}

interface ProfessionRule { name: string; re: RegExp }
const PROFESSION_RULES: ProfessionRule[] = [
  // Management / office / sales.
  { name: 'Sales Manager', re: /\b(?:sales\s+manager|account\s+manager)\b|менеджер\s+(?:по\s+)?продаж|менеджер\s+з\s+продаж|sotuv\s+menejer/iu },
  { name: 'Project Manager', re: /\bproject\s+manager\b|проектн(?:ый|ий)\s+менеджер|менеджер\s+проект|керівник\s+проєкт/iu },
  { name: 'Product Manager', re: /\bproduct\s+manager\b|продакт\s*менеджер|менеджер\s+продукт/iu },
  { name: 'Store Manager', re: /\bstore\s+manager\b|управляющ(?:ий|ая)\s+магазин|заведующ(?:ий|ая)\s+магазин|керуюч(?:ий|а)\s+магазин/iu },
  { name: 'Restaurant Manager', re: /\brestaurant\s+manager\b|управляющ(?:ий|ая)\s+(?:ресторан|кафе)|керуюч(?:ий|а)\s+(?:ресторан|кафе)/iu },
  { name: 'General Manager', re: /\bgeneral\s+manager\b|управляющ(?:ий|ая)\b|керуюч(?:ий|а)\b|директор|director/iu },
  { name: 'Supervisor', re: /\bsupervisor\b|супервайзер|старший\s+смены|керівник\s+зміни/iu },
  { name: 'HR / Recruiter', re: /\b(?:hr|human\s+resources|recruiter|talent\s+acquisition)\b|рекрутер|сорсер|кадровик|hr[-\s]?менеджер/iu },
  { name: 'Office Manager', re: /\boffice\s+manager\b|офис[-\s]?менеджер|офіс[-\s]?менеджер/iu },
  { name: 'Administrator', re: /\badministrator\b|администратор|адміністратор/iu },
  { name: 'Receptionist', re: /\breceptionist\b|рецепционист|рецепціоніст|ресепшн/iu },
  { name: 'Manager', re: /\bmanager\b|менеджер|menejer/iu },
  { name: 'Accountant', re: /\baccountant\b|бухгалтер|buxgalter/iu },
  { name: 'Cashier', re: /\bcashier\b|кассир|касир|kassir/iu },
  { name: 'Salesperson', re: /\b(?:salesperson|sales\s+assistant|shop\s+assistant|seller)\b|продавец|продавець|продавчин|sotuvchi/iu },
  { name: 'Merchandiser', re: /\bmerchandiser\b|мерчендайзер|мерчандайзер/iu },
  { name: 'Promoter', re: /\bpromoter\b|промоутер/iu },
  { name: 'Customer Support', re: /\b(?:customer\s+support|support\s+specialist|call\s*center)\b|поддержк|підтримк|колл[-\s]?центр|call[-\s]?центр/iu },
  { name: 'Operator', re: /\boperator\b|оператор/iu },

  // Logistics / security / service.
  { name: 'Courier', re: /\bcourier\b|курьер|кур'єр|kuryer/iu },
  { name: 'Driver', re: /\bdriver\b|водитель|водій|haydovchi|shafyor/iu },
  { name: 'Security Guard', re: /\bsecurity(?:\s+guard)?\b|охранник|охоронець|охорона|qorovul/iu },
  { name: 'Cleaner', re: /\b(?:cleaner|cleaning|housekeeper)\b|уборщик|уборщица|уборка|прибиральник|прибиральниц|домработниц|farrosh/iu },
  { name: 'Caregiver', re: /\bcaregiver\b|сиделк|доглядальниц|parvarish/iu },

  // HoReCa.
  { name: 'Bartender', re: /\b(?:bartender|barman)\b|бармен|barmen/iu },
  { name: 'Barista', re: /\bbarista\b|бариста/iu },
  { name: 'Waiter', re: /\b(?:waiter|waitress)\b|официант|офіціант|afitsant/iu },
  { name: 'Hostess', re: /\bhostess\b|хостес/iu },
  { name: 'Cook / Chef', re: /\b(?:cook|chef)\b|повар|кухар|ошпаз|oshpaz/iu },

  // Sports.
  { name: 'Fitness Trainer', re: /\b(?:fitness|gym|personal)\s+(?:trainer|coach)\b|тренер\s+(?:в\s+)?(?:спортзал|спортзале|спортзалі|фитнес|фітнес)|фитнес[-\s]?тренер|фітнес[-\s]?тренер/iu },
  { name: 'Trainer / Coach', re: /\b(?:trainer|coach)\b|тренер|коуч/iu },

  // Medicine.
  { name: 'Dentist', re: /\bdentist\b|стоматолог|тиш\s+врач|tish\s+shifokor/iu },
  { name: 'Pharmacist', re: /\bpharmacist\b|фармацевт|провизор|dorixona\s+xodim/iu },
  { name: 'Doctor', re: /\bdoctor\b|врач|лікар|доктор|shifokor/iu },
  { name: 'Nurse', re: /\bnurse\b|медсестр|медбрат|медична\s+сестр|hamshira/iu },
  { name: 'Medical Assistant', re: /\bmedical\s+assistant\b|фельдшер|медичн(?:ий|а)\s+асистент/iu },

  // Education / childcare.
  { name: 'Tutor', re: /\btutor\b|репетитор|rep(?:e|i)titor(?:lik)?/iu },
  { name: 'Kindergarten Teacher', re: /\bkindergarten\s+teacher\b|воспитател|виховател|tarbiyachi/iu },
  { name: 'Nanny', re: /\bnanny\b|няня|нянечк|enaga/iu },
  { name: 'Teacher', re: /\bteacher\b|учитель|вчитель|преподавател|викладач|o(?:'|’)qituvchi/iu },
  { name: 'Psychologist', re: /\bpsychologist\b|психолог|psixolog/iu },
  { name: 'Speech Therapist', re: /\bspeech\s+therapist\b|логопед|logoped/iu },

  // IT / professional. Keep specializations before the generic developer rule.
  { name: 'Full-stack Developer', re: /\bfull[- ]?stack\s+(?:developer|engineer|dasturchi)\b|\bfullstack\s+dasturchi\b/iu },
  { name: 'Backend Developer', re: /\bback[- ]?end\s+(?:developer|engineer|dasturchi)\b|\bbackend\s+dasturchi\b/iu },
  { name: 'Frontend Developer', re: /\bfront[- ]?end\s+(?:developer|engineer|dasturchi)\b|\bfrontend\s+dasturchi\b/iu },
  { name: 'Mobile Developer', re: /\b(?:mobile|android|ios)\s+(?:developer|engineer|dasturchi)\b/iu },
  { name: 'System Administrator', re: /\b(?:system|network|windows\s+server)\s+administrator\b|систем(?:ный|ним)\s+администратор|сисадмин|сетевой\s+администратор|tarmoq\s+administrator|tizim\s+administrator/iu },
  { name: 'Software Developer', re: /\b(?:software\s+)?(?:developer|programmer|frontend|front-end|backend|back-end|full[- ]?stack|android|ios)\b|разработчик|розробник|программист|програміст|dasturchi|dasturlash/iu },
  { name: 'QA Engineer', re: /\b(?:qa|quality\s+assurance|tester|test\s+engineer)\b|тестировщик|тестувальник/iu },
  { name: 'DevOps Engineer', re: /\bdevops\b/iu },
  { name: 'Designer', re: /\b(?:designer|ui\/?ux)\b|дизайнер/iu },
  { name: 'Analyst', re: /\banalyst\b|аналитик|аналітик/iu },
  { name: 'Engineer', re: /\bengineer\b|инженер|інженер|muhandis/iu },
  { name: 'Marketer', re: /\b(?:marketer|marketing\s+specialist|smm)\b|маркетолог|smm[-\s]?специалист/iu },
  { name: 'Translator', re: /\b(?:translator|interpreter)\b|переводчик|перекладач|таржимон|tarjimon/iu },
  { name: 'Lawyer', re: /\b(?:lawyer|attorney|legal\s+specialist)\b|юрист|адвокат|правник|yurist/iu },

  // Construction / production / warehouse.
  { name: 'Construction Worker', re: /\b(?:builder|construction\s+worker)\b|строител|будівельник|разнорабоч|різнороб|qurilish/iu },
  { name: 'Welder', re: /\bwelder\b|сварщик|зварювальник|payvandchi/iu },
  { name: 'Electrician', re: /\belectrician\b|электрик|електрик/iu },
  { name: 'Plumber', re: /\bplumber\b|сантехник|сантехнік/iu },
  { name: 'Mechanic', re: /\bmechanic\b|механик|механік/iu },
  { name: 'Warehouse Worker', re: /\bwarehouse\b|кладовщик|комплектовщик|комірник|склад(?:ской|ський)?\s+работник/iu },
  { name: 'Packer', re: /\bpacker\b|упаковщик|упаковщица|пакувальник|qadoqlovchi/iu },
  { name: 'Factory Worker', re: /\bfactory\s+worker\b|рабоч(?:ий|ая)\s+(?:на\s+)?(?:заводе|производстве)|працівник\s+виробництва|ishlab\s+chiqarish/iu },
  { name: 'Loader', re: /\bloader\b|грузчик|вантажник/iu },
  { name: 'Seamstress', re: /\bseamstress\b|швея|швачка|tikuvchi/iu },
]

const SPECIFIC_MANAGER_ROLES = new Set([
  'Sales Manager', 'Project Manager', 'Product Manager', 'Store Manager', 'Restaurant Manager',
  'General Manager', 'HR / Recruiter', 'Office Manager',
])
const SPECIFIC_DEVELOPER_ROLES = new Set([
  'Full-stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile Developer',
])
const NON_TARGET_CONTEXT_RE = /(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous|раньше|ранее|прежде|работал|работала|працював|працювала|worked\s+(?:as|at)|oldin|avval|ishlagan|ishladim|tajriba|диплом|diplom|mutaxassisligim)/iu
const TARGET_CONTEXT_RE = /(?:ищу\s+(?:работу|подработку)|шукаю\s+(?:роботу|підробіток)|желаемая\s+(?:должность|работа)|бажана\s+(?:посада|робота)|target\s+role|desired\s+(?:role|position)|looking\s+for\s+(?:a\s+)?(?:job|work)|open\s+to\s+work|menga\s+ish\s+kerak|ish\s+(?:kerak|qidiryapman|qidiraman|izlayapman)|ish\s+joyi\s+kerak|lavozim|kasb|soha|soxa|maqsad(?:im)?)/iu

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
  if (names.some((name) => SPECIFIC_DEVELOPER_ROLES.has(name))) {
    const generic = names.indexOf('Software Developer')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('System Administrator')) {
    const generic = names.indexOf('Administrator')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Fitness Trainer')) {
    const generic = names.indexOf('Trainer / Coach')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Dentist')) {
    const generic = names.indexOf('Doctor')
    if (generic >= 0) names.splice(generic, 1)
  }
  return names
}

export function detectMentionedProfessions(source: string): string[] {
  return collectProfessions(source)
}

function normalizeProvidedProfessions(items: string[] | undefined): string[] {
  const out: string[] = []
  for (const item of items || []) {
    const clean = cleanRole(item)
    if (!clean) continue
    const matches = collectProfessions(clean)
    for (const value of (matches.length ? matches : [clean])) {
      if (!out.includes(value)) out.push(value)
    }
  }
  return out
}

function targetContext(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const picked: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!TARGET_CONTEXT_RE.test(lines[i]!)) continue
    for (let offset = 0; offset < 3 && i + offset < lines.length; offset += 1) {
      const line = lines[i + offset]!
      if (offset > 0 && NON_TARGET_CONTEXT_RE.test(line)) break
      picked.push(line)
    }
  }
  return picked.join('\n')
}

function extractGoalRole(text: string): string {
  // Uzbek CV cards often put unrelated past experience and the actual target
  // into one "Maqsad" paragraph. Prefer the explicit "X sifatida ish topish"
  // construction so the earlier profession cannot become the desired role.
  const asRole = text.match(
    /\b((?:(?:frontend|front-end|backend|back-end|full[- ]?stack|mobile|android|ios)\s+)?(?:dasturchi|developer|programmer))\s+sifatida\s+(?:ish\s+(?:topish|qidirish|izlash)|ishlash)\b/iu,
  )
  return cleanRole(asRole?.[1])
}

export function normalizeProfessions(rawRole: string | undefined, text: string): string[] {
  // Desired-role text wins, except when a loose source parser handed us an
  // explicit work-history/education line instead of a target role.
  const target = cleanRole(rawRole)
  if (target && !NON_TARGET_CONTEXT_RE.test(target)) {
    const targetMatches = collectProfessions(target)
    if (targetMatches.length) return targetMatches
  }

  // Fallback is restricted to job-seeker intent/target context. Do not scan the
  // whole CV: "worked as cashier" must not become a current Cashier target.
  const contextualMatches = collectProfessions(targetContext(text))
  if (contextualMatches.length) return contextualMatches
  return target && !NON_TARGET_CONTEXT_RE.test(target) ? [target] : []
}

export function normalizeRole(role: string | undefined, text: string): string {
  return normalizeProfessions(role, text)[0] || cleanRole(role)
}

function workHistoryBlock(text: string): string {
  const explicit = text.match(/(?:^|\n)\s*(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous\s+(?:jobs?|positions?)|tajriba|ish\s+tajribasi)\s*[:—-]?\s*([\s\S]{1,2600}?)(?=\n\s*(?:навыки|навички|skills|образование|освіта|education|контакт|contact|ожидания|salary|языки|мови|languages)\s*[:—-]|$)/iu)
  if (explicit?.[1]) return explicit[1]

  return text.split(/\n|(?<=[.!?])\s+/u).filter((line) =>
    /(?:работал[аи]?|працюва(?:в|ла)|worked\s+(?:as|at)|oldin|avval|ishlagan|ishladim|ishlaganman|tajriba(?:m)?\s+bor)/iu.test(line),
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

// "Murojaat qilish vaqti: 8:00 - 22:00" is on nearly every structured UZ card
// and answers a real question — when may I call this person. Deliberately not
// matched on a bare "ish vaqti", which is the working schedule the candidate
// wants, not the hours they answer the phone.
const CONTACT_HOURS_RE =
  /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:murojaat\s+qilish\s+vaqti|aloqa\s+vaqti|qo(?:'|’)ng(?:'|’)iroq\s+vaqti|bog(?:'|’)lanish\s+vaqti|время\s+(?:связи|звонков|для\s+связи)|звонить\s+(?:с|в)|contact\s+(?:hours|time)|call\s+time)\s*[:—-]?\s*([^\n]{3,60})/iu;

export function extractContactHours(text: string): string | null {
  const raw = text.match(CONTACT_HOURS_RE)?.[1];
  if (!raw) return null;
  const cleaned = raw.replace(/\s{2,}/g, ' ').replace(/[.;,]+$/, '').trim();
  // A time range is what makes this field worth showing at all.
  return /\d{1,2}[:.]\d{2}|\d{1,2}\s*[-–—]\s*\d{1,2}/.test(cleaned) ? cleaned.slice(0, 60) : null;
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
  return extractCandidateAge(text)
}

function parseMoneyNumber(raw: string): number | null {
  let value = raw.trim().replace(/\s+/g, '')
  if (!value) return null
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) value = value.replace(/[.,]/g, '')
  else value = value.replace(',', '.')
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function defaultCurrency(country: string): string | null {
  return ({ UZ: 'UZS', UA: 'UAH', KZ: 'KZT', KG: 'KGS' } as Record<string, string>)[country.toUpperCase()] || null
}

export function extractCandidateSalary(
  text: string,
  country: string,
): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const field = text.match(
    /(?:^|\n)[^\p{L}\p{N}\n]{0,10}(?:narxi?|salary|expected\s+salary|зарплата|зп|бажана\s+зарплата|oylik|maosh|ish\s+haqi)\s*[:—-]\s*([^\n]{1,120})/iu,
  )?.[1]
  if (!field) return {}

  const values = (field.match(/\d[\d\s.,]*\d|\d/g) || [])
    .map(parseMoneyNumber)
    .filter((value): value is number => value != null && value > 0)
    .slice(0, 2)
  if (!values.length) return {}

  const multiplier = /(?:млн|million|mln)/iu.test(field) ? 1_000_000
    : /(?:тыс|тис|thousand|ming)/iu.test(field) ? 1_000
      : 1
  const amounts = values.map((value) => Math.round(value * multiplier))
  const currency = /(?:\$|usd|доллар)/iu.test(field) ? 'USD'
    : /(?:uzs|сум|so(?:'|’)m)/iu.test(field) ? 'UZS'
      : /(?:uah|грн|грив)/iu.test(field) ? 'UAH'
        : /(?:kzt|₸|тенге|тг)/iu.test(field) ? 'KZT'
          : /(?:kgs|сом)/iu.test(field) ? 'KGS'
            : defaultCurrency(country)

  if (amounts.length > 1) {
    return { salaryMin: Math.min(...amounts), salaryMax: Math.max(...amounts), currency }
  }
  if (/\+|(?:^|\s)(?:от|від|from)\s/iu.test(field)) {
    return { salaryMin: amounts[0], currency }
  }
  return { salaryMin: amounts[0], salaryMax: amounts[0], currency }
}

export function detectRelocationReady(text: string): boolean | null {
  if (/не\s+готов\p{L}*\s+к\s+переезду|не\s+розгляда\p{L}*\s+переїзд|not\s+(?:open|ready)\s+to\s+relocat/iu.test(text)) return false
  if (/готов\p{L}*\s+к\s+переезду|готов\p{L}*\s+переехать|готов\p{L}*\s+до\s+переїзду|relocat(?:e|ion)|ko(?:'|’)chib\s+o(?:'|’)tish/iu.test(text)) return true
  return null
}

const REMOTE_POSITIVE_RE = /\bremote\b|удал[её]н(?:но|ная|ную|ка)|віддален|дистанцион|masofaviy|online\s+(?:work|job)|онлайн\s+работ/iu
const REMOTE_NEGATIVE_RE = /только\s+офис|офисн(?:ый|ая)\s+формат|офлайн|удал[её]нк\p{L}*\s+не\s+рассматрива|remote\s+(?:not|no)|faqat\s+ofis|ofisda\s+ishlash/iu

export function normalizeRemotePreference(
  raw: boolean | null | undefined,
  text: string,
  origin: CvProfile['origin'],
): boolean | null {
  if (REMOTE_NEGATIVE_RE.test(text)) return false
  if (REMOTE_POSITIVE_RE.test(text)) return true
  // Legacy Telegram parsing used RegExp.test(), so every post without a remote
  // marker was persisted as false. Treat that false as unknown; web adapters
  // can still preserve an explicit structured false from their source.
  if ((origin ?? 'telegram') === 'telegram' && raw === false) return null
  return raw ?? null
}

function numericExperience(segment: string): number | null {
  const direct = segment.match(
    /(?:опыт(?:\s+работы)?|досвід(?:\s+роботи)?|experience|staj|tajriba(?:m)?)\s*[:—-]?\s*(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil|йил)?/iu,
  )
  const reverse = segment.match(
    /(\d+(?:[.,]\d+)?)\+?\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|yil(?:lik)?|йил(?:лик)?)[^\n.!?]{0,100}(?:опыт|досвід|experience|staj|tajriba(?:m)?)/iu,
  )
  const value = direct?.[1] || reverse?.[1]
  if (!value) return null
  const years = Number(value.replace(',', '.'))
  return Number.isFinite(years) && years >= 0 && years <= 60 ? years : null
}

function sameProfessionFamily(a: string, b: string): boolean {
  if (a === b) return true
  return /Developer$/u.test(a) && /Developer$/u.test(b)
}

export function normalizeRelevantExperience(
  raw: number | null | undefined,
  targetProfessions: string[],
  text: string,
): number | null | undefined {
  if (raw == null) return raw
  const years = Number(raw)
  if (!Number.isFinite(years)) return null

  const mentions = text
    .split(/\n|(?<=[.!?])\s+/u)
    .map((segment) => ({ segment, years: numericExperience(segment) }))
    .filter((item) => item.years != null && Math.abs(item.years - years) < 0.001)
  if (!mentions.length || !targetProfessions.length) return raw

  const hasRelevantEvidence = mentions.some(({ segment }) => {
    const mentioned = collectProfessions(segment)
    // A generic "3 years experience" remains valid. We reject only when the
    // source explicitly ties those years to a different profession.
    if (!mentioned.length) return true
    return mentioned.some((profession) =>
      targetProfessions.some((target) => sameProfessionFamily(profession, target)),
    )
  })
  return hasRelevantEvidence ? raw : null
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
  const goalRole = extractGoalRole(originalText)
  const effectiveRole = goalRole || profile.role
  // Repair already-stored rows where a loose adapter saved the whole labelled
  // line ("familya: ...") as the name. New parses and old data then converge.
  const rawName = profile.name?.trim() || ''
  const name = (rawName ? extractCandidateName(rawName) || rawName : extractCandidateName(originalText))
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 100)
  const text = `${name}\n${effectiveRole || ''}\n${originalText}`
  const extractedContacts = extractContacts(text)
  const contacts = {
    ...(extractedContacts.telegram ? { telegram: extractedContacts.telegram } : {}),
    ...(extractedContacts.email ? { email: extractedContacts.email } : {}),
    ...(extractedContacts.phone ? { phone: extractedContacts.phone } : {}),
    ...(profile.contacts || {}),
  }
  // AI-enriched/current structured professions must survive subsequent feed and
  // Elasticsearch normalization. Only derive from free text when none exist.
  const providedProfessions = normalizeProvidedProfessions(profile.professions)
  const professions = providedProfessions.length
    ? providedProfessions
    : normalizeProfessions(effectiveRole, originalText)
  const age = profile.age ?? extractAge(originalText)
  const employmentTypes = profile.employmentTypes?.length
    ? profile.employmentTypes
    : normalizeEmploymentTypes(originalText, profile.employmentType)
  const experienceYears = normalizeRelevantExperience(profile.experienceYears, professions, originalText)
  const remote = normalizeRemotePreference(profile.remote, originalText, profile.origin)
  const extractedSalary = profile.salaryMin == null && profile.salaryMax == null
    ? extractCandidateSalary(originalText, profile.country)
    : {}
  const salaryMin = profile.salaryMin ?? extractedSalary.salaryMin
  const salaryMax = profile.salaryMax ?? extractedSalary.salaryMax
  const currency = profile.currency ?? extractedSalary.currency

  return {
    ...profile,
    name,
    originalText,
    description: profile.description || originalText,
    role: professions[0] || normalizeRole(effectiveRole, originalText),
    professions,
    previousProfessions: profile.previousProfessions?.length
      ? normalizeProvidedProfessions(profile.previousProfessions)
      : normalizePreviousProfessions(originalText),
    features: [...new Set([...(profile.features || []), ...extractCandidateFeatures(originalText)])],
    age,
    isAdult: age == null ? true : age >= 18,
    experienceYears,
    salaryMin,
    salaryMax,
    currency,
    remote,
    relocationReady: profile.relocationReady ?? detectRelocationReady(originalText),
    employmentTypes,
    skills: normalizeSkills(profile.skills, originalText),
    seniority: profile.seniority ?? detectSeniority(text, experienceYears),
    contact: profile.contact || contacts.telegram || contacts.email || contacts.phone || null,
    contactHours: profile.contactHours ?? extractContactHours(originalText),
    contacts,
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
