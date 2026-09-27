// "Sign in with Google" for saved flats, as a server-side OAuth
// authorization-code flow with PKCE.
//
// Why a redirect and not Google's JavaScript button: no Google script runs on
// the site and no Google cookie is set until the visitor clicks "Sign in";
// the scope is `openid` alone, so the ID token carries Google's subject id and
// nothing else -- which is all the backend stores (apps/flats migration 059);
// and it does not depend on One Tap, which Google suppresses after dismissals.
//
// The flow: /flats-account-google-start stores state, nonce and a PKCE
// verifier in a short-lived httpOnly cookie and redirects to Google. Google
// redirects back to /flats-account-google-callback, which checks state,
// exchanges the code (with the client secret, server side), checks the nonce
// and hands the ID token to flats-api, which verifies it and links this
// browser's installation to the account.
import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { FLAT_API_URL } from './feedLookup'

export const OAUTH_COOKIE = 'ff_oauth'
const OAUTH_COOKIE_MAX_AGE = 10 * 60
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

/** Null when sign-in is not configured; the UI then hides the button. */
export function googleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) return null
  const site = String(process.env.SITE_PUBLIC_URL || 'https://whiteslove.me').trim().replace(/\/$/, '')
  return { clientId, clientSecret, redirectUri: `${site}/flats-account-google-callback` }
}

/**
 * Where to send the visitor afterwards: a same-site path only. Anything that
 * could leave the site (`//evil`, `/\evil`, a full URL) falls back to the
 * flats page, so the callback cannot be used as an open redirect.
 */
export function safeReturnPath(value: unknown): string {
  const path = String(value ?? '')
  if (path.length > 512 || !/^\/(?![/\\])[^\s\\]*$/u.test(path)) return '/flat-finder/favorites'
  return path
}

/** Appends `account=<outcome>` for the page to report. */
export function withAccountOutcome(path: string, outcome: string): string {
  const url = new URL(path, 'https://site.invalid')
  url.searchParams.set('account', outcome)
  return `${url.pathname}${url.search}`
}

interface PendingSignIn {
  state: string
  nonce: string
  verifier: string
  returnTo: string
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Lax: sent on Google's top-level redirect back to us, not on cross-site
    // subrequests.
    sameSite: 'lax' as const,
    secure: !import.meta.dev,
    path: '/',
    maxAge,
  }
}

const token = () => randomBytes(32).toString('base64url')

/** Starts a sign-in: remembers its secrets and returns Google's URL. */
export function beginGoogleSignIn(event: H3Event, config: GoogleOAuthConfig, returnTo: string): string {
  const pending: PendingSignIn = { state: token(), nonce: token(), verifier: token(), returnTo }
  setCookie(event, OAUTH_COOKIE, Buffer.from(JSON.stringify(pending)).toString('base64url'), cookieOptions(OAUTH_COOKIE_MAX_AGE))
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    // `openid` only: the token then identifies the account and nothing more.
    scope: 'openid',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

/** The pending sign-in, consumed: the cookie is deleted whatever happens next. */
export function takePendingSignIn(event: H3Event): PendingSignIn | null {
  const raw = getCookie(event, OAUTH_COOKIE)
  deleteCookie(event, OAUTH_COOKIE, cookieOptions(0))
  if (!raw) return null
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PendingSignIn>
    if (!value.state || !value.nonce || !value.verifier) return null
    return { state: value.state, nonce: value.nonce, verifier: value.verifier, returnTo: safeReturnPath(value.returnTo) }
  } catch {
    return null
  }
}

/** The nonce claim of an ID token received directly from Google's token endpoint. */
export function idTokenNonce(idToken: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] || '', 'base64url').toString('utf8'))
    return typeof payload?.nonce === 'string' ? payload.nonce : null
  } catch {
    return null
  }
}

export function accountUrl(path: string): string {
  return `${FLAT_API_URL}/api/mobile/account${path}`
}
