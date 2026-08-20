// Scheduled worker: refreshes every configured source through the source-aware
// refresher. Each source fetch runs independently and merges into the shared
// Redis store, so one blocked board cannot prevent the rest from updating.

import {
  configuredJobSources,
  refreshJobSource,
} from '~~/server/utils/jobsSourceRefresh'

export default defineTask({
  meta: {
    name: 'jobs:refresh',
    description: 'Pull all configured job sources into the Redis store and prune closed/old postings',
  },
  async run() {
    const sources = configuredJobSources()
    const results = await Promise.allSettled(sources.map((source) => refreshJobSource(source)))

    let fetched = 0
    let stored = 0
    const failed: string[] = []

    results.forEach((result, index) => {
      const source = sources[index]!
      if (result.status === 'rejected') {
        failed.push(source)
        console.error(`[jobs:refresh:${source}] failed:`, result.reason instanceof Error ? result.reason.message : String(result.reason))
        return
      }
      fetched += result.value.fetched || 0
      if ('stored' in result.value && typeof result.value.stored === 'number') {
        stored = Math.max(stored, result.value.stored)
      }
    })

    console.log(`[jobs:refresh] fetched=${fetched} stored=${stored} failed=${failed.length}`)
    return { result: { fetched, stored, failed, sources } }
  },
})
