import { useRedis } from '~~/server/utils/redis'
import { hiringDbEnabled, loadDbCandidates } from './hiringDb'
import type { CvProfile } from './hiringTypes'

const STORE_KEY = 'hiring:store:v4'
const MAX_AGE_MONTHS = 3
// The durable fallback below is a full candidate load. Until a web crawl has
// actually stored something, every request would repeat it — which is what
// made the board take seventeen seconds per request to serve nothing. A short
// cache keeps the recovery, and caches the empty answer too.
const FALLBACK_TTL_MS = 60_000
const FALLBACK_TIMEOUT_MS = 2_000

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }

function active(profile: CvProfile): boolean {
  if (profile.origin !== 'web') return false
  const activity = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
  if (!Number.isFinite(activity)) return false
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_AGE_MONTHS)
  return activity >= cutoff.getTime() && activity <= Date.now() + 48 * 60 * 60 * 1000
}

let fallbackProfiles: CvProfile[] = []
let fallbackAt = 0

/** A slow database must never hold up the page; the store read already has. */
async function withTimeout<T>(operation: Promise<T>, fallback: T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Web resume boards are already candidate-only sources, so they must not pass
 * through Telegram's message-intent classifier. Read their normalized records
 * directly from the shared durable store and apply only the product freshness
 * requirement here.
 */
export async function getStoredWebCvProfiles(): Promise<CvProfile[]> {
  let stored: StoredProfile[] = []
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (raw) stored = JSON.parse(raw) as StoredProfile[]
  } catch (error) {
    console.warn('[hiring:web] store read failed:', (error as Error).message)
  }

  let web = stored.filter(active)
  // A racing Telegram writer could previously leave a healthy Redis snapshot
  // containing only Telegram rows. Treat "no web rows" as a web-cache miss and
  // recover the durable board profiles instead of returning a false zero.
  if (!web.length && hiringDbEnabled()) {
    if (Date.now() - fallbackAt < FALLBACK_TTL_MS) {
      web = fallbackProfiles
    } else {
      web = (await withTimeout(loadDbCandidates(), [], FALLBACK_TIMEOUT_MS)).filter(active)
      fallbackProfiles = web
      fallbackAt = Date.now()
    }
  }
  return web.map(({ lastSeen: _lastSeen, ai: _ai, ...profile }) => profile)
}
