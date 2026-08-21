// The channel list the queue dispatcher fans out over. Served from the app so
// the Python dispatcher never carries a second copy of the handles that would
// drift out of step with DEFAULT_CV_CHANNELS.

import { createError, getHeader } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'

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

  const handles = hiringChannelHandles()
  return { ok: true, count: handles.length, handles }
})
