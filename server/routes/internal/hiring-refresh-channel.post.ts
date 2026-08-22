// Refreshes one hiring source on behalf of a queue task. Telegram channels,
// public web-CV adapters and public social targets share the queue; prefixes
// keep retries isolated per site/channel/query.

import { createError, getHeader, readBody } from 'h3'
import { hiringChannelHandles } from '~~/server/utils/hiringSources'
import { refreshHiringChannel } from '~~/server/utils/hiringStore'
import { hiringWebSourceHandles, refreshHiringWebSource } from '~~/server/utils/hiringWebSources'
import { hiringIshBorSourceHandles, refreshHiringIshBorSource } from '~~/server/utils/hiringIshBorSource'
import {
  hiringSecondaryWebSourceHandles,
  refreshHiringSecondaryWebSource,
} from '~~/server/utils/hiringSecondaryWebSources'
import { hiringUzJobsSourceHandles, refreshHiringUzJobsSource } from '~~/server/utils/hiringUzJobsSource'
import { hiringSocialSourceHandles, refreshHiringSocialSource } from '~~/server/utils/hiringSocialSources'

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
  const knownUzJobs = hiringUzJobsSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())
  const knownSecondaryWeb = hiringSecondaryWebSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())
  const knownSocial = hiringSocialSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())

  if (!handle || (!knownTelegram && !knownWeb && !knownIshBor && !knownUzJobs && !knownSecondaryWeb && !knownSocial)) {
    throw createError({ statusCode: 400, statusMessage: `Unknown hiring source: ${handle || '<empty>'}` })
  }

  const result = knownSocial
    ? await refreshHiringSocialSource(handle)
    : knownIshBor
      ? await refreshHiringIshBorSource(handle)
      : knownUzJobs
        ? await refreshHiringUzJobsSource(handle)
        : knownSecondaryWeb
          ? await refreshHiringSecondaryWebSource(handle)
          : knownWeb
            ? await refreshHiringWebSource(handle)
            : await refreshHiringChannel(handle)

  if (!result) {
    const kind = knownTelegram ? 'Telegram' : knownSocial ? 'Social' : 'Web CV'
    throw createError({ statusCode: 503, statusMessage: `${kind} source is disabled` })
  }

  return { ok: true, handle, ...result }
})