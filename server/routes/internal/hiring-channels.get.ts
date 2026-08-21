// The source list the queue dispatcher fans out over. Telegram usernames and
// public web-CV adapters share the same durable RabbitMQ queue; web adapters use
// a `web:<key>` handle so the Python dispatcher does not need source-specific
// knowledge.

import { createError, getHeader } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { hiringWebSourceHandles } from '~~/server/utils/hiringWebSources'
import { hiringExtraWebSourceHandles } from '~~/server/utils/hiringExtraWebSources'

export default defineEventHandler((event) => {
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

  const handles = [
    ...hiringChannelHandles(),
    ...hiringWebSourceHandles(),
    ...hiringExtraWebSourceHandles(),
  ]
  return { ok: true, count: handles.length, handles }
})
