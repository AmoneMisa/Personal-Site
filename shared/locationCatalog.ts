import {
  GEOGRAPHY_CITIES,
  KZ_CITY_CATALOG,
  UA_CITY_CATALOG,
  UZ_CITY_CATALOG,
  aliasesOf,
  canonicalAnyCity,
  canonicalCentralAsiaCity,
  canonicalUkraineCity,
} from '@whiteslove/parsing-lexicon'
import { geographyDisplayName } from '@whiteslove/parsing-lexicon/geography-display'

export function normalizeCityValue(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е')
}

const PARSING_CITIES = [
  ...GEOGRAPHY_CITIES.filter((city) => !['UA', 'KZ', 'UZ'].includes(city.country || '')),
  ...KZ_CITY_CATALOG,
  ...UZ_CITY_CATALOG,
  ...UA_CITY_CATALOG,
]
const PARSING_CITY_BY_KEY = new Map(
  PARSING_CITIES.map((city) => [normalizeCityValue(city.canonical), city] as const),
)

function sharedCanonicalCity(value: string): string | null {
  return canonicalUkraineCity(value) || canonicalCentralAsiaCity(value) || canonicalAnyCity(value)
}

export function canonicalCityKey(value: string): string {
  return normalizeCityValue(sharedCanonicalCity(value) || value)
}

export function cityAliases(value: string): string[] {
  const key = canonicalCityKey(value)
  const entity = PARSING_CITY_BY_KEY.get(key)
  return entity ? [...new Set([entity.canonical, ...aliasesOf(entity)])] : [value]
}

export function canonicalCityValue(value: string): string {
  return sharedCanonicalCity(value) || value.trim()
}

export function cityDisplayLabel(value: string, locale: string): string {
  return geographyDisplayName(canonicalCityValue(value), locale, 'city')
}
