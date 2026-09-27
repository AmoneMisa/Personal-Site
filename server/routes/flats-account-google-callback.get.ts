// GET /flats-account-google-callback — Google sends the visitor back here.
//
// Every outcome is a redirect to the page the visitor started from, with
// ?account=linked|cancelled|failed, so a failure never strands them on a bare
// JSON response. Error details go to the log as codes, never the token.
import { installationFor, savedStateHeaders } from '../flats/savedState'
import {
  GOOGLE_TOKEN_URL,
  accountUrl,
  googleOAuthConfig,
  idTokenNonce,
  takePendingSignIn,
  withAccountOutcome,
} from '../flats/googleOAuth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const query = getQuery(event)
  const pending = takePendingSignIn(event)
  const returnTo = pending?.returnTo ?? '/flat-finder/favorites'
  const done = (outcome: string) => sendRedirect(event, withAccountOutcome(returnTo, outcome), 302)

  const config = googleOAuthConfig()
  if (!config) return done('unavailable')
  if (query.error) return done(query.error === 'access_denied' ? 'cancelled' : 'failed')
  // State ties this response to the sign-in this browser started (CSRF).
  if (!pending || typeof query.state !== 'string' || query.state !== pending.state || typeof query.code !== 'string') {
    console.warn('[flats-account] callback without a matching sign-in')
    return done('failed')
  }

  let idToken: string
  try {
    const tokens = await $fetch<{ id_token?: string }>(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: query.code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }).toString(),
      timeout: 10_000,
    })
    idToken = String(tokens?.id_token || '')
  } catch (error) {
    console.error('[flats-account] code exchange failed:', (error as { statusCode?: number })?.statusCode ?? 'error')
    return done('failed')
  }
  // The nonce ties the token to this sign-in (replay). The signature, issuer,
  // audience and expiry are checked by flats-api.
  if (!idToken || idTokenNonce(idToken) !== pending.nonce) {
    console.warn('[flats-account] id token nonce mismatch')
    return done('failed')
  }

  // Signing in is also the first sync for a browser that never had one.
  const credentials = installationFor(event)
  try {
    await $fetch(accountUrl('/google'), {
      method: 'POST',
      headers: { ...savedStateHeaders(credentials, event), 'Content-Type': 'application/json' },
      body: { idToken },
      timeout: 15_000,
    })
    return done('linked')
  } catch (error) {
    console.error('[flats-account] link failed:', (error as { statusCode?: number })?.statusCode ?? 'error')
    return done('failed')
  }
})
