// Scheduled worker: refreshes the Redis vacancy store (see utils/jobsStore.ts).
// Wired to a daily cron in nuxt.config.ts (nitro.scheduledTasks) and also kicked
// once on boot by server/plugins/jobsWarmup.ts when the store is cold.

import { refreshJobStore } from '~~/server/utils/jobsStore'

export default defineTask({
  meta: {
    name: 'jobs:refresh',
    description: 'Pull all job boards into the Redis store and prune closed/old postings',
  },
  async run() {
    const summary = await refreshJobStore()
    console.log(
      `[jobs:refresh] fetched=${summary.fetched} stored=${summary.stored}`,
      summary.perSource,
    )
    return { result: summary }
  },
})
