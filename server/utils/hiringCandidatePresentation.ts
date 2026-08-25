import type { CvProfile } from './hiringTypes'
import { parseExtendedLanguageContext } from '@whiteslove/parsing-lexicon/hiring-language-extensions'
import {
  publicCandidateGender,
  publicCandidateName,
  publicCandidateProfessionKeys as legacyProfessionKeys,
  publicCandidateRemote,
  publicCandidateSalary,
  type HiringCandidateLocale,
} from '../../internal/legacy/hiringCandidatePresentationCore'

export {
  publicCandidateGender,
  publicCandidateName,
  publicCandidateRemote,
  publicCandidateSalary,
}
export type { HiringCandidateLocale }

const STANDALONE_REMOTE_ROLE_RE = /^(?:онлайн|onlayn|online)$/iu

export function publicCandidateProfessionKeys(profile: CvProfile): string[] {
  if (STANDALONE_REMOTE_ROLE_RE.test(String(profile.role || '').trim())) return ['Any Role']
  return legacyProfessionKeys(profile)
}

const LANGUAGE_LABELS_RU: Record<string, string> = {
  en: 'Английский',
  ru: 'Русский',
  uz: 'Узбекский',
  kk: 'Казахский',
  uk: 'Украинский',
  tr: 'Турецкий',
  de: 'Немецкий',
  fr: 'Французский',
  es: 'Испанский',
  zh: 'Китайский',
  ko: 'Корейский',
  ja: 'Японский',
  ar: 'Арабский',
  tg: 'Таджикский',
  ky: 'Кыргызский',
  ro: 'Румынский',
  pl: 'Польский',
}

const LEVEL_LABELS_RU: Record<string, string> = {
  basic: 'базовый',
  elementary: 'элементарный',
  preIntermediate: 'ниже среднего',
  intermediate: 'разговорный',
  upperIntermediate: 'выше среднего',
  advanced: 'продвинутый',
  professional: 'профессиональный',
  fluent: 'свободный',
  native: 'родной',
}

const LEVEL_LABELS_EN: Record<string, string> = {
  basic: 'basic',
  elementary: 'elementary',
  preIntermediate: 'pre-intermediate',
  intermediate: 'conversational',
  upperIntermediate: 'upper-intermediate',
  advanced: 'advanced',
  professional: 'professional',
  fluent: 'fluent',
  native: 'native',
}

export function publicCandidateLanguages(profile: CvProfile, locale: HiringCandidateLocale): string[] {
  const text = profile.originalText || profile.description || ''
  if (!text) return [...new Set((profile.languages || []).filter(Boolean))]

  const parsed = parseExtendedLanguageContext(text, { mode: 'candidate' })
  if (!parsed.length) return [...new Set((profile.languages || []).filter(Boolean))]

  return parsed.map((item) => {
    const label = locale === 'ru' ? LANGUAGE_LABELS_RU[item.language] || item.name : item.name
    const level = item.cefr || (item.level
      ? (locale === 'ru' ? LEVEL_LABELS_RU[item.level] : LEVEL_LABELS_EN[item.level]) || item.level
      : null)
    return level ? `${label} — ${level}` : label
  })
}
