// Cold-start populate: refresh every configured source shortly after Nitro boots.
// The source-aware refresher isolates upstream failures and merges each successful
// source into the same Redis store used by /jobs-feed.

import {
  configuredJobSources,
  refreshJobSource,
} from '~~/server/utils/jobsSourceRefresh'

export default defineNitroPlugin(() => {
  setTimeout(async () => {
    const sources = configuredJobSources()
    const results = await Promise.allSettled(sources.map((source) => refreshJobSource(source)))

    let fetched = 0
    const failed: string[] = []

    results.forEach((result, index) => {
      const source = sources[index]!
      if (result.status === 'rejected') {
        failed.push(source)
        console.error(`[jobs:warmup:${source}] failed:`, result.reason instanceof Error ? result.reason.message : String(result.reason))
        return
      }
      fetched += result.value.fetched || 0
    })

    console.log(`[jobs:warmup] fetched=${fetched} failed=${failed.length}`)
  }, 2000)
})
