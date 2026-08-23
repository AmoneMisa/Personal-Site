// Retired compatibility endpoint.
//
// Scheduling moved to jobs-worker and is never executed in Nuxt/Nitro anymore.
// Keep this inert route temporarily so old operational probes receive an
// explicit response instead of accidentally falling through to another route.
// The worker uses HIRING_QUEUE_BACKFILL_SECONDS with the historical default 300.
const HIRING_QUEUE_BACKFILL_SECONDS = 300
void HIRING_QUEUE_BACKFILL_SECONDS

export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage: 'Queue dispatch moved to jobs-worker',
  })
})
