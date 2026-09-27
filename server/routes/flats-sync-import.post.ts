// POST /flats-sync-import — hand the server every favourite this browser has
// that the server does not, in one request.
//
// The backend's import is additive (INSERT ... ON CONFLICT DO NOTHING, see
// apps/flats/src/mobile/mobile-saved-state.js): it never removes or overwrites
// what is already stored, so it is safe for a union merge. It is used instead
// of one mutation per item because the backend allows one mutation per 100 ms
// per client; a loop of mutations trips that and switches sync off.
import { installationFor, savedStateFetch, savedStateHeaders } from '../flats/savedState'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ favorites?: unknown[]; sorted?: unknown[] }>(event)
  const payload = {
    favorites: Array.isArray(body?.favorites) ? body.favorites : [],
    sorted: Array.isArray(body?.sorted) ? body.sorted : [],
  }
  if (!payload.favorites.length && !payload.sorted.length) return { ok: true, skipped: true }

  const credentials = installationFor(event)
  try {
    await savedStateFetch('/import', {
      method: 'POST',
      headers: { ...savedStateHeaders(credentials, event), 'Content-Type': 'application/json' },
      body: payload,
      timeout: 20_000,
    })
    return { ok: true }
  } catch (error) {
    console.error('[flats-sync] import failed:', (error as Error)?.message)
    setResponseStatus(event, 502)
    return { ok: false, error: 'import failed' }
  }
})
