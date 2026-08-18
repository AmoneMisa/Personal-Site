// GET /jobs-feed — Nitro server route. Deliberately NOT under "/api/**": in the
// host site that whole prefix is a routeRules proxy to the FastAPI backend (a
// global middleware that runs before file routes), so an /api/* handler would be
// forwarded to FastAPI and 404. Living at /jobs-feed keeps it served by Nitro.
//
// Reads the progressively populated vacancy store, then filters/sorts/paginates
// its current snapshot. Optional sources activate only when their env keys are set.
// Shared contract for the web page + Android app.

import {
  ALL_SOURCES,
  EMPLOYMENT_KINDS,
  type EmploymentKind,
  FREE_SOURCES,
  type JobSource,
  type Relocation,
  type SortKey,
  type WorkMode,
} from '../utils/jobTypes'
import {filterAndPaginate} from '../utils/aggregate'
import {getJobRefreshState, getStoredJobs, refreshJobStore} from '../utils/jobsStore'
import {getRates, loadRates} from '../utils/currency'
import {jobSearchKey, searchJobMatches,} from '../utils/jobsElastic'

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

const SORT_KEYS: SortKey[] = ['date', 'oldest', 'title', 'company', 'salary']
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'office', 'unknown']
const RELOCATIONS: Relocation[] = ['offered', 'none', 'unknown']

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n))
}

async function getStoredSnapshot(): Promise<Awaited<ReturnType<typeof getStoredJobs>>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      getStoredJobs(),
      new Promise<Awaited<ReturnType<typeof getStoredJobs>>>((resolve) => {
        timer = setTimeout(() => resolve([]), 750)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
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
  const cities = String(q.cities ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const includeRu = q.includeRu === 'true'
  const includeBy = q.includeBy === 'true'
  const workMode = WORK_MODES.includes(q.workMode as WorkMode) ? (q.workMode as WorkMode) : undefined
  const relocation = RELOCATIONS.includes(q.relocation as Relocation)
    ? (q.relocation as Relocation)
    : undefined
  const employmentKind = EMPLOYMENT_KINDS.includes(q.employmentKind as EmploymentKind)
    ? (q.employmentKind as EmploymentKind)
    : undefined
  const hasSalary = q.hasSalary === 'true'
  const maxExperienceYears = q.maxExperienceYears ? clampInt(q.maxExperienceYears, 0, 0, 40) : undefined
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

  // Populate live FX rates opportunistically. The static fallback is already in
  // memory, so a Redis/network issue must never hold the feed response open.
  loadRates().catch(() => {})

  // Read only the current snapshot. A cold or newly added source starts the
  // deduplicated refresh in the background and returns partial data immediately.
  // Redis is normally local and fast, but a broken container/network must not
  // turn this endpoint into another gateway timeout. Continue with an empty
  // snapshot after a short budget; getStoredJobs handles its own late failure.
  const pool = await getStoredSnapshot();
  let searchMatches:
      Awaited<
          ReturnType<
              typeof searchJobMatches
          >
      > = null

  if (search) {
    try {
      searchMatches =
          await searchJobMatches(
              search,
          )
    } catch (err) {
      /*
       * ES недоступен —
       * /jobs продолжает работать
       * через старый includes().
       */
      console.warn(
          '[jobs:elasticsearch] search fallback:',
          (err as Error).message,
      )

      searchMatches = null
    }
  }

  const searchPool =
      searchMatches
          ? pool.filter(
              (job) =>
                  searchMatches!
                      .rank
                      .has(
                          jobSearchKey(
                              job,
                          ),
                      ),
          )
          : pool;
  if (!pool.length && finalSources.length) {
    refreshJobStore().catch(() => {})
  }

  const refresh = getJobRefreshState()
  setResponseHeader(event, 'Cache-Control', refresh.inProgress ? 'no-store' : 'private, max-age=30')

  return {
    ...filterAndPaginate(searchPool, {
      /*
       * ES уже выполнил text search.
       *
       * Если ES недоступен —
       * передаём исходный q и остаётся
       * старый String.includes fallback.
       */
      q: searchMatches ? '' : search,
      location: String(q.location ?? '').trim(),
      remote,
      sources: finalSources,
      sort,
      maxAgeDays: clampInt(q.maxAgeDays, 14, 1, 14),
      salaryMin,
      countries,
      cities,
      includeRu,
      includeBy,
      workMode,
      relocation,
      employmentKind,
      hasSalary,
      maxExperienceYears,
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
    warming: refresh.inProgress,
    loadedSources: refresh.loadedSources,
    pendingSources: refresh.pendingSources,
    failedSources: refresh.failedSources,
  }
})
