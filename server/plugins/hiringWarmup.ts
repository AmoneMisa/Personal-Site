import { refreshHiringStore } from '~~/server/utils/hiringStore'

export default defineNitroPlugin(() => {
  setTimeout(async () => {
    try {
      const summary = await refreshHiringStore()
      console.log(`[hiring:warmup] store refreshed: stored=${summary.stored}`)
    } catch (err) {
      console.error('[hiring:warmup] failed:', (err as Error).message)
    }
  }, 2500)
})
