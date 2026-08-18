import { metroLabel } from '../utils/tashkentMetroLabels'

// GET /flats-meta — proxy the flat-finder backend's /api/countries (country +
// currency + city/location metadata for the filter dropdowns). Canonical station
// values live in flat-finder; this route only localizes presentation labels.
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'

export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch<any[]>(`${FLAT_API_URL}/api/countries`, { timeout: 15_000 })
    const locale = getHeader(event, 'accept-language') || 'en'
    const localized = Array.isArray(data)
      ? data.map((country: any) => {
          if (country?.code !== 'UZ' || !country?.locations?.Tashkent) return country
          const tashkent = country.locations.Tashkent
          return {
            ...country,
            locations: {
              ...country.locations,
              Tashkent: {
                ...tashkent,
                metro: Array.isArray(tashkent.metro)
                  ? tashkent.metro.map((value: string) => metroLabel(value, locale))
                  : [],
              },
            },
          }
        })
      : data
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return localized
  } catch {
    return []
  }
})
