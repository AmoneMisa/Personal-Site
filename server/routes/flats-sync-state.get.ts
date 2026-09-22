// GET /flats-sync-state — this browser's synced favourites and collections.
//
// Minting the installation on read means the first visit creates it and comes
// back empty, which is exactly the "nothing saved yet" state the client wants.
import { installationFor, savedStateHeaders, savedStateUrl } from '../flats/savedState'

export default defineEventHandler(async (event) => {
  const credentials = installationFor(event)
  try {
    const data = await $fetch<{ favorites?: unknown[]; sorted?: unknown[]; presets?: unknown[] }>(
      savedStateUrl(''),
      { headers: savedStateHeaders(credentials), timeout: 15_000 },
    )
    // Never cache: this is per-installation state.
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { ok: true, state: data }
  } catch (error) {
    // Sync is an enhancement over local storage, so a backend that is down or
    // rate-limiting must not break the page. The client keeps working locally.
    console.error('[flats-sync] read failed:', (error as Error)?.message)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return { ok: false, state: null }
  }
})
