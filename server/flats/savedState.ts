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

export function savedStateHeaders(credentials: InstallationCredentials): Record<string, string> {
  return {
    'X-Flat-Finder-Device-Id': credentials.deviceId,
    'X-Flat-Finder-Device-Secret': credentials.secret,
  }
}

export function savedStateUrl(path: string): string {
  return `${FLAT_API_URL}/api/mobile/saved-state${path}`
}
