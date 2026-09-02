// GET /flats-rates — proxy the flat-finder backend's /api/rates (FX rates vs USD)
// so the HTTPS site can convert/display prices in the user's chosen currency and
// send price filters in a known currency. See flats-feed for why this is proxied.
import { FLAT_API_URL } from '../flats/feedLookup'

export default defineEventHandler(async (event) => {
  try {
    const data = await $fetch(`${FLAT_API_URL}/api/rates`, { timeout: 10_000 })
    setResponseHeader(event, 'Cache-Control', 'private, max-age=3600')
    return data
  } catch {
    return { base: 'USD', rates: { USD: 1 } }
  }
})
