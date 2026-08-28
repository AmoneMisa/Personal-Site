// GET /jobs-vacancy?id=<job id> or ?publicId=<public id> — read-only lookup in
// the persisted vacancy snapshot. Ingestion and enrichment happen in
// jobs-worker before persistence.
//
// publicId is a one-way FNV hash of (source, id) — there is no reverse index,
// so a publicId lookup recomputes the hash for every snapshot entry until one
// matches. The snapshot is small and already in memory, so this stays cheap.

import { getStoredJobsSnapshot } from '../utils/jobsSnapshot'
import { publicEntityId } from '../../shared/publicEntityId'
import { getJobByPublicIdDb } from '../jobs/infrastructure/database'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const id = String(query.id ?? '').trim()
  const publicId = String(query.publicId ?? '').trim()
  if (!id && !publicId) return { job: null }

  if (publicId) {
    const databaseJob = await getJobByPublicIdDb(publicId)
    if (databaseJob) {
      return { job: { ...databaseJob, publicId: publicEntityId('job', databaseJob.source, databaseJob.id) } }
    }
  }

  const jobs = await getStoredJobsSnapshot()
  const found = id
    ? jobs.find((job) => job.id === id || job.url === id)
    : jobs.find((job) => String(publicEntityId('job', job.source, job.id)) === publicId)
  return {
    job: found
      ? { ...found, publicId: publicEntityId('job', found.source, found.id) }
      : null,
  }
})
