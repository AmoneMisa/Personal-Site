import { timingSafeEqual } from 'node:crypto'
import { metricsRegistry } from '../utils/siteMetrics'

function keyMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Prometheus scrape endpoint. The frontend is reachable through the public
// edge, so the endpoint stays hidden (404) until METRICS_KEY is configured and
// then requires it as a bearer token.
export default defineEventHandler(async (event) => {
  const expected = String(process.env.METRICS_KEY || '').trim()
  if (!expected) throw createError({ statusCode: 404 })

  const header = getRequestHeader(event, 'authorization') || ''
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!keyMatches(given, expected)) throw createError({ statusCode: 401 })

  setResponseHeader(event, 'Content-Type', metricsRegistry.contentType)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return metricsRegistry.metrics()
})
