import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const runner = await read('scripts/migrate-database.ts')
const deploy = await read('deploy.sh')
const prepare = await read('scripts/prepare-database-schema.ts')
const envExample = await read('.env.example')
const jobsRuntime = await read('server/jobs/infrastructure/database.ts')
const hiringRuntime = await read('server/hiring/infrastructure/database.ts')
const hiringCurrent = await read('server/hiring/infrastructure/currentCandidateReadModel.ts')
const queueRuntime = await read('shared/jobs/jobsPgQueue.ts')
const jobs = await read('db/migrations/jobs/001_initial_read_model.sql')
const hiring = await read('db/migrations/hiring/001_candidate_read_model.sql')
const queue = await read('db/migrations/queue/001_queue_schema.sql')

test('database schemas have explicit versioned migration files', () => {
  assert.match(jobs, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.vacancies/)
  assert.match(hiring, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.candidates/)
  assert.match(hiring, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.candidate_current/)
  assert.match(queue, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.tasks/)
  assert.match(queue, /CREATE TABLE IF NOT EXISTS \{\{schema\}\}\.scheduler_state/)
})

test('migration runner is ordered, checksummed and serialized per schema', () => {
  assert.match(runner, /_site_migrations/)
  assert.match(runner, /createHash\('sha256'\)/)
  assert.match(runner, /changed after it was applied/)
  assert.match(runner, /pg_advisory_lock\(hashtext\(\$1\)\)/)
  assert.match(runner, /\.sort\(\(a, b\) => a\.localeCompare\(b, 'en'\)\)/)
  assert.match(runner, /sql\.replaceAll\('\{\{schema\}\}', target\.schema\)/)
})

test('migration runner can use deployment-only DDL credentials', () => {
  for (const variable of [
    'JOBS_MIGRATION_DATABASE_URL',
    'HIRING_MIGRATION_DATABASE_URL',
    'JOBS_QUEUE_MIGRATION_DATABASE_URL',
  ]) {
    assert.match(runner, new RegExp(`process\\.env\\.${variable}`))
    assert.match(envExample, new RegExp(`^${variable}=`, 'm'))
  }
  assert.match(runner, /runtimeJobsUrl/)
  assert.match(runner, /runtimeHiringUrl/)
  assert.match(runner, /runtimeQueueUrl/)
})

test('jobs runtime only verifies migrated relations instead of performing DDL', () => {
  assert.match(jobsRuntime, /to_regclass/)
  assert.match(jobsRuntime, /run scripts\/migrate-database\.ts before runtime/)
  assert.doesNotMatch(jobsRuntime, /\bCREATE\s+(?:SCHEMA|TABLE|INDEX)\b/i)
  assert.doesNotMatch(jobsRuntime, /\bALTER\s+TABLE\b/i)
})

test('hiring runtime is DDL-free and deploy owns legacy read-model backfill', () => {
  assert.match(hiringRuntime, /to_regclass/)
  assert.match(hiringRuntime, /export async function backfillDbCandidateReadModel/)
  assert.doesNotMatch(hiringRuntime, /\bCREATE\s+(?:SCHEMA|TABLE|INDEX)\b/i)
  assert.doesNotMatch(hiringRuntime, /\bALTER\s+TABLE\b/i)
  assert.doesNotMatch(hiringCurrent, /\bCREATE\s+(?:SCHEMA|TABLE|INDEX)\b/i)
  assert.match(prepare, /await backfillDbCandidateReadModel\(\)/)

  const loadRead = hiringRuntime.match(
    /export async function loadDbCandidates[\s\S]*?(?=\nexport interface DbCandidateFeed)/,
  )?.[0] || ''
  const feedRead = hiringRuntime.match(
    /export async function queryDbCandidates[\s\S]*?(?=\nasync function previousDedupeKeys)/,
  )?.[0] || ''
  assert.ok(loadRead)
  assert.ok(feedRead)
  assert.doesNotMatch(loadRead, /backfillDbCandidateReadModel/)
  assert.doesNotMatch(feedRead, /backfillDbCandidateReadModel/)
})

test('queue runtime only verifies migrated relations instead of performing DDL', () => {
  assert.match(queueRuntime, /to_regclass/)
  assert.match(queueRuntime, /run scripts\/migrate-database\.ts before runtime/)
  assert.doesNotMatch(queueRuntime, /\bCREATE\s+(?:SCHEMA|TABLE|INDEX)\b/i)
  assert.doesNotMatch(queueRuntime, /\bALTER\s+TABLE\b/i)
})

test('deployment applies migrations before compatibility read-model preparation and rollout', () => {
  const migrate = deploy.indexOf('run_database_migrations')
  const prepareSchema = deploy.indexOf('prepare_database_schema')
  const prepareDatabases = deploy.indexOf('prepare_databases()')
  const rollout = deploy.indexOf('up -d --no-build --remove-orphans')

  assert.ok(migrate > -1 && prepareSchema > migrate)
  assert.ok(prepareDatabases > prepareSchema)
  assert.ok(rollout > prepareDatabases)
  assert.match(deploy, /\.\/scripts\/migrate-database\.ts/)
})
