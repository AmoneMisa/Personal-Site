import { extractCandidateContacts } from '@whiteslove/parsing-lexicon/hiring-candidate-fields'
import { parseHiringSourceSalary } from '@whiteslove/parsing-lexicon/hiring-source-semantics'
import type { CvProfile } from '../../../../shared/contracts/hiring'
import { cityFrom, parseAge } from '../../../../shared/hiring/webFields'
import { normalizeCandidate } from '../../../utils/hiringNormalize'

export type SecondarySourceKey = 'novarobota-ua' | 'layboard-kz' | 'amountwork-ro'

function parseExperience(text: string): number | null {
  if (/без опыта|без досвіду|no experience|fără experiență/iu.test(text)) return 0
  const match = text.match(/(?:опыт(?: работы)?|досвід(?: роботи)?|experience|experiență)[^\d]{0,40}(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani)/iu)
    || text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:лет|год(?:а)?|рок(?:и|ів)?|years?|ani)\b[^\n]{0,40}(?:опыт|досвід|experience|experiență)/iu)
  return match ? Number(match[1]!.replace(',', '.')) : null
}

function parseSalary(text: string, fallback: string): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  const parsed = parseHiringSourceSalary(text)
  if (!parsed || (parsed.min == null && parsed.max == null)) return {}
  const first = parsed.min ?? parsed.max
  const second = parsed.max ?? parsed.min
  if (first == null || !Number.isFinite(first) || first <= 0) return {}
  const upper = second != null && Number.isFinite(second) ? second : first
  const currency = parsed.currency || fallback
  if (!currency) return {}
  return {
    salaryMin: Math.min(first, upper),
    salaryMax: Math.max(first, upper),
    currency,
  }
}

function contacts(text: string, country: string): CvProfile['contacts'] {
  return { ...extractCandidateContacts(text, country) }
}

export function parseSecondaryChipSalary(
  chip: string,
): Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'> {
  return parseSalary(chip, '')
}

export function buildSecondaryProfile(input: {
  key: SecondarySourceKey
  country: 'UA' | 'KZ' | 'RO'
  label: string
  id: string
  role: string
  name?: string
  age?: number | null
  city?: string | null
  activity: string
  url: string
  text: string
  salaryCurrency: string
  salary?: Pick<CvProfile, 'salaryMin' | 'salaryMax' | 'currency'>
  contactType?: 'direct' | 'platform'
}): CvProfile {
  const publicContacts = contacts(input.text, input.country)
  const hasDirect = Boolean(publicContacts.phone || publicContacts.email || publicContacts.telegram)
  const age = input.age ?? parseAge(input.text)
  return normalizeCandidate({
    id: `web-${input.key}-${input.id}`,
    source: 'telegram',
    origin: 'web',
    sourceKey: input.key,
    country: input.country,
    name: input.name || '',
    role: input.role,
    professions: [input.role],
    age,
    isAdult: age == null ? true : age >= 18,
    experienceYears: parseExperience(input.text),
    city: input.city ?? cityFrom(input.text, input.country),
    remote: /удал[её]н|віддален|remote|online|онлайн|la distanță/iu.test(input.text) ? true : null,
    relocationReady: /возможен переезд|готов\p{L}* к переезду|можливий переїзд|relocat/iu.test(input.text) ? true : null,
    employmentTypes: [
      ...(/полная занятость|повна зайнятість|full[- ]?time|permanent/iu.test(input.text) ? ['full_time' as const] : []),
      ...(/неполная занятость|неповна зайнятість|part[- ]?time|подработка|підробіток/iu.test(input.text) ? ['part_time' as const] : []),
    ],
    publishedAt: input.activity,
    updatedAt: input.activity,
    activityAt: input.activity,
    createdAt: input.activity,
    url: input.url,
    originalText: input.text.slice(0, 4_000),
    description: input.text.slice(0, 4_000),
    tags: [input.label, 'Web CV', input.country],
    contacts: publicContacts,
    contact: publicContacts.telegram || publicContacts.email || publicContacts.phone || input.url,
    contactType: input.contactType || (hasDirect ? 'direct' : 'platform'),
    ...parseSalary(input.text, input.salaryCurrency),
    ...(input.salary || {}),
  })
}
