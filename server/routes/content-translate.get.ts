import { aiWorkerEnabled, isAiWorkerTransientError, requestAiWorker } from '../utils/aiWorker'

export default defineEventHandler(async (event) => {
  if (!aiWorkerEnabled()) throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })
  const key = String(getQuery(event).key || '')
  if (!/^translation-[a-f0-9]{32}$/.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid translation key' })
  try {
    return await requestAiWorker(`/ai/result/${encodeURIComponent(key)}`)
  } catch (error) {
    if (isAiWorkerTransientError(error)) return { status: 'pending', key }
    throw error
  }
})
