import type { H3Event } from 'h3'
import { FixedWindowRateLimiter } from './fixedWindowRateLimiter'
import { requestClientIp } from './requestClientIp'

const TIMEOUT_MS = 15_000

/** Where privacy requests are handled: the flats API of the backend platform. */
export function privacyApiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  return String(env.FLAT_API_URL || 'http://flats-api:4000').trim().replace(/\/$/, '')
}

// Per-visitor limits in the BFF. The backend limits too, but it sees this
// server as the client, so without forwarding the visitor's address every
// visitor would share one bucket there.
export const intakeLimiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 10 * 60_000, maxEntries: 5_000 })
export const statusLimiter = new FixedWindowRateLimiter({ limit: 30, windowMs: 60_000, maxEntries: 5_000 })

export function enforceLimit(event: H3Event, limiter: FixedWindowRateLimiter): string {
  const ip = requestClientIp(event)
  if (!limiter.consume(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
  return ip
}

/**
 * One request to the privacy API. Returns the upstream status and JSON body;
 * the body is forwarded as-is because the backend already limits it to what
 * a requester may see. Failures are logged by path and status only: request
 * bodies here are personal data.
 */
export async function privacyApiRequest(path: string, init: { method: 'GET' | 'POST'; body?: unknown; clientIp: string }): Promise<{ status: number; body: unknown }> {
  const url = `${privacyApiBaseUrl()}${path}`
  try {
    const response = await fetch(url, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        // The backend trusts exactly one proxy hop and rate-limits on it.
        // Without a known address (proxy headers not trusted here) nothing is
        // forwarded rather than a placeholder the backend would parse as one.
        ...(init.clientIp && init.clientIp !== 'unknown' ? { 'X-Forwarded-For': init.clientIp } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = await response.json().catch(() => ({ ok: false, error: 'invalid_upstream_response' }))
    return { status: response.status, body }
  } catch (error) {
    console.error(`[privacy-request] ${init.method} ${path.split('/').slice(0, 4).join('/')} unavailable: ${(error as Error)?.name ?? 'error'}`)
    throw createError({ statusCode: 502, statusMessage: 'Privacy request service is unavailable' })
  }
}
