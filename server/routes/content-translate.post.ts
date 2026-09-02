import type { H3Event } from 'h3'
import { aiWorkerEnabled, requestAiWorker } from '../utils/aiWorker'
import { FixedWindowRateLimiter } from '../utils/fixedWindowRateLimiter'
import { requestClientIp } from '../utils/requestClientIp'

const limiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 60_000, maxEntries: 5_000 })
const FEATURES = new Set(['vacancy-description', 'candidate-description'])

function enforceRateLimit(event: H3Event) {
  if (!limiter.consume(requestClientIp(event))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many translation requests' })
  }
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event)
  if (!aiWorkerEnabled()) throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })

  const body = await readBody<{ text?: unknown; targetLanguage?: unknown; feature?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const targetLanguage = body?.targetLanguage === 'en' ? 'English' : body?.targetLanguage === 'ru' ? 'Russian' : ''
  const feature = typeof body?.feature === 'string' && FEATURES.has(body.feature) ? body.feature : ''
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Description is required' })
  if (text.length > 8_000) throw createError({ statusCode: 413, statusMessage: 'Description is too long' })
  if (!targetLanguage || !feature) throw createError({ statusCode: 400, statusMessage: 'Unsupported translation request' })

  return await requestAiWorker('/ai/extract', {
    method: 'POST',
    body: JSON.stringify({ kind: 'translation', rawText: text, knownFacts: { targetLanguage }, meta: { feature } }),
  })
})
