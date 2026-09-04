import { aiWorkerEnabled, isAiWorkerTransientError, requestAiWorker } from '../utils/aiWorker'

export default defineEventHandler(async (event) => {
  if (!aiWorkerEnabled()) throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })
  const key = String(getQuery(event).key || '')
  if (!/^translation-[a-f0-9]{32}$/.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid translation key' })
  }

  try {
    return await requestAiWorker(`/ai/result/${encodeURIComponent(key)}`)
  } catch (error) {
    // The browser used to interpret a single 502/504/timeout while polling as a
    // terminal translation failure. The queued inference job can still be running,
    // so keep the UI in its pending state and let the next poll recover.
    if (isAiWorkerTransientError(error)) return { status: 'pending', key }
    throw error
  }
})
