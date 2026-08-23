import { useStateStore } from '~~/server/utils/stateStore'

import type { CvProfile } from './hiringTypes'
import type { SourceRun } from './hiringDiagnostics'
import { hiringDbEnabled, loadDbCandidates, saveDbCandidates } from './hiringDb'
import { emptyWebCursor, loadWebCursors, saveWebCursor } from './hiringCursors'
import { normalizeCandidate } from './hiringNormalize'
import { withHiringStoreLock } from './hiringStoreLock'
import { cutoffDate } from '../../shared/hiring/webFields'
import { parseIshBorProfile } from '../../shared/hiring/ishBorProfile'
import { crawlIshBorPages } from '../../shared/hiring/sources/ishBorCrawler'
import { hiringIshBorSourceHandles, ISHBOR_SOURCE_KEY } from '../../shared/hiring/sources/ishBorSource'

const STORE_KEY = 'hiring:store:v4'
const STORE_TTL_SECONDS = 100 * 86_400

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }

async function fetchProfiles(cursor = emptyWebCursor(ISHBOR_SOURCE_KEY)) {
  return crawlIshBorPages(
    cursor,
    (summary, detailHtml) => parseIshBorProfile(summary, detailHtml, normalizeCandidate),
  )
}

async function persist(profiles: CvProfile[], diagnostic: SourceRun): Promise<number> {
  const stored = await withHiringStoreLock(async () => {
    const now = new Date().toISOString()
    let existing: StoredProfile[] = []
    try {
      const raw = await useStateStore().get(STORE_KEY)
      if (raw) existing = JSON.parse(raw) as StoredProfile[]
    } catch {
      // Postgres hydration below is the fallback.
    }
    if (!existing.length && hiringDbEnabled()) {
      existing = (await loadDbCandidates()).map((profile) => ({ ...profile, lastSeen: now }))
    }

    const byKey = new Map<string, StoredProfile>()
    for (const profile of existing) byKey.set(profile.url || profile.id, profile)
    for (const profile of profiles) byKey.set(profile.url || profile.id, { ...profile, lastSeen: now })

    const oldest = cutoffDate().getTime()
    const kept = [...byKey.values()].filter((profile) => {
      const time = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
      return Number.isFinite(time) && time >= oldest && time <= Date.now() + 48 * 60 * 60 * 1000
    })

    await useStateStore().set(STORE_KEY, JSON.stringify(kept), 'EX', STORE_TTL_SECONDS)
    return kept.length
  })
  if (hiringDbEnabled()) await saveDbCandidates(profiles, diagnostic)
  return stored
}

/** One crawl of the ish-bor board, without storing anything. For diagnostics. */
export async function crawlIshBorSource() {
  const cursor = (await loadWebCursors()).get(ISHBOR_SOURCE_KEY) || emptyWebCursor(ISHBOR_SOURCE_KEY)
  return fetchProfiles(cursor)
}

export { hiringIshBorSourceHandles }

export async function refreshHiringIshBorSource(
  handle: string,
): Promise<{ fetched: number; candidates: number; stored: number } | null> {
  if (!hiringIshBorSourceHandles().some((item) => item.toLowerCase() === handle.toLowerCase())) return null
  const checkedAt = new Date().toISOString()
  try {
    const cursor = (await loadWebCursors()).get(ISHBOR_SOURCE_KEY) || emptyWebCursor(ISHBOR_SOURCE_KEY)
    const result = await fetchProfiles(cursor)
    const diagnostic: SourceRun = {
      handle: `web:${ISHBOR_SOURCE_KEY}`,
      country: 'UZ',
      status: result.profiles.length ? 'ok' : 'empty',
      fetched: result.fetched,
      candidates: result.profiles.length,
      checkedAt,
    }
    const stored = await persist(result.profiles, diagnostic)
    await saveWebCursor(result.cursor)
    console.log(`[hiring:web] ${ISHBOR_SOURCE_KEY} fetched=${result.fetched} candidates=${result.profiles.length} store=${stored}`)
    return { fetched: result.fetched, candidates: result.profiles.length, stored }
  } catch (error) {
    const diagnostic: SourceRun = {
      handle: `web:${ISHBOR_SOURCE_KEY}`,
      country: 'UZ',
      status: 'error',
      fetched: 0,
      candidates: 0,
      checkedAt,
      error: (error as Error).message,
    }
    if (hiringDbEnabled()) await saveDbCandidates([], diagnostic)
    throw error
  }
}
