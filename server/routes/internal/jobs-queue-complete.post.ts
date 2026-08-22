import { createError, getHeader, readBody } from 'h3'
import { completeJobsQueueTask, jobsQueueDbEnabled } from '~~/server/utils/jobsPgQueue'

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

  const body = await readBody<{ id?: string, lockToken?: string, result?: unknown }>(event)
  const id = String(body?.id || '')
  const lockToken = String(body?.lockToken || '')
  if (!id || !lockToken) {
    throw createError({ statusCode: 400, statusMessage: 'Missing task id or lock token' })
  }

  const completed = await completeJobsQueueTask({ id, lockToken, result: body?.result })
  if (!completed) {
    throw createError({ statusCode: 409, statusMessage: 'Queue task lease was lost' })
  }
  return { ok: true, completed: true }
})
