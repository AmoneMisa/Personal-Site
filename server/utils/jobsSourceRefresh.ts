import { useRedis } from '~~/server/utils/redis'
import { ALL_SOURCES, type Job, type JobSource } from './jobTypes'
import { enrichJob } from './enrich'
import { syncJobsSearchIndex } from './jobsElastic'
import { fetchExtraTelegramJobs } from './extraTelegramJobSources'
import {
  fetchAdzuna,
  fetchArbeitnow,
  fetchCompanies,
  fetchDevKg,
  fetchIshGo,
  fetchItJobsUz,
  fetchJobicy,
  fetchJooble,
  fetchOlx,
  fetchRemoteOk,
  fetchRemotive,
  fetchRss,
  fetchTheMuse,
  fetchTelegram,
  isLikelyTelegramVacancy,
} from './sources'

const STORE_KEY = 'jobs:store:v4'
const STORE_TTL_SECONDS = 15 * 86_400
const MAX_AGE_DAYS = 14
const STALE_DAYS = 4
const SOURCE_TIMEOUT_MS = 30_000

type StoredJob = Job & {
  lastSeen: string
  ai?: unknown
}

async function fetchAllTelegram(q: string): Promise<Job[]> {
  const [primary, extra] = await Promise.all([
    fetchTelegram(q),
    fetchExtraTelegramJobs(q),
  ])
  return [...primary, ...extra]
}

const FETCHERS: Record<JobSource, (q: string) => Promise<Job[]>> = {
  remotive: fetchRemotive,
  remoteok: fetchRemoteOk,
  arbeitnow: fetchArbeitnow,
  themuse: fetchTheMuse,
  jobicy: fetchJobicy,
  adzuna: fetchAdzuna,
  jooble: fetchJooble,
  rss: fetchRss,
  companies: fetchCompanies,
  devkg: fetchDevKg,
  ishgo: fetchIshGo,
  itjobsuz: fetchItJobsUz,
  telegram: fetchAllTelegram,
  olx: fetchOlx,
}

let mergeLock: Promise<unknown> = Promise.resolve()

export function configuredJobSources(): JobSource[] {
  return ALL_SOURCES.filter(isConfigured)
}

function isConfigured(source: JobSource): boolean {
  switch (source) {
    case 'adzuna':
      return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
    case 'jooble':
      return !!process.env.JOOBLE_KEY
    case 'rss':
      return process.env.RSS_DEFAULTS !== 'off' || !!process.env.RSS_FEEDS
    case 'companies':
      return process.env.COMPANIES_SOURCE !== 'off'
    case 'devkg':
      return process.env.DEVKG_SOURCE !== 'off'
    case 'ishgo':
      return process.env.ISHGO_SOURCE !== 'off'
    case 'itjobsuz':
      return process.env.ITJOBS_UZ_SOURCE !== 'off'
    case 'telegram':
      return process.env.TELEGRAM_SOURCE !== 'off'
    case 'olx':
      return process.env.OLX_SOURCE === 'on'
    default:
      return true
  }
}

function dedupKey(job: Job): string {
  return job.url || job.id
}

function isVisible(job: StoredJob): boolean {
  return job.source !== 'telegram'
    || isLikelyTelegramVacancy(`${job.title}\n${job.description || ''}`)
}

function prune(list: StoredJob[], now: number): StoredJob[] {
  const oldestPosted = now - MAX_AGE_DAYS * 86_400_000
  const stalest = now - STALE_DAYS * 86_400_000

  return list.filter((job) => {
    if (!isVisible(job)) return false

    const posted = Date.parse(job.postedAt)
    const seen = Date.parse(job.lastSeen)

    if (Number.isNaN(posted) || posted < oldestPosted) return false
    if (Number.isNaN(seen) || seen < stalest) return false

    return true
  })
}

async function fetchSource(source: JobSource): Promise<Job[]> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      FETCHERS[source](''),
      new Promise<Job[]>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${SOURCE_TIMEOUT_MS / 1000}s`)),
          SOURCE_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function mergeFetchedSource(source: JobSource, jobs: Job[]) {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const redis = useRedis()

  const raw = await redis.get(STORE_KEY)
  const existing = raw ? JSON.parse(raw) as StoredJob[] : []
  const byKey = new Map<string, StoredJob>()

  for (const job of existing) {
    byKey.set(dedupKey(job), job)
  }

  for (const job of jobs) {
    const enriched = enrichJob(job)
    const key = dedupKey(enriched)
    const previous = byKey.get(key)

    byKey.set(key, {
      ...enriched,
      lastSeen: nowIso,
      ...(previous?.ai ? { ai: previous.ai } : {}),
    })
  }

  const kept = prune([...byKey.values()], now)

  await redis.set(
    STORE_KEY,
    JSON.stringify(kept),
    'EX',
    STORE_TTL_SECONDS,
  )

  try {
    await syncJobsSearchIndex(kept)
  } catch (error) {
    console.error(
      `[jobs:queue:${source}] Elasticsearch sync failed:`,
      (error as Error).message,
    )
  }

  return {
    source,
    fetched: jobs.length,
    stored: kept.length,
  }
}

export async function refreshJobSource(source: JobSource) {
  if (!ALL_SOURCES.includes(source)) {
    throw new Error(`Unknown job source ${source}`)
  }

  if (!isConfigured(source)) {
    return {
      source,
      skipped: true,
      reason: 'not_configured',
      fetched: 0,
    }
  }

  const jobs = await fetchSource(source)

  // Fetching is parallel; mutation of the shared Redis store is serialized.
  const operation = mergeLock.then(
    () => mergeFetchedSource(source, jobs),
    () => mergeFetchedSource(source, jobs),
  )

  mergeLock = operation.catch(() => {})
  return await operation
}
