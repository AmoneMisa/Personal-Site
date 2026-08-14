// Cold-start populate: if the vacancy store is empty when Nitro boots (fresh
// deploy, or after the 15-day TTL lapsed), kick a refresh in the background so
// the first visitor isn't served an empty list. Fire-and-forget — never blocks
// startup, and the daily scheduled task keeps it fresh thereafter.

import { getStoredJobs, refreshJobStore } from '~~/server/utils/jobsStore'
import { refreshRates } from '~~/server/utils/currency'

export default defineNitroPlugin(() => {
  // Defer slightly so boot completes first; then only refresh a cold store.
  setTimeout(async () => {
    try {
      const existing = await getStoredJobs()
      // A cold job refresh already refreshes FX first. With a warm store, refresh
      // FX directly so rates are still seeded once on every deployment.
      if (existing.length) {
        await refreshRates()
        return
      }
      const summary = await refreshJobStore()
      console.log(`[jobs:warmup] cold store populated: stored=${summary.stored}`)
    } catch (err) {
      console.error('[jobs:warmup] failed:', (err as Error).message)
    }
  }, 2000)
})
