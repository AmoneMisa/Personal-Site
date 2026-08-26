import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
  type GeographyDisplayKind,
} from '@whiteslove/parsing-lexicon/geography-display'

export type LocationKind = GeographyDisplayKind

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
