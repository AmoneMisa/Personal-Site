// POST /flats-sync-mutate — one saved-state mutation for this browser.
//
// The op vocabulary is the backend's (favorite.put/delete, sorted.put/delete/
// deleteCollection, preset.put/delete). It is forwarded rather than rebuilt so
// there is one definition of a mutation, but the op name is checked here so a
// page bug cannot send arbitrary bodies to the API.
import { installationFor, savedStateHeaders, savedStateUrl } from '../flats/savedState'

const ALLOWED_OPS = new Set([
  'favorite.put',
  'favorite.delete',
  'sorted.put',
  'sorted.delete',
  'sorted.deleteCollection',
])

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const op = String(body?.op || '')
  if (!ALLOWED_OPS.has(op)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'unsupported op' }
  }

  const credentials = installationFor(event)
  try {
    await $fetch(savedStateUrl('/mutate'), {
      method: 'POST',
      headers: { ...savedStateHeaders(credentials), 'Content-Type': 'application/json' },
      body,
      timeout: 15_000,
    })
    return { ok: true }
  } catch (error) {
    // The caller already applied the change locally; report the failure so it
    // can retry rather than silently diverging from the server.
    console.error('[flats-sync] mutate failed:', op, (error as Error)?.message)
    setResponseStatus(event, 502)
    return { ok: false, error: 'mutate failed' }
  }
})
