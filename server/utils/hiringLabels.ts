import { canonicalCityValue } from '../../shared/locationCatalog'
import { locationLabel } from '../../app/utils/locationLabels'

// Localized city/country labels for the hiring pages are resolved here, not in
// the browser: locationLabel() pulls the full geography display data from
// @whiteslove/parsing-lexicon (~9 MB of JS), which the /hiring bundle used to
// ship just to print a few city names.

type Json = Record<string, unknown>

export function hiringUiLocale(value: unknown): 'ru' | 'en' {
  return String(Array.isArray(value) ? value[0] : value || '').toLowerCase().startsWith('en') ? 'en' : 'ru'
}

function cityLabel(city: string, locale: string): string {
  return locationLabel(canonicalCityValue(city), locale, 'city')
}

function isRecord(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Adds cityLabel/countryLabel to every profile and display to statistics.locations. */
export function decorateHiringFeed(payload: unknown, locale: string): unknown {
  if (!isRecord(payload)) return payload

  if (Array.isArray(payload.profiles)) {
    for (const profile of payload.profiles) {
      if (!isRecord(profile)) continue
      if (typeof profile.city === 'string' && profile.city) profile.cityLabel = cityLabel(profile.city, locale)
      if (typeof profile.country === 'string' && profile.country) {
        profile.countryLabel = locationLabel(profile.country, locale, 'country')
      }
    }
  }

  const locations = isRecord(payload.statistics) ? payload.statistics.locations : null
  if (Array.isArray(locations)) {
    for (const item of locations) {
      if (!isRecord(item) || typeof item.label !== 'string' || item.label === '__unknown__') continue
      item.display = locationLabel(item.label, locale, 'city')
    }
  }
  return payload
}

/** Adds cityLabels (canonical city -> label) to each country of /hiring-meta. */
export function decorateHiringMeta(payload: unknown, locale: string): unknown {
  if (!Array.isArray(payload)) return payload
  for (const country of payload) {
    if (!isRecord(country) || !Array.isArray(country.cities)) continue
    country.cityLabels = Object.fromEntries(
      country.cities.filter((city): city is string => typeof city === 'string').map((city) => [city, cityLabel(city, locale)]),
    )
  }
  return payload
}
