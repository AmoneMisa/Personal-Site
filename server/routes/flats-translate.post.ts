import { aiWorkerEnabled, requestAiWorker } from '../utils/aiWorker'
import { FixedWindowRateLimiter } from '../utils/fixedWindowRateLimiter'
import type { H3Event } from 'h3'

type TranslationResponse = {
  status: 'pending' | 'completed' | 'failed' | 'disabled'
  key?: string
  data?: { translatedText?: string; sourceLanguage?: string | null }
  confidence?: number
}

const translationLimiter = new FixedWindowRateLimiter({
  limit: 10,
  windowMs: 60_000,
  maxEntries: 5_000,
})

function enforceRateLimit(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  if (!translationLimiter.consume(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many translation requests' })
  }
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event)
  if (!aiWorkerEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })
  }

  const body = await readBody<{ text?: unknown; targetLanguage?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const targetLanguage = body?.targetLanguage === 'en' ? 'English' : body?.targetLanguage === 'ru' ? 'Russian' : ''

  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'Description is required' })
  }
  if (text.length > 8_000) {
    throw createError({ statusCode: 413, statusMessage: 'Description is too long' })
  }
  if (!targetLanguage) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported target language' })
  }

  return await requestAiWorker<TranslationResponse>('/ai/extract', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'translation',
      rawText: text,
      knownFacts: { targetLanguage },
      meta: { feature: 'flat-description' },
    }),
  })
})
