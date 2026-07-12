// GET /api/jobs — Nitro server route. Sits above the "/api/**" proxy just like
// server/api/headerMenu.get.ts, so it is handled here (not proxied to FastAPI).
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
  fetchHeadHunter,
  fetchJobicy,
  fetchJooble,
  fetchRemoteOk,
  fetchRemotive,
  fetchRss,
  fetchTheMuse,
} from '../utils/sources'
import { filterAndPaginate } from '../utils/aggregate'

const FETCHERS: Record<JobSource, (q: string) => Promise<Job[]>> = {
  remotive: fetchRemotive,
  remoteok: fetchRemoteOk,
  arbeitnow: fetchArbeitnow,
  headhunter: fetchHeadHunter,
  themuse: fetchTheMuse,
  jobicy: fetchJobicy,
  adzuna: fetchAdzuna,
  jooble: fetchJooble,
  rss: fetchRss,
  companies: fetchCompanies,
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
    default:
      return true
  }
}

const CACHE_TTL_SECONDS = 300
const SORT_KEYS: SortKey[] = ['date', 'oldest', 'title', 'company', 'salary']
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'office', 'unknown']
const RELOCATIONS: Relocation[] = ['offered', 'none', 'unknown']

async function getSource(source: JobSource, q: string): Promise<Job[]> {
  const redis = useRedis()
  // Cache the full (query-less) pull; per-request search is applied locally.
  const cacheable = q === ''
  const key = `jobs:src:${source}`

  if (cacheable) {
    try {
      const cached = await redis.get(key)
      if (cached) return JSON.parse(cached) as Job[]
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
      ]
  const activeSources = chosen.filter(isConfigured)
  const finalSources = activeSources.length ? activeSources : FREE_SOURCES

  let remote: boolean | undefined
  if (q.remote === 'true') remote = true
  else if (q.remote === 'false') remote = false

  const sort = (SORT_KEYS.includes(q.sort as SortKey) ? q.sort : 'date') as SortKey
  const salaryMin = q.salaryMin ? clampInt(q.salaryMin, 0, 0, 100_000_000) : undefined

  // Advanced enriched filters (all optional).
  const country = String(q.country ?? '').trim().toUpperCase() || undefined
  const workMode = WORK_MODES.includes(q.workMode as WorkMode) ? (q.workMode as WorkMode) : undefined
  const relocation = RELOCATIONS.includes(q.relocation as Relocation)
    ? (q.relocation as Relocation)
    : undefined
  let foreignerFriendly: boolean | undefined
  if (q.foreignerFriendly === 'true') foreignerFriendly = true
  else if (q.foreignerFriendly === 'false') foreignerFriendly = false
  const language = String(q.language ?? '').trim() || undefined
  const languageLevel = String(q.languageLevel ?? '').trim() || undefined
  const skills = String(q.skills ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const results = await Promise.all(finalSources.map((s) => getSource(s, search)))

  return filterAndPaginate(results.flat(), {
    q: search,
    location: String(q.location ?? '').trim(),
    remote,
    sources: finalSources,
    sort,
    maxAgeDays: clampInt(q.maxAgeDays, 14, 1, 14),
    salaryMin,
    country,
    workMode,
    relocation,
    foreignerFriendly,
    language,
    languageLevel,
    skills,
    page: clampInt(q.page, 1, 1, 10000),
    pageSize: clampInt(q.pageSize, 20, 1, 100),
  })
})
