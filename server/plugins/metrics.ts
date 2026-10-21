import diagnosticsChannel from 'node:diagnostics_channel'
import type { H3Event } from 'h3'
import {
  httpRequestDuration,
  statusClass,
  upstreamLabel,
  upstreamRequestDuration,
  upstreamRequestErrors,
} from '../utils/siteMetrics'

const requestStart = new WeakMap<H3Event, number>()

function routeLabel(event: H3Event): string {
  const matched = (event.context.matchedRoute as { path?: string } | undefined)?.path
  // The Vue renderer is Nitro's '/**' catch-all; per-page detail comes from
  // Web Vitals instead of the raw URL, which would be an unbounded label.
  if (!matched || matched === '/**') return 'page'
  return matched
}

// Node's built-in fetch (and therefore $fetch) is undici, which publishes these
// channels for every request. Subscribing here instruments all upstream calls
// (Flat Finder, platform APIs, AI Worker, ...) without wrapping each call site.
type UndiciRequest = { origin?: string | URL }
const fetchStart = new WeakMap<UndiciRequest, number>()

function subscribeUndici() {
  const flag = Symbol.for('whiteslove.siteMetrics.undici')
  const state = globalThis as Record<symbol, unknown>
  if (state[flag]) return
  state[flag] = true

  diagnosticsChannel.subscribe('undici:request:create', (message) => {
    const { request } = message as { request: UndiciRequest }
    fetchStart.set(request, performance.now())
  })
  diagnosticsChannel.subscribe('undici:request:headers', (message) => {
    const { request, response } = message as { request: UndiciRequest; response: { statusCode: number } }
    const start = fetchStart.get(request)
    if (start === undefined) return
    fetchStart.delete(request)
    upstreamRequestDuration
      .labels(upstreamLabel(String(request.origin || '')), statusClass(response.statusCode))
      .observe((performance.now() - start) / 1000)
  })
  diagnosticsChannel.subscribe('undici:request:error', (message) => {
    const { request } = message as { request: UndiciRequest }
    if (!fetchStart.has(request)) return
    fetchStart.delete(request)
    upstreamRequestErrors.labels(upstreamLabel(String(request.origin || ''))).inc()
  })
}

export default defineNitroPlugin((nitroApp) => {
  subscribeUndici()

  nitroApp.hooks.hook('request', (event) => {
    requestStart.set(event, performance.now())
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const start = requestStart.get(event)
    if (start === undefined) return
    requestStart.delete(event)
    httpRequestDuration
      .labels(event.method, routeLabel(event), statusClass(getResponseStatus(event)))
      .observe((performance.now() - start) / 1000)
  })
})
