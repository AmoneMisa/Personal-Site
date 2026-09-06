import { FLAT_API_URL } from '../flats/feedLookup'
import { normalizedSearchKey } from '../flats/feedCache'
import { CURRENT_ALL_SOURCE_TOKENS } from '../flats/feedListingShape'
import { BoundedTtlCache } from '../utils/boundedTtlCache'

const MAP_TIMEOUT_MS = 55_000
const MAP_CACHE_MS = 30_000
const MAP_STALE_MS = 120_000
const MAX_PENDING = 16
const cache = new BoundedTtlCache<string, { at: number; data: any }>({
  maxEntries: 64,
  defaultTtlMs: MAP_STALE_MS,
})
const pending = new Map<string, Promise<any>>()

function normalizeUpstreamParams(incoming: URL): URLSearchParams {
  const params = new URLSearchParams(incoming.searchParams)
  params.set('mapOnly', '1')
  params.delete('includeStats')
  params.delete('statsOnly')
  params.delete('offset')
  params.delete('cursor')
  params.delete('limit')

  const rawSources = [...new Set((params.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter((source) => CURRENT_ALL_SOURCE_TOKENS.includes(source as typeof CURRENT_ALL_SOURCE_TOKENS[number])))].sort()
  const legacyAllSources = rawSources.length === 2
    && rawSources.includes('olx')
    && rawSources.includes('telegram')
  const currentAllSources = CURRENT_ALL_SOURCE_TOKENS.every((source) => rawSources.includes(source))
  if (legacyAllSources || currentAllSources || !rawSources.length) params.delete('sources')
  else if (rawSources.length) params.set('sources', rawSources.join(','))

  // Do not canonicalize geography here. The backend owns aliases, canonical
  // station identity, radius/arc membership and map/list consistency.
  return params
}

function loadMap(key: string, url: string): Promise<any> {
  const current = pending.get(key)
  if (current) return current
  if (pending.size >= MAX_PENDING) return Promise.reject(new Error('Map refresh capacity reached'))
  const request = $fetch<any>(url, { timeout: MAP_TIMEOUT_MS, retry: 0 })
    .then((data) => {
      cache.set(key, { at: Date.now(), data })
      return data
    })
    .finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}

export default defineEventHandler(async (event) => {
  const params = normalizeUpstreamParams(getRequestURL(event))
  const key = normalizedSearchKey(params)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < MAP_CACHE_MS) return cached.data

  const url = `${FLAT_API_URL}/api/listings?${params}`
  try {
    return await loadMap(key, url)
  } catch (error: any) {
    setHeader(event, 'Cache-Control', 'no-store')
    // Recheck expiry after the request: it may have taken almost a minute.
    const fallback = cache.get(key)
    if (fallback) return { ...fallback.data, stale: true }
    setResponseStatus(event, Number(error?.statusCode || error?.response?.status || 503))
    return {
      count: 0,
      mapPoints: [],
      mapPointsTruncated: false,
      error: 'Map feed temporarily unavailable',
    }
  }
})
