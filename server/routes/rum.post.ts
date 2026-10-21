import { rumPageLabel, webVitalsCls, webVitalsMs } from '../utils/siteMetrics'

const MAX_BODY_BYTES = 4096
const MAX_ENTRIES = 10
const MS_METRICS = new Set(['LCP', 'INP', 'FCP', 'TTFB'])
const RATINGS = new Set(['good', 'needs-improvement', 'poor'])

type VitalEntry = { name?: unknown; value?: unknown; rating?: unknown; page?: unknown }

/**
 * Real-user Web Vitals beacon (app/plugins/web-vitals.client.ts).
 *
 * Values only feed aggregate histograms; nothing per visitor (IP, URL, user
 * agent) is stored. Malformed entries are dropped silently, since a beacon
 * cannot act on an error response anyway.
 */
export default defineEventHandler(async (event) => {
  const length = Number(getRequestHeader(event, 'content-length') || 0)
  if (length > MAX_BODY_BYTES) throw createError({ statusCode: 413 })

  // sendBeacon posts text/plain to avoid a CORS preflight, so parse manually.
  const raw = await readRawBody(event, 'utf8')
  if (!raw || raw.length > MAX_BODY_BYTES) throw createError({ statusCode: 400 })

  let entries: VitalEntry[]
  try {
    const parsed = JSON.parse(raw)
    entries = Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : []
  } catch {
    throw createError({ statusCode: 400 })
  }

  for (const entry of entries) {
    const value = Number(entry.value)
    const rating = RATINGS.has(String(entry.rating)) ? String(entry.rating) : null
    if (!Number.isFinite(value) || value < 0 || !rating) continue
    const page = rumPageLabel(entry.page)

    if (entry.name === 'CLS') {
      if (value <= 10) webVitalsCls.labels(page, rating).observe(value)
    } else if (MS_METRICS.has(String(entry.name))) {
      if (value <= 120_000) webVitalsMs.labels(String(entry.name), page, rating).observe(value)
    }
  }

  setResponseStatus(event, 204)
  return null
})
