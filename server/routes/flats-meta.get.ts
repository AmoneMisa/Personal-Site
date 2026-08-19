// GET /flats-meta — proxy the flat-finder backend's /api/countries (country +
// currency + city/location metadata for the filter dropdowns).
//
// This route deliberately returns CANONICAL location values. Display names are
// localized at render time by the client (app/utils/locationLabels.ts), which
// keeps filter state, URL params and API requests independent of the UI language
// — previously the station labels were localized here, so the dropdown *value*
// itself changed with the request locale. Inbound legacy/localized filter values
// are still canonicalized in flats-feed, so old links and presets keep working.
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'

export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch<any[]>(`${FLAT_API_URL}/api/countries`, { timeout: 15_000 })
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return data
  } catch {
    return []
  }
})
