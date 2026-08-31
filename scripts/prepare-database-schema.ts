import { getJobByPublicIdDb, jobsDbEnabled } from '../server/jobs/infrastructure/database'
import {
  backfillDbCandidateReadModel,
  hiringDbEnabled,
  loadDbCandidates,
} from '../server/hiring/infrastructure/database'
import { jobsQueueDbEnabled, jobsQueueStats } from '../shared/jobs/jobsPgQueue'

async function main() {
  const prepared: string[] = []

  if (jobsDbEnabled()) {
    // Migrations own DDL. This impossible public-id lookup only verifies that the
    // reduced-privilege runtime connection can read the migrated Jobs schema.
    await getJobByPublicIdDb('0')
    prepared.push('jobs')
  }

  if (hiringDbEnabled()) {
    // Legacy row hydration is an explicit deployment operation. HTTP reads never
    // mutate old rows or rebuild the current-candidate projection anymore.
    await backfillDbCandidateReadModel()
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
