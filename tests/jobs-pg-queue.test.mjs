import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queue = readFileSync(new URL('../server/utils/jobsPgQueue.ts', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../jobs-queue-worker/worker.py', import.meta.url), 'utf8')
const dockerfile = readFileSync(new URL('../jobs-queue-worker/Dockerfile', import.meta.url), 'utf8')
const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
const packageLock = readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8')
const backendRequirements = readFileSync(new URL('../backend/requirements.txt', import.meta.url), 'utf8')

test('jobs and hiring tasks use a durable PostgreSQL queue', () => {
  assert.match(queue, /CREATE TABLE IF NOT EXISTS \$\{name\}\.tasks/)
  assert.match(queue, /CHECK \(status IN \('pending', 'running', 'done', 'dead'\)\)/)
  assert.match(queue, /FOR UPDATE SKIP LOCKED/)
  assert.match(queue, /pg_advisory_xact_lock/)
  assert.match(queue, /priority DESC/)
  assert.match(queue, /locked_until/)
  assert.match(queue, /run_after/)
  assert.match(queue, /scheduler_state/)
  assert.match(queue, /ON CONFLICT \(task_key\) DO NOTHING/)
})

test('workers poll the internal Postgres queue API and preserve retries', () => {
  assert.match(worker, /\/internal\/jobs-queue-claim/)
  assert.match(worker, /\/internal\/jobs-queue-complete/)
  assert.match(worker, /\/internal\/jobs-queue-fail/)
  assert.match(worker, /\/internal\/jobs-queue-dispatch/)
  assert.match(worker, /target = "dead" if outcome\.get\("dead"\) else "retry"/)
  assert.doesNotMatch(worker, /import pika/)
  assert.doesNotMatch(worker, /basic_consume|basic_publish|start_consuming/)
  assert.doesNotMatch(dockerfile, /pip install/)
})

test('Personal-Site no longer depends on flat-finder RabbitMQ', () => {
  assert.doesNotMatch(compose, /flat-finder-rabbitmq/)
  assert.doesNotMatch(compose, /RABBITMQ_/)
  assert.match(compose, /JOBS_QUEUE_DATABASE_URL/)
  assert.match(compose, /JOBS_QUEUE_DB_SCHEMA/)
  assert.match(compose, /jobs-queue-worker-1:/)
  assert.doesNotMatch(compose, /jobs-queue-worker-2:/)
})

test('application state no longer requires Redis', () => {
  assert.doesNotMatch(compose, /^\s{2}redis:\s*$/m)
  assert.doesNotMatch(compose, /image:\s*redis:/)
  assert.doesNotMatch(compose, /REDIS_URL:/)
  assert.doesNotMatch(compose, /REDIS_HOST:/)
  assert.doesNotMatch(compose, /REDIS_PORT:/)
  assert.doesNotMatch(envExample, /^REDIS_/m)
  assert.doesNotMatch(packageJson, /"ioredis"\s*:/)
  assert.doesNotMatch(packageLock, /"node_modules\/ioredis"\s*:/)
  assert.doesNotMatch(backendRequirements, /^redis(?:\[hiredis\])?(?:[=<>!~].*)?$/m)
  assert.match(compose, /^\s{2}site_state:\s*$/m)
  assert.match(compose, /SITE_STATE_DIR:\s*\/var\/app\/state\/site/)
  assert.match(compose, /BACKEND_STATE_DIR:\s*\/var\/app\/state\/backend/)
})
