// Redis-backed store for candidate CV/resume profiles. Refreshed by
// server/tasks/hiring/refresh.ts on a schedule and on cold boot.

import { useRedis } from '~~/server/utils/redis'
import {
  fetchHiringChannel,
  fetchHiringSource,
  getHiringSourceDiagnostics,
  isHiringSourceConfigured,
  isLikelyCvPost,
} from './hiringSources'
import {
  hiringDbEnabled,
  loadDbCandidates,
  pruneDbCandidates,
  saveDbCandidates,
} from './hiringDb'
import { normalizeCandidate } from './hiringNormalize'
import { isCharityAppeal, isRecruitingOpportunity, repairCandidateProfile } from './hiringQuality'
import { HIRING_SOURCES, type CandidateEmploymentType, type CvProfile, type HiringSource } from './hiringTypes'
import {
  aiFingerprint,
  aiWorkerEnabled,
  scheduleAiExtraction,
  type AiExtractionResult,
} from './aiWorker'

const STORE_KEY = 'hiring:store:v4'
const STORE_TTL_SECONDS = 100 * 86_400
const MEMORY_TTL_MS = 5 * 60_000
const MAX_AGE_MONTHS = 3
const SOURCE_TIMEOUT_MS = 600_000
const AI_MIN_CONFIDENCE = 0.7
const AI_CANDIDATE_PARSER_VERSION = 'candidate-semantic-v2'
const AI_FAILED_RETRY_MS = 15 * 60_000
const AI_PENDING_STALE_MS = 30 * 60_000
// A refresh that fails at the transport level (worker down, Telegram
// unreachable) stores nothing, so the board would stay empty until the next
// scheduled run. Such an attempt is retried from the feed with backoff, while
// sources that answered with no candidates are never retried: that is a
// legitimately empty result, not an outage.
const COLD_RETRY_MIN_MS = 60_000
const COLD_RETRY_MAX_MS = 15 * 60_000
// Postgres is only consulted when Redis has nothing; this stops a permanently
// empty database from being re-queried on every single request.
const DB_HYDRATE_COOLDOWN_MS = 60_000

type CandidateAiData = {
  name?: string | null
  professions?: string[]
  previousProfessions?: string[]
  skills?: string[]
  features?: string[]
  age?: number | null
  isAdult?: boolean | null
  salaryMin?: number | null
  salaryMax?: number | null
  currency?: string | null
  country?: string | null
  city?: string | null
  district?: string | null
  remote?: boolean | null
  relocationReady?: boolean | null
  employmentTypes?: CandidateEmploymentType[]
  experienceYears?: number | null
  education?: string | null
  languages?: string[]
  contacts?: { telegram?: string | null; email?: string | null; phone?: string | null }
}

type StoredAi = {
  fingerprint: string
  status: 'pending' | 'completed' | 'low_confidence' | 'failed'
  confidence?: number
  data?: CandidateAiData
  updatedAt: string
}

type StoredProfile = CvProfile & { lastSeen: string; ai?: StoredAi }

let memoryStore: StoredProfile[] = []
let memoryValidUntil = 0
let refreshAttempted = false
let refreshEndedAt = 0
let failedRefreshStreak = 0
let dbHydratedAt = 0
let refreshInFlight: Promise<{ fetched: number; stored: number }> | undefined

function dedupKey(profile: CvProfile): string {
  return profile.url || profile.id
}

function repaired(profile: CvProfile): CvProfile {
  return repairCandidateProfile(normalizeCandidate(profile))
}

/** The channel a profile came from, read back off its canonical t.me link. */
function channelHandle(profile: CvProfile): string {
  return /^https?:\/\/t\.me\/([^/]+)/i.exec(profile.url || '')?.[1]?.toLowerCase() || ''
}

/**
 * Refills the store from Postgres when Redis is cold. Candidates keep their
 * original createdAt (that is what the age prune judges); lastSeen is stamped
 * now because Postgres already dropped anything outside the retention window.
 */
async function hydrateFromDb(): Promise<StoredProfile[]> {
  if (!hiringDbEnabled() || Date.now() - dbHydratedAt < DB_HYDRATE_COOLDOWN_MS) return []
  dbHydratedAt = Date.now()
  const profiles = await loadDbCandidates()
  if (!profiles.length) return []
  const nowIso = new Date().toISOString()
  const restored = profiles.map((profile) => ({ ...profile, lastSeen: nowIso }))
  console.log(`[hiring:db] hydrated ${restored.length} candidates from postgres`)
  await persistStore(restored)
  return restored
}

/**
 * Mirrors the refreshed store into Postgres, one call per channel so each
 * channel's run — including "checked, found nothing" and "errored" — lands in
 * hiring_source_runs next to its candidates.
 */
async function syncDb(kept: StoredProfile[]) {
  if (!hiringDbEnabled()) return
  const byHandle = new Map<string, CvProfile[]>()
  for (const profile of kept) {
    const handle = channelHandle(profile)
    if (!handle) continue
    const bucket = byHandle.get(handle)
    if (bucket) bucket.push(profile)
    else byHandle.set(handle, [profile])
  }

  let saved = 0
  for (const diagnostic of getHiringSourceDiagnostics()) {
    saved += await saveDbCandidates(byHandle.get(diagnostic.handle.toLowerCase()) || [], diagnostic)
  }
  const pruned = await pruneDbCandidates()
  console.log(`[hiring:db] upserted ${saved} candidates, pruned ${pruned}`)
}

function isVisible(profile: StoredProfile): boolean {
  const text = `${profile.name || ''}\n${profile.role || ''}\n${profile.originalText || profile.description || ''}`
  if (isRecruitingOpportunity(text) || isCharityAppeal(text)) return false
  return isLikelyCvPost(text, true)
}

function publicProfiles(list: StoredProfile[]): CvProfile[] {
  return list
    .filter(isVisible)
    .map(({ lastSeen: _lastSeen, ai: _ai, ...profile }) => repaired(profile))
}

function candidateAiInput(profile: CvProfile) {
  const normalized = repaired(profile)
  const rawText = normalized.originalText || normalized.description || ''

  // Only deterministic hard facts are authoritative for the model. Parser
  // guesses such as source-country, remote=false-by-absence, role and generic
  // experience must stay out of knownFacts so the semantic model can correct
  // them from the original multilingual text.
  const knownFacts: Record<string, unknown> = {
    name: normalized.name || null,
    age: normalized.age ?? null,
    isAdult: normalized.age == null ? null : normalized.isAdult ?? null,
    contacts: normalized.contacts || {},
  }
  const fingerprintFacts = {
    parserVersion: AI_CANDIDATE_PARSER_VERSION,
    ...knownFacts,
  }
  return {
    rawText,
    knownFacts,
    fingerprint: aiFingerprint('candidate', rawText, fingerprintFacts),
  }
}

function uniqueStrings(...lists: Array<string[] | undefined>): string[] {
  return [...new Set(lists.flatMap((items) => items || []).map((item) => item.trim()).filter(Boolean))]
}

function hasAiField(data: CandidateAiData, field: keyof CandidateAiData): boolean {
  return Object.prototype.hasOwnProperty.call(data, field)
}

function mergeCandidateAi(profile: CvProfile, data: CandidateAiData): CvProfile {
  const merged: CvProfile = { ...profile }

  // Name/age/contacts are hard deterministic facts when present. Semantic fields
  // below are intentionally allowed to correct an earlier regex/source guess.
  if (!merged.name && data.name?.trim()) merged.name = data.name.trim()

  if (data.professions?.length) {
    merged.professions = uniqueStrings(data.professions)
    merged.role = merged.professions[0] || merged.role
  } else {
    merged.professions = uniqueStrings(merged.professions)
  }
  if (Array.isArray(data.previousProfessions)) merged.previousProfessions = uniqueStrings(data.previousProfessions)

  // Keep deterministic skills/features as a safety net, while letting AI add
  // canonical spellings such as Talwindcss -> Tailwind.
  merged.skills = uniqueStrings(merged.skills, data.skills)
  merged.features = uniqueStrings(merged.features, data.features)
  merged.languages = uniqueStrings(merged.languages, data.languages)

  if (Array.isArray(data.employmentTypes)) {
    merged.employmentTypes = [...new Set(data.employmentTypes)]
  }

  if (merged.age == null && data.age != null) merged.age = data.age
  merged.isAdult = merged.age == null ? true : merged.age >= 18

  // Overall experience means experience relevant to CURRENT desired roles. AI
  // may therefore correctly clear a regex value that came from an unrelated
  // previous job (e.g. one year tutoring while seeking Backend Developer).
  if (hasAiField(data, 'experienceYears')) merged.experienceYears = data.experienceYears ?? null

  // AI understands open salary ranges: 300$+ => min=300, max=null.
  if (hasAiField(data, 'salaryMin')) merged.salaryMin = data.salaryMin ?? null
  if (hasAiField(data, 'salaryMax')) merged.salaryMax = data.salaryMax ?? null
  if (hasAiField(data, 'currency')) merged.currency = data.currency?.trim().toUpperCase() || null

  // Source/channel geography is not candidate geography. A confident semantic
  // result may replace it (e.g. a candidate posted in UA channel but located in Canada).
  if (data.country?.trim()) merged.country = data.country.trim()
  if (hasAiField(data, 'city')) merged.city = data.city?.trim() || null
  if (hasAiField(data, 'district')) merged.district = data.district?.trim() || null

  // null is meaningful: it means "not stated" and must be able to replace the
  // old parser's false-by-absence value.
  if (hasAiField(data, 'remote')) merged.remote = data.remote ?? null
  if (hasAiField(data, 'relocationReady')) merged.relocationReady = data.relocationReady ?? null

  if (data.education?.trim()) merged.education = data.education.trim()

  const contacts = { ...(merged.contacts || {}) }
  if (!contacts.telegram && data.contacts?.telegram) contacts.telegram = data.contacts.telegram
  if (!contacts.email && data.contacts?.email) contacts.email = data.contacts.email
  if (!contacts.phone && data.contacts?.phone) contacts.phone = data.contacts.phone
  merged.contacts = contacts
  merged.contact = merged.contact || contacts.telegram || contacts.email || contacts.phone || null

  return repaired(merged)
}

async function persistStore(list: StoredProfile[]) {
  memoryStore = list
  memoryValidUntil = Date.now() + MEMORY_TTL_MS
  try {
    await useRedis().set(STORE_KEY, JSON.stringify(list), 'EX', STORE_TTL_SECONDS)
  } catch (error) {
    console.error('[hiring] failed to persist store:', (error as Error).message)
  }
}

async function applyCandidateAiResult(
  key: string,
  fingerprint: string,
  result: AiExtractionResult<CandidateAiData>,
) {
  const index = memoryStore.findIndex((profile) => dedupKey(profile) === key)
  if (index < 0) return
  const current = memoryStore[index]!
  if (candidateAiInput(current).fingerprint !== fingerprint) return

  const accepted = !result.lowConfidence && result.confidence >= AI_MIN_CONFIDENCE
  memoryStore[index] = {
    ...(accepted ? mergeCandidateAi(current, result.data) : repaired(current)),
    lastSeen: current.lastSeen,
    ai: {
      fingerprint,
      status: accepted ? 'completed' : 'low_confidence',
      confidence: result.confidence,
      data: accepted ? result.data : undefined,
      updatedAt: new Date().toISOString(),
    },
  }
  await persistStore(memoryStore)
}

function scheduleCandidateAi(list: StoredProfile[]) {
  if (!aiWorkerEnabled()) return
  const batchSize = Math.max(1, Number(process.env.AI_WORKER_CANDIDATE_BATCH) || 24)
  let scheduled = 0
  const newestFirst = [...list].sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))

  for (const profile of newestFirst) {
    if (scheduled >= batchSize) break
    if (!isVisible(profile)) continue
    const input = candidateAiInput(profile)
    if (!input.rawText.trim()) continue

    if (profile.ai?.fingerprint === input.fingerprint) {
      const ageMs = Date.now() - Date.parse(profile.ai.updatedAt || '')
      if (profile.ai.status === 'completed' || profile.ai.status === 'low_confidence') continue
      if (profile.ai.status === 'pending' && Number.isFinite(ageMs) && ageMs < AI_PENDING_STALE_MS) continue
      if (profile.ai.status === 'failed' && Number.isFinite(ageMs) && ageMs < AI_FAILED_RETRY_MS) continue
    }

    const key = dedupKey(profile)
    const queued = scheduleAiExtraction<CandidateAiData>({
      id: key,
      kind: 'candidate',
      ...input,
      meta: { source: profile.source, sourceCountry: profile.country, id: profile.id, url: profile.url },
      onResult: (result) => applyCandidateAiResult(key, input.fingerprint, result),
      onFailed: async (status) => {
        if (status !== 'failed') return
        const current = memoryStore.find((item) => dedupKey(item) === key)
        if (!current || candidateAiInput(current).fingerprint !== input.fingerprint) return
        current.ai = { fingerprint: input.fingerprint, status: 'failed', updatedAt: new Date().toISOString() }
        await persistStore(memoryStore)
      },
    })

    if (queued) {
      profile.ai = { fingerprint: input.fingerprint, status: 'pending', updatedAt: new Date().toISOString() }
      scheduled += 1
    }
  }

  if (scheduled) console.log(`[hiring:ai] queued ${scheduled} candidate profiles`)
}

async function fetchSource(source: HiringSource): Promise<CvProfile[]> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fetchHiringSource(source, ''),
      new Promise<CvProfile[]>((_, reject) => {
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

export async function getStoredCvProfiles(): Promise<CvProfile[]> {
  if (memoryStore.length && Date.now() < memoryValidUntil) return publicProfiles(memoryStore)
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (raw) {
      const list = JSON.parse(raw) as StoredProfile[]
      memoryStore = list
      memoryValidUntil = Date.now() + MEMORY_TTL_MS
      return publicProfiles(list)
    }
  } catch {
    // Redis unavailable — Postgres below is the next best source.
  }
  if (memoryStore.length) return publicProfiles(memoryStore)
  return publicProfiles(await hydrateFromDb())
}

/** @deprecated use getStoredCvProfiles */
export const getStoredHiringPosts = getStoredCvProfiles

async function loadStored(): Promise<StoredProfile[]> {
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (raw) return JSON.parse(raw) as StoredProfile[]
  } catch {
    // Fall through to memory/Postgres.
  }
  if (memoryStore.length) return memoryStore
  return hydrateFromDb()
}

function pruneStore(byKey: Map<string, StoredProfile>, now: number): StoredProfile[] {
  const nowDate = new Date(now)
  const oldestPosted = new Date(nowDate)
  oldestPosted.setUTCMonth(oldestPosted.getUTCMonth() - MAX_AGE_MONTHS)
  const kept: StoredProfile[] = []

  for (const rawProfile of byKey.values()) {
    if (!isVisible(rawProfile)) continue
    const profile = repaired(rawProfile)
    const posted = profile.createdAt ? new Date(profile.createdAt).getTime() : Number.NaN
    if (Number.isNaN(posted) || posted < oldestPosted.getTime() || posted > now + 48 * 60 * 60 * 1000) continue
    // Telegram candidate retention is based on publication time. `lastSeen` is
    // crawl bookkeeping only; dropping a two-month-old CV because a high-volume
    // channel did not resurface it during the last 14 days violated the product
    // requirement and made the board steadily shrink.
    kept.push({ ...profile, lastSeen: rawProfile.lastSeen, ai: rawProfile.ai })
  }
  return kept
}

function coldRetryDelay(): number {
  return Math.min(COLD_RETRY_MAX_MS, COLD_RETRY_MIN_MS * 2 ** Math.max(0, failedRefreshStreak - 1))
}

/** Records whether the store stayed empty because no source could be reached. */
function noteRefreshOutcome(transportFailed: boolean) {
  failedRefreshStreak = transportFailed ? failedRefreshStreak + 1 : 0
  if (!transportFailed) return
  console.warn(
    `[hiring] refresh #${failedRefreshStreak} reached no source and stored nothing; ` +
    `retrying in ${Math.round(coldRetryDelay() / 1000)}s`,
  )
}

/** True when at least one source/channel answered, however few candidates it had. */
function sourcesAnswered(activeSources: HiringSource[]): boolean {
  if (!activeSources.length) return true
  return getHiringSourceDiagnostics().some((item) => item.status !== 'error')
}

export async function refreshHiringStore(): Promise<{ fetched: number; stored: number }> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = performRefresh()
    .catch((error) => {
      noteRefreshOutcome(true)
      throw error
    })
    .finally(() => {
      refreshAttempted = true
      refreshEndedAt = Date.now()
      refreshInFlight = undefined
    })
  return refreshInFlight
}

async function performRefresh(): Promise<{ fetched: number; stored: number }> {
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const existing = await loadStored()
  const byKey = new Map<string, StoredProfile>()
  for (const profile of existing) byKey.set(dedupKey(profile), profile)

  const activeSources = HIRING_SOURCES.filter(isHiringSourceConfigured)
  let fetched = 0
  let sourceFailures = 0
  for (const source of activeSources) {
    try {
      const batch = await fetchSource(source)
      fetched += batch.length
      for (const rawProfile of batch) {
        const profile = repaired(rawProfile)
        if (isRecruitingOpportunity(profile.originalText || profile.description || '')) continue
        const key = dedupKey(profile)
        const previous = byKey.get(key)
        const input = candidateAiInput(profile)
        const reusableAi = previous?.ai?.fingerprint === input.fingerprint ? previous.ai : undefined
        const withAi = reusableAi?.status === 'completed' && reusableAi.data
          ? mergeCandidateAi(profile, reusableAi.data)
          : profile
        byKey.set(key, { ...withAi, lastSeen: nowIso, ai: reusableAi })
      }
    } catch (error) {
      sourceFailures += 1
      console.error(`[hiring] source "${source}" failed:`, (error as Error).message)
    }
  }

  const kept = pruneStore(byKey, now)
  await persistStore(kept)
  scheduleCandidateAi(kept)
  await syncDb(kept)
  noteRefreshOutcome(kept.length === 0 && (sourceFailures > 0 || !sourcesAnswered(activeSources)))
  return { fetched, stored: kept.length }
}

/**
 * Refreshes one channel and folds it into the store. This is the unit of work
 * the RabbitMQ tasks carry: a channel that times out is retried on its own,
 * instead of a whole-source refresh failing and taking the good channels with
 * it. Returns null when the handle is not configured.
 */
export async function refreshHiringChannel(handle: string): Promise<{ fetched: number; stored: number } | null> {
  const outcome = await fetchHiringChannel(handle)
  if (!outcome) return null

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const byKey = new Map<string, StoredProfile>()
  for (const profile of await loadStored()) byKey.set(dedupKey(profile), profile)

  for (const rawProfile of outcome.result.profiles) {
    const profile = repaired(rawProfile)
    if (isRecruitingOpportunity(profile.originalText || profile.description || '')) continue
    const key = dedupKey(profile)
    const previous = byKey.get(key)
    const input = candidateAiInput(profile)
    const reusableAi = previous?.ai?.fingerprint === input.fingerprint ? previous.ai : undefined
    const withAi = reusableAi?.status === 'completed' && reusableAi.data
      ? mergeCandidateAi(profile, reusableAi.data)
      : profile
    byKey.set(key, { ...withAi, lastSeen: nowIso, ai: reusableAi })
  }

  const kept = pruneStore(byKey, now)
  await persistStore(kept)
  scheduleCandidateAi(kept)

  if (hiringDbEnabled()) {
    await saveDbCandidates(
      kept.filter((profile) => channelHandle(profile) === outcome.diagnostic.handle.toLowerCase()),
      outcome.diagnostic,
    )
  }

  // A channel that answered proves the transport works, so the whole-store
  // backoff must not keep treating the board as mid-outage.
  if (outcome.diagnostic.status !== 'error') {
    refreshAttempted = true
    refreshEndedAt = Date.now()
    failedRefreshStreak = 0
  }

  return { fetched: outcome.diagnostic.fetched, stored: kept.length }
}

export function isHiringStoreCold(): boolean {
  if (memoryStore.length) return false
  if (!refreshAttempted) return true
  // Only outages are retried, and never more often than the backoff allows.
  if (!failedRefreshStreak) return false
  return Date.now() - refreshEndedAt >= coldRetryDelay()
}
