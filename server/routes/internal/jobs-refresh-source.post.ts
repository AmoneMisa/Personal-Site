import { createError, getHeader, readBody } from 'h3'
import { ALL_SOURCES, type JobSource } from '~~/server/utils/jobTypes'
import { refreshJobSource } from '~~/server/utils/jobsSourceRefresh'

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

  const body = await readBody<{ source?: string }>(event)
  const source = String(body?.source || '') as JobSource

  if (!ALL_SOURCES.includes(source)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown job source: ${source || '<empty>'}`,
    })
  }

  return {
    ok: true,
    ...(await refreshJobSource(source)),
  }
})
