import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queue = readFileSync(new URL('../shared/jobs/jobsPgQueue.ts', import.meta.url), 'utf8')
const queueMigration = readFileSync(new URL('../db/migrations/queue/001_queue_schema.sql', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../jobs-worker/worker.ts', import.meta.url), 'utf8')
const jobsRuntime = readFileSync(new URL('../jobs-worker/jobsRuntime.ts', import.meta.url), 'utf8')
const hiringAdapters = readFileSync(new URL('../jobs-worker/hiringAdapters.ts', import.meta.url), 'utf8')
const dockerfile = readFileSync(new URL('../jobs-worker/Dockerfile', import.meta.url), 'utf8')
const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const jobsFeed = readFileSync(new URL('../server/routes/jobs-feed.get.ts', import.meta.url), 'utf8')
const hiringFeed = readFileSync(new URL('../server/routes/hiring-feed.get.ts', import.meta.url), 'utf8')
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const packageLock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const backendRequirements = readFileSync(new URL('../backend/requirements.txt', import.meta.url), 'utf8')
const backendPdf = readFileSync(new URL('../backend/src/routers/pdf.py', import.meta.url), 'utf8')
const backendStateStore = readFileSync(new URL('../backend/src/utils/state_store.py', import.meta.url), 'utf8')

test('jobs and hiring tasks use a durable PostgreSQL queue', () => {
  assert.match(queueMigration, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.tasks/)
  assert.match(queueMigration, /CHECK \(status IN \('pending', 'running', 'done', 'dead'\)\)/)
  assert.match(queueMigration, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.scheduler_state/)
  assert.match(queueMigration, /tasks_pending_idx/)
  assert.match(queueMigration, /tasks_running_lease_idx/)

  assert.match(queue, /SELECT to_regclass\(\$1\)::text AS tasks, to_regclass\(\$2\)::text AS scheduler_state/)
  assert.match(queue, /Queue schema \$\{name\} is not migrated/)
  assert.doesNotMatch(queue, /CREATE\s+(?:SCHEMA|TABLE|INDEX)/i)
  assert.doesNotMatch(queue, /ALTER\s+TABLE/i)
  assert.match(queue, /FOR UPDATE SKIP LOCKED/)
  assert.match(queue, /pg_advisory_xact_lock/)
  assert.match(queue, /priority DESC/)
  assert.match(queue, /locked_until/)
  assert.match(queue, /run_after/)
  assert.match(queue, /scheduler_state/)
  assert.match(queue, /ON CONFLICT \(task_key\) DO NOTHING/)
})

test('one TypeScript worker owns queue transitions and ingestion through local runtime boundaries', () => {
  assert.match(worker, /dispatchDueJobsQueue/)
  assert.match(worker, /claimJobsQueueTask/)
  assert.match(worker, /completeJobsQueueTask/)
  assert.match(worker, /failJobsQueueTask/)
  assert.match(worker, /refreshSource\(source\)/)
  assert.match(worker, /refreshHiringTarget\(handle\)/)
  assert.doesNotMatch(worker, /\/internal\/jobs-/)
  assert.doesNotMatch(worker, /\/internal\/hiring-/)
  assert.doesNotMatch(worker, /JOBS_FRONTEND_URL|JOBS_BACKEND_URL|JOBS_API_URL/)
  assert.match(worker, /\.\.\/shared\/jobs\/jobsPgQueue/)

  assert.match(jobsRuntime, /refreshJobSource/)
  assert.match(hiringAdapters, /refreshHiringChannel/)
  assert.match(hiringAdapters, /refreshHiringWebSource/)
  assert.match(hiringAdapters, /refreshHiringSocialSource/)
  assert.match(hiringAdapters, /refreshHiringLinkedInSource/)

  assert.match(dockerfile, /jobs-worker\/worker\.ts/)
  assert.doesNotMatch(dockerfile, /pip install|python/)
})

test('jobs and hiring API stay in Nuxt while heavy execution stays out', () => {
  assert.match(jobsFeed, /read-only vacancy feed/u)
  assert.match(hiringFeed, /read-only candidate CV\/resume feed/u)
  assert.match(compose, /^\s{2}frontend:\s*$/m)
  assert.match(compose, /^\s{2}jobs-worker:\s*$/m)
  assert.doesNotMatch(compose, /^\s{2}jobs-api:\s*$/m)
  assert.doesNotMatch(compose, /jobs-backend/)
  assert.doesNotMatch(compose, /jobs-queue-worker/)
  assert.doesNotMatch(compose, /jobs-queue-dispatcher/)
  assert.match(compose, /JOBS_RUNTIME_ROLE:\s*frontend/)
  assert.match(compose, /JOBS_RUNTIME_ROLE:\s*worker/)
})

test('Personal-Site no longer depends on flat-finder RabbitMQ', () => {
  assert.doesNotMatch(compose, /flat-finder-rabbitmq/)
  assert.doesNotMatch(compose, /RABBITMQ_/)
  assert.match(compose, /JOBS_QUEUE_DATABASE_URL/)
  assert.match(compose, /JOBS_QUEUE_DB_SCHEMA/)
})

test('application state no longer requires a Redis runtime', () => {
  assert.doesNotMatch(compose, /^\s{2}redis:\s*$/m)
  assert.doesNotMatch(compose, /image:\s*redis:/)
  assert.doesNotMatch(compose, /REDIS_URL:/)
  assert.doesNotMatch(compose, /REDIS_HOST:/)
  assert.doesNotMatch(compose, /REDIS_PORT:/)
  assert.doesNotMatch(envExample, /^REDIS_/m)

  // Nitro can bring ioredis transitively for optional storage drivers; this
  // application must not depend on it directly or run a Redis service.
  assert.equal(packageJson.dependencies?.ioredis, undefined)
  assert.equal(packageLock.packages?.['']?.dependencies?.ioredis, undefined)

  assert.doesNotMatch(backendRequirements, /^redis(?:\[hiredis\])?(?:[=<>!~].*)?$/m)
  assert.doesNotMatch(backendPdf, /(?:from|import)\s+redis(?:\.|\s)/)
  assert.doesNotMatch(backendPdf, /utils\.redis_client/)
  assert.match(backendPdf, /utils\.state_store\s+import\s+get_state_store/)
  assert.match(backendStateStore, /class PersistentFileKV/)
  assert.match(compose, /^\s{2}site_state:\s*$/m)
  assert.match(compose, /SITE_STATE_DIR:\s*\/var\/app\/state\/site/)
  assert.match(compose, /BACKEND_STATE_DIR:\s*\/var\/app\/state\/backend/)
})
