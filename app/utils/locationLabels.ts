import {
  GENERIC_LANDMARK_TERMS,
  findCanonical,
} from '@whiteslove/parsing-lexicon'
import {
  geographyDisplayName,
} from '@whiteslove/parsing-lexicon/geography-display'

export type LocationKind = 'country' | 'city' | 'district' | 'metro' | 'any'

type UiLanguage = 'ru' | 'en'

function uiLanguage(locale: string): UiLanguage {
  return String(locale).toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

function genericLandmarkDisplayName(value: string, locale: string): string {
  const landmark = findCanonical(value, GENERIC_LANDMARK_TERMS)
  if (!landmark) return value

  const labels = landmark.aliases?.[uiLanguage(locale)]
  return labels?.[0] || landmark.canonical || value
}

export function locationLabel(
  value: string | null | undefined,
  locale: string,
  kind: LocationKind = 'any',
): string {
  const exact = geographyDisplayName(value, locale, kind)
  const raw = String(value ?? '').trim()

  if (kind === 'any') {
    return raw && exact === raw
      ? genericLandmarkDisplayName(raw, locale)
      : exact
  }

  return raw && exact === raw
    ? geographyDisplayName(value, locale, 'any')
    : exact
}
