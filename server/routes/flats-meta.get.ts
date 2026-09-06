// GET /flats-meta — proxy the flat-finder backend's /api/countries (country +
// currency + city/location metadata for the filter dropdowns).
//
// Values remain canonical for URL/filter state. The backend supplies separate
// label maps for the requested locale; the browser only looks up these labels.
import { FLAT_API_URL } from '../flats/feedLookup'

export default defineEventHandler(async (event) => {
  const rawLocale = String(getQuery(event).locale || '').trim().slice(0, 16)
  const locale = /^[A-Za-z_-]+$/.test(rawLocale) ? rawLocale : ''
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : ''
  try {
    const data = await $fetch<any[]>(`${FLAT_API_URL}/api/countries${query}`, { timeout: 15_000 })
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return data
  } catch {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({ statusCode: 502, statusMessage: 'Flat Finder metadata is unavailable' })
  }
})
