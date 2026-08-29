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

// For microdistrict/quartal/informal-area names (no dedicated LocationKind of their
// own): try only the district/microdistrict/metro tables directly, in that order,
// and never fall through to locationLabel's "any" cascade — that cascade also does
// fuzzy city/country entity matching, which has mistranslated names that merely
// resemble a city ("Tashkent City" became "город Ташкент"). Many Tashkent
// microdistrict/quartal names coincide with metro station names (the city's metro
// stations are named after the areas they serve), so the metro table often has real
// coverage even for non-metro places. Names with no entry in any of the three stay
// as their raw canonical form rather than risk a wrong match.
export function zoneNameLabel(value: string | null | undefined, locale: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return raw
  for (const kind of ['district', 'microdistrict', 'metro'] as const) {
    const translated = geographyDisplayName(raw, locale, kind)
    if (translated && translated !== raw) return translated
  }

  // Quartal composites (e.g. "Chilanzar-20A") aren't in any lexicon table as a
  // whole string, only their district/microdistrict prefix is. Match on an
  // exact "<Key>-" prefix only (never a loose substring) so we don't repeat
  // the fuzzy-match bug this function otherwise avoids, and keep the quartal
  // suffix as-is since it isn't translatable geography.
  const separatorIndex = raw.indexOf('-')
  if (separatorIndex > 0) {
    const prefix = raw.slice(0, separatorIndex)
    const suffix = raw.slice(separatorIndex)
    for (const kind of ['district', 'microdistrict', 'metro'] as const) {
      const translated = geographyDisplayName(prefix, locale, kind)
      if (translated && translated !== prefix) return `${translated}${suffix}`
    }
  }

  return raw
}
