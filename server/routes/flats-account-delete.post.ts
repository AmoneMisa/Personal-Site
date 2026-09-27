// POST /flats-account-delete — erase the Google account this browser is signed
// in to: its saved flats, presets and subject id. Every device is unlinked.
// A cross-site POST cannot trigger this: the installation cookies are SameSite=Lax.
import { existingInstallation, savedStateHeaders } from '../flats/savedState'
import { accountUrl } from '../flats/googleOAuth'

export default defineEventHandler(async (event) => {
  const credentials = existingInstallation(event)
  if (!credentials) return { ok: true, signedIn: false }
  try {
    await $fetch(accountUrl('/delete'), {
      method: 'POST',
      headers: savedStateHeaders(credentials, event),
      timeout: 15_000,
    })
    return { ok: true, signedIn: false }
  } catch (error) {
    console.error('[flats-account] delete failed:', (error as { statusCode?: number })?.statusCode ?? 'error')
    setResponseStatus(event, 502)
    return { ok: false }
  }
})
