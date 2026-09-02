// GET /hiring-photo?path=/api/tg-photo/<channel>/<id> — proxy Telegram photos
// through the flat-finder backend (same transport as /flats-photo).
import { FLAT_API_URL } from '../flats/feedLookup'

const TG_PHOTO_RE = /^\/api\/tg-photo\/[A-Za-z0-9_]{3,64}\/\d+$/

export default defineEventHandler(async (event) => {
  const path = String(getQuery(event).path || '')
  if (!TG_PHOTO_RE.test(path)) {
    setResponseStatus(event, 400)
    return 'bad path'
  }
  try {
    const res = await fetch(`${FLAT_API_URL}${path}`, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) {
      setResponseStatus(event, res.status === 404 ? 404 : 502)
      return ''
    }
    setResponseHeader(event, 'Content-Type', res.headers.get('content-type') || 'image/jpeg')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    return Buffer.from(await res.arrayBuffer())
  } catch {
    setResponseStatus(event, 502)
    return ''
  }
})
