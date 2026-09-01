import { useStateStore } from '~~/server/utils/stateStore'
import { syncJobsDb } from '../jobs/infrastructure/database'
import {
  configuredCommunityJobBoardTargets,
  fetchCommunityJobBoardTarget,
  isCommunityJobBoardTarget,
} from './communityJobBoardSources'
import { enrichJob } from './enrich'
import {
  configuredFlagmaJobBoardTargets,
  fetchFlagmaJobBoardTarget,
  isFlagmaJobBoardTarget,
} from './flagmaJobSource'
import { isJobSourceAvailable } from './jobSourceConfig'
import { fetchJobSource } from './jobSourceFetchers'
import { syncJobsSearchIndex } from './jobsElastic'
import { ALL_SOURCES, type Job, type JobSource } from './jobTypes'
import { isLikelyTelegramVacancy } from './sources'

const STORE_KEY = 'jobs:store:v4'
const STORE_TTL_SECONDS = 15 * 86_400
const MAX_AGE_DAYS = 14
const STALE_DAYS = 4

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

let mergeLock: Promise<unknown> = Promise.resolve()

export function configuredJobSources(): JobSource[] {
  return ALL_SOURCES.filter((source) => isJobSourceAvailable(source, 'ingestion'))
}

/**
 * Queue targets are intentionally more granular than the public JobSource enum.
 * Registry-style vacancy boards are individual targets so the durable queue and
 * shared crawler own pacing/retries instead of a source adapter launching its
 * own fan-out inside the broad `companies` source.
 */
export function configuredJobRefreshTargets(): string[] {
  const sources = configuredJobSources()
  if (!sources.includes('companies')) return sources
  return [
    ...sources,
    ...configuredCommunityJobBoardTargets(),
    ...configuredFlagmaJobBoardTargets(),
  ]
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
    // Source detail checks may return a closed-vacancy tombstone. Remove the
    // previously stored row immediately; do not wait for the generic stale TTL.
    if (job.vacancyStatus === 'closed' || job.hiringKind === 'closed_vacancy') {
      byKey.delete(dedupKey(job))
      continue
    }
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
// heap and was killed. One refresh per queue target at a time; a second caller
// waits for the first instead of starting another.
const inFlight = new Map<string, Promise<unknown>>()

function isKnownJobSource(value: string): value is JobSource {
  return ALL_SOURCES.includes(value as JobSource)
}

async function mergeForTarget(target: string, source: JobSource, jobs: Job[]) {
  const operation = mergeLock.then(
    () => mergeFetchedSource(source, jobs),
    () => mergeFetchedSource(source, jobs),
  )
  mergeLock = operation.catch(() => {})
  const result = await operation
  return { target, ...result }
}

async function runJobTargetRefresh(target: string) {
  if (isCommunityJobBoardTarget(target) || isFlagmaJobBoardTarget(target)) {
    if (!isJobSourceAvailable('companies', 'ingestion')) {
      return { target, source: 'companies' as const, skipped: true, reason: 'not_configured', fetched: 0 }
    }
    const jobs = isFlagmaJobBoardTarget(target)
      ? await fetchFlagmaJobBoardTarget(target)
      : await fetchCommunityJobBoardTarget(target)
    return mergeForTarget(target, 'companies', jobs)
  }

  if (!isKnownJobSource(target)) throw new Error(`Unknown job refresh target ${target}`)
  if (!isJobSourceAvailable(target, 'ingestion')) {
    return { target, source: target, skipped: true, reason: 'not_configured', fetched: 0 }
  }
  const jobs = await fetchJobSource(target)
  return mergeForTarget(target, target, jobs)
}

export async function refreshJobTarget(target: string) {
  if (
    !isCommunityJobBoardTarget(target)
    && !isFlagmaJobBoardTarget(target)
    && !isKnownJobSource(target)
  ) {
    throw new Error(`Unknown job refresh target ${target}`)
  }

  if (inFlight.has(target)) {
    console.log(`[jobs] ${target} refresh already running; skipping this request`)
    return { target, skipped: true, reason: 'already_running', fetched: 0 }
  }

  const started = runJobTargetRefresh(target)
  inFlight.set(target, started)
  try {
    return await started
  } finally {
    inFlight.delete(target)
  }
}

export async function refreshJobSource(source: JobSource) {
  return refreshJobTarget(source)
}
