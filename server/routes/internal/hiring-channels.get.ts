// The source list the queue dispatcher fans out over. Telegram usernames and
// public web-CV adapters share the same durable RabbitMQ queue; web adapters use
// a `web:<key>` handle so the Python dispatcher does not need source-specific
// knowledge.

import { createError, getHeader } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { hiringWebSourceHandles } from '~~/server/utils/hiringWebSources'
import { hiringIshBorSourceHandles } from '~~/server/utils/hiringIshBorSource'
import { hiringSecondaryWebSourceHandles } from '~~/server/utils/hiringSecondaryWebSources'
import { hiringUzJobsSourceHandles } from '~~/server/utils/hiringUzJobsSource'
import { loadCursors, loadWebCursors } from '~~/server/utils/hiringCursors'

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

  const telegramHandles = hiringChannelHandles()
  const progressiveWebHandles = [
    ...hiringWebSourceHandles(),
    ...hiringIshBorSourceHandles(),
    ...hiringUzJobsSourceHandles(),
  ]
  const handles = [
    ...telegramHandles,
    ...progressiveWebHandles,
    ...hiringSecondaryWebSourceHandles(),
  ]
  const [telegramCursors, webCursors] = await Promise.all([loadCursors(), loadWebCursors()])
  const backfillHandles = [
    ...telegramHandles.filter((handle) => !telegramCursors.get(handle)?.bootstrapComplete),
    ...progressiveWebHandles.filter((handle) => {
      const key = handle.replace(/^web:/i, '')
      return !webCursors.get(key)?.bootstrapComplete
    }),
  ]
  return {
    ok: true,
    count: handles.length,
    handles,
    backfillCount: backfillHandles.length,
    backfillHandles,
  }
})
