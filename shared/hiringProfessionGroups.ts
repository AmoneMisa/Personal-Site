import { hiringProfessionLabel, type HiringProfessionLocale } from './hiringProfessionLabels'

interface HiringProfessionGroup {
  en: string
  ru: string
  members: string[]
}

/** Search-only facets. Candidate cards keep their exact canonical profession. */
export const HIRING_PROFESSION_GROUPS: Record<string, HiringProfessionGroup> = {
  'group:accounting-treasury': {
    en: 'Accountant / Chief Accountant / Treasurer',
    ru: 'Бухгалтер / Главный бухгалтер / Казначей',
    members: ['Accountant', 'Chief Accountant', 'Treasurer'],
  },
  'group:retail-service': {
    en: 'Manager / Consultant / Cashier / Salesperson',
    ru: 'Менеджер / Консультант / Кассир / Продавец',
    members: ['Manager', 'Consultant', 'Cashier', 'Salesperson'],
  },
}

const MEMBER_GROUP = new Map(
  Object.entries(HIRING_PROFESSION_GROUPS)
    .flatMap(([group, value]) => value.members.map((member) => [member, group] as const)),
)

export function expandHiringProfessionFilters(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => HIRING_PROFESSION_GROUPS[value]?.members || [value]))]
}

/** Replaces individual selector entries with their shared search facet. */
export function collapseHiringProfessionFilterValues(values: string[]): string[] {
  const out = new Set<string>()
  for (const value of values) out.add(MEMBER_GROUP.get(value) || value)
  return [...out]
}

/** Keeps old saved/share links compatible with the collapsed selector. */
export function normalizeHiringProfessionFilterSelections(values: string[]): string[] {
  return collapseHiringProfessionFilterValues(values)
}

export function hiringProfessionFilterLabel(value: string, locale: HiringProfessionLocale): string {
  const group = HIRING_PROFESSION_GROUPS[value]
  return group?.[locale] || hiringProfessionLabel(value, locale)
}
