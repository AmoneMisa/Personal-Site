// GET /flats-geo-city — resolve a city's geo-catalog entity plus every
// descendant entity (districts, microdistricts, metro, POIs, ...) in one call.
//
// geo-catalog's data is an encrypted artifact that only decrypts under Node
// (see @whiteslove/geo-catalog's catalog.js), so this lookup has to happen
// here in the Nitro server rather than in a universal composable — importing
// the package from client-bundled code crashes hydration.
import { getGeoDescendants, resolveLexiconGeoEntity, type GeoEntity } from '@whiteslove/geo-catalog'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const country = String(query.country || '').trim().toUpperCase()
  const city = String(query.city || '').trim()
  const districtNames = String(query.districts || '')
    .split(',')
    .map((value) => decodeURIComponent(value))
    .filter(Boolean)

  if (!country || !city) {
    return { city: null, descendants: [], resolvedDistricts: [] }
  }

  const cityEntity = resolveLexiconGeoEntity({ country, type: 'city', canonical: city })
  const descendants: GeoEntity[] = cityEntity ? [...getGeoDescendants(cityEntity.id, { country })] : []
  const resolvedDistricts = districtNames.map((name) =>
    resolveLexiconGeoEntity({ country, city, type: 'district', canonical: name }),
  )

  setResponseHeader(event, 'Cache-Control', 'private, max-age=300')
  return { city: cityEntity, descendants, resolvedDistricts }
})
