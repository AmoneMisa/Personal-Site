// Candidate profile normalization + deduplication.
// Free-form posts are normalized without overwriting the original message.

import { canonicalSkillName, extractSkillDetails } from '~~/shared/jobSkills'
import type { CandidateEmploymentType, CvProfile } from './hiringTypes'
import type { Seniority } from './jobTypes'
import { extractCandidateAge, extractCandidateGender, extractCandidateName } from './hiringCandidateFields'
import { ishBorLocationFromText, trimIshBorProfileText } from './hiringIshBorFields'
import { careeristRoleFromText, trimCareeristProfileText } from './hiringCareeristFields'
import { parseSalary as parseWebSalary } from './hiringWebFields'

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
  { name: 'Sales Manager', re: /\b(?:sales\s+(?:manager|executive|director)|account\s+manager|head\s+of\s+sales)\b|менеджер\s+(?:по\s+)?(?:экспортн\p{L}*\s+)?продаж|менеджер\s+з\s+продаж|руководител\p{L}*\s+отдела\s+продаж|(?<!\p{L})роп(?!\p{L})|sotuv\s+menejer/iu },
  { name: 'Project Manager', re: /\bproject\s+manager\b|проектн(?:ый|ий)\s+менеджер|менеджер\s+проект|керівник\s+проєкт/iu },
  { name: 'Product Manager', re: /\bproduct\s+manager\b|продакт\s*менеджер|менеджер\s+продукт/iu },
  { name: 'Store Manager', re: /\bstore\s+manager\b|управляющ(?:ий|ая)\s+магазин|заведующ(?:ий|ая)\s+магазин|керуюч(?:ий|а)\s+магазин/iu },
  { name: 'Restaurant Manager', re: /\brestaurant\s+manager\b|управляющ(?:ий|ая)\s+(?:ресторан|кафе)|керуюч(?:ий|а)\s+(?:ресторан|кафе)/iu },
  { name: 'General Manager', re: /\bgeneral\s+manager\b|управляющ(?:ий|ая)\b|керуюч(?:ий|а)\b|директор|director/iu },
  { name: 'Supervisor', re: /\bsupervisor\b|супервайзер|старший\s+смены|керівник\s+зміни|начальник\s+отряд/iu },
  { name: 'Consultant', re: /\bconsultant\b|консультант|консультантка/iu },
  { name: 'HR / Recruiter', re: /\b(?:hr|human\s+resources|recruiter|talent\s+acquisition|people\s+partner|hrbp|hrd)\b|рекрутер|сорсер|кадровик|кадров\p{L}*\s+аудит|hr[-\s]?менеджер/iu },
  { name: 'Office Manager', re: /\boffice\s+manager\b|офис[-\s]?менеджер|офіс[-\s]?менеджер/iu },
  { name: 'Administrator', re: /\badministrator\b|администратор|адміністратор/iu },
  { name: 'Receptionist', re: /\breceptionist\b|рецепционист|рецепціоніст|ресепшн/iu },
  { name: 'Manager', re: /\bmanager\b|менеджер|menejer/iu },
  { name: 'Chief Accountant', re: /\b(?:chief|head)\s+accountant\b|главн\p{L}*\s+б[уy](?:х|x)?галтер|головн\p{L}*\s+бухгалтер|bosh\s+b(?:u(?:x|h)?|o)?galter/iu },
  { name: 'Accountant', re: /\baccountant\b|б[уy](?:х|x)?галтер(?:ия)?|b(?:u(?:x|h)?|o)?galter(?:iya)?/iu },
  { name: 'Treasurer', re: /\btreasurer\b|казначей|скарбник|g['’ʻʼ‘`]?aznachi/iu },
  { name: 'Cashier', re: /\bcashier\b|кассир|касир|kassir|kassa\s+(?:xodimi|mudiri)/iu },
  { name: 'Salesperson', re: /\b(?:salesperson|sales\s+assistant|shop\s+assistant|seller)\b|продавец|продавець|продавчин|sotuvchi/iu },
  { name: 'Merchandiser', re: /\bmerchandiser\b|мерчендайзер|мерчандайзер/iu },
  { name: 'Promoter', re: /\bpromoter\b|промоутер/iu },
  { name: 'Chat Operator', re: /\bchat[-\s]+operator(?:i)?\b|оператор\s+чат(?:а|у)?|чат[-\s]+оператор/iu },
  { name: 'Call Center Operator', re: /\b(?:call|koll)[-\s]?(?:center|centre|markaz)\s+operator(?:i)?\b|оператор\s+(?:колл|call)[-\s]?центр|(?:колл|call)[-\s]?центр(?:а|у)?\s+оператор/iu },
  { name: 'Customer Support', re: /\b(?:customer\s+support|support\s+specialist|call\s*center)\b|поддержк|підтримк|колл[-\s]?центр|call[-\s]?центр/iu },
  { name: 'Operator', re: /\boperator(?:lik|i)?\b|оператор/iu },
  { name: 'Copywriter', re: /\bcopywriter\b|копирайтер|копірайтер|составлени\p{L}*\s+текст|наборщик\s+текста/iu },

  // Logistics / security / service.
  { name: 'Courier', re: /\bcourier\b|курьер|кур'єр|kuryer/iu },
  { name: 'Driver', re: /\bdriver\b|(?<!\p{L})водитель(?!\p{L})|(?<!\p{L})водій(?!\p{L})|\bhaydovchi\b|\bshafyor\b|(?<!\p{L})[СC][ЕE]\s+категори/iu },
  { name: 'Logistics Specialist', re: /\b(?:logist|logistician|logistics\s+(?:specialist|coordinator|manager))\b|логист\p{L}*/iu },
  { name: 'Security Guard', re: /\bsecurity(?:\s+guard)?\b|охранник|охоронець|охорона|qorovul|qoriqlash|xavfsizlik/iu },
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
  { name: 'English Teacher', re: /\b(?:english\s+(?:teacher|tutor)|ingliz\s+tili(?:dan)?\s+(?:o['’ʻʼ‘`]?qituvchi|ustoz(?:iman)?))\b|преподавател\p{L}*\s+английск|учител\p{L}*\s+английск/iu },
  { name: 'Kindergarten Teacher', re: /\bkindergarten\s+teacher\b|воспитател|виховател|tarbiyachi|(?:xususiy\s+)?bog['’ʻʼ‘`]?cha/iu },
  { name: 'Nanny', re: /\bnanny\b|няня|нянечк|enaga|bola(?:larga)?\s+qarash|bolaga\s+qarash/iu },
  { name: 'Teacher', re: /\bteacher\b|учитель|вчитель|преподавател|викладач|тьютор|t(?:yutor|itur)(?:lik)?|o['’ʻʼ‘`]?qituvchi(?:lik)?|ustoz(?:iman)?/iu },
  { name: 'Psychologist', re: /\bpsychologist\b|психолог|psixolog/iu },
  { name: 'Speech Therapist', re: /\bspeech\s+therapist\b|логопед|logoped/iu },

  // IT / professional. Keep specializations before the generic developer rule.
  { name: 'Full-stack Developer', re: /\bfull[- ]?stack\s+(?:developer|engineer|dasturchi)\b|\bfullstack\s+dasturchi\b/iu },
  { name: 'Backend Developer', re: /\bback[- ]?end\s+(?:developer|engineer|dasturchi)\b|\bbackend\s+dasturchi\b/iu },
  { name: 'Frontend Developer', re: /\b(?:front[- ]?end|frontend|frontet|frontent|fronend)(?:\s+(?:developer|engineer|dasturchi))?\b|фронтенд/iu },
  { name: 'Mobile Developer', re: /\b(?:mobile|android|ios)\s+(?:developer|engineer|dasturchi)\b/iu },
  { name: 'System Administrator', re: /\b(?:system|network|windows\s+server)\s+administrator\b|систем(?:ный|ним)\s+администратор|сисадмин|сетевой\s+администратор|tarmoq\s+administrator|tizim\s+administrator/iu },
  { name: 'IT Specialist', re: /\bit\s+specialist\b|it[-\s]?специалист|специалист\s+по\s+it|\bit(?:ishnik|[-\s]?shnik)\b|айтишник|kompyuter\s+bo(?:['’ʻʼ‘`]?yicha|yicha)\s+ish/iu },
  { name: 'Software Developer', re: /\b(?:software\s+)?(?:developer|programmer|frontend|front-end|backend|back-end|full[- ]?stack|android|ios)\b|разработчик|розробник|программист|програміст|dasturchi|dasturlash/iu },
  { name: 'QA Engineer', re: /\b(?:qa|quality\s+assurance|tester|test\s+engineer)\b|тестировщик|тестувальник/iu },
  { name: 'DevOps Engineer', re: /\bdevops\b/iu },
  { name: 'Cybersecurity Specialist', re: /\b(?:cybersecurity|cyber\s+security|ciso)\b|информационн\p{L}*\s+безопасност|axborot\s+xavfsizligi/iu },
  { name: 'Penetration Tester', re: /\b(?:penetration\s+tester|pentester|ethical\s+hacker)\b|пентестер/iu },
  { name: 'AI / ML Engineer', re: /\b(?:(?:ai|ml|machine\s+learning)\s+(?:engineer|developer)|machine\s+learning\s+specialist)\b|инженер\s+(?:машинного\s+обучения|ии)/iu },
  { name: 'Data Scientist', re: /\bdata\s+scientist\b|\bdata\s+science\b|дата[-\s]?сайентист/iu },
  { name: 'Data Engineer', re: /\bdata\s+engineer\b|инженер\s+данных/iu },
  { name: 'Engineering Manager', re: /\b(?:cto|vp\s+of\s+engineering|head\s+of\s+engineering|engineering\s+manager)\b|техническ\p{L}*\s+директор/iu },
  { name: 'Hardware Engineer', re: /\b(?:hardware|embedded|pcb)\s*(?:engineer|developer)?\b|друкован\p{L}*\s+плат|печатн\p{L}*\s+плат|мікроконтролер|микроконтроллер/iu },
  { name: 'Designer', re: /\b(?:designer|ui\/?ux)\b|дизайнер/iu },
  { name: 'Architect', re: /\barchitect\b|архитектор|архітектор|arxitektor(?:\s+loyihachi)?/iu },
  { name: 'Analyst', re: /\banalyst\b|аналитик|аналітик/iu },
  { name: 'Engineer', re: /\bengineer\b|инженер|інженер|muhandis|injiner/iu },
  { name: 'Marketer', re: /\b(?:marketer|marketing(?:\s+specialist)?|smm)\b|маркетинг|маркетолог|smm[-\s]?специалист/iu },
  { name: 'Media Specialist', re: /\bmedia\s+specialist\b|специалист\s+по\s+сми|matbuot/iu },
  { name: 'Quality Inspector', re: /\bquality\s+inspector\b|инспектор\s+по\s+качеств|інспектор\s+з\s+якост/iu },
  { name: 'Production Manager', re: /\bproduction\s+(?:manager|director)\b|директор\s+по\s+производств|техническ\p{L}*\s+директор/iu },
  { name: 'Translator', re: /\b(?:translator|interpreter)\b|переводчик|перекладач|таржимон|tarjimon/iu },
  { name: 'Lawyer', re: /\b(?:lawyer|attorney|legal\s+specialist)\b|юрист|адвокат|правник|yurist/iu },
  { name: 'Notary', re: /\bnotar(?:y|ius)\b|нотариус/iu },
  { name: 'Metrology Specialist', re: /\bmetrolog(?:y|iya)\b|метролог|standartlashtirish/iu },
  { name: 'Economist', re: /\beconomist\b|экономист|(?<!\p{L})iqt(?:i)?sod(?:chi|iy)(?!\p{L})/iu },
  { name: 'Finance / Banking Specialist', re: /\b(?:finance|banking)\s+specialist\b|специалист\s+по\s+(?:финанс|банков)|moliya|(?<!\p{L})bank(?!\p{L})|soliq/iu },
  { name: 'Oil & Gas Worker', re: /\boil\s*(?:&|and)?\s*gas\b|нефт\p{L}*\s*(?:и|&)?\s*газ\p{L}*|neft\s*(?:va\s*)?gaz(?:\s+soha\p{L}*)?/iu },
  { name: 'Biotechnologist', re: /\bbiotechnologist\b|биотехнолог|biotexnolog/iu },
  { name: 'Laboratory Technician', re: /\blaboratory\s+technician\b|лаборант|laborant/iu },

  // Construction / production / warehouse.
  { name: 'General Laborer', re: /\b(?:general\s+laborer|handyman)\b|разнорабоч|різнороб/iu },
  { name: 'Construction Worker', re: /\b(?:builder|construction\s+worker)\b|строител|будівельник|qurilish/iu },
  { name: 'Welder', re: /\bwelder\b|сварщик|зварювальник|payvandchi/iu },
  { name: 'Electrician', re: /\belectrician\b|электрик|електрик/iu },
  { name: 'Plumber', re: /\bplumber\b|сантехник|сантехнік/iu },
  { name: 'Mechanic', re: /\bmechanic\b|механик|механік/iu },
  { name: 'Warehouse Manager', re: /\bwarehouse\s+manager\b|начальник\s+склад|заведующ\p{L}*\s+склад|керівник\s+склад/iu },
  { name: 'Warehouse Worker', re: /\bwarehouse\b|кладовщик|комплектовщик|комірник|склад(?:ской|ський)?\s+работник/iu },
  { name: 'Packer', re: /\bpacker\b|упаковщик|упаковщица|пакувальник|qadoqlovchi/iu },
  { name: 'Factory Worker', re: /\bfactory\s+worker\b|рабоч(?:ий|ая)\s+(?:на\s+)?(?:заводе|производстве)|працівник\s+виробництва|ishlab\s+chiqarish/iu },
  { name: 'Loader', re: /\bloader\b|грузчик|вантажник/iu },
  { name: 'Seamstress', re: /\bseamstress\b|швея|швачка|tikuvchi/iu },
]

const SPECIFIC_MANAGER_ROLES = new Set([
  'Sales Manager', 'Project Manager', 'Product Manager', 'Store Manager', 'Restaurant Manager',
  'General Manager', 'HR / Recruiter', 'Office Manager', 'Warehouse Manager', 'Logistics Specialist',
])
const SPECIFIC_DEVELOPER_ROLES = new Set([
  'Full-stack Developer', 'Backend Developer', 'Frontend Developer', 'Mobile Developer',
])
const SPECIFIC_TECH_ROLES = new Set([
  'QA Engineer', 'DevOps Engineer', 'Cybersecurity Specialist', 'Penetration Tester',
  'AI / ML Engineer', 'Data Scientist', 'Data Engineer', 'Hardware Engineer',
])
const NON_TARGET_CONTEXT_RE = /(?:опыт\s+работы|досвід\s+роботи|work\s+experience|previous|раньше|ранее|прежде|работал|работала|працював|працювала|worked\s+(?:as|at)|oldin|avval|ishlagan|ishladim|tajriba|диплом|diplom|mutaxassisligim)/iu
const TARGET_CONTEXT_RE = /(?:ищу\s+(?:работу|подработку)|шукаю\s+(?:роботу|підробіток)|желаемая\s+(?:должность|работа)|бажана\s+(?:посада|робота)|target\s+role|desired\s+(?:role|position)|looking\s+for\s+(?:a\s+)?(?:job|work)|open\s+to\s+work|menga\s+ish\s+kerak|ish\s+(?:kerak|qidiryapman|qidiraman|izlayapman)|ish\s+joyi\s+kerak|lavozim|kasb|soha|soxa|maqsad(?:im)?)/iu

function cleanRole(raw: string | undefined): string {
  return (raw || '').trim().replace(/^[#\-–—•*\s]+/, '').replace(/[.;,]+$/, '').replace(/\s{2,}/g, ' ').slice(0, 180)
}

function comparableRoleText(raw: string | undefined): string {
  return cleanRole(raw).toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
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
  if (names.includes('Production Manager') || names.includes('Engineering Manager')) {
    const generic = names.indexOf('General Manager')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.some((name) => SPECIFIC_DEVELOPER_ROLES.has(name))) {
    for (const genericName of ['Software Developer', 'IT Specialist']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
  }
  if (names.some((name) => SPECIFIC_TECH_ROLES.has(name))) {
    for (const genericName of ['Engineer', 'IT Specialist']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
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
  if (names.includes('English Teacher')) {
    const generic = names.indexOf('Teacher')
    if (generic >= 0) names.splice(generic, 1)
  }
  if (names.includes('Call Center Operator') || names.includes('Chat Operator')) {
    for (const genericName of ['Customer Support', 'Operator']) {
      const generic = names.indexOf(genericName)
      if (generic >= 0) names.splice(generic, 1)
    }
  }
  if (names.includes('Chief Accountant')) {
    const generic = names.indexOf('Accountant')
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
  if (FLEXIBLE_ROLE_RE.test(target)) return ['Any Role']
  if (NON_ROLE_RE.test(target)) return []
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
  return /\b24\s*\/\s*7\b|\d{1,2}[:.]\d{2}|\d{1,2}\s*[-–—]\s*\d{1,2}/.test(cleaned) ? cleaned.slice(0, 60) : null;
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

const REMOTE_POSITIVE_RE = /\bremote\b|удал[её]н\p{L}*|віддален|дистанцион|masofaviy|(?<!\p{L})onlayn(?!\p{L})|online\s+(?:work|job)|онлайн\s+работ/iu
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
  if (/full[-\s]?time|(?<!\p{L})полный\s+(?:рабочий\s+)?день|(?<!\p{L})полная\s+занятость|(?<!\p{L})повн(?:ий|а)\s+(?:робочий\s+)?день|(?<!\p{L})повна\s+зайнятість|to(?:'|’)liq\s+(?:ish|stavka)/iu.test(source)) out.add('full_time')
  if (/part[-\s]?time|неполный\s+(?:рабочий\s+)?день|неполная\s+занятость|частичная\s+занятость|подработк|неповн(?:ий|а)\s+(?:робочий\s+)?день|часткова\s+зайнятість|підробіт|yarim\s+stavka/iu.test(source)) out.add('part_time')
  return [...out]
}

/** Removes text ligatures emitted by icon fonts from older stored web cards. */
function stripUiArtifacts(value: string): string {
  return value
    .replace(/\b(?:local_shipping|location_on|work_outline|account_circle)\b/giu, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .trim()
}

/** Removes ad-loader JavaScript leaked by incomplete Flagma card fragments. */
function trimFlagmaProfileText(value: string): string {
  return stripUiArtifacts(value)
    .replace(
      /(?:^|\n)\s*try\s*\{\s*(?:\r?\n)?\s*\(?\s*(?:adsbygoogle|window\.adsbygoogle)[\s\S]{0,500}?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]{0,500}?\}(?=\s*\n|$)/giu,
      '\n',
    )
    .split('\n')
    .filter((line) => !/^\s*(?:сохранить|save|\(?\s*adsbygoogle\b|window\.adsbygoogle\b|console\.log\s*\(|try\s*\{|\}?\s*catch\s*\([^)]*\)\s*\{|\}\s*;?)\s*$/iu.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizedCandidateSkills(profile: CvProfile, text: string): string[] {
  const skipTextExtraction = profile.sourceKey === 'careerist-uz' || profile.sourceKey === 'ishbor-uz'
  const rawSkills = skipTextExtraction
    ? []
    : profile.sourceKey?.startsWith('flagma')
      ? (profile.skills || []).filter((skill) => canonicalSkillName(skill) != null)
      : profile.skills
  const normalized = normalizeSkills(rawSkills, skipTextExtraction ? '' : text)
  if (!profile.sourceKey?.startsWith('flagma')) return normalized

  const history = workHistoryBlock(text)
  return normalized.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Marketplace names are legitimate skills only when stated as skills.
    // In `Administrator, Uzum market, Buxoro` the same token is the employer.
    const company = new RegExp(
      `(?:^|[,;])\\s*${escaped}\\s+(?:market|marketplace|group|company|llc|ooo)\\s*(?:[,.;]|$)`,
      'iu',
    )
    const explicitSkill = new RegExp(
      `(?:skills|навыки|навички|stack|texnologiya(?:lar)?)\\s*[:—-][^\\n]{0,300}(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
      'iu',
    )
    return !company.test(history) || explicitSkill.test(text)
  })
}

const HIDDEN_NAME_RE = /^(?:(?:фио|піб|name)?\s*(?:скрыт\p{L}*|прихован\p{L}*|hidden|yashiril\p{L}*|ascuns)|onlayn|online|resume|резюме|[?？�\uFFFD]{2,})$/iu
const EMPLOYMENT_AS_EDUCATION_RE = /занятост|зайнятіст|удал[её]нн|дистанцион|remote|full[- ]?time|part[- ]?time|график\s+работ|bandlik/iu
const FLEXIBLE_ROLE_RE = /^(?:нет|без)\s+разницы(?:\s+.*)?$|^не\s*важно(?:\s+.*)?$|^farqi\s+yo['’ʻʼ‘`]?q$|^любая\s+(?:работа|занятость)(?:\s+.*)?$/iu
const NON_ROLE_RE = /^(?:удал[её]нно|работа\s+на\s+удал[её]н\p{L}*\s+основе|remote|onlayn|online|farqi\s+yo['’ʻʼ‘`]?q|bilmaym\p{L}*|ish\s+ker(?:e|a)\s+onlayn|любая\s+(?:работа|занятость)|немає|нет|не\s+указано|not\s+specified)$/iu

function normalizeCandidateEducation(profile: CvProfile, text: string): string | null | undefined {
  const raw = profile.education?.trim() || ''
  const withoutPreviewBoilerplate = raw.replace(/\s*[·|]\s*Location:\s*[\s\S]*$/iu, '').trim()
  if (withoutPreviewBoilerplate && !EMPLOYMENT_AS_EDUCATION_RE.test(withoutPreviewBoilerplate)) return withoutPreviewBoilerplate
  if (profile.sourceKey?.startsWith('flagma')) {
    const demographics = text.match(
      /\|\s*([^\n|]{0,120}(?:образован\p{L}*|освіт\p{L}*|studii|ta(?:['’])?lim)[^\n|]{0,120})/iu,
    )?.[1]?.trim()
    if (demographics && !EMPLOYMENT_AS_EDUCATION_RE.test(demographics)) return demographics
    const shortDemographics = text.match(/\|\s*([^\n|]{2,80})/u)?.[1]?.trim()
    if (shortDemographics && /(?:высш|средн|бакалавр|магистр|колледж|лицей|образован)/iu.test(shortDemographics)) {
      return shortDemographics
    }
  }
  return raw ? null : profile.education
}

function validStoredContact(value: string | null | undefined): string | null {
  const raw = value?.trim() || ''
  if (!raw) return null
  if (/^https?:\/\//iu.test(raw) || /^@[A-Za-z0-9_]{4,32}$/u.test(raw) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 15 ? raw : null
}

function normalizeMixedScriptName(value: string): string {
  if ((value.match(/\p{Script=Cyrillic}/gu) || []).length < 2) return value
  const confusables: Record<string, string> = {
    A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  }
  return value.replace(/[ABCEHKMOPTXY]/g, (letter) => confusables[letter] || letter)
}

function normalizeCandidateNameCase(value: string): string {
  if (!value || value !== value.toLocaleLowerCase('ru') || !/\p{L}/u.test(value)) return value
  return value.replace(/(^|[\s-])(\p{L})/gu, (_match, boundary: string, letter: string) => (
    `${boundary}${letter.toLocaleUpperCase('ru')}`
  ))
}

export function normalizeCandidate(profile: CvProfile): CvProfile {
  // Repair rows parsed before Material Icon ligatures were removed from the
  // source HTML. Underscored glyph names are presentation markup, not CV text.
  const rawSourceText = stripUiArtifacts(profile.originalText || profile.description || '')
  const originalText = profile.sourceKey === 'ishbor-uz'
    ? trimIshBorProfileText(rawSourceText)
    : profile.sourceKey === 'careerist-uz'
      ? trimCareeristProfileText(rawSourceText)
      : profile.sourceKey?.startsWith('flagma')
        ? trimFlagmaProfileText(rawSourceText)
        : rawSourceText
  const goalRole = extractGoalRole(originalText)
  const sourceRole = profile.sourceKey === 'careerist-uz' ? careeristRoleFromText(originalText) : null
  const rawEffectiveRoleCandidate = cleanRole(goalRole || sourceRole || profile.role)
  const roleDuplicatesName = Boolean(comparableRoleText(rawEffectiveRoleCandidate))
    && comparableRoleText(rawEffectiveRoleCandidate) === comparableRoleText(profile.name)
  const rawEffectiveRole = roleDuplicatesName ? '' : rawEffectiveRoleCandidate
  const flexibleRole = FLEXIBLE_ROLE_RE.test(rawEffectiveRole)
  const effectiveRole = flexibleRole ? 'Any Role' : NON_ROLE_RE.test(rawEffectiveRole) ? '' : rawEffectiveRole
  // Repair already-stored rows where a loose adapter saved the whole labelled
  // line ("familya: ...") as the name. New parses and old data then converge.
  const rawName = profile.name?.trim() || ''
  const roleAsName = profile.origin === 'web' && rawName.split(/\s+/u).length <= 3
    && collectProfessions(rawName).length > 0
  const nameCandidate = rawName && !HIDDEN_NAME_RE.test(rawName) && !roleAsName
    ? extractCandidateName(rawName) || rawName
    : extractCandidateName(originalText)
  const name = normalizeCandidateNameCase(normalizeMixedScriptName(HIDDEN_NAME_RE.test(nameCandidate) ? '' : nameCandidate))
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
  const providedProfessions = profile.sourceKey === 'careerist-uz' || flexibleRole || !effectiveRole
    ? []
    : normalizeProvidedProfessions(profile.professions)
  const professions = providedProfessions.length
    ? providedProfessions
    : normalizeProfessions(effectiveRole, originalText)
  const storedAge = profile.age != null && profile.age >= 14 && profile.age <= 90 ? profile.age : null
  const age = storedAge ?? extractAge(originalText)
  const parsedEmploymentTypes = normalizeEmploymentTypes(originalText, profile.employmentType)
  const employmentTypes = profile.sourceKey?.startsWith('flagma')
    ? parsedEmploymentTypes
    : profile.employmentTypes?.length ? profile.employmentTypes : parsedEmploymentTypes
  const relevantExperience = normalizeRelevantExperience(profile.experienceYears, professions, originalText)
  // Month-based durations (20 years 4 months) are repeating IEEE fractions.
  // One decimal is enough for the source precision and keeps JSON/UI readable.
  const experienceYears = relevantExperience == null ? null : Number(relevantExperience.toFixed(1))
  const storedCity = profile.city == null ? profile.city : stripUiArtifacts(profile.city) || null
  const city = profile.sourceKey === 'ishbor-uz'
    ? ishBorLocationFromText(rawSourceText) || storedCity
    : storedCity
  const remote = normalizeRemotePreference(profile.remote, originalText, profile.origin)
  const extractedSalary = profile.sourceKey === 'careerist-uz'
    ? parseWebSalary(originalText, profile.country)
    : profile.salaryMin == null && profile.salaryMax == null
      ? extractCandidateSalary(originalText, profile.country)
      : {}
  const replaceStoredSalary = profile.sourceKey === 'careerist-uz' && extractedSalary.salaryMin != null
  const salaryMin = replaceStoredSalary ? extractedSalary.salaryMin : profile.salaryMin ?? extractedSalary.salaryMin
  const salaryMax = replaceStoredSalary ? extractedSalary.salaryMax : profile.salaryMax ?? extractedSalary.salaryMax
  const currency = replaceStoredSalary ? extractedSalary.currency : profile.currency ?? extractedSalary.currency
  const education = normalizeCandidateEducation(profile, originalText)
  const gender = profile.gender === 'male' || profile.gender === 'female'
    ? profile.gender
    : extractCandidateGender(originalText)

  return {
    ...profile,
    name,
    originalText,
    description: profile.sourceKey === 'ishbor-uz'
      ? trimIshBorProfileText(stripUiArtifacts(profile.description || originalText))
      : profile.sourceKey === 'careerist-uz'
        ? trimCareeristProfileText(stripUiArtifacts(profile.description || originalText))
        : profile.sourceKey?.startsWith('flagma')
          ? trimFlagmaProfileText(profile.description || originalText)
          : stripUiArtifacts(profile.description || originalText),
    role: professions[0] || (effectiveRole ? normalizeRole(effectiveRole, originalText) : ''),
    professions,
    previousProfessions: profile.previousProfessions?.length
      ? normalizeProvidedProfessions(profile.previousProfessions)
      : normalizePreviousProfessions(originalText),
    features: [...new Set([...(profile.features || []), ...extractCandidateFeatures(originalText)])],
    age,
    gender,
    isAdult: age == null ? true : age >= 18,
    experienceYears,
    city,
    education,
    salaryMin,
    salaryMax,
    currency,
    remote,
    relocationReady: profile.relocationReady ?? detectRelocationReady(originalText),
    employmentTypes,
    skills: normalizedCandidateSkills(profile, originalText),
    seniority: profile.seniority ?? detectSeniority(text, experienceYears),
    contact: validStoredContact(profile.contact) || contacts.telegram || contacts.email || contacts.phone
      || (profile.contactType === 'platform' ? profile.url : null),
    contactHours: profile.contactHours ?? extractContactHours(originalText),
    contacts,
  }
}

function fingerprint(profile: CvProfile): string {
  const contact = profile.contacts?.telegram || profile.contacts?.email || profile.contacts?.phone
  if (contact) return `c:${contact.toLowerCase()}`
  const name = (profile.name || '').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
  if (profile.origin === 'web' && name.length >= 4 && !HIDDEN_NAME_RE.test(profile.name || '')) {
    const source = (profile.sourceKey || profile.source || '').toLocaleLowerCase('ru')
    const city = (profile.city || '').toLocaleLowerCase('ru').replace(/[^\p{L}\p{N}]+/gu, '')
    const professions = [...(profile.professions || [])].sort().join(',').toLocaleLowerCase('en')
    const salary = `${profile.salaryMin ?? ''}:${profile.salaryMax ?? ''}:${profile.currency || ''}`
    return `p:${source}:${name}:${city}:${profile.age ?? ''}:${professions}:${salary}`
  }
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
