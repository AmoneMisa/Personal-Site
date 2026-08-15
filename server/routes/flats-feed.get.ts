// GET /flats-feed — server-side proxy to the flat-finder backend's /api/listings.
// The flat API is plain HTTP and the site is HTTPS, so a direct browser call is
// blocked as mixed content; proxying here keeps it same-origin + HTTPS. Lives
// outside /api (that prefix proxies to FastAPI). FLAT_API_URL configures the
// upstream (defaults to the host-nginx port the desktop app already uses).
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'

// Telegram listing photos come back as paths relative to the flat backend
// (/api/tg-photo/<channel>/<id>); rewrite them through our own /flats-photo proxy
// so the browser loads them over HTTPS same-origin. OLX photos are absolute https
// URLs and pass through untouched.
function rewritePhoto(p: unknown): unknown {
  return typeof p === 'string' && p.startsWith('/api/tg-photo/')
    ? `/flats-photo?path=${encodeURIComponent(p)}`
    : p
}

export default defineEventHandler(async (event) => {
  const search = getRequestURL(event).search // forward all filters verbatim
  const url = `${FLAT_API_URL}/api/listings${search}`
  try {
    const data = await $fetch<any>(url, { timeout: 25_000 })
    if (Array.isArray(data?.listings)) {
      for (const l of data.listings) {
        l.photo = rewritePhoto(l.photo)
        if (Array.isArray(l.photos)) l.photos = l.photos.map(rewritePhoto)
      }
    }
    setResponseHeader(event, 'Cache-Control', 'private, max-age=30')
    return data
  } catch (err) {
    setResponseStatus(event, 502)
    return { error: (err as Error).message, listings: [], count: 0 }
  }
})
