export type HiringProfessionLocale = 'en' | 'ru'

interface ProfessionLabels {
  en: string
  ru: string
}

/**
 * Canonical hiring profession keys stay in English in storage/search.
 * This table is display-only and may safely grow without migrating persisted CVs.
 */
export const HIRING_PROFESSION_LABELS: Record<string, ProfessionLabels> = {
  'Sales Manager': { en: 'Sales Manager', ru: 'Менеджер по продажам' },
  'Project Manager': { en: 'Project Manager', ru: 'Менеджер проектов' },
  'Product Manager': { en: 'Product Manager', ru: 'Продакт-менеджер' },
  'Store Manager': { en: 'Store Manager', ru: 'Управляющий магазином' },
  'Restaurant Manager': { en: 'Restaurant Manager', ru: 'Управляющий рестораном' },
  'General Manager': { en: 'General Manager', ru: 'Генеральный менеджер' },
  Supervisor: { en: 'Supervisor', ru: 'Супервайзер' },
  Consultant: { en: 'Consultant', ru: 'Консультант' },
  'HR / Recruiter': { en: 'HR / Recruiter', ru: 'HR / Рекрутер' },
  'Office Manager': { en: 'Office Manager', ru: 'Офис-менеджер' },
  Administrator: { en: 'Administrator', ru: 'Администратор' },
  Receptionist: { en: 'Receptionist', ru: 'Администратор ресепшена' },
  Manager: { en: 'Manager', ru: 'Менеджер' },
  'Chief Accountant': { en: 'Chief Accountant', ru: 'Главный бухгалтер' },
  Accountant: { en: 'Accountant', ru: 'Бухгалтер' },
  Treasurer: { en: 'Treasurer', ru: 'Казначей' },
  Cashier: { en: 'Cashier', ru: 'Кассир' },
  Salesperson: { en: 'Salesperson', ru: 'Продавец' },
  Merchandiser: { en: 'Merchandiser', ru: 'Мерчендайзер' },
  Promoter: { en: 'Promoter', ru: 'Промоутер' },
  'Chat Operator': { en: 'Chat Operator', ru: 'Оператор чата' },
  'Customer Support': { en: 'Customer Support', ru: 'Специалист поддержки' },
  'Call Center Operator': { en: 'Call Center Operator', ru: 'Оператор колл-центра' },
  Operator: { en: 'Operator', ru: 'Оператор' },
  Copywriter: { en: 'Copywriter', ru: 'Копирайтер' },

  Courier: { en: 'Courier', ru: 'Курьер' },
  Driver: { en: 'Driver', ru: 'Водитель' },
  'Security Guard': { en: 'Security Guard', ru: 'Охранник' },
  Cleaner: { en: 'Cleaner', ru: 'Специалист по уборке' },
  Caregiver: { en: 'Caregiver', ru: 'Сиделка' },
  'Logistics Specialist': { en: 'Logistics Specialist', ru: 'Логист' },

  Bartender: { en: 'Bartender', ru: 'Бармен' },
  Barista: { en: 'Barista', ru: 'Бариста' },
  Waiter: { en: 'Waiter', ru: 'Официант' },
  Hostess: { en: 'Hostess', ru: 'Хостес' },
  'Cook / Chef': { en: 'Cook / Chef', ru: 'Повар / шеф-повар' },

  'Fitness Trainer': { en: 'Fitness Trainer', ru: 'Фитнес-тренер' },
  'Trainer / Coach': { en: 'Trainer / Coach', ru: 'Тренер / коуч' },

  Dentist: { en: 'Dentist', ru: 'Стоматолог' },
  Pharmacist: { en: 'Pharmacist', ru: 'Фармацевт' },
  Doctor: { en: 'Doctor', ru: 'Врач' },
  Nurse: { en: 'Nurse', ru: 'Медсестра / медбрат' },
  'Medical Assistant': { en: 'Medical Assistant', ru: 'Медицинский ассистент' },

  Tutor: { en: 'Tutor', ru: 'Репетитор' },
  'Kindergarten Teacher': { en: 'Kindergarten Teacher', ru: 'Воспитатель детского сада' },
  Nanny: { en: 'Nanny', ru: 'Няня' },
  Teacher: { en: 'Teacher', ru: 'Преподаватель' },
  Psychologist: { en: 'Psychologist', ru: 'Психолог' },
  'Speech Therapist': { en: 'Speech Therapist', ru: 'Логопед' },

  // Widely used technical job titles intentionally stay in English in the
  // Russian UI. Translating them literally makes the board less recognizable
  // to candidates and recruiters who use the English titles in practice.
  'Full-stack Developer': { en: 'Full-stack Developer', ru: 'Full-stack Developer' },
  'Backend Developer': { en: 'Backend Developer', ru: 'Backend Developer' },
  'Frontend Developer': { en: 'Frontend Developer', ru: 'Frontend Developer' },
  'Mobile Developer': { en: 'Mobile Developer', ru: 'Mobile Developer' },
  'IT Specialist': { en: 'IT Specialist', ru: 'IT Specialist' },
  'Network Administrator': { en: 'Network Administrator', ru: 'Сетевой администратор' },
  'System Administrator': { en: 'System Administrator', ru: 'Системный администратор' },
  'Software Developer': { en: 'Software Developer', ru: 'Software Developer' },
  'QA Engineer': { en: 'QA Engineer', ru: 'QA Engineer' },
  'DevOps Engineer': { en: 'DevOps Engineer', ru: 'DevOps Engineer' },
  'Cybersecurity Specialist': { en: 'Cybersecurity Specialist', ru: 'Cybersecurity Specialist' },
  'Penetration Tester': { en: 'Pentester', ru: 'Pentester' },
  'AI / ML Engineer': { en: 'AI / ML Engineer', ru: 'AI / ML Engineer' },
  'Data Scientist': { en: 'Data Scientist', ru: 'Data Scientist' },
  'Data Engineer': { en: 'Data Engineer', ru: 'Data Engineer' },
  'Engineering Manager': { en: 'Engineering Manager', ru: 'Engineering Manager' },
  'Hardware Engineer': { en: 'Hardware Engineer', ru: 'Hardware Engineer' },
  Designer: { en: 'Designer', ru: 'Дизайнер' },
  Architect: { en: 'Architect', ru: 'Архитектор' },
  Analyst: { en: 'Analyst', ru: 'Аналитик' },
  Economist: { en: 'Economist', ru: 'Экономист' },
  Engineer: { en: 'Engineer', ru: 'Инженер' },
  Marketer: { en: 'Marketer', ru: 'Маркетолог' },
  'Media Specialist': { en: 'Media Specialist', ru: 'Специалист по СМИ' },
  'Quality Inspector': { en: 'Quality Inspector', ru: 'Инспектор по качеству' },
  'Production Manager': { en: 'Production Manager', ru: 'Руководитель производства' },
  Translator: { en: 'Translator', ru: 'Переводчик' },
  Lawyer: { en: 'Lawyer', ru: 'Юрист' },
  Notary: { en: 'Notary', ru: 'Нотариус' },
  'Metrology Specialist': { en: 'Metrology Specialist', ru: 'Специалист по метрологии и стандартизации' },
  'Finance / Banking Specialist': { en: 'Finance / Banking Specialist', ru: 'Специалист по финансам и банковскому делу' },
  'Oil & Gas Worker': { en: 'Oil & Gas Worker', ru: 'Работник нефтегазовой отрасли' },
  Biotechnologist: { en: 'Biotechnologist', ru: 'Биотехнолог' },
  'Laboratory Technician': { en: 'Laboratory Technician', ru: 'Лаборант' },

  'General Laborer': { en: 'General Laborer', ru: 'Разнорабочий' },
  'Construction Worker': { en: 'Construction Worker', ru: 'Строитель' },
  Welder: { en: 'Welder', ru: 'Сварщик' },
  Electrician: { en: 'Electrician', ru: 'Электрик' },
  Plumber: { en: 'Plumber', ru: 'Сантехник' },
  Mechanic: { en: 'Mechanic', ru: 'Механик' },
  'Warehouse Manager': { en: 'Warehouse Manager', ru: 'Начальник склада' },
  'Warehouse Worker': { en: 'Warehouse Worker', ru: 'Работник склада' },
  Packer: { en: 'Packer', ru: 'Упаковщик' },
  'Factory Worker': { en: 'Factory Worker', ru: 'Работник производства' },
  Loader: { en: 'Loader', ru: 'Грузчик' },
  Seamstress: { en: 'Seamstress', ru: 'Швея' },
}

interface RawProfessionAlias {
  canonical?: string
  re: RegExp
  en?: string
  ru?: string
}

// Some source boards expose a headline instead of a normalized profession.
// Resolve common Uzbek/Russian/typo variants here as a presentation safety net;
// canonical parser rules may still normalize them earlier in the pipeline.
const RAW_PROFESSION_ALIASES: RawProfessionAlias[] = [
  { canonical: 'Penetration Tester', re: /^(?:pentester|pen\s*tester|penetration\s+tester)$/iu },
  { canonical: 'Data Scientist', re: /^(?:data\s+scientist|data\s+science\s+specialist)$/iu },
  { canonical: 'Data Engineer', re: /^data\s+engineer$/iu },
  { canonical: 'AI / ML Engineer', re: /^(?:ai\s*\/\s*ml|ml|machine\s+learning)\s+(?:engineer|developer)$/iu },
  { canonical: 'Frontend Developer', re: /(?:^|\s)(?:frontend|front[- ]?end|frontet)(?:\s|$)|\bitishnik\b.*\bfront/iu },
  { canonical: 'IT Specialist', re: /\b(?:itishnik|it\s*ishnik|it\s+specialist)\b/iu },
  { canonical: 'Economist', re: /^(?:iqtisodchi|iqtsodchi|iqtisodiy|economist|экономист)$/iu },
  { canonical: 'Logistics Specialist', re: /^(?:logist|logistic|logistics|logistika|логист)$/iu },
  { canonical: 'Teacher', re: /\b(?:ingliz\s+tili\s+)?ustoz(?:iman)?\b|\bo['’ʻʼ‘`]?qituvchi\b/iu },
  { canonical: 'Nanny', re: /\bbola(?:lar)?ga?\s+qarash\b|\bbolalarga\s+qarash\b/iu },
  { en: 'Remote work', ru: 'Удалённая работа', re: /^(?:onlayn|online)$/iu },
]

function aliasedProfession(value: string): RawProfessionAlias | undefined {
  return RAW_PROFESSION_ALIASES.find((alias) => alias.re.test(value))
}

export function hiringProfessionLocale(value: unknown): HiringProfessionLocale {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ru'
}

export function hiringProfessionLabel(value: string, locale: HiringProfessionLocale): string {
  const key = String(value || '').trim()
  const direct = HIRING_PROFESSION_LABELS[key]
  if (direct) return direct[locale]

  const alias = aliasedProfession(key)
  if (alias?.canonical) return HIRING_PROFESSION_LABELS[alias.canonical]?.[locale] || alias.canonical
  if (alias) return alias[locale] || key

  return key
}
