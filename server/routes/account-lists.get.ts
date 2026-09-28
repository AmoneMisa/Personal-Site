// GET /account-lists?domain=jobs|cv — the Google account's saved jobs or CVs
// (favourites, hidden, recent, seen, presets).
//
// Only a signed-in browser syncs these lists, and signing in always creates the
// installation first, so this never mints one: a browser without it simply
// has nothing to read.
import { accountListsUrl, existingInstallation, installationFetch, savedStateHeaders } from '../flats/savedState'
import { accountListDomain } from '../utils/accountLists'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const domain = accountListDomain(getQuery(event).domain)
  if (!domain) {
    setResponseStatus(event, 400)
    return { ok: false, lists: null }
  }
  const credentials = existingInstallation(event)
  if (!credentials) return { ok: false, lists: null }
  try {
    const lists = await installationFetch<Record<string, unknown>>(accountListsUrl(domain), {
      headers: savedStateHeaders(credentials, event),
      timeout: 15_000,
    })
    return { ok: true, lists }
  } catch (error) {
    // Sync is an enhancement over local storage: the page keeps working locally.
    console.error('[account-lists] read failed:', domain, (error as Error)?.message)
    return { ok: false, lists: null }
  }
})
