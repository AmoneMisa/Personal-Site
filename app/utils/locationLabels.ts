import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
} from '@whiteslove/parsing-lexicon/geography-display'

export type LocationKind = 'country' | 'city' | 'district' | 'metro' | 'any'

export function locationLabel(
  value: string | null | undefined,
  locale: string,
  kind: LocationKind = 'any',
): string {
  const exact = geographyDisplayName(value, locale, kind)
  if (kind === 'any') return exact

  // Some source feeds use a colloquial locality/metro name in the district
  // slot (Tashkent "Minor" is a common example). The geography package already
  // knows the localized display name, just under another presentation kind.
  // Do not expose the canonical English token merely because the source chose
  // a looser field; fall back to the package's cross-kind display dictionary.
  const raw = String(value ?? '').trim()
  return raw && exact === raw
    ? geographyDisplayName(value, locale, 'any')
    : exact
}

export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  return geographyMetroLabelWithAlias(value, locale)
}
