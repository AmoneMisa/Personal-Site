// GET /flats-account — whether this browser is signed in, and whether sign-in
// is offered at all. A browser that never synced has no installation and is
// simply signed out; this does not mint one.
import { existingInstallation, savedStateHeaders } from '../flats/savedState'
import { accountUrl, googleOAuthConfig } from '../flats/googleOAuth'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const enabled = Boolean(googleOAuthConfig())
  const credentials = existingInstallation(event)
  if (!enabled || !credentials) return { enabled, signedIn: false }
  try {
    const status = await $fetch<{ signedIn?: boolean }>(accountUrl(''), {
      headers: savedStateHeaders(credentials, event),
      timeout: 10_000,
    })
    return { enabled, signedIn: status?.signedIn === true }
  } catch (error) {
    console.error('[flats-account] status failed:', (error as Error)?.message)
    return { enabled, signedIn: false, unavailable: true }
  }
})
