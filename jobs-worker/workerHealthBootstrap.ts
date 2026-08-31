import { hostname } from 'node:os'

import { jobsQueueStats } from '../shared/jobs/jobsPgQueue'
import { createWorkerHealthReporter } from './workerHealth'

const workerId = String(process.env.JOBS_QUEUE_WORKER_ID || `${hostname()}:jobs`).slice(0, 200)
const reporter = createWorkerHealthReporter({ workerId, getQueueStats: jobsQueueStats })

await reporter.start()

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void reporter.stop()
  })
}
