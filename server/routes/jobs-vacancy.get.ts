// GET /jobs-vacancy?id=<job id> — returns a single stored vacancy (enriched), or
// { job: null } if it isn't in the store (e.g. aged out past the 14-day window).
// Powers shareable vacancy links and the "recently viewed" strip, which must open
// a specific posting regardless of the current filters/page. Lives outside /api
// for the same reason as /jobs-feed (that prefix proxies to FastAPI).

import { getStoredJobs } from '../utils/jobsStore'
import { enrichJob } from '../utils/enrich'

export default defineEventHandler(async (event) => {
  const id = String(getQuery(event).id ?? '').trim()
  if (!id) return { job: null }
  const jobs = await getStoredJobs()
  const found = jobs.find((job) => job.id === id || job.url === id)
  return { job: found ? enrichJob(found) : null }
})
