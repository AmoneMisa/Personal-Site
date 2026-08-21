// Refreshes one CV channel on behalf of a RabbitMQ task. Per-channel rather
// than per-source so a single slow handle is retried on its own — the whole
// source no longer fails because the worker queue outran one timeout.

import { createError, getHeader, readBody } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { refreshHiringChannel } from '~~/server/utils/hiringStore'

export default defineEventHandler(async (event) => {
  const expected = String(process.env.QUEUE_INTERNAL_KEY || '')
  const provided = String(getHeader(event, 'x-queue-key') || '')

  if (expected.length < 16) {
    throw createError({
      statusCode: 503,
      statusMessage: 'QUEUE_INTERNAL_KEY is not configured',
    })
  }

  if (provided !== expected) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const body = await readBody<{ handle?: string }>(event)
  const handle = String(body?.handle || '').replace(/^@/, '')
  const known = hiringChannelHandles().some((item) => item.toLowerCase() === handle.toLowerCase())

  if (!handle || !known) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown hiring channel: ${handle || '<empty>'}`,
    })
  }

  const result = await refreshHiringChannel(handle)
  if (!result) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Telegram source is disabled',
    })
  }

  return { ok: true, handle, ...result }
})
