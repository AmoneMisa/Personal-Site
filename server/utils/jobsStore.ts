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
import { getSkillMeta } from '~~/shared/jobSkills'
import { toUsd } from './currency'
import { enrichJob, PER_YEAR } from './enrich'
import {
  aiFingerprint,
  aiWorkerEnabled,
  scheduleAiExtraction,
  type AiExtractionResult,
} from './aiWorker'
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

type VacancyAiData = {
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  salaryPeriod?: 'hour' | 'day' | 'week' | 'month' | 'year' | null
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'temporary' | 'internship' | 'freelance' | null
  workFormat?: 'office' | 'remote' | 'hybrid' | 'field' | null
  experienceMinYears?: number | null
  experienceMaxYears?: number | null
  skills?: string[]
  languages?: Array<{ language: string, level?: string | null, required?: boolean | null }>
  visaSponsorship?: boolean | null
  relocationSupport?: boolean | null
  foreignersAccepted?: boolean | null
}

type StoredAi = {
  fingerprint: string
  status: 'pending' | 'completed' | 'low_confidence' | 'failed'
  confidence?: number
  data?: VacancyAiData
  updatedAt: string
}

// Persisted shape carries lifecycle and private AI provenance. `publicJobs`
// strips both fields so internal worker state never becomes part of the API.
type StoredJob = Job & { lastSeen: string, ai?: StoredAi }
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

function isVisibleStoredJob(job: StoredJob): boolean {
  return job.source !== 'telegram'
    || isLikelyTelegramVacancy(`${job.title}\n${job.description || ''}`)
}

function publicJobs(list: StoredJob[]): Job[] {
  return list
    .filter(isVisibleStoredJob)
    .map(({ lastSeen: _lastSeen, ai: _ai, ...job }) => job)
}

function vacancyAiInput(job: Job) {
  const rawText = `${job.title}\n${job.company}\n${job.location}\n${job.description || ''}`.trim()
  const knownFacts: Record<string, unknown> = {
    title: job.title,
    company: job.company,
    location: job.location,
    salaryMin: job.salaryMin ?? null,
    salaryMax: job.salaryMax ?? null,
    currency: job.salaryCurrency ?? null,
    salaryPeriod: job.salaryPeriod ?? null,
    employmentType: job.employmentKind ?? job.employmentType ?? null,
    workFormat: job.workMode === 'unknown' ? null : job.workMode ?? null,
    experienceMinYears: job.experienceMinYears ?? null,
    skills: job.skills || [],
    languages: job.languages || [],
  }
  return {
    rawText,
    knownFacts,
    fingerprint: aiFingerprint('vacancy', rawText, knownFacts),
  }
}

function mergeVacancyAi(job: Job, data: VacancyAiData): Job {
  const merged: Job = { ...job }
  if ((merged.workMode == null || merged.workMode === 'unknown') && data.workFormat) {
    merged.workMode = data.workFormat === 'field' ? 'office' : data.workFormat
    merged.remote = merged.workMode === 'remote'
  }
  if ((merged.relocation == null || merged.relocation === 'unknown') && data.relocationSupport === true) {
    merged.relocation = 'offered'
  }
  if (!merged.foreignerFriendly && (data.foreignersAccepted === true || data.visaSponsorship === true)) {
    merged.foreignerFriendly = true
  }
  if (merged.experienceMinYears == null && data.experienceMinYears != null) {
    merged.experienceMinYears = data.experienceMinYears
    if (data.experienceMinYears === 0) merged.noExperience = true
  }
  if (merged.experienceMaxYears == null && data.experienceMaxYears != null) {
    merged.experienceMaxYears = data.experienceMaxYears
  }

  const employmentMap = {
    full_time: 'fulltime',
    part_time: 'parttime',
    contract: 'contract',
    freelance: 'contract',
    temporary: 'temporary',
    internship: 'internship',
  } as const
  if (!merged.employmentKind && data.employmentType) {
    merged.employmentKind = employmentMap[data.employmentType]
  }

  const skillNames = [...new Set([...(merged.skills || []), ...(data.skills || [])].map((item) => item.trim()).filter(Boolean))]
  if (skillNames.length) {
    merged.skills = skillNames
    const detailNames = new Set((merged.skillDetails || []).map(({ name }) => name))
    merged.skillDetails = [...(merged.skillDetails || [])]
    for (const name of skillNames) {
      if (detailNames.has(name)) continue
      const meta = getSkillMeta(name)
      if (meta) merged.skillDetails.push({ name, ...meta })
    }
  }

  const languages = [...(merged.languages || [])]
  const languageNames = new Set(languages.map(({ language }) => language.toLowerCase()))
  for (const item of data.languages || []) {
    if (!item.language || languageNames.has(item.language.toLowerCase())) continue
    languages.push({ language: item.language, level: item.level || undefined })
    languageNames.add(item.language.toLowerCase())
  }
  if (languages.length) merged.languages = languages

  if (merged.salaryMin == null && data.salaryMin != null) merged.salaryMin = data.salaryMin
  if (merged.salaryMax == null && data.salaryMax != null) merged.salaryMax = data.salaryMax
  if (!merged.salaryCurrency && data.currency) merged.salaryCurrency = data.currency.toUpperCase()
  if (!merged.salaryPeriod && data.salaryPeriod && ['hour', 'month', 'year'].includes(data.salaryPeriod)) {
    merged.salaryPeriod = data.salaryPeriod as Job['salaryPeriod']
  }
  if (!merged.salaryUsd && merged.salaryPeriod) {
    const lo = toUsd(merged.salaryMin, merged.salaryCurrency)
    const hi = toUsd(merged.salaryMax, merged.salaryCurrency)
    const midpoint = lo && hi ? (lo + hi) / 2 : lo || hi
    if (midpoint) merged.salaryUsd = Math.round(midpoint * PER_YEAR[merged.salaryPeriod])
  }
  return merged
}

function vacancyNeedsAi(job: Job): boolean {
  if ((job.description || '').length < 100) return false
  let score = 0
  if (!job.skills?.length) score += 3
  if (job.experienceMinYears == null) score += 2
  if (!job.languages?.length) score += 1
  if (!job.workMode || job.workMode === 'unknown') score += 1
  if (!job.employmentKind) score += 1
  return score >= 2
}

async function persistMemoryStore() {
  memoryValidUntil = Date.now() + MEMORY_TTL_MS
  try {
    await useRedis().set(STORE_KEY, JSON.stringify(memoryStore), 'EX', STORE_TTL_SECONDS)
  } catch (error) {
    console.error('[jobs:ai] failed to persist enrichment:', (error as Error).message)
  }
}

async function applyVacancyAiResult(
  key: string,
  fingerprint: string,
  result: AiExtractionResult<VacancyAiData>,
) {
  const index = memoryStore.findIndex((job) => dedupKey(job) === key)
  if (index < 0) return
  const current = memoryStore[index]!
  if (vacancyAiInput(current).fingerprint !== fingerprint) return
  const accepted = !result.lowConfidence && result.confidence >= 0.6
  memoryStore[index] = {
    ...(accepted ? mergeVacancyAi(current, result.data) : current),
    lastSeen: current.lastSeen,
    ai: {
      fingerprint,
      status: accepted ? 'completed' : 'low_confidence',
      confidence: result.confidence,
      data: accepted ? result.data : undefined,
      updatedAt: new Date().toISOString(),
    },
  }
  await persistMemoryStore()
}

function scheduleVacancyAi(list: StoredJob[]) {
  if (!aiWorkerEnabled()) return
  const batchSize = Math.max(1, Number(process.env.AI_WORKER_VACANCY_BATCH) || 10)
  let scheduled = 0
  const newestFirst = [...list].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
  for (const job of newestFirst) {
    if (scheduled >= batchSize) break
    if (!vacancyNeedsAi(job)) continue
    const input = vacancyAiInput(job)
    // Terminal metadata is only carried onto this fresh record when its
    // deterministic fingerprint matched. AI-filled fields can then change a
    // recomputed fingerprint, so presence here is the reliable skip signal.
    if (job.ai && job.ai.status !== 'pending') continue
    const key = dedupKey(job)
    const queued = scheduleAiExtraction<VacancyAiData>({
      id: key,
      kind: 'vacancy',
      ...input,
      meta: { source: job.source, country: job.country, id: job.id },
      onResult: (result) => applyVacancyAiResult(key, input.fingerprint, result),
      onFailed: async (status) => {
        if (status !== 'failed') return
        const current = memoryStore.find((item) => dedupKey(item) === key)
        if (!current || vacancyAiInput(current).fingerprint !== input.fingerprint) return
        current.ai = { fingerprint: input.fingerprint, status: 'failed', updatedAt: new Date().toISOString() }
        await persistMemoryStore()
      },
    })
    if (queued) {
      job.ai = { fingerprint: input.fingerprint, status: 'pending', updatedAt: new Date().toISOString() }
      scheduled += 1
    }
  }
  if (scheduled) console.log(`[jobs:ai] queued ${scheduled} ambiguous vacancies`)
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
    return publicJobs(memoryStore)
  }
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (!raw) {
      return publicJobs(memoryStore)
    }
    const list = JSON.parse(raw) as StoredJob[]
    memoryStore = list
    memoryValidUntil = Date.now() + MEMORY_TTL_MS
    return publicJobs(list)
  } catch {
    return publicJobs(memoryStore)
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
    if (!isVisibleStoredJob(job)) continue
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
        const key = dedupKey(enriched)
        const previous = byKey.get(key)
        const input = vacancyAiInput(enriched)
        const reusableAi = previous?.ai?.fingerprint === input.fingerprint ? previous.ai : undefined
        const withAi = reusableAi?.status === 'completed' && reusableAi.data
          ? mergeVacancyAi(enriched, reusableAi.data)
          : enriched
        byKey.set(key, { ...withAi, lastSeen: nowIso, ai: reusableAi })
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

  // Submission and polling happen in the background. Feed responses and the
  // scraper task never wait for Ollama, and deterministic fields stay usable.
  scheduleVacancyAi(kept)

  return { fetched, stored: kept.length, perSource }
}

export function refreshJobStore(): Promise<RefreshSummary> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = performJobStoreRefresh().finally(() => {
    refreshInFlight = undefined
  })
  return refreshInFlight
}
