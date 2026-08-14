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

let memoryStore: StoredJob[] = []
let memoryValidUntil = 0
let refreshInFlight: Promise<RefreshSummary> | undefined

function dedupKey(job: Job): string {
  return job.url || job.id
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
  try {
    const raw = await useRedis().get(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredJob[]) : memoryStore
  } catch {
    return memoryStore
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

  // Refresh live FX rates on the same daily cadence as the vacancy pull.
  await refreshRates()

  const sources = ALL_SOURCES.filter(isConfigured)
  const results = await Promise.all(
    sources.map((s) =>
      FETCHERS[s]('').catch((err) => {
        console.error(`[jobs:refresh] source "${s}" failed:`, (err as Error).message)
        return [] as Job[]
      }),
    ),
  )
  const fetched = results.flat()

  // Start from what we already have so a transient source failure doesn't drop data.
  const byKey = new Map<string, StoredJob>()
  for (const job of await loadStored()) byKey.set(dedupKey(job), job)
  // Upsert freshly-seen postings, refreshing their lastSeen stamp.
  const perSource: Partial<Record<JobSource, number>> = {}
  for (const job of fetched) {
    const enriched = enrichJob(job)
    byKey.set(dedupKey(enriched), { ...enriched, lastSeen: nowIso })
    perSource[job.source] = (perSource[job.source] || 0) + 1
  }

  const oldestPosted = now - MAX_AGE_DAYS * 86_400_000
  const stalest = now - STALE_DAYS * 86_400_000
  const kept: StoredJob[] = []
  for (const job of byKey.values()) {
    const posted = new Date(job.postedAt).getTime()
    const seen = new Date(job.lastSeen).getTime()
    if (Number.isNaN(posted) || posted < oldestPosted) continue // too old
    if (Number.isNaN(seen) || seen < stalest) continue // not seen recently → closed
    kept.push(job)
  }

  // Always retain the refreshed store in-process. This keeps search/filtering
  // fast in local development and during a temporary Redis outage.
  memoryStore = kept
  memoryValidUntil = Date.now() + MEMORY_TTL_MS

  try {
    await useRedis().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
  } catch (err) {
    console.error('[jobs:refresh] failed to persist store:', (err as Error).message)
  }

  return { fetched: fetched.length, stored: kept.length, perSource }
}

export function refreshJobStore(): Promise<RefreshSummary> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = performJobStoreRefresh().finally(() => {
    refreshInFlight = undefined
  })
  return refreshInFlight
}
