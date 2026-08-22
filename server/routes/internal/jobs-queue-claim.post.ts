import { createError, getHeader, readBody } from 'h3'
import { claimJobsQueueTask, jobsQueueDbEnabled } from '~~/server/utils/jobsPgQueue'

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

  const body = await readBody<{ workerId?: string }>(event)
  const task = await claimJobsQueueTask({
    workerId: body?.workerId,
    leaseMs: Math.max(60_000, Number(process.env.JOBS_QUEUE_LEASE_SECONDS || 240) * 1000),
    maxAttempts: Math.max(1, Number(process.env.JOBS_QUEUE_MAX_ATTEMPTS) || 5),
  })
  return { ok: true, task }
})
