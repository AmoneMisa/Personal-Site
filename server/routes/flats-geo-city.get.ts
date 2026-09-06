// GET /flats-geo-city — website-facing adapter over Flat Finder's canonical
// district-zones contract. Geo entities, boundaries and localized labels belong
// to the Flat Finder backend; Personal Site must not decrypt or rebuild them.
import type { FlatGeoZonesResponse } from '~~/shared/contracts/flatGeo'
import { FLAT_API_URL } from '../flats/feedLookup'

const GEO_TIMEOUT_MS = 15_000

const EMPTY_RESPONSE: FlatGeoZonesResponse = {
  districtZones: [],
  microdistrictMarkers: [],
  quartalMarkers: [],
  areaZones: [],
  metroStations: [],
  parks: [],
  shoppingMalls: [],
  universities: [],
  cityZone: null,
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const country = String(query.country || '').trim().toUpperCase()
  const city = String(query.city || '').trim()
  const locale = String(query.locale || '').trim().slice(0, 16)

  if (!country || !city) {
    return EMPTY_RESPONSE
  }

  if (!/^[A-Z]{2}$/.test(country) || !/^[\p{L}\p{N} .,'’'&()/-]{1,120}$/u.test(city)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid geo request' })
  }

  const params = new URLSearchParams({ country, city })
  if (/^[A-Za-z_-]+$/.test(locale)) params.set('locale', locale)

  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  try {
    return await $fetch<FlatGeoZonesResponse>(
      `${FLAT_API_URL}/api/district-zones?${params.toString()}`,
      { timeout: GEO_TIMEOUT_MS },
    )
  } catch (error) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({
      statusCode: 502,
      statusMessage: 'Flat Finder geo data is unavailable',
      cause: error,
    })
  }
})
