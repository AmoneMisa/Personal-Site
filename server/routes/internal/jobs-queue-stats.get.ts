import { createError, getHeader } from 'h3'
import { jobsQueueDbEnabled, jobsQueueStats } from '~~/server/utils/jobsPgQueue'

export default defineEventHandler(async (event) => {
  const expected = String(process.env.QUEUE_INTERNAL_KEY || '')
  const provided = String(getHeader(event, 'x-queue-key') || '')
  if (expected.length < 16) {
    throw createError({ statusCode: 503, statusMessage: 'QUEUE_INTERNAL_KEY is not configured' })
  }
  if (provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!jobsQueueDbEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Jobs queue database is not configured' })
  }
  return { ok: true, ...(await jobsQueueStats()) }
})
