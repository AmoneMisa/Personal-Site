import { FLAT_API_URL } from '../flats/feedLookup'

const MAP_TIMEOUT_MS = 55_000
const MAP_CACHE_MS = 30_000
const ALL_FEED_SOURCES = ['olx', 'telegram', 'facebook', 'threads'] as const
const cache = new Map<string, { at: number; data: any }>()
const pending = new Map<string, Promise<any>>()

function normalizeUpstreamParams(incoming: URL): URLSearchParams {
  const params = new URLSearchParams(incoming.searchParams)
  params.set('mapOnly', '1')
  params.delete('includeStats')
  params.delete('statsOnly')
  params.delete('offset')
  params.delete('cursor')
  params.delete('limit')

  const rawSources = (params.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter((source) => ALL_FEED_SOURCES.includes(source as typeof ALL_FEED_SOURCES[number]))
  const legacyAllSources = rawSources.length === 2
    && rawSources.includes('olx')
    && rawSources.includes('telegram')
  if (legacyAllSources) params.delete('sources')
  else if (rawSources.length) params.set('sources', rawSources.join(','))

  // Do not canonicalize geography here. The backend owns aliases, canonical
  // station identity, radius/arc membership and map/list consistency.
  return params
}

function loadMap(key: string, url: string): Promise<any> {
  const current = pending.get(key)
  if (current) return current
  const request = $fetch<any>(url, { timeout: MAP_TIMEOUT_MS })
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
  const key = params.toString()
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < MAP_CACHE_MS) return cached.data

  const url = `${FLAT_API_URL}/api/listings?${params}`
  try {
    return await loadMap(key, url)
  } catch (error: any) {
    if (cached) return { ...cached.data, stale: true }
    setResponseStatus(event, Number(error?.statusCode || error?.response?.status || 503))
    return {
      count: 0,
      mapPoints: [],
      mapPointsTruncated: false,
      error: 'Map feed temporarily unavailable',
    }
  }
})
