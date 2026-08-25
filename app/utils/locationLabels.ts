import {
  geographyDisplayName,
  geographyMetroLabelWithAlias,
  type GeographyDisplayKind,
} from '@whiteslove/parsing-lexicon/geography-display';

export type LocationKind = GeographyDisplayKind;

/**
 * Render-only geography localization.
 * All canonical -> display-name knowledge lives in @whiteslove/parsing-lexicon.
 * Frontend code must not maintain geography name dictionaries.
 */
export function locationLabel(
  value: string | null | undefined,
  locale: string,
  kind: LocationKind = 'any',
): string {
  return geographyDisplayName(value, locale, kind);
}

/** Alias in parentheses when the package provides one: "Новза (Хамза)". */
export function metroLabelWithAlias(value: string | null | undefined, locale: string): string {
  return geographyMetroLabelWithAlias(value, locale);
}
