import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

/**
 * Prometheus registry for the Nuxt/Nitro frontend process.
 *
 * Every label here has a bounded value set: routes come from Nitro's matched
 * route pattern (never the raw URL), upstreams from the configured service
 * env vars, and Web Vitals pages are capped in rumPageLabel(). Unbounded
 * labels would let any visitor grow the scrape without limit.
 */
export const metricsRegistry = new Registry()
collectDefaultMetrics({ register: metricsRegistry, prefix: 'site_' })

export const httpRequestDuration = new Histogram({
  name: 'site_http_request_duration_seconds',
  help: 'Nitro request duration by matched route',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
})

export const upstreamRequestDuration = new Histogram({
  name: 'site_upstream_request_duration_seconds',
  help: 'Server-side fetch duration to upstream services',
  labelNames: ['upstream', 'status'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [metricsRegistry],
})

export const upstreamRequestErrors = new Counter({
  name: 'site_upstream_request_errors_total',
  help: 'Server-side fetches to upstream services that failed without a response (timeout, refused, DNS)',
  labelNames: ['upstream'] as const,
  registers: [metricsRegistry],
})

export const webVitalsMs = new Histogram({
  name: 'site_web_vitals_milliseconds',
  help: 'Real-user Core Web Vitals reported by browsers (LCP, INP, FCP, TTFB)',
  labelNames: ['metric', 'page', 'rating'] as const,
  buckets: [50, 100, 200, 300, 500, 800, 1200, 1800, 2500, 4000, 6000, 10000],
  registers: [metricsRegistry],
})

export const webVitalsCls = new Histogram({
  name: 'site_web_vitals_cls',
  help: 'Real-user Cumulative Layout Shift reported by browsers',
  labelNames: ['page', 'rating'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.4, 0.6, 1],
  registers: [metricsRegistry],
})

const UPSTREAM_ENV: Record<string, string> = {
  flatApi: 'FLAT_API_URL',
  vacanciesApi: 'VACANCIES_API_URL',
  cvApi: 'CV_API_URL',
  aiWorker: 'AI_WORKER_URL',
  telegramWorker: 'TELEGRAM_WORKER_URL',
  umami: 'UMAMI_URL',
}

let upstreamOrigins: Map<string, string> | null = null

function originOf(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

/** Maps a fetch origin to a configured upstream name, or 'external'. */
export function upstreamLabel(origin: string): string {
  if (!upstreamOrigins) {
    upstreamOrigins = new Map()
    for (const [label, envName] of Object.entries(UPSTREAM_ENV)) {
      const configured = originOf(process.env[envName])
      if (configured) upstreamOrigins.set(configured, label)
    }
  }
  return upstreamOrigins.get(origin) || 'external'
}

/** "2xx" style buckets keep the status label small. */
export function statusClass(status: number): string {
  return status >= 100 && status < 600 ? `${Math.floor(status / 100)}xx` : 'other'
}

const MAX_RUM_PAGES = 80
const rumPages = new Set<string>()

/**
 * Pages arrive from the browser, so they are untrusted. Only route-name shaped
 * values are accepted and at most MAX_RUM_PAGES distinct ones are kept.
 */
export function rumPageLabel(raw: unknown): string {
  const page = typeof raw === 'string' ? raw : ''
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(page)) return 'other'
  if (rumPages.has(page)) return page
  if (rumPages.size >= MAX_RUM_PAGES) return 'other'
  rumPages.add(page)
  return page
}
