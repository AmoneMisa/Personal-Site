import { useStateStore } from './stateStore'
import { hiringDbEnabled, loadDbCandidates } from './hiringDb'
import type { CvProfile } from './hiringTypes'

const STORE_KEY = 'hiring:store:v4'
const MEMORY_TTL_MS = 60_000

// Keep in sync with the derivation version stamped by hiringStore. The Nuxt API
// only reads this marker; the worker owns normalization/repair and writes it.
export const DERIVED_VERSION = 'd18'

type StoredProfile = CvProfile & {
  lastSeen?: string
  ai?: unknown
  visible?: boolean
  derived?: string
}

let memoryStore: CvProfile[] = []
let memoryValidUntil = 0

function publicProfiles(list: StoredProfile[]): CvProfile[] {
  return list
    .filter((profile) => profile.visible !== false)
    .map(({ lastSeen: _lastSeen, ai: _ai, visible: _visible, ...profile }) => profile)
}

/**
 * Read-only candidate snapshot used by the Nuxt jobs/hiring API.
 *
 * No Telegram/web source adapters, AI scheduling, write locks or refresh logic
 * are imported here. If the file snapshot is cold, Postgres is used strictly as
 * a read fallback; only jobs-worker writes the hot snapshot.
 */
export async function getStoredCvProfilesSnapshot(): Promise<CvProfile[]> {
  if (Date.now() < memoryValidUntil) return memoryStore

  try {
    const raw = await useStateStore().get(STORE_KEY)
    if (raw) {
      memoryStore = publicProfiles(JSON.parse(raw) as StoredProfile[])
      memoryValidUntil = Date.now() + MEMORY_TTL_MS
      return memoryStore
    }
  } catch (error) {
    console.warn('[hiring:snapshot] persistent snapshot read failed:', (error as Error).message)
  }

  if (hiringDbEnabled()) {
    try {
      memoryStore = await loadDbCandidates()
      memoryValidUntil = Date.now() + MEMORY_TTL_MS
      return memoryStore
    } catch (error) {
      console.warn('[hiring:snapshot] postgres fallback failed:', (error as Error).message)
    }
  }

  return memoryStore
}
