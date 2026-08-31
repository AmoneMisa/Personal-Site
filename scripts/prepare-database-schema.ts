import { getJobByPublicIdDb, jobsDbEnabled } from '../server/jobs/infrastructure/database'
import { hiringDbEnabled, loadDbCandidates } from '../server/hiring/infrastructure/database'
import { jobsQueueDbEnabled, jobsQueueStats } from '../shared/jobs/jobsPgQueue'

async function main() {
  const prepared: string[] = []

  if (jobsDbEnabled()) {
    // A harmless impossible public-id read currently crosses the Jobs schema
    // initialization boundary without mutating vacancy state. This is an explicit
    // deployment preflight while runtime DDL is being extracted into migrations.
    await getJobByPublicIdDb('0')
    prepared.push('jobs')
  }

  if (hiringDbEnabled()) {
    // Hydration also completes the maintained candidate_current read-model
    // backfill, keeping that work out of the first production HTTP request.
    await loadDbCandidates()
    prepared.push('hiring')
  }

  if (jobsQueueDbEnabled()) {
    await jobsQueueStats()
    prepared.push('site_queue')
  }

  console.log(`[db:prepare] ready: ${prepared.join(', ') || 'no configured databases'}`)
}

main().catch((error) => {
  console.error('[db:prepare] failed:', error instanceof Error ? error.stack || error.message : String(error))
  process.exit(1)
})
