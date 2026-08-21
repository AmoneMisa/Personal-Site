// Refreshes one hiring source on behalf of a RabbitMQ task. Telegram channels
// and public web-CV adapters share the queue; `web:<key>` identifies a web
// source and keeps retries isolated per site/channel.

import { createError, getHeader, readBody } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { refreshHiringChannel } from '~~/server/utils/hiringStore'
import { hiringWebSourceHandles, refreshHiringWebSource } from '~~/server/utils/hiringWebSources'
import { hiringIshBorSourceHandles, refreshHiringIshBorSource } from '~~/server/utils/hiringIshBorSource'

export default defineEventHandler(async (event) => {
  const expected = String(process.env.QUEUE_INTERNAL_KEY || '')
  const provided = String(getHeader(event, 'x-queue-key') || '')

  if (expected.length < 16) {
    throw createError({ statusCode: 503, statusMessage: 'QUEUE_INTERNAL_KEY is not configured' })
  }
  if (provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<{ handle?: string }>(event)
  const handle = String(body?.handle || '').replace(/^@/, '')
  const knownTelegram = hiringChannelHandles().some((item) => item.toLowerCase() === handle.toLowerCase())
  const knownWeb = hiringWebSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())
  const knownIshBor = hiringIshBorSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())

  if (!handle || (!knownTelegram && !knownWeb && !knownIshBor)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown hiring source: ${handle || '<empty>'}` })
  }

  const result = knownIshBor
    ? await refreshHiringIshBorSource(handle)
    : knownWeb
      ? await refreshHiringWebSource(handle)
      : await refreshHiringChannel(handle)

  if (!result) {
    throw createError({ statusCode: 503, statusMessage: knownTelegram ? 'Telegram source is disabled' : 'Web CV source is disabled' })
  }

  return { ok: true, handle, ...result }
})
