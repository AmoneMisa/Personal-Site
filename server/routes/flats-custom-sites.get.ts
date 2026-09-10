// GET /flats-custom-sites — proxy the flat-finder backend's /api/custom-sites
// (the curated real-estate domains behind the "Sites" source bucket) so the
// filter UI can offer per-site toggles instead of one opaque switch. See
// flats-feed for why this is proxied same-origin rather than called directly.
import { FLAT_API_URL } from '../flats/feedLookup'

type CustomSite = { domain: string, countries: string[] }

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const country = String(query.country || '').trim().toUpperCase()
  const params = /^[A-Z]{2}$/.test(country) ? `?country=${country}` : ''

  try {
    const data = await $fetch<{ sites: CustomSite[] }>(
      `${FLAT_API_URL}/api/custom-sites${params}`,
      { timeout: 10_000 },
    )
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return { sites: Array.isArray(data?.sites) ? data.sites : [] }
  } catch {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { sites: [] }
  }
})
