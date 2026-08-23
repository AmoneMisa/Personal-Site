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
  const match = text.match(
    /(?:от|від|de la)?\s*(\d[\d\s.,]{2,})(?:\s*(?:-|–|—|до|to|până la)\s*(\d[\d\s.,]{2,}))?\s*(грн|UAH|KZT|₸|тенге|USD|\$|EUR|€|RON|lei|руб\.?|₽)/iu,
  )
  if (!match) return {}
  const number = (raw: string) => Number(raw.replace(/[\s.,]/g, ''))
  const first = number(match[1]!)
  const second = match[2] ? number(match[2]) : undefined
  if (!Number.isFinite(first) || first <= 0) return {}
  const token = match[3]!.toUpperCase()
  const currency = /ГРН|UAH/.test(token) ? 'UAH'
    : /KZT|₸|ТЕНГЕ/.test(token) ? 'KZT'
      : /USD|\$/.test(token) ? 'USD'
        : /EUR|€/.test(token) ? 'EUR'
          : /RON|LEI/.test(token) ? 'RON'
            : /РУБ|₽/.test(token) ? 'RUB'
              : fallback
  return {
    salaryMin: second && Number.isFinite(second) ? Math.min(first, second) : first,
    salaryMax: second && Number.isFinite(second) ? Math.max(first, second) : undefined,
    currency,
  }
}

function contacts(text: string): CvProfile['contacts'] {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu)?.[0]
  const telegram = text.match(/@[A-Za-z0-9_]{5,}/)?.[0]
  const phone = text.match(/(?:\+?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){8,12}/)?.[0]
  return {
    ...(phone ? { phone: phone.replace(/\s+/g, ' ').trim() } : {}),
    ...(email ? { email } : {}),
    ...(telegram ? { telegram } : {}),
  }
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
  const publicContacts = contacts(input.text)
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
