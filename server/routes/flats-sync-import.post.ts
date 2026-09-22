// POST /flats-sync-import — seed this installation from what the browser
// already had in localStorage, once.
//
// Used the first time a browser syncs: everything saved before sync existed is
// handed over in one request instead of a mutation per item. The backend's
// import replaces the installation's state wholesale, so the client must only
// call this when the remote side is empty.
import { installationFor, savedStateHeaders, savedStateUrl } from '../flats/savedState'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ favorites?: unknown[]; sorted?: unknown[] }>(event)
  const payload = {
    favorites: Array.isArray(body?.favorites) ? body.favorites : [],
    sorted: Array.isArray(body?.sorted) ? body.sorted : [],
  }
  if (!payload.favorites.length && !payload.sorted.length) return { ok: true, skipped: true }

  const credentials = installationFor(event)
  try {
    await $fetch(savedStateUrl('/import'), {
      method: 'POST',
      headers: { ...savedStateHeaders(credentials), 'Content-Type': 'application/json' },
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
