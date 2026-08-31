import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

const runner = await read('scripts/migrate-database.ts')
const deploy = await read('deploy.sh')
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

test('deployment applies migrations before compatibility read-model preparation and rollout', () => {
  const migrate = deploy.indexOf('run_database_migrations')
  const prepare = deploy.indexOf('prepare_database_schema')
  const prepareDatabases = deploy.indexOf('prepare_databases()')
  const rollout = deploy.indexOf('up -d --no-build --remove-orphans')

  assert.ok(migrate > -1 && prepare > migrate)
  assert.ok(prepareDatabases > prepare)
  assert.ok(rollout > prepareDatabases)
  assert.match(deploy, /\.\/scripts\/migrate-database\.ts/)
})
