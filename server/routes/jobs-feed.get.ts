// GET /jobs-feed — Nitro server route. Deliberately NOT under "/api/**": in the
// host site that whole prefix is a routeRules proxy to the FastAPI backend (a
// global middleware that runs before file routes), so an /api/* handler would be
// forwarded to FastAPI and 404. Living at /jobs-feed keeps it served by Nitro.
//
// Aggregates many job boards, caches each pull in Redis (5 min), then filters/
// sorts/paginates. Optional sources activate only when their env keys are set.
// Shared contract for the web page + Android app.

import { useRedis } from '~~/server/utils/redis'
import {
  ALL_SOURCES,
  FREE_SOURCES,
  type Job,
  type JobSource,
  type Relocation,
  type SortKey,
  type WorkMode,
} from '../utils/jobTypes'
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
} from '../utils/sources'
import { filterAndPaginate } from '../utils/aggregate'
import { getStoredJobs, refreshJobStore } from '../utils/jobsStore'
import { getRates, loadRates } from '../utils/currency'

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

// Optional sources are only queried when configured, to avoid wasted calls.
function isConfigured(source: JobSource): boolean {
  switch (source) {
    case 'adzuna':
      return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
    case 'jooble':
      return !!process.env.JOOBLE_KEY
    case 'rss':
      // On by default thanks to the built-in Ukraine (DOU.ua) feed.
      return process.env.RSS_DEFAULTS !== 'off' || !!process.env.RSS_FEEDS
    case 'companies':
      // On by default thanks to the built-in Greenhouse/Lever seed boards.
      return process.env.COMPANIES_SOURCE !== 'off'
    case 'devkg':
      // On by default — DevKG's public vacancies RSS feed, no key required.
      return process.env.DEVKG_SOURCE !== 'off'
    case 'ishgo':
      return process.env.ISHGO_SOURCE !== 'off'
    case 'itjobsuz':
      return process.env.ITJOBS_UZ_SOURCE !== 'off'
    case 'telegram':
      return process.env.TELEGRAM_SOURCE !== 'off'
    case 'olx':
      // Explicit opt-in: OLX currently blocks the public endpoint on some IPs.
      return process.env.OLX_SOURCE === 'on'
    default:
      return true
  }
}

const CACHE_TTL_SECONDS = 300
const sourceMemoryCache = new Map<JobSource, { expiresAt: number; jobs: Job[] }>()
const SORT_KEYS: SortKey[] = ['date', 'oldest', 'title', 'company', 'salary']
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'office', 'unknown']
const RELOCATIONS: Relocation[] = ['offered', 'none', 'unknown']

async function getSource(source: JobSource, q: string): Promise<Job[]> {
  const redis = useRedis()
  // Cache the full (query-less) pull; per-request search is applied locally.
  const cacheable = q === ''
  const key = `jobs:src:${source}`

  if (cacheable) {
    const memory = sourceMemoryCache.get(source)
    if (memory && memory.expiresAt > Date.now()) return memory.jobs
    try {
      const cached = await redis.get(key)
      if (cached) {
        const jobs = JSON.parse(cached) as Job[]
        sourceMemoryCache.set(source, {
          expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
          jobs,
        })
        return jobs
      }
    } catch {
      /* redis down — fetch live */
    }
  }

  let jobs: Job[] = []
  try {
    jobs = await FETCHERS[source](q)
  } catch (err) {
    console.error(`[jobs] source "${source}" failed:`, (err as Error).message)
    return []
  }

  if (cacheable) {
    sourceMemoryCache.set(source, {
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
      jobs,
    })
    try {
      await redis.set(key, JSON.stringify(jobs), 'EX', CACHE_TTL_SECONDS)
    } catch {
      /* best-effort */
    }
  }
  return jobs
}

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n))
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const search = String(q.q ?? '').trim()

  const requested = String(q.source ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as JobSource[]
  const chosen = requested.length
    ? requested.filter((s) => ALL_SOURCES.includes(s))
    : [
        ...FREE_SOURCES,
        'adzuna' as JobSource,
        'jooble' as JobSource,
        'rss' as JobSource,
        'companies' as JobSource,
        'ishgo' as JobSource,
        'itjobsuz' as JobSource,
        'olx' as JobSource,
      ]
  const activeSources = chosen.filter(isConfigured)
  // An explicitly selected but disabled/unconfigured source must return an
  // empty result, not silently fall back to unrelated boards.
  const finalSources = activeSources.length
    ? activeSources
    : requested.length
      ? []
      : FREE_SOURCES

  let remote: boolean | undefined
  if (q.remote === 'true') remote = true
  else if (q.remote === 'false') remote = false

  const sort = (SORT_KEYS.includes(q.sort as SortKey) ? q.sort : 'date') as SortKey
  const salaryMin = q.salaryMin ? clampInt(q.salaryMin, 0, 0, 100_000_000) : undefined

  // Advanced enriched filters (all optional).
  const countries = String(q.country ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
  const includeRu = q.includeRu === 'true'
  const includeBy = q.includeBy === 'true'
  const workMode = WORK_MODES.includes(q.workMode as WorkMode) ? (q.workMode as WorkMode) : undefined
  const relocation = RELOCATIONS.includes(q.relocation as Relocation)
    ? (q.relocation as Relocation)
    : undefined
  let foreignerFriendly: boolean | undefined
  if (q.foreignerFriendly === 'true') foreignerFriendly = true
  else if (q.foreignerFriendly === 'false') foreignerFriendly = false
  const noExperience = q.noExperience === 'true'
  const language = String(q.language ?? '').trim() || undefined
  const languageLevel = String(q.languageLevel ?? '').trim() || undefined
  const excludeLanguages = String(q.excludeLanguage ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const skills = String(q.skills ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  // Ensure the FX rate table is in memory before enrichment normalizes salaries
  // to USD, and so the response can hand the live rates to the client.
  await loadRates()

  // Primary path: read the pre-aggregated store the scheduled worker maintains,
  // so requests never block on (or get geo-blocked by) upstream boards. Cold
  // fallback: pull live once and kick a background refresh to warm the store.
  let pool = await getStoredJobs()
  if (!pool.length) {
    if (requested.length) {
      // A cold, explicitly selected source should not wait for every configured
      // board. Pull only that source and warm the complete store in background.
      pool = (await Promise.all(finalSources.map((source) => getSource(source, '')))).flat()
      refreshJobStore().catch(() => {})
    } else {
      // The initial all-source page still needs the complete store. The refresh
      // promise is deduplicated with the deployment warmup task.
      await refreshJobStore()
      pool = await getStoredJobs()
    }
  } else if (requested.length) {
    // A store written before a newly deployed source existed can be non-empty
    // yet contain no rows for that explicitly selected source. Fetch only the
    // missing selection now instead of returning a misleading zero until cron.
    const freshnessCutoff = Date.now() - 14 * 86_400_000
    const present = new Set(
      pool
        .filter((job) => new Date(job.postedAt).getTime() >= freshnessCutoff)
        .map((job) => job.source),
    )
    const missing = finalSources.filter((source) => !present.has(source))
    if (missing.length) {
      const live = (await Promise.all(missing.map((source) => getSource(source, search)))).flat()
      pool = [...pool, ...live]
      refreshJobStore().catch(() => {})
    }
  }

  return {
    ...filterAndPaginate(pool, {
      q: search,
      location: String(q.location ?? '').trim(),
      remote,
      sources: finalSources,
      sort,
      maxAgeDays: clampInt(q.maxAgeDays, 14, 1, 14),
      salaryMin,
      countries,
      includeRu,
      includeBy,
      workMode,
      relocation,
      foreignerFriendly,
      noExperience,
      language,
      languageLevel,
      excludeLanguages,
      skills,
      page: clampInt(q.page, 1, 1, 10000),
      pageSize: clampInt(q.pageSize, 20, 1, 100),
    }),
    rates: getRates(),
  }
})
