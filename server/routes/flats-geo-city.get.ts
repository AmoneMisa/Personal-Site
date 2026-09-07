// GET /flats-geo-city — same-origin BFF over Flat Finder's canonical map-zone
// contract. The stable group fields are consumed by useGeoCityCatalog; the
// descendants envelope is retained for the richer map-only overlays so both
// paths read one backend-owned geography response.
import type { FlatGeoZone, FlatGeoZonesResponse } from '~~/shared/contracts/flatGeo'
import { FLAT_API_URL } from '../flats/feedLookup'

const GEO_TIMEOUT_MS = 15_000

const EMPTY_RESPONSE: FlatGeoZonesResponse = {
  districtZones: [],
  regionZones: [],
  microdistrictMarkers: [],
  mahallaMarkers: [],
  quarterMarkers: [],
  quartalMarkers: [],
  areaZones: [],
  zoneMarkers: [],
  metroStations: [],
  parks: [],
  shoppingMalls: [],
  universities: [],
  schools: [],
  residentialComplexes: [],
  airports: [],
  railwayStations: [],
  busStations: [],
  transportStops: [],
  parkings: [],
  cityZone: null,
}

type GeoEntity = {
  id: string
  parentId: string | null
  type: string
  country: string
  canonicalName: string
  label: string
  center: { lat: number, lng: number }
  accuracyM: number
  boundary?: FlatGeoZone['boundary']
  color?: string
  mode?: string
  routeRefs?: string[]
  lineColor?: string
  lineColors?: string[]
}

function asEntity(zone: FlatGeoZone | null | undefined, country: string): GeoEntity | null {
  if (!zone?.id || !zone?.name || !Number.isFinite(zone.lat) || !Number.isFinite(zone.lng)) return null
  return {
    id: zone.id,
    parentId: zone.parentId ?? null,
    type: zone.type || '',
    country,
    canonicalName: zone.name,
    label: zone.label || zone.name,
    center: { lat: Number(zone.lat), lng: Number(zone.lng) },
    accuracyM: Number.isFinite(zone.radiusM) ? Number(zone.radiusM) : 0,
    ...(zone.boundary ? { boundary: zone.boundary } : {}),
    ...(zone.color ? { color: zone.color } : {}),
    ...(zone.mode ? { mode: zone.mode } : {}),
    ...(Array.isArray(zone.routeRefs) ? { routeRefs: zone.routeRefs } : {}),
    ...(zone.lineColor ? { lineColor: zone.lineColor } : {}),
    ...(Array.isArray(zone.lineColors) ? { lineColors: zone.lineColors } : {}),
  }
}

function decodedList(value: unknown): string[] {
  return String(value || '')
    .split(',')
    .map((item) => {
      try { return decodeURIComponent(item).trim() } catch { return item.trim() }
    })
    .filter(Boolean)
}

function emptyEnvelope() {
  return {
    ...EMPTY_RESPONSE,
    city: null as GeoEntity | null,
    descendants: [] as GeoEntity[],
    resolvedDistricts: [] as Array<GeoEntity | null>,
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const country = String(query.country || '').trim().toUpperCase()
  const city = String(query.city || '').trim()
  const locale = String(query.locale || '').trim().slice(0, 16)
  const districtNames = decodedList(query.districts)

  if (!country || !city) return emptyEnvelope()

  if (!/^[A-Z]{2}$/.test(country) || !/^[\p{L}\p{N} .,'’'&()/-]{1,120}$/u.test(city)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid geo request' })
  }

  const params = new URLSearchParams({ country, city })
  if (/^[A-Za-z_-]+$/.test(locale)) params.set('locale', locale)

  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  try {
    const raw = await $fetch<FlatGeoZonesResponse>(
      `${FLAT_API_URL}/api/district-zones?${params.toString()}`,
      { timeout: GEO_TIMEOUT_MS },
    )
    const zones: FlatGeoZonesResponse = {
      ...EMPTY_RESPONSE,
      ...raw,
      districtZones: Array.isArray(raw?.districtZones) ? raw.districtZones : [],
      regionZones: Array.isArray(raw?.regionZones) ? raw.regionZones : [],
      microdistrictMarkers: Array.isArray(raw?.microdistrictMarkers) ? raw.microdistrictMarkers : [],
      mahallaMarkers: Array.isArray(raw?.mahallaMarkers) ? raw.mahallaMarkers : [],
      quarterMarkers: Array.isArray(raw?.quarterMarkers) ? raw.quarterMarkers : [],
      quartalMarkers: Array.isArray(raw?.quartalMarkers) ? raw.quartalMarkers : [],
      areaZones: Array.isArray(raw?.areaZones) ? raw.areaZones : [],
      zoneMarkers: Array.isArray(raw?.zoneMarkers) ? raw.zoneMarkers : [],
      metroStations: Array.isArray(raw?.metroStations) ? raw.metroStations : [],
      parks: Array.isArray(raw?.parks) ? raw.parks : [],
      shoppingMalls: Array.isArray(raw?.shoppingMalls) ? raw.shoppingMalls : [],
      universities: Array.isArray(raw?.universities) ? raw.universities : [],
      schools: Array.isArray(raw?.schools) ? raw.schools : [],
      residentialComplexes: Array.isArray(raw?.residentialComplexes) ? raw.residentialComplexes : [],
      airports: Array.isArray(raw?.airports) ? raw.airports : [],
      railwayStations: Array.isArray(raw?.railwayStations) ? raw.railwayStations : [],
      busStations: Array.isArray(raw?.busStations) ? raw.busStations : [],
      transportStops: Array.isArray(raw?.transportStops) ? raw.transportStops : [],
      parkings: Array.isArray(raw?.parkings) ? raw.parkings : [],
      cityZone: raw?.cityZone || null,
    }

    const groups = [
      zones.districtZones,
      zones.regionZones,
      zones.microdistrictMarkers,
      zones.mahallaMarkers,
      zones.quarterMarkers,
      zones.quartalMarkers,
      zones.areaZones,
      zones.zoneMarkers,
      zones.metroStations,
      zones.parks,
      zones.shoppingMalls,
      zones.universities,
      zones.schools,
      zones.residentialComplexes,
      zones.airports,
      zones.railwayStations,
      zones.busStations,
      zones.transportStops,
      zones.parkings,
    ]
    const descendants = groups
      .flatMap((items) => items)
      .map((zone) => asEntity(zone, country))
      .filter((entity): entity is GeoEntity => Boolean(entity))
    const cityEntity = asEntity(zones.cityZone, country)
    const districts = descendants.filter((entity) => entity.type === 'district')
    const resolvedDistricts = districtNames.map((name) =>
      districts.find((entity) => entity.canonicalName.toLocaleLowerCase() === name.toLocaleLowerCase()) || null,
    )

    return { ...zones, city: cityEntity, descendants, resolvedDistricts }
  } catch (error) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({
      statusCode: 502,
      statusMessage: 'Flat Finder geo data is unavailable',
      cause: error,
    })
  }
})
