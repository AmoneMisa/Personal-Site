import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'

/**
 * Sends real-user Core Web Vitals to the same-origin /rum route, which only
 * aggregates them into Prometheus histograms (server/routes/rum.post.ts).
 *
 * web-vitals measures the hard page load, so every metric is attributed to the
 * route the visitor landed on, even if CLS/INP are flushed after a client-side
 * navigation. The route name drops the i18n "___ru" suffix so both locales
 * share one label.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.dev) return

  const router = useRouter()
  let page = 'other'
  const queue: Array<{ name: string; value: number; rating: string; page: string }> = []

  const flush = () => {
    if (!queue.length) return
    const body = JSON.stringify(queue.splice(0))
    if (!navigator.sendBeacon?.('/rum', body)) {
      fetch('/rum', { method: 'POST', body, keepalive: true }).catch(() => {})
    }
  }

  const report = (metric: Metric) => {
    queue.push({ name: metric.name, value: metric.value, rating: metric.rating, page })
  }

  nuxtApp.hook('app:mounted', () => {
    page = String(router.currentRoute.value.name || 'other').replace(/___[a-z]{2}$/, '')
    onLCP(report)
    onINP(report)
    onCLS(report)
    onFCP(report)
    onTTFB(report)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    addEventListener('pagehide', flush)
  })
})
