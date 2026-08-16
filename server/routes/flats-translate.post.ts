import { aiWorkerEnabled, requestAiWorker } from '../utils/aiWorker'
import type { H3Event } from 'h3'

type TranslationResponse = {
  status: 'pending' | 'completed' | 'failed' | 'disabled'
  key?: string
  data?: { translatedText?: string; sourceLanguage?: string | null }
  confidence?: number
}

const windows = new Map<string, { startedAt: number; count: number }>()

function enforceRateLimit(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const now = Date.now()
  const current = windows.get(ip)
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(ip, { startedAt: now, count: 1 })
    return
  }
  current.count += 1
  if (current.count > 10) throw createError({ statusCode: 429, statusMessage: 'Too many translation requests' })
}

export default defineEventHandler(async (event) => {
  enforceRateLimit(event)
  if (!aiWorkerEnabled()) throw createError({ statusCode: 503, statusMessage: 'Translation is unavailable' })

  const body = await readBody<{ text?: unknown; targetLanguage?: unknown }>(event)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const targetLanguage = body?.targetLanguage === 'en' ? 'English' : body?.targetLanguage === 'ru' ? 'Russian' : ''
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Description is required' })
  if (text.length > 8_000) throw createError({ statusCode: 413, statusMessage: 'Description is too long' })
  if (!targetLanguage) throw createError({ statusCode: 400, statusMessage: 'Unsupported target language' })

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
