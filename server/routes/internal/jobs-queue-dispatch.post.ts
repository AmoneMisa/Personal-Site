import { createError, getHeader } from 'h3'
import { ALL_SOURCES } from '~~/server/utils/jobTypes'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { hiringWebSourceHandles } from '~~/server/utils/hiringWebSources'
import { hiringIshBorSourceHandles } from '~~/server/utils/hiringIshBorSource'
import { hiringSecondaryWebSourceHandles } from '~~/server/utils/hiringSecondaryWebSources'
import { hiringUzJobsSourceHandles } from '~~/server/utils/hiringUzJobsSource'
import { loadCursors, loadWebCursors } from '~~/server/utils/hiringCursors'
import { dispatchDueJobsQueue, jobsQueueDbEnabled } from '~~/server/utils/jobsPgQueue'

function authorize(event: any) {
  const expected = String(process.env.QUEUE_INTERNAL_KEY || '')
  const provided = String(getHeader(event, 'x-queue-key') || '')
  if (expected.length < 16) {
    throw createError({ statusCode: 503, statusMessage: 'QUEUE_INTERNAL_KEY is not configured' })
  }
  if (provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!jobsQueueDbEnabled()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'JOBS_QUEUE_DATABASE_URL or HIRING_DATABASE_URL is not configured',
    })
  }
}

export default defineEventHandler(async (event) => {
  authorize(event)

  const telegramHandles = hiringChannelHandles()
  const progressiveWebHandles = [
    ...hiringWebSourceHandles(),
    ...hiringIshBorSourceHandles(),
    ...hiringUzJobsSourceHandles(),
  ]
  const hiringHandles = [
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

  const result = await dispatchDueJobsQueue({
    sources: [...ALL_SOURCES],
    hiringHandles,
    backfillHandles,
    jobsRefreshSeconds: Math.max(60, Number(process.env.JOBS_QUEUE_REFRESH_SECONDS) || 1800),
    hiringRefreshSeconds: Math.max(60, Number(process.env.HIRING_QUEUE_REFRESH_SECONDS) || 1800),
    backfillSeconds: Math.max(60, Number(process.env.HIRING_QUEUE_BACKFILL_SECONDS) || 300),
    hiringEnabled: String(process.env.HIRING_QUEUE_ENABLED || 'on').toLowerCase() !== 'off',
  })

  return { ok: true, ...result }
})
