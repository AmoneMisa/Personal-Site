// POST /flats-account-sign-out — unlink this browser from its Google account.
// The account and its saved flats stay; this browser is left empty.
// A cross-site POST cannot trigger this: the installation cookies are SameSite=Lax.
import { existingInstallation, savedStateHeaders } from '../flats/savedState'
import { accountUrl } from '../flats/googleOAuth'

export default defineEventHandler(async (event) => {
  const credentials = existingInstallation(event)
  if (!credentials) return { ok: true, signedIn: false }
  try {
    await $fetch(accountUrl('/sign-out'), {
      method: 'POST',
      headers: savedStateHeaders(credentials, event),
      timeout: 15_000,
    })
    return { ok: true, signedIn: false }
  } catch (error) {
    console.error('[flats-account] sign-out failed:', (error as { statusCode?: number })?.statusCode ?? 'error')
    setResponseStatus(event, 502)
    return { ok: false }
  }
})
