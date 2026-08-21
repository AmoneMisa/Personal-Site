import { useRedis } from '~~/server/utils/redis'
import type { CvProfile } from './hiringTypes'

const STORE_KEY = 'hiring:store:v4'
const MAX_AGE_MONTHS = 3

type StoredProfile = CvProfile & { lastSeen?: string; ai?: unknown }

function active(profile: CvProfile): boolean {
  if (profile.origin !== 'web') return false
  const activity = Date.parse(profile.activityAt || profile.updatedAt || profile.createdAt || '')
  if (!Number.isFinite(activity)) return false
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_AGE_MONTHS)
  return activity >= cutoff.getTime() && activity <= Date.now() + 48 * 60 * 60 * 1000
}

/**
 * Web resume boards are already candidate-only sources, so they must not pass
 * through Telegram's message-intent classifier. Read their normalized records
 * directly from the shared durable store and apply only the product freshness
 * requirement here.
 */
export async function getStoredWebCvProfiles(): Promise<CvProfile[]> {
  try {
    const raw = await useRedis().get(STORE_KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as StoredProfile[]
    return stored
      .filter(active)
      .map(({ lastSeen: _lastSeen, ai: _ai, ...profile }) => profile)
  } catch (error) {
    console.warn('[hiring:web] store read failed:', (error as Error).message)
    return []
  }
}
