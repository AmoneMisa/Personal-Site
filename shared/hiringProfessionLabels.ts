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
  'HR / Recruiter': { en: 'HR / Recruiter', ru: 'HR / Рекрутер' },
  'Office Manager': { en: 'Office Manager', ru: 'Офис-менеджер' },
  Administrator: { en: 'Administrator', ru: 'Администратор' },
  Receptionist: { en: 'Receptionist', ru: 'Администратор ресепшена' },
  Manager: { en: 'Manager', ru: 'Менеджер' },
  Accountant: { en: 'Accountant', ru: 'Бухгалтер' },
  Cashier: { en: 'Cashier', ru: 'Кассир' },
  Salesperson: { en: 'Salesperson', ru: 'Продавец' },
  Merchandiser: { en: 'Merchandiser', ru: 'Мерчендайзер' },
  Promoter: { en: 'Promoter', ru: 'Промоутер' },
  'Customer Support': { en: 'Customer Support', ru: 'Специалист поддержки' },
  Operator: { en: 'Operator', ru: 'Оператор' },
  Copywriter: { en: 'Copywriter', ru: 'Копирайтер' },

  Courier: { en: 'Courier', ru: 'Курьер' },
  Driver: { en: 'Driver', ru: 'Водитель' },
  'Security Guard': { en: 'Security Guard', ru: 'Охранник' },
  Cleaner: { en: 'Cleaner', ru: 'Специалист по уборке' },
  Caregiver: { en: 'Caregiver', ru: 'Сиделка' },

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

  'Full-stack Developer': { en: 'Full-stack Developer', ru: 'Full-stack-разработчик' },
  'Backend Developer': { en: 'Backend Developer', ru: 'Backend-разработчик' },
  'Frontend Developer': { en: 'Frontend Developer', ru: 'Frontend-разработчик' },
  'Mobile Developer': { en: 'Mobile Developer', ru: 'Мобильный разработчик' },
  'Software Developer': { en: 'Software Developer', ru: 'Разработчик ПО' },
  'QA Engineer': { en: 'QA Engineer', ru: 'QA-инженер' },
  'DevOps Engineer': { en: 'DevOps Engineer', ru: 'DevOps-инженер' },
  'Cybersecurity Specialist': { en: 'Cybersecurity Specialist', ru: 'Специалист по информационной безопасности' },
  'Engineering Manager': { en: 'Engineering Manager', ru: 'Технический руководитель' },
  'Hardware Engineer': { en: 'Hardware Engineer', ru: 'Инженер-электронщик' },
  Designer: { en: 'Designer', ru: 'Дизайнер' },
  Analyst: { en: 'Analyst', ru: 'Аналитик' },
  Engineer: { en: 'Engineer', ru: 'Инженер' },
  Marketer: { en: 'Marketer', ru: 'Маркетолог' },
  'Production Manager': { en: 'Production Manager', ru: 'Руководитель производства' },
  Translator: { en: 'Translator', ru: 'Переводчик' },
  Lawyer: { en: 'Lawyer', ru: 'Юрист' },
  Notary: { en: 'Notary', ru: 'Нотариус' },
  'Metrology Specialist': { en: 'Metrology Specialist', ru: 'Специалист по метрологии и стандартизации' },

  'General Laborer': { en: 'General Laborer', ru: 'Разнорабочий' },
  'Construction Worker': { en: 'Construction Worker', ru: 'Строитель' },
  Welder: { en: 'Welder', ru: 'Сварщик' },
  Electrician: { en: 'Electrician', ru: 'Электрик' },
  Plumber: { en: 'Plumber', ru: 'Сантехник' },
  Mechanic: { en: 'Mechanic', ru: 'Механик' },
  'Warehouse Worker': { en: 'Warehouse Worker', ru: 'Работник склада' },
  Packer: { en: 'Packer', ru: 'Упаковщик' },
  'Factory Worker': { en: 'Factory Worker', ru: 'Работник производства' },
  Loader: { en: 'Loader', ru: 'Грузчик' },
  Seamstress: { en: 'Seamstress', ru: 'Швея' },
}

export function hiringProfessionLocale(value: unknown): HiringProfessionLocale {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'ru'
}

export function hiringProfessionLabel(value: string, locale: HiringProfessionLocale): string {
  const key = String(value || '').trim()
  return HIRING_PROFESSION_LABELS[key]?.[locale] || key
}
