// GET /jobs-vacancy?id=<job id> — read-only lookup in the persisted vacancy
// snapshot. Ingestion and enrichment happen in jobs-worker before persistence.

import { getStoredJobsSnapshot } from '../utils/jobsSnapshot'

export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '').trim()
  if (!id) return { job: null }

  const jobs = await getStoredJobsSnapshot()
  const found = jobs.find((job) => job.id === id || job.url === id)
  return { job: found || null }
})
