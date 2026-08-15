// GET /flats-meta — proxy the flat-finder backend's /api/countries (country +
// currency + city/location metadata for the filter dropdowns). See flats-feed.
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'

export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch(`${FLAT_API_URL}/api/countries`, { timeout: 15_000 })
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return data
  } catch {
    return []
  }
})
