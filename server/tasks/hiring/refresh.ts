import { refreshHiringStore, getStoredCvProfiles } from '~~/server/utils/hiringStore'
import { candidateSearchAvailable, syncCandidateIndex } from '~~/server/utils/hiringElastic'
import { dedupeCandidates, normalizeCandidate } from '~~/server/utils/hiringNormalize'

export default defineTask({
  meta: {
    name: 'hiring:refresh',
    description: 'Pull candidate CV/resume profiles from Telegram resume channels',
  },
  async run() {
    const summary = await refreshHiringStore()
    console.log(`[hiring:refresh] fetched=${summary.fetched} stored=${summary.stored}`)

    // Keep the search index in step with the store. Indexing the normalized,
    // de-duplicated set means search ranks exactly what the feed can display.
    // A failure here is logged and swallowed: the feed falls back to in-memory
    // filtering, so a broken cluster must never fail the refresh.
    let indexed = 0
    try {
      if (await candidateSearchAvailable()) {
        const profiles = dedupeCandidates((await getStoredCvProfiles()).map(normalizeCandidate))
        indexed = await syncCandidateIndex(profiles)
        console.log(`[hiring:refresh] indexed=${indexed}`)
      } else {
        console.warn('[hiring:refresh] elasticsearch unavailable, search falls back to in-memory')
      }
    } catch (error) {
      console.warn('[hiring:refresh] index sync failed:', (error as Error).message)
    }

    return { result: { ...summary, indexed } }
  },
})
