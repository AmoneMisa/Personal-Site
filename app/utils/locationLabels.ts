import {
  GENERIC_LANDMARK_TERMS,
  findCanonical,
} from '@whiteslove/parsing-lexicon'
import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
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
    // Generic semantic landmarks (for example "Railway station") are canonical
    // values from parsing-lexicon too, but they are not administrative geography.
    // Resolve them from the shared landmark lexicon instead of maintaining a
    // second translation dictionary in Personal Site.
    return raw && exact === raw
      ? genericLandmarkDisplayName(raw, locale)
      : exact
  }

  // Some source feeds use a colloquial locality/metro name in the district
  // slot (Tashkent "Minor" is a common example). The geography package already
  // knows the localized display name, just under another presentation kind.
  // Do not expose the canonical English token merely because the source chose
  // a looser field; fall back to the package's cross-kind display dictionary.
  return raw && exact === raw
    ? geographyDisplayName(value, locale, 'any')
    : exact
}

export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  return geographyMetroLabelWithAlias(value, locale)
}
