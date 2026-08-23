export * from './hiringCandidatePresentationLegacy'

import type { CvProfile } from './hiringTypes'
import {
  publicCandidateLanguages as legacyLanguages,
  publicCandidateProfessionKeys as legacyProfessionKeys,
  type HiringCandidateLocale,
} from './hiringCandidatePresentationLegacy'

const STANDALONE_REMOTE_ROLE_RE = /^(?:онлайн|onlayn|online)$/iu

export function publicCandidateProfessionKeys(profile: CvProfile): string[] {
  if (STANDALONE_REMOTE_ROLE_RE.test(String(profile.role || '').trim())) return ['Any Role']
  return legacyProfessionKeys(profile)
}

type LanguageRule = { ru: string; en: string; re: RegExp }
const LANGUAGES: LanguageRule[] = [
  { ru: 'Русский', en: 'Russian', re: /русск\p{L}*|russian|rus\s+tili/iu },
  { ru: 'Узбекский', en: 'Uzbek', re: /узбекск\p{L}*|uzbek|o['’ʻʼ‘`]?zbek\s+tili/iu },
  { ru: 'Таджикский', en: 'Tajik', re: /таджикск\p{L}*|tajik|tojik\s+tili/iu },
  { ru: 'Английский', en: 'English', re: /английск\p{L}*|english|ingliz\s+tili/iu },
  { ru: 'Казахский', en: 'Kazakh', re: /казахск\p{L}*|kazakh|qozoq\s+tili/iu },
  { ru: 'Кыргызский', en: 'Kyrgyz', re: /кыргызск\p{L}*|киргизск\p{L}*|kyrgyz|qirg['’ʻʼ‘`]?iz\s+tili/iu },
  { ru: 'Украинский', en: 'Ukrainian', re: /украинск\p{L}*|українськ\p{L}*|ukrainian/iu },
  { ru: 'Турецкий', en: 'Turkish', re: /турецк\p{L}*|turkish|turk\s+tili/iu },
  { ru: 'Румынский', en: 'Romanian', re: /румынск\p{L}*|rom[aâ]n\p{L}*|romanian/iu },
]

const LEVELS = [
  { ru: 'родной', en: 'native', re: /родн\p{L}*|native|ona\s+tili/giu },
  { ru: 'свободный', en: 'fluent', re: /свободн\p{L}*|fluent|erkin/giu },
  { ru: 'профессиональный', en: 'professional', re: /профессиональн\p{L}*|professional/giu },
  { ru: 'разговорный', en: 'conversational', re: /разговорн\p{L}*|conversational/giu },
  { ru: 'средний', en: 'intermediate', re: /intermediate|средн\p{L}*\s+уров/giu },
  { ru: 'базовый', en: 'basic', re: /базов\p{L}*|basic|boshlang['’ʻʼ‘`]?ich/giu },
] as const

function nearestLanguageLevel(text: string, languageIndex: number, locale: HiringCandidateLocale): string | null {
  const start = Math.max(0, languageIndex - 60)
  const end = Math.min(text.length, languageIndex + 80)
  const local = text.slice(start, end)
  const target = languageIndex - start
  const candidates: Array<{ distance: number; value: string }> = []

  for (const match of local.matchAll(/(?:^|[^A-Z])(A1|A2|B1|B2|C1|C2)(?=$|[^A-Z])/gi)) {
    const index = (match.index || 0) + match[0].indexOf(match[1]!)
    candidates.push({ distance: Math.abs(index - target), value: match[1]!.toUpperCase() })
  }
  for (const level of LEVELS) {
    level.re.lastIndex = 0
    for (const match of local.matchAll(level.re)) {
      candidates.push({
        distance: Math.abs((match.index || 0) - target),
        value: locale === 'en' ? level.en : level.ru,
      })
    }
  }

  candidates.sort((a, b) => a.distance - b.distance)
  return candidates[0]?.value || null
}

export function publicCandidateLanguages(profile: CvProfile, locale: HiringCandidateLocale): string[] {
  const text = profile.originalText || profile.description || ''
  if (!text) return legacyLanguages(profile, locale)

  const legacy = legacyLanguages(profile, locale)
  const out = new Set<string>(legacy)

  for (const language of LANGUAGES) {
    language.re.lastIndex = 0
    const match = language.re.exec(text)
    if (!match || match.index == null) continue
    const label = locale === 'en' ? language.en : language.ru
    for (const existing of [...out]) {
      if (existing === label || existing.startsWith(`${label} — `)) out.delete(existing)
    }
    const level = nearestLanguageLevel(text, match.index, locale)
    out.add(level ? `${label} — ${level}` : label)
  }

  return [...out]
}
