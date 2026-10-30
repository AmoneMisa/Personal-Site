import type { H3Event } from 'h3'
import { FLAT_API_URL } from '../flats/feedLookup'
import { FixedWindowRateLimiter } from './fixedWindowRateLimiter'
import { requestClientIp } from './requestClientIp'

const TG_PHOTO_RE = /^\/api\/tg-photo\/[A-Za-z0-9_]{3,64}\/\d+$/
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

// A page loads dozens of photos at once, so the limit is generous; it only stops a loop.
const limiter = new FixedWindowRateLimiter({ limit: 600, windowMs: 60_000, maxEntries: 5_000 })

/**
 * Proxy one Telegram listing photo from the flat-finder backend over HTTPS same-origin.
 * The path is strictly validated, the answer must be an image and is capped in size,
 * so neither a wrong path nor a misbehaving upstream can fill memory or serve a page.
 */
export async function proxyTelegramPhoto(event: H3Event) {
  if (!limiter.consume(requestClientIp(event))) {
    setResponseStatus(event, 429)
    return ''
  }
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
    const type = res.headers.get('content-type') || 'image/jpeg'
    const declared = Number(res.headers.get('content-length') || 0)
    if (!/^image\//i.test(type) || declared > MAX_PHOTO_BYTES) {
      await res.body?.cancel()
      setResponseStatus(event, 502)
      return ''
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_PHOTO_BYTES) {
      setResponseStatus(event, 502)
      return ''
    }
    setResponseHeader(event, 'Content-Type', type)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=604800, immutable')
    return bytes
  } catch {
    setResponseStatus(event, 502)
    return ''
  }
}
