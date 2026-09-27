// GET /flats-account-google-start?return=<path> — leave for Google's sign-in
// page. See server/flats/googleOAuth.ts for the whole flow.
import { beginGoogleSignIn, googleOAuthConfig, safeReturnPath, withAccountOutcome } from '../flats/googleOAuth'

export default defineEventHandler((event) => {
  const returnTo = safeReturnPath(getQuery(event).return)
  const config = googleOAuthConfig()
  if (!config) return sendRedirect(event, withAccountOutcome(returnTo, 'unavailable'), 302)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return sendRedirect(event, beginGoogleSignIn(event, config, returnTo), 302)
})
