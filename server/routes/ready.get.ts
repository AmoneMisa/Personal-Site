import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const STATE_DIR = process.env.SITE_STATE_DIR || '/var/app/state/site'
const TIMEOUT_MS = Math.max(500, Number(process.env.READINESS_API_TIMEOUT_MS) || 2_000)

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

async function checkPlatformApi(rawBaseUrl: string): Promise<string | null> {
  const baseUrl = rawBaseUrl.trim().replace(/\/$/, '')
  if (!baseUrl) return 'not configured'
  try {
    const response = await fetch(`${baseUrl}/ready`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    return response.ok ? null : `HTTP ${response.status}`
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export default defineEventHandler(async (event) => {
  const checks = await Promise.all([
    checkStateDirectory(),
    checkPlatformApi(String(process.env.VACANCIES_API_URL || '')),
    checkPlatformApi(String(process.env.CV_API_URL || '')),
  ])
  const failures = ['state', 'vacanciesApi', 'cvApi'].filter((_, index) => checks[index])

  if (failures.length) {
    setResponseStatus(event, 503)
    return { ok: false, failures }
  }
  return { ok: true }
})
