import {
  TASHKENT_METRO_BY_NAME,
  canonicalTashkentMetro,
} from '@whiteslove/parsing-lexicon'

export function metroLabel(value: string, locale = 'en'): string {
  const canonical = canonicalTashkentMetro(value) || value
  if (!locale.toLowerCase().startsWith('ru')) return canonical
  return TASHKENT_METRO_BY_NAME.get(canonical)?.labels.ru || value
}

export function canonicalMetroValue(value: string): string {
  return canonicalTashkentMetro(value) || value
}
