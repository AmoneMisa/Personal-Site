import { useStateStore } from '~~/server/utils/stateStore'
import { ALL_SOURCES, type Job, type JobSource } from './jobTypes'
import { enrichJob } from './enrich'
import { syncJobsSearchIndex } from './jobsElastic'
import { syncJobsDb } from '../jobs/infrastructure/database'
import { fetchExtraTelegramJobs } from './extraTelegramJobSources'
import { fetchLinkedInJobs } from './linkedinSource'
import { fetchFacebookJobs, fetchThreadsJobs } from './socialJobSources'
import { fetchExtraPublicJobs } from './extraPublicJobSources'
import { fetchCuratedRemoteJobs } from './curatedRemoteJobSources'
import { fetchUsaTechCompanyJobs } from './usaTechCompanySources'
import { fetchRegionalTechCompanyJobs } from './regionalTechCompanySources'
import { fetchUsaVisaSponsorJobs } from './usaVisaSponsorSource'
import { fetchSourceExpansionJobs } from './sourceExpansionJobs'
import { fetchAviationExpansionJobs } from './aviationExpansionJobs'
import { fetchIntelliasJobs } from './intelliasJobs'
import { fetchJobsUaJobs } from './jobsUaSource'
import { fetchUkraineBoardJobs } from './ukraineJobSources'
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
// `companies` is intentionally an umbrella source: official ATS feeds, career
// pages, regional boards and aviation sources all run as isolated sub-loaders.
// Give that fan-out room to finish while keeping one source refresh bounded.
const COMPANIES_SOURCE_TIMEOUT_MS = 150_000
// Regional LinkedIn pagination and serialized Threads searches intentionally do
// more work than ordinary API/RSS sources. Keep them below the queue worker's
// execution budget, but do not abort them at the generic 30-second ceiling.
const LINKEDIN_SOURCE_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(170_000, Number(process.env.LINKEDIN_SOURCE_TIMEOUT_MS) || 150_000),
)
const SOCIAL_SOURCE_TIMEOUT_MS = Math.max(
  60_000,
  Math.min(170_000, Number(process.env.SOCIAL_JOB_SOURCE_TIMEOUT_MS) || 150_000),
)

type StoredJob = Job & {
  lastSeen: string
  ai?: unknown
}

function normalizedTagKey(value: string): string {
  return value.normalize('NFKC').replace(/[^\p{L}\p{N}+#.]+/gu, ' ').trim().toLocaleLowerCase('en')
}

function cleanJobTags(job: Job): Job {
  const company = normalizedTagKey(job.company || '')
  const seen = new Set<string>()
  const tags = (job.tags || []).filter((tag) => {
    const key = normalizedTagKey(String(tag || ''))
    if (!key || key === company || seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (tags.length === (job.tags || []).length) return job
  return { ...job, tags }
}

/**
 * A few HTML boards hand the source adapter a whole detail page. If that
 * adapter strips tags without first removing <script>, the script *contents*
 * become ordinary text and reach enrichment. That is how Yandex RTB code was
 * shown in the modal and words such as `JSON` became fake required skills.
 *
 * Keep this guard at the storage/enrichment boundary as defence in depth: a
 * board-specific parser can still be fixed independently, while executable
 * page plumbing never becomes vacancy content or ATS keywords again.
 */
export function sanitizeFetchedJob(input: Job): Job {
  const job = cleanJobTags(input)
  const raw = String(job.description || '').replace(/\s+/g, ' ').trim()
  if (!raw) return job

  const embeddedScript = raw.search(
    /(?:window\.yaContextCb\b|Ya\.Context\.AdvManager\b|yandex_rtb_R-A-\d+|googletag\.cmd\b|dataLayer\.push\s*\()/i,
  )
  let description = embeddedScript >= 0 ? raw.slice(0, embeddedScript).trim() : raw

  const isIshBor = (job.tags || []).some((tag) => /ish-bor\.uz/i.test(String(tag)))
    || /ish-bor\.uz/i.test(job.company || '')
    || /ish-bor\.uz/i.test(job.url || '')

  if (isIshBor) {
    // ish-bor appends SEO/navigation copy to the useful one-line summary.
    description = description
      .replace(/^Регистрация\s+\d{1,2}[./-]\d{1,2}[./-]20\d{2}(?:\s+\d+){0,3}\s*/iu, '')
      .replace(/\s+\|?\s*Вакансии,\s*Вакансия,\s*работа(?:\s|,|$)[\s\S]*$/iu, '')
      .replace(/\s+ish-bor\.uz\s+(?:Фильтр|Если вам нужна работа|Меню|О нас)[\s\S]*$/iu, '')
      .trim()

    // A detail layout with no textual summary is preferable as a concise card
    // over exposing registration counters/navigation from the surrounding page.
    if (!description || /^Регистрация(?:\s|$)/iu.test(description)) description = job.title.trim()
  }

  return description === raw ? job : { ...job, description: description || undefined }
}

async function fetchAllTelegram(q: string): Promise<Job[]> {
  const [primary, extra] = await Promise.all([
    fetchTelegram(q),
    fetchExtraTelegramJobs(q),
  ])
  return [...primary, ...extra]
}

async function fetchAllCompanies(q: string): Promise<Job[]> {
  const loaders = [
    { label: 'companies', load: () => fetchCompanies(q) },
    { label: 'public-boards', load: () => fetchExtraPublicJobs(q) },
    // These boards used to rely on the generic public-board anchor parser.
    // Keep them inside the companies umbrella, but let source-aware adapters
    // overwrite matching URLs with better company/location/date fidelity.
    { label: 'curated-remote-boards', load: () => fetchCuratedRemoteJobs(q) },
    { label: 'usa-tech-companies', load: () => fetchUsaTechCompanyJobs(q) },
    { label: 'regional-tech-companies', load: () => fetchRegionalTechCompanyJobs(q) },
    { label: 'usa-visa-sponsors', load: () => fetchUsaVisaSponsorJobs(q) },
    { label: 'source-expansion', load: () => fetchSourceExpansionJobs(q) },
    { label: 'aviation-expansion', load: () => fetchAviationExpansionJobs(q) },
    { label: 'intellias', load: () => fetchIntelliasJobs(q) },
    { label: 'jobs-ua', load: () => fetchJobsUaJobs(q) },
    { label: 'ua-boards', load: () => fetchUkraineBoardJobs(q) },
  ]

  const results = await Promise.allSettled(loaders.map(({ load }) => load()))
  const jobs: Job[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value)
      return
    }

    console.warn(
      `[jobs] ${loaders[index]!.label} sub-source failed:`,
      result.reason instanceof Error ? result.reason.message : String(result.reason),
    )
  })

  return jobs
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
  companies: fetchAllCompanies,
  linkedin: fetchLinkedInJobs,
  facebook: fetchFacebookJobs,
  threads: fetchThreadsJobs,
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
    case 'linkedin':
      return process.env.LINKEDIN_SOURCE !== 'off'
    case 'facebook':
    case 'threads':
      return String(process.env.SOCIAL_JOB_SOURCE || 'on').toLowerCase() !== 'off'
        && !!process.env.HIRING_SOCIAL_API_URL
        && String(process.env.QUEUE_INTERNAL_KEY || '').length >= 16
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

function sourceTimeoutMs(source: JobSource): number {
  if (source === 'companies') return COMPANIES_SOURCE_TIMEOUT_MS
  if (source === 'linkedin') return LINKEDIN_SOURCE_TIMEOUT_MS
  if (source === 'facebook' || source === 'threads') return SOCIAL_SOURCE_TIMEOUT_MS
  return SOURCE_TIMEOUT_MS
}

async function fetchSource(source: JobSource): Promise<Job[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutMs = sourceTimeoutMs(source)

  try {
    return await Promise.race([
      FETCHERS[source](''),
      new Promise<Job[]>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${timeoutMs / 1000}s`)),
          timeoutMs,
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
  const store = useStateStore()

  const raw = await store.get(STORE_KEY)
  const existing = raw ? JSON.parse(raw) as StoredJob[] : []
  const byKey = new Map<string, StoredJob>()

  // Re-sanitize old snapshot entries too. This makes source-level cleanup (for
  // example a company name that was historically stored as a tag) visible as
  // soon as any queue refresh touches the store, without waiting 14 days.
  for (const stored of existing) {
    const job = sanitizeFetchedJob(stored) as StoredJob
    byKey.set(dedupKey(job), job)
  }

  for (const job of jobs) {
    const enriched = enrichJob(sanitizeFetchedJob(job))
    const key = dedupKey(enriched)
    const previous = byKey.get(key)

    byKey.set(key, {
      ...enriched,
      lastSeen: nowIso,
      ...(previous?.ai ? { ai: previous.ai } : {}),
    })
  }

  const kept = prune([...byKey.values()], now)

  await store.set(
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
  try {
    await syncJobsDb(kept)
  } catch (error) {
    console.error(
      `[jobs:queue:${source}] PostgreSQL sync failed:`,
      (error as Error).message,
    )
  }

  return {
    source,
    fetched: jobs.length,
    stored: kept.length,
  }
}

// A source refresh outlives the request that started it: the route gives up
// after 150s, but the crawl keeps running, and the queue then retries the same
// source. Several full crawls of the same boards end up in flight at once,
// each holding its pages in memory — which is how this process reached a 4GB
// heap and was killed. One refresh per source at a time; a second caller
// waits for the first instead of starting another.
const inFlight = new Map<JobSource, Promise<unknown>>()

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

  if (inFlight.has(source)) {
    // Answer at once rather than holding the caller open behind a crawl it
    // will time out on anyway: the retry that follows would only add another
    // waiting request to the pile.
    console.log(`[jobs] ${source} refresh already running; skipping this request`)
    return { source, skipped: true, reason: 'already_running', fetched: 0 }
  }

  const started = runJobSourceRefresh(source)
  inFlight.set(source, started)
  try {
    return await started
  } finally {
    inFlight.delete(source)
  }
}

async function runJobSourceRefresh(source: JobSource) {
  const jobs = await fetchSource(source)

  // Fetching is parallel; mutation of the shared persistent store is serialized.
  const operation = mergeLock.then(
    () => mergeFetchedSource(source, jobs),
    () => mergeFetchedSource(source, jobs),
  )

  mergeLock = operation.catch(() => {})
  return await operation
}
