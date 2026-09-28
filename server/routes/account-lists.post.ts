// POST /account-lists?domain=jobs|cv — a batch of list operations
// ({ops: [{op: put|add|delete|clear, list, key?, payload?}]}). The backend
// validates each op (apps/flats mobile-lists.js); this checks only the shape
// so a page bug cannot forward arbitrary bodies.
import { accountListsUrl, existingInstallation, installationFetch, savedStateHeaders } from '../flats/savedState'
import { accountListDomain, ACCOUNT_LIST_MAX_OPS } from '../utils/accountLists'

export default defineEventHandler(async (event) => {
  const domain = accountListDomain(getQuery(event).domain)
  const body = await readBody<{ ops?: unknown }>(event)
  const ops = Array.isArray(body?.ops) ? body.ops : []
  if (!domain || !ops.length || ops.length > ACCOUNT_LIST_MAX_OPS) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid request' }
  }
  const credentials = existingInstallation(event)
  if (!credentials) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'not signed in' }
  }
  try {
    await installationFetch(accountListsUrl(domain), {
      method: 'POST',
      headers: { ...savedStateHeaders(credentials, event), 'Content-Type': 'application/json' },
      body: { ops },
      timeout: 15_000,
    })
    return { ok: true }
  } catch (error) {
    console.error('[account-lists] write failed:', domain, (error as Error)?.message)
    setResponseStatus(event, 502)
    return { ok: false, error: 'write failed' }
  }
})
