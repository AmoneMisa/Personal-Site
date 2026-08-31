import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from 'pg'

const STATE_DIR = process.env.SITE_STATE_DIR || '/var/app/state/site'
const DB_TIMEOUT_MS = Math.max(500, Number(process.env.READINESS_DB_TIMEOUT_MS) || 2_000)

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

async function checkDatabase(connectionString: string): Promise<string | null> {
  const client = new Client({ connectionString, connectionTimeoutMillis: DB_TIMEOUT_MS })
  try {
    await client.connect()
    await client.query('SELECT 1')
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

  const databaseUrls = new Map<string, string>()
  const jobsUrl = String(process.env.JOBS_DATABASE_URL || '').trim()
  const hiringUrl = String(process.env.HIRING_DATABASE_URL || '').trim()
  if (jobsUrl) databaseUrls.set(jobsUrl, 'jobsDb')
  if (hiringUrl && !databaseUrls.has(hiringUrl)) databaseUrls.set(hiringUrl, 'hiringDb')

  const databaseChecks = await Promise.all(
    [...databaseUrls.entries()].map(async ([url, name]) => [name, await checkDatabase(url)] as const),
  )
  for (const [name, error] of databaseChecks) {
    if (error) failures[name] = error
  }

  if (Object.keys(failures).length) {
    setResponseStatus(event, 503)
    return { ok: false, failures: Object.keys(failures) }
  }
  return { ok: true }
})
