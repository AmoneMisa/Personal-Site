// GET /flats-geo-city — same-origin BFF adapter over the Flat Finder backend.
// Canonical geo entities, coordinates, boundaries and hierarchy are owned by
// backend-platform. Personal Site must not load geo-catalog directly.
import { FLAT_API_URL } from '../flats/feedLookup'

type BackendZone = {
  id?: string
  parentId?: string | null
  type?: string
  name?: string
  label?: string
  lat?: number
  lng?: number
  radiusM?: number
  boundary?: unknown
}

function asEntity(zone: BackendZone | null | undefined, country: string) {
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
    boundary: zone.boundary || undefined,
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

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const country = String(query.country || '').trim().toUpperCase()
  const city = String(query.city || '').trim()
  const locale = String(query.locale || '').trim()
  const districtNames = decodedList(query.districts)

  if (!country || !city) {
    return { city: null, descendants: [], resolvedDistricts: [] }
  }

  const params = new URLSearchParams({ country, city })
  if (locale) params.set('locale', locale)

  try {
    const zones = await $fetch<any>(`${FLAT_API_URL}/api/district-zones?${params}`, { timeout: 15_000 })
    const groups = [
      zones?.districtZones,
      zones?.microdistrictMarkers,
      zones?.quartalMarkers,
      zones?.areaZones,
      zones?.metroStations,
      zones?.parks,
      zones?.shoppingMalls,
      zones?.universities,
    ]
    const descendants = groups
      .flatMap((items) => Array.isArray(items) ? items : [])
      .map((zone) => asEntity(zone, country))
      .filter(Boolean)
    const cityEntity = asEntity(zones?.cityZone, country)
    const districts = descendants.filter((entity: any) => entity.type === 'district')
    const resolvedDistricts = districtNames.map((name) =>
      districts.find((entity: any) => entity.canonicalName.toLocaleLowerCase() === name.toLocaleLowerCase()) || null,
    )

    setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
    return { city: cityEntity, descendants, resolvedDistricts }
  } catch {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    setResponseStatus(event, 502)
    return { city: null, descendants: [], resolvedDistricts: [] }
  }
})
