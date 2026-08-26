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
  return geographyDisplayName(value, locale, kind)
}

export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  return geographyMetroLabelWithAlias(value, locale)
}
