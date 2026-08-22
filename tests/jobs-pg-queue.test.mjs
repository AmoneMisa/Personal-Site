import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const queue = readFileSync(new URL('../server/utils/jobsPgQueue.ts', import.meta.url), 'utf8')
const worker = readFileSync(new URL('../jobs-queue-worker/worker.py', import.meta.url), 'utf8')
const dockerfile = readFileSync(new URL('../jobs-queue-worker/Dockerfile', import.meta.url), 'utf8')
const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8')
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')

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
  assert.match(compose, /jobs-queue-worker-2:/)
})

test('Redis remains intentionally configured for application state', () => {
  assert.match(compose, /redis:\n\s+image: redis:8\.4\.0/)
  assert.match(compose, /REDIS_URL: redis:\/\/redis:6379/)
  assert.match(compose, /REDIS_HOST: redis/)
  assert.match(envExample, /REDIS_URL=redis:\/\/localhost:6379/)
})
