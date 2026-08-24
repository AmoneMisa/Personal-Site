// GET /jobs-feed — read-only vacancy feed served by the isolated jobs API.
// Ingestion lives exclusively in jobs-worker; this request path only reads the
// persisted snapshot, filters/sorts it and optionally queries Elasticsearch.

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
import { filterAndPaginate } from '../utils/aggregate'
import { getStoredJobsSnapshot } from '../utils/jobsSnapshot'
import { getRates, loadRates } from '../utils/currency'
import { jobSearchKey, searchJobMatches } from '../utils/jobsElastic'
import { keepUsaForeignerCandidate } from '../utils/jobVisaSponsorship'

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
    case 'linkedin':
      return process.env.LINKEDIN_SOURCE !== 'off'
    case 'facebook':
    case 'threads':
      return String(process.env.SOCIAL_JOB_SOURCE || 'on').toLowerCase() !== 'off'
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

const SORT_KEYS: SortKey[] = ['date', 'oldest', 'title', 'company', 'salary']
const WORK_MODES: WorkMode[] = ['remote', 'hybrid', 'office', 'unknown']
const RELOCATIONS: Relocation[] = ['offered', 'none', 'unknown']

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isNaN(n) ? def : Math.min(max, Math.max(min, n))
}

async function getStoredSnapshot(): Promise<Awaited<ReturnType<typeof getStoredJobsSnapshot>>> {
  // The snapshot is a local persistent-volume read, not an upstream crawl. Returning
  // [] after an arbitrary timeout makes the first filtered request look genuinely
  // empty while the same read keeps warming in the background. Await it once; the
  // snapshot module keeps a 60-second in-memory cache for subsequent requests.
  return getStoredJobsSnapshot()
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
  const finalSources = activeSources.length
    ? activeSources
    : requested.length
      ? []
      : FREE_SOURCES.filter(isConfigured)

  let remote: boolean | undefined
  if (q.remote === 'true') remote = true
  else if (q.remote === 'false') remote = false

  const sort = (SORT_KEYS.includes(q.sort as SortKey) ? q.sort : 'date') as SortKey
  const salaryMin = q.salaryMin ? clampInt(q.salaryMin, 0, 0, 100_000_000) : undefined

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
  const usaBroadForeignerFilter = foreignerFriendly === true && countries.includes('US')
  const hideRiskyIndustries = q.hideRiskyIndustries !== 'false'
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

  // Rate refresh is independent of ingestion and never awaited by the feed.
  loadRates().catch(() => {})

  const pool = await getStoredSnapshot()
  let searchMatches: Awaited<ReturnType<typeof searchJobMatches>> = null

  if (search) {
    try {
      searchMatches = await searchJobMatches(search)
    } catch (err) {
      console.warn('[jobs:elasticsearch] search fallback:', (err as Error).message)
      searchMatches = null
    }
  }

  const matchedPool = searchMatches
    ? pool.filter((job) => searchMatches!.rank.has(jobSearchKey(job)))
    : pool

  // USA uses evidence-based sponsorship classification instead of the legacy
  // boolean. Keep explicit/verified/historical sponsor evidence and reject
  // unknown or explicitly negative sponsorship cases.
  const searchPool = usaBroadForeignerFilter
    ? matchedPool.filter(keepUsaForeignerCandidate)
    : matchedPool

  setResponseHeader(event, 'Cache-Control', 'private, max-age=30')

  const result = filterAndPaginate(searchPool, {
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
    foreignerFriendly: usaBroadForeignerFilter ? undefined : foreignerFriendly,
    hideRiskyIndustries,
    noExperience,
    language,
    languageLevel,
    excludeLanguages,
    skills,
    page: clampInt(q.page, 1, 1, 10000),
    pageSize: clampInt(q.pageSize, 20, 1, 100),
  })

  // The USA foreigner filter is applied before aggregate.ts because it uses a
  // richer sponsorship classifier than the legacy `job.foreignerFriendly` flag.
  // Therefore every vacancy remaining in `result` is foreigner/sponsor-friendly
  // by the exact predicate used for this request. Keep the statistics consistent
  // with the visible filtered set instead of counting only the legacy flag.
  if (usaBroadForeignerFilter) result.stats.foreignerFriendly = result.total

  return {
    ...result,
    rates: getRates(),
    warming: false,
    loadedSources: [...new Set(pool.map((job) => job.source))],
    pendingSources: [],
    failedSources: [],
  }
})