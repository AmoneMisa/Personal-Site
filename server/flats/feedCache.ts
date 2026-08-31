import { BoundedTtlCache } from '../utils/boundedTtlCache'

export const FEED_FRESH_MS = 30_000
export const FEED_STALE_MS = 60 * 60_000
export const EMPTY_STALE_MS = 60_000
export const UPSTREAM_TIMEOUT_MS = 25_000
export const STATS_UPSTREAM_TIMEOUT_MS = 55_000
export const PUBLIC_ID_CACHE_TTL_MS = FEED_FRESH_MS

const FEED_CACHE_MAX_ENTRIES = 750
const PUBLIC_ID_CACHE_MAX_ENTRIES = 1_000
const MAX_INFLIGHT_REFRESHES = 64

type FeedCacheEntry = { at: number; data: any }

const feedCache = new BoundedTtlCache<string, FeedCacheEntry>({
  maxEntries: FEED_CACHE_MAX_ENTRIES,
  defaultTtlMs: FEED_STALE_MS,
})
const feedRefreshes = new Map<string, Promise<any>>()
const publicIdCache = new BoundedTtlCache<string, any>({
  maxEntries: PUBLIC_ID_CACHE_MAX_ENTRIES,
  defaultTtlMs: PUBLIC_ID_CACHE_TTL_MS,
})

export function staleWindow(entry: { data: any } | undefined): number {
  const listings = entry?.data?.listings
  return Array.isArray(listings) && listings.length && !entry?.data?.warming
    ? FEED_STALE_MS
    : EMPTY_STALE_MS
}

export function normalizedSearchKey(params: URLSearchParams): string {
  const entries = [...params.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    const keyOrder = keyA.localeCompare(keyB)
    return keyOrder || valueA.localeCompare(valueB)
  })
  return new URLSearchParams(entries).toString()
}

export function getCachedFeed(key: string): FeedCacheEntry | undefined {
  return feedCache.get(key)
}

export function cachedFeedValues(now = Date.now()): FeedCacheEntry[] {
  return [...feedCache.values(now)]
}

export function refreshFeed(key: string, url: string): Promise<any> {
  const current = feedRefreshes.get(key)
  if (current) return current
  if (feedRefreshes.size >= MAX_INFLIGHT_REFRESHES) {
    return Promise.reject(new Error('Flat feed refresh capacity reached'))
  }

  const statsOnly = /(?:[?&])statsOnly=(?:1|true)(?:&|$)/u.test(url)
  const request = $fetch<any>(url, {
    timeout: statsOnly ? STATS_UPSTREAM_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS,
  })
    .then((data) => {
      const at = data?.warming ? Date.now() - FEED_FRESH_MS : Date.now()
      const entry = { at, data }
      feedCache.set(key, entry, staleWindow(entry))
      return data
    })
    .finally(() => feedRefreshes.delete(key))

  feedRefreshes.set(key, request)
  return request
}

export function getCachedPublicId(publicId: string): any | undefined {
  return publicIdCache.get(publicId)
}

export function cachePublicId(publicId: string, data: any): void {
  publicIdCache.set(publicId, data)
}
