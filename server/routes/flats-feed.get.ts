// GET /flats-feed — server-side proxy to the flat-finder backend's /api/listings.
// The flat API is plain HTTP and the site is HTTPS, so a direct browser call is
// blocked as mixed content; proxying here keeps it same-origin + HTTPS. Lives
// outside /api (that prefix proxies to FastAPI). FLAT_API_URL configures the
// upstream (defaults to the host-nginx port the desktop app already uses).
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'
const FEED_FRESH_MS = 30_000
const FEED_STALE_MS = 60 * 60_000
const feedCache = new Map<string, { at: number; data: any }>()
const feedRefreshes = new Map<string, Promise<any>>()

// Telegram listing photos come back as paths relative to the flat backend
// (/api/tg-photo/<channel>/<id>); rewrite them through our own /flats-photo proxy
// so the browser loads them over HTTPS same-origin. OLX photos are absolute https
// URLs and pass through untouched.
function rewritePhoto(p: unknown): unknown {
  return typeof p === 'string' && p.startsWith('/api/tg-photo/')
    ? `/flats-photo?path=${encodeURIComponent(p)}`
    : p
}

function shapeResponse(raw: any, requestedSources: string[]): any {
  const data = { ...raw }
  const allowed = requestedSources.length ? requestedSources : ['olx', 'telegram']
  data.listings = Array.isArray(raw?.listings)
    ? raw.listings
        .filter((listing: any) => allowed.includes(String(listing?.source || '').toLowerCase()))
        .map((listing: any) => ({
          ...listing,
          photo: rewritePhoto(listing.photo),
          photos: Array.isArray(listing.photos) ? listing.photos.map(rewritePhoto) : [],
        }))
    : []
  const backendSources = Array.isArray(raw?.filters?.sources) ? raw.filters.sources : []
  data.count = requestedSources.length && backendSources.length === 0
    ? data.listings.length
    : typeof raw?.count === 'number' ? raw.count : data.listings.length
  return data
}

function refreshFeed(key: string, url: string): Promise<any> {
  const current = feedRefreshes.get(key)
  if (current) return current
  const request = $fetch<any>(url, { timeout: 15_000 })
    .then((data) => {
      // A cold backend returns immediately with `warming: true`. Keep that
      // response only as stale so the client's next poll reaches upstream
      // instead of replaying an empty snapshot for the normal 30-second TTL.
      const at = data?.warming ? Date.now() - FEED_FRESH_MS : Date.now()
      feedCache.set(key, { at, data })
      return data
    })
    .finally(() => feedRefreshes.delete(key))
  feedRefreshes.set(key, request)
  return request
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const requestedSources = (incoming.searchParams.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter((source) => source === 'olx' || source === 'telegram')

  // The flat backend keeps one complete warmed snapshot per country and applies
  // all UI filters after the cache read. Forward filters so they are evaluated
  // in memory before backend pagination, never by launching another scrape.
  const upstreamParams = new URLSearchParams(incoming.searchParams)
  const url = `${FLAT_API_URL}/api/listings?${upstreamParams}`
  const key = upstreamParams.toString()
  const requestedOffset = Math.max(0, Number(upstreamParams.get('offset')) || 0)
  const requestedLimit = Math.min(60, Math.max(1, Number(upstreamParams.get('limit')) || 20))
  const enforcePage = (response: any) => ({
    ...response,
    listings: Array.isArray(response?.listings) && response.listings.length > requestedLimit
      ? response.listings.slice(requestedOffset, requestedOffset + requestedLimit)
      : response?.listings || [],
  })
  const shapeWithCombinedFallback = async (raw: any) => {
    const shaped = shapeResponse(raw, requestedSources)
    if (raw?.warming || requestedSources.length !== 1 || shaped.listings.length || Number(raw?.sourceCounts?.[requestedSources[0]!]) > 0) {
      return enforcePage(shaped)
    }

    // Compatibility for the pre-fix backend during staggered deployment: its
    // source-specific cache can degrade to demo rows while the combined cache
    // still has the real source. Reuse that warm combined snapshot only when
    // the selected source explicitly reported zero live rows.
    const combinedParams = new URLSearchParams(upstreamParams)
    combinedParams.delete('sources')
    const combinedKey = `combined:${combinedParams}`
    const combinedUrl = `${FLAT_API_URL}/api/listings?${combinedParams}`
    const combinedCached = feedCache.get(combinedKey)
    const combinedRaw = combinedCached && Date.now() - combinedCached.at < FEED_STALE_MS
      ? combinedCached.data
      : await refreshFeed(combinedKey, combinedUrl)
    const combined = shapeResponse(combinedRaw, requestedSources)
    return enforcePage(combined.listings.length ? { ...combined, compatibilityFallback: true } : shaped)
  }
  const cached = feedCache.get(key)
  if (cached && Date.now() - cached.at < FEED_FRESH_MS) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return await shapeWithCombinedFallback(cached.data)
  }
  if (cached && Date.now() - cached.at < FEED_STALE_MS) {
    refreshFeed(key, url).catch(() => {})
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { ...await shapeWithCombinedFallback(cached.data), stale: true }
  }
  try {
    const data = await refreshFeed(key, url)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return await shapeWithCombinedFallback(data)
  } catch (err) {
    setResponseStatus(event, 502)
    return { error: (err as Error).message, listings: [], count: 0 }
  }
})
