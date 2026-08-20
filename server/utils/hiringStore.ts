// Redis-backed store for candidate CV/resume profiles. Refreshed by
// server/tasks/hiring/refresh.ts on a schedule and on cold boot.

import { useRedis } from '~~/server/utils/redis'
import {
  fetchHiringSource,
  isHiringSourceConfigured,
  isLikelyCvPost,
} from './hiringSources'
import { HIRING_SOURCES, type CvProfile, type HiringSource } from './hiringTypes'

const STORE_KEY = 'hiring:store:v3'
const STORE_TTL_SECONDS = 100 * 86_400
const MEMORY_TTL_MS = 5 * 60_000
const MAX_AGE_MONTHS = 3
const STALE_DAYS = 14
const SOURCE_TIMEOUT_MS = 120_000

type StoredProfile = CvProfile & { lastSeen: string }

let memoryStore: StoredProfile[] = []
let memoryValidUntil = 0
let refreshAttempted = false
let refreshInFlight: Promise<{ fetched: number; stored: number }> | undefined

function dedupKey(profile: CvProfile): string {
  return profile.url || profile.id
}

function isVisible(profile: StoredProfile): boolean {
  return isLikelyCvPost(`${profile.name || ''}\n${profile.role || ''}\n${profile.originalText || profile.description || ''}`, true)
}

function publicProfiles(list: StoredProfile[]): CvProfile[] {
  return list.filter(isVisible).map(({ lastSeen: _lastSeen, ...profile }) => profile)
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
    if (!raw) return publicProfiles(memoryStore)
    const list = JSON.parse(raw) as StoredProfile[]
    memoryStore = list
    memoryValidUntil = Date.now() + MEMORY_TTL_MS
    return publicProfiles(list)
  } catch {
    return publicProfiles(memoryStore)
  }
}

/** @deprecated use getStoredCvProfiles */
export const getStoredHiringPosts = getStoredCvProfiles

async function loadStored(): Promise<StoredProfile[]> {
  try {
    const raw = await useRedis().get(STORE_KEY)
    return raw ? (JSON.parse(raw) as StoredProfile[]) : memoryStore
  } catch {
    return memoryStore
  }
}

function pruneStore(byKey: Map<string, StoredProfile>, now: number): StoredProfile[] {
  const nowDate = new Date(now)
  const oldestPosted = new Date(nowDate)
  oldestPosted.setUTCMonth(oldestPosted.getUTCMonth() - MAX_AGE_MONTHS)
  const stalest = now - STALE_DAYS * 86_400_000
  const kept: StoredProfile[] = []

  for (const profile of byKey.values()) {
    if (!isVisible(profile)) continue
    const posted = profile.createdAt ? new Date(profile.createdAt).getTime() : Number.NaN
    const seen = new Date(profile.lastSeen).getTime()
    // Posts without a trustworthy source timestamp are not allowed onto the
    // board: recency is a hard product requirement, not an inferred value.
    if (Number.isNaN(posted) || posted < oldestPosted.getTime() || posted > now + 48 * 60 * 60 * 1000) continue
    if (Number.isNaN(seen) || seen < stalest) continue
    kept.push(profile)
  }
  return kept
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

export async function refreshHiringStore(): Promise<{ fetched: number; stored: number }> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = performRefresh().finally(() => {
    refreshAttempted = true
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
  for (const source of activeSources) {
    try {
      const batch = await fetchSource(source)
      fetched += batch.length
      for (const profile of batch) byKey.set(dedupKey(profile), { ...profile, lastSeen: nowIso })
    } catch (error) {
      console.error(`[hiring] source "${source}" failed:`, (error as Error).message)
    }
  }

  const kept = pruneStore(byKey, now)
  await persistStore(kept)
  return { fetched, stored: kept.length }
}

export function isHiringStoreCold(): boolean {
  return memoryStore.length === 0 && !refreshAttempted
}
