import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'

import { REQUIRED_DATABASE_MIGRATIONS } from '../../shared/databaseMigrationVersions'

const STATE_DIR = process.env.SITE_STATE_DIR || '/var/app/state/site'
const DB_TIMEOUT_MS = Math.max(500, Number(process.env.READINESS_DB_TIMEOUT_MS) || 2_000)
const SCHEMA_RE = /^[a-z_][a-z0-9_]*$/i

async function checkStateDirectory(): Promise<string | null> {
  const path = join(STATE_DIR, `.ready-${process.pid}-${randomUUID()}`)
  try {
    await mkdir(STATE_DIR, { recursive: true })
    await writeFile(path, 'ok', { encoding: 'utf8', flag: 'wx' })
    await rm(path, { force: true })
    return null
  } catch (error) {
    await rm(path, { force: true }).catch(() => {})
    return error instanceof Error ? error.message : String(error)
  }
}

async function checkDatabase(
  connectionString: string,
  schema: string,
  requiredMigration: string,
): Promise<string | null> {
  if (!SCHEMA_RE.test(schema)) return `invalid schema ${schema}`

  const client = new Client({ connectionString, connectionTimeoutMillis: DB_TIMEOUT_MS })
  try {
    await client.connect()
    const table = await client.query<{ exists: boolean }>(
      'SELECT to_regclass($1) IS NOT NULL AS exists',
      [`${schema}._site_migrations`],
    )
    if (!table.rows[0]?.exists) return `migration table missing for ${schema}`

    const migration = await client.query(
      `SELECT 1 FROM ${schema}._site_migrations WHERE version = $1 LIMIT 1`,
      [requiredMigration],
    )
    if (!migration.rowCount) return `required migration ${requiredMigration} missing for ${schema}`
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  } finally {
    await client.end().catch(() => {})
  }
}

export default defineEventHandler(async (event) => {
  const failures: Record<string, string> = {}
  const stateError = await checkStateDirectory()
  if (stateError) failures.state = stateError

  const hiringUrl = String(process.env.HIRING_DATABASE_URL || '').trim()
  const jobsUrl = String(process.env.JOBS_DATABASE_URL || hiringUrl).trim()
  const jobsSchema = String(process.env.JOBS_DB_SCHEMA || 'jobs').trim()
  const hiringSchema = String(process.env.HIRING_DB_SCHEMA || 'hiring').trim()

  const databaseChecks: Array<Promise<readonly [string, string | null]>> = []
  if (jobsUrl) {
    databaseChecks.push(
      checkDatabase(jobsUrl, jobsSchema, REQUIRED_DATABASE_MIGRATIONS.jobs)
        .then((error) => ['jobsDb', error] as const),
    )
  }
  if (hiringUrl) {
    databaseChecks.push(
      checkDatabase(hiringUrl, hiringSchema, REQUIRED_DATABASE_MIGRATIONS.hiring)
        .then((error) => ['hiringDb', error] as const),
    )
  }

  for (const [name, error] of await Promise.all(databaseChecks)) {
    if (error) failures[name] = error
  }

  if (Object.keys(failures).length) {
    setResponseStatus(event, 503)
    return { ok: false, failures: Object.keys(failures) }
  }
  return { ok: true }
})
