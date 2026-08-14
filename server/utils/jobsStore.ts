// Redis-backed vacancy store. A scheduled worker (server/tasks/jobs/refresh.ts)
// pulls every configured board once, merges the result into a single Redis key,
// and prunes closed/old postings. The /jobs-feed request path then reads only
// from this store, so it never blocks on (or is geo-blocked by) upstream boards.
//
// Retention: a posting is kept while it is < 14 days old AND was seen in the last
// STALE_DAYS refreshes (so a vacancy that disappears from its source — i.e. was
// closed — ages out, while a source failing for a day or two doesn't wipe data).

import { useRedis } from '~~/server/utils/redis'
import { ALL_SOURCES, type Job, type JobSource } from './jobTypes'
import { refreshRates } from './currency'
import { enrichJob } from './enrich'
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
} from './sources'

const STORE_KEY = 'jobs:store:v3'
const STORE_TTL_SECONDS = 15 * 86_400 // safety net: store self-expires if the worker dies
const MEMORY_TTL_MS = 5 * 60_000
const MAX_AGE_DAYS = 14 // never retain postings older than this (mirrors the read-side cap)
const STALE_DAYS = 4 // drop postings not seen in the last N days (treated as closed)
const SOURCE_TIMEOUT_MS = 30_000

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
  telegram: fetchTelegram,
  olx: fetchOlx,
}

// Only pull optional sources when their credentials/opt-in are present.
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

// Persisted shape carries a lastSeen stamp used only for closed-vacancy pruning.
type StoredJob = Job & { lastSeen: string }
type RefreshSummary = {
  fetched: number
  stored: number
  perSource: Partial<Record<JobSource, number>>
}

export type JobRefreshState = {
  inProgress: boolean
  loadedSources: JobSource[]
  pendingSources: JobSource[]
  failedSources: JobSource[]
  startedAt?: string
  completedAt?: string
}

let memoryStore: StoredJob[] = []
let memoryValidUntil = 0
let refreshInFlight: Promise<RefreshSummary> | undefined
let refreshState: JobRefreshState = {
  inProgress: false,
  loadedSources: [],
  pendingSources: [],
  failedSources: [],
}

function dedupKey(job: Job): string {
  return job.url || job.id
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

/** All stored vacancies (lastSeen stripped). Empty on a cold cache or Redis error. */
export async function getStoredJobs(): Promise<Job[]> {
  if (memoryStore.length && Date.now() < memoryValidUntil) {
    return memoryStore.map(({ lastSeen: _lastSeen, ...job }) => job)
  }
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (!raw) {
      return memoryStore.map(({ lastSeen: _lastSeen, ...job }) => job)
    }
    const list = JSON.parse(raw) as StoredJob[]
    memoryStore = list
    memoryValidUntil = Date.now() + MEMORY_TTL_MS
    return list.map(({ lastSeen: _lastSeen, ...job }) => job)
  } catch {
    return memoryStore.map(({ lastSeen: _lastSeen, ...job }) => job)
  }
}

async function loadStored(): Promise<StoredJob[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const raw = await Promise.race([
      useRedis().get(STORE_KEY),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 750)
      }),
    ])
    return raw ? (JSON.parse(raw) as StoredJob[]) : memoryStore
  } catch {
    return memoryStore
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function pruneStore(byKey: Map<string, StoredJob>, now: number): StoredJob[] {
  const oldestPosted = now - MAX_AGE_DAYS * 86_400_000
  const stalest = now - STALE_DAYS * 86_400_000
  const kept: StoredJob[] = []
  for (const job of byKey.values()) {
    const posted = new Date(job.postedAt).getTime()
    const seen = new Date(job.lastSeen).getTime()
    if (Number.isNaN(posted) || posted < oldestPosted) continue
    if (Number.isNaN(seen) || seen < stalest) continue
    kept.push(job)
  }
  return kept
}

function publishMemoryStore(byKey: Map<string, StoredJob>, now: number): StoredJob[] {
  const kept = pruneStore(byKey, now)
  memoryStore = kept
  memoryValidUntil = Date.now() + MEMORY_TTL_MS
  return kept
}

/** Current progressive refresh state for non-blocking feed responses. */
export function getJobRefreshState(): JobRefreshState {
  return {
    ...refreshState,
    loadedSources: [...refreshState.loadedSources],
    pendingSources: [...refreshState.pendingSources],
    failedSources: [...refreshState.failedSources],
  }
}

/**
 * Pull every configured board, merge into the store, prune, and persist.
 * Returns a small summary for logging/observability. Never throws — a failing
 * source contributes nothing rather than aborting the whole refresh.
 */
async function performJobStoreRefresh(): Promise<RefreshSummary> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const sources = ALL_SOURCES.filter(isConfigured)

  refreshState = {
    inProgress: true,
    loadedSources: [],
    pendingSources: [...sources],
    failedSources: [],
    startedAt: nowIso,
  }

  // FX and vacancy requests run concurrently. Neither one delays the first
  // source becoming visible in the in-process store.
  refreshRates().catch(() => {})

  // Start from what we already have so a transient source failure doesn't drop data.
  const byKey = new Map<string, StoredJob>()
  for (const job of await loadStored()) byKey.set(dedupKey(job), job)
  const perSource: Partial<Record<JobSource, number>> = {}
  let fetched = 0

  await Promise.all(sources.map(async (source) => {
    try {
      const jobs = await fetchSource(source)
      fetched += jobs.length
      perSource[source] = jobs.length

      // Skill/language extraction is regex-heavy and multiple source promises
      // can resume in the same event-loop turn. Yield after every vacancy so a
      // cold refresh never starves page, filter, or icon requests.
      for (const job of jobs) {
        const enriched = enrichJob(job)
        byKey.set(dedupKey(enriched), { ...enriched, lastSeen: nowIso })
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }

      refreshState.loadedSources.push(source)
    } catch (err) {
      refreshState.failedSources.push(source)
      console.error(`[jobs:refresh] source "${source}" failed:`, (err as Error).message)
    } finally {
      refreshState.pendingSources = refreshState.pendingSources.filter((item) => item !== source)
      publishMemoryStore(byKey, now)
    }
  }))

  const kept = publishMemoryStore(byKey, now)

  // The current in-memory result is complete now. Redis persistence below is
  // best-effort and must not keep clients polling a finished vacancy refresh.
  refreshState = {
    ...refreshState,
    inProgress: false,
    pendingSources: [],
    completedAt: new Date().toISOString(),
  }

  try {
    await useRedis().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
  } catch (err) {
    console.error('[jobs:refresh] failed to persist store:', (err as Error).message)
  }

  return { fetched, stored: kept.length, perSource }
}

export function refreshJobStore(): Promise<RefreshSummary> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = performJobStoreRefresh().finally(() => {
    refreshInFlight = undefined
  })
  return refreshInFlight
}
