// Shared plumbing for the saved-state proxy routes.
//
// The flat-finder backend authenticates saved state with an installation device
// id plus a 64-hex secret (apps/flats/src/mobile/mobile-saved-state.js). That
// secret is a bearer credential: anything holding it can read and rewrite that
// installation's favourites and collections. So it lives in httpOnly cookies
// and is attached here, server side — the browser never sees it, which keeps it
// out of reach of any XSS on the page.
//
// There is no registration endpoint: the backend creates the installation on
// first use (ensureInstallation) and then verifies the hash, so a fresh id and
// secret is all it takes to start.
import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { FLAT_API_URL } from './feedLookup'
import { requestClientIp } from '../utils/requestClientIp'

export const DEVICE_COOKIE = 'ff_device'
export const SECRET_COOKIE = 'ff_secret'

// The backend validates: id 8-80 chars of [A-Za-z0-9._:-], secret 64 lowercase
// hex. Anything else is a 401, so generate inside those rules.
const DEVICE_RE = /^[A-Za-z0-9._:-]{8,80}$/
const SECRET_RE = /^[a-f0-9]{64}$/

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2

export interface InstallationCredentials {
  deviceId: string
  secret: string
}

function cookieOptions() {
  // `secure` only in production: the dev server is plain http on localhost and
  // a secure cookie would never be stored there.
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !import.meta.dev,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  }
}

/** Reads the installation from cookies, or mints one and sets them. */
export function installationFor(event: H3Event): InstallationCredentials {
  const existingDevice = getCookie(event, DEVICE_COOKIE) || ''
  const existingSecret = getCookie(event, SECRET_COOKIE) || ''
  if (DEVICE_RE.test(existingDevice) && SECRET_RE.test(existingSecret)) {
    return { deviceId: existingDevice, secret: existingSecret }
  }

  // "web-" marks where the installation came from; the rest is random.
  const credentials: InstallationCredentials = {
    deviceId: `web-${randomBytes(16).toString('hex')}`,
    secret: randomBytes(32).toString('hex'),
  }
  setCookie(event, DEVICE_COOKIE, credentials.deviceId, cookieOptions())
  setCookie(event, SECRET_COOKIE, credentials.secret, cookieOptions())
  return credentials
}

/** Present only after the browser has synced at least once. */
export function existingInstallation(event: H3Event): InstallationCredentials | null {
  const deviceId = getCookie(event, DEVICE_COOKIE) || ''
  const secret = getCookie(event, SECRET_COOKIE) || ''
  return DEVICE_RE.test(deviceId) && SECRET_RE.test(secret) ? { deviceId, secret } : null
}

export function savedStateHeaders(
  credentials: InstallationCredentials,
  event?: H3Event,
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Flat-Finder-Device-Id': credentials.deviceId,
    'X-Flat-Finder-Device-Secret': credentials.secret,
  }
  // The backend rate-limits saved state per client IP (trust proxy 1, so it
  // reads the last X-Forwarded-For hop). Without this every browser arrives
  // from this server's address and they all share one bucket.
  const ip = event ? requestClientIp(event) : 'unknown'
  if (ip !== 'unknown') headers['X-Forwarded-For'] = ip
  return headers
}

export function savedStateUrl(path: string): string {
  return `${FLAT_API_URL}/api/mobile/saved-state${path}`
}

// The backend allows one saved-state request per 100-250 ms per client, so
// two quick heart clicks can legitimately collide. Wait the Retry-After it
// sends (capped) and try once more before calling it a failure; a failure
// switches sync off for the rest of the page.
const RATE_LIMIT_RETRY_CAP_MS = 1_000

function retryAfterMs(error: unknown): number | null {
  const response = (error as { response?: { status?: number; headers?: Headers; _data?: { retryAfterMs?: unknown } } })?.response
  if (response?.status !== 429) return null
  const fromBody = Number(response._data?.retryAfterMs)
  const fromHeader = Number(response.headers?.get('retry-after')) * 1000
  const wait = Number.isFinite(fromBody) && fromBody > 0 ? fromBody : Number.isFinite(fromHeader) ? fromHeader : 250
  return Math.min(Math.max(wait, 0), RATE_LIMIT_RETRY_CAP_MS)
}

/** A request to the backend's installation-authenticated API, retried once on 429. */
export async function installationFetch<T>(
  url: string,
  options: Parameters<typeof $fetch>[1],
): Promise<T> {
  try {
    return await $fetch<T>(url, options)
  } catch (error) {
    const wait = retryAfterMs(error)
    if (wait == null) throw error
    await new Promise((resolve) => setTimeout(resolve, wait))
    return await $fetch<T>(url, options)
  }
}

export function savedStateFetch<T>(
  path: string,
  options: Parameters<typeof $fetch>[1],
): Promise<T> {
  return installationFetch<T>(savedStateUrl(path), options)
}

/** The account's jobs / CV lists (apps/flats mobile-lists.js). */
export function accountListsUrl(domain: string): string {
  return `${FLAT_API_URL}/api/mobile/lists/${domain}`
}
