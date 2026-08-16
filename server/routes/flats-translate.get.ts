import { aiWorkerEnabled, requestAiWorker } from '../utils/aiWorker'

export default defineEventHandler(async (event) => {
  if (!aiWorkerEnabled()) throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })
  const key = String(getQuery(event).key || '')
  if (!/^translation-[a-f0-9]{32}$/.test(key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid translation key' })
  }
  return await requestAiWorker(`/ai/result/${encodeURIComponent(key)}`)
})
