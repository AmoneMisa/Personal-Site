import { canonicalMetroValue } from '../utils/tashkentMetroLabels'
import { BoundedTtlCache } from '../utils/boundedTtlCache'
import {
  ALL_FEED_SOURCES,
  CURRENT_ALL_SOURCE_TOKENS,
  shapeListing,
  shapeLiveListing,
  shapeResponse,
} from '../flats/feedListingShape'

// GET /flats-feed — server-side proxy to the flat-finder backend's /api/listings.
// The flat API is plain HTTP and the site is HTTPS, so a direct browser call is
// blocked as mixed content; proxying here keeps it same-origin + HTTPS. Lives
// outside /api (that prefix proxies to FastAPI). FLAT_API_URL configures the
// upstream (defaults to the host-nginx port the desktop app already uses).
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'
const FEED_FRESH_MS = 30_000
const FEED_STALE_MS = 60 * 60_000
// An answer with no listings is almost always the upstream being unhappy — a
// warming store, a degraded source, a timeout that resolved to nothing. Serving
// one for the full hour turns a blip into "нет объявлений" for every visitor
// asking that question, so empty answers get a short leash and are refetched.
const EMPTY_STALE_MS = 60_000
// The flat API answers an uncached query in ~6s and slower under load; 15s left
// legitimate searches failing as if nothing matched.
const UPSTREAM_TIMEOUT_MS = 25_000
// Full statistics aggregate the complete filtered result and can legitimately
// take longer than a page lookup. They are loaded off the critical rendering
// path, so give only stats-only requests a larger budget instead of slowing the
// listings feed itself.
const STATS_UPSTREAM_TIMEOUT_MS = 55_000
// Live source verification is background-only and sits behind gateways with a
// roughly ten-second request ceiling. Return an inconclusive result before that
// ceiling instead of letting a slow OLX response turn into a user-visible 504.
const EXACT_LOOKUP_TIMEOUT_MS = 8_000
// A clean ?adv= link hits this endpoint on every open — sharing one link in a
// group chat means a burst of visitors resolving the same publicId within
// seconds. A short TTL absorbs that burst as one Postgres round trip while
// staying fresh enough that a price edit or deactivation shows up quickly.
const PUBLIC_ID_CACHE_TTL_MS = FEED_FRESH_MS
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
/** How long a cached answer may still be served: empty ones expire quickly. */
function staleWindow(entry: { data: any } | undefined): number {
  const listings = entry?.data?.listings
  return Array.isArray(listings) && listings.length && !entry?.data?.warming
    ? FEED_STALE_MS
    : EMPTY_STALE_MS
}

function normalizedSearchKey(params: URLSearchParams): string {
  const entries = [...params.entries()].sort(([keyA, valueA], [keyB, valueB]) => {
    const keyOrder = keyA.localeCompare(keyB)
    return keyOrder || valueA.localeCompare(valueB)
  })
  return new URLSearchParams(entries).toString()
}

function refreshFeed(key: string, url: string): Promise<any> {
  const current = feedRefreshes.get(key)
  if (current) return current
  if (feedRefreshes.size >= MAX_INFLIGHT_REFRESHES) {
    return Promise.reject(new Error('Flat feed refresh capacity reached'))
  }

  const statsOnly = /(?:[?&])statsOnly=(?:1|true)(?:&|$)/u.test(url)
  const request = $fetch<any>(url, { timeout: statsOnly ? STATS_UPSTREAM_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS })
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

function exactCountry(params: URLSearchParams): string {
  const countries = (params.get('countries') || '')
    .split(',')
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country))
  return countries.length === 1 ? countries[0]! : ''
}

function findCachedExactListing(listingId: string, source: string, country: string): any | null {
  const now = Date.now()
  for (const entry of feedCache.values(now)) {
    if (now - entry.at > FEED_STALE_MS) continue
    const listings = Array.isArray(entry.data?.listings) ? entry.data.listings : []
    const exact = listings.find((listing: any) => {
      if (String(listing?.id ?? '') !== listingId) return false
      if (source && String(listing?.source || '').toLowerCase() !== source) return false
      if (country && String(listing?.country || '').toUpperCase() !== country) return false
      return true
    })
    if (exact) return exact
  }
  return null
}

export default defineEventHandler(async (event) => {
  const incoming = getRequestURL(event)
  const requestedSourceTokens = (incoming.searchParams.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter(Boolean)
  const rawRequestedSources = requestedSourceTokens
    .filter((source) => ALL_FEED_SOURCES.includes(source as typeof ALL_FEED_SOURCES[number]))

  // The current web UI historically sent `olx,telegram` to mean "all" because
  // those were the only sources when the page was built. Social housing is now
  // persisted too, so preserve the UI contract while letting the default feed
  // return every available source. A single explicit source remains a real filter.
  const legacyAllSources = rawRequestedSources.length === 2
    && rawRequestedSources.includes('olx')
    && rawRequestedSources.includes('telegram')
  const currentAllSources = CURRENT_ALL_SOURCE_TOKENS.every((source) => requestedSourceTokens.includes(source))
  const allSourcesRequest = legacyAllSources || currentAllSources
  const requestedSources = allSourcesRequest ? [] : rawRequestedSources

  const upstreamParams = new URLSearchParams(incoming.searchParams)
  // An explicit list containing every UI source is semantically identical to
  // no source filter. Removing it lets PostgreSQL use its optimized default-feed
  // query instead of applying a redundant five-value filter on every row.
  if (allSourcesRequest) upstreamParams.delete('sources')
  const metro = upstreamParams.get('metro')
  if (metro) upstreamParams.set('metro', canonicalMetroValue(metro))

  // A clean listing link names only the advert's stable publicId — no filters,
  // no source/country. Resolve it directly against the backend's dedicated
  // lookup and skip the whole filtered-search path.
  const publicIdParam = String(upstreamParams.get('publicId') || '').trim()
  if (publicIdParam && /^\d+$/.test(publicIdParam)) {
    const canonicalPublicId = publicIdParam.replace(/^0+(?=\d)/, '')
    setResponseHeader(event, 'Cache-Control', 'no-store')
    const cached = publicIdCache.get(canonicalPublicId)
    if (cached) return cached
    try {
      const result = await $fetch<any>(
        `${FLAT_API_URL}/api/listing/by-public-id/${encodeURIComponent(canonicalPublicId)}`,
        { timeout: EXACT_LOOKUP_TIMEOUT_MS },
      )
      if (result?.listing) {
        const data = { count: 1, listings: [shapeListing(result.listing)] }
        publicIdCache.set(canonicalPublicId, data)
        return data
      }
      // Not-found stays uncached: a listing still being ingested must not be
      // kept invisible behind a cached miss until the TTL expires.
      return { count: 0, listings: [] }
    } catch (error: any) {
      const status = Number(error?.statusCode || error?.response?.status || 0)
      if (status === 404) return { count: 0, listings: [] }
      setResponseStatus(event, 502)
      return { count: 0, listings: [], error: 'Listing lookup failed' }
    }
  }

  const exactListingId = String(upstreamParams.get('listingId') || '').trim()
  const exactSource = requestedSources.length === 1 ? requestedSources[0]! : ''
  const exactCountryCode = exactCountry(upstreamParams)
  const verifyLive = upstreamParams.get('verifyLive') === '1'
  upstreamParams.delete('verifyLive')

  // Ordinary exact lookups stay on PostgreSQL so cards and shared links open
  // immediately. The client follows with an explicit live verification after
  // opening; only that second request is allowed to wait on OLX.
  if (verifyLive && exactListingId && exactSource === 'olx' && exactCountryCode) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    try {
      const exact = await $fetch<any>(
        `${FLAT_API_URL}/api/listing/olx/${encodeURIComponent(exactListingId)}?country=${encodeURIComponent(exactCountryCode)}`,
        { timeout: EXACT_LOOKUP_TIMEOUT_MS },
      )
      if (exact?.listing && String(exact.listing.id ?? '') === exactListingId) {
        return {
          count: 1,
          listings: [shapeLiveListing(exact.listing)],
          exactListingFallback: 'source',
        }
      }
      return { count: 0, listings: [], exactListingFallback: 'source-unavailable' }
    } catch (error: any) {
      const status = Number(error?.statusCode || error?.response?.status || 0)
      if (status === 404) {
        return { count: 0, listings: [], exactListingFallback: 'source-inactive' }
      }
      // A timeout or temporary source failure is inconclusive. The client may
      // still open the card already present in its feed, but must not mark it
      // active or remove it as unavailable.
      return { count: 0, listings: [], exactListingFallback: 'source-unavailable' }
    }
  }

  const url = `${FLAT_API_URL}/api/listings?${upstreamParams}`
  const key = normalizedSearchKey(upstreamParams)
  const requestedOffset = Math.max(0, Number(upstreamParams.get('offset')) || 0)
  const requestedLimit = Math.min(60, Math.max(1, Number(upstreamParams.get('limit')) || 20))
  const enforcePage = (response: any) => ({
    ...response,
    listings: Array.isArray(response?.listings) && response.listings.length > requestedLimit
      ? response.listings.slice(requestedOffset, requestedOffset + requestedLimit)
      : response?.listings || [],
  })
  const shapeWithCombinedFallback = async (raw: any) => {
    const shaped = shapeResponse(raw, requestedSources)
    if (raw?.warming || requestedSources.length !== 1 || shaped.listings.length || Number(raw?.sourceCounts?.[requestedSources[0]!]) > 0) {
      return enforcePage(shaped)
    }

    const combinedParams = new URLSearchParams(upstreamParams)
    combinedParams.delete('sources')
    const combinedKey = `combined:${normalizedSearchKey(combinedParams)}`
    const combinedUrl = `${FLAT_API_URL}/api/listings?${combinedParams}`
    const combinedCached = feedCache.get(combinedKey)
    const combinedRaw = combinedCached && Date.now() - combinedCached.at < staleWindow(combinedCached)
      ? combinedCached.data
      : await refreshFeed(combinedKey, combinedUrl)
    const combined = shapeResponse(combinedRaw, requestedSources)
    return enforcePage(combined.listings.length ? { ...combined, compatibilityFallback: true } : shaped)
  }

  const withExactListingFallback = async (response: any) => {
    const listingId = String(upstreamParams.get('listingId') || '').trim()
    if (!listingId) return response

    const source = requestedSources.length === 1 ? requestedSources[0]! : ''
    const country = exactCountry(upstreamParams)

    if (Array.isArray(response?.listings) && response.listings.length) return response

    const cachedListing = findCachedExactListing(listingId, source, country)
    if (cachedListing) {
      return {
        ...response,
        count: 1,
        listings: [shapeListing(cachedListing)],
        exactListingFallback: 'cache',
      }
    }

    return response
  }

  // PostgreSQL already excludes rows persisted with `active = FALSE`. Waiting
  // for another source-verification batch here added up to five seconds after
  // every cold database query and pushed otherwise successful feeds past the
  // gateway timeout. The backend availability sweep owns persisted state; an
  // explicit background `verifyLive` request still checks an opened OLX advert.
  const finalize = async (raw: any) => withExactListingFallback(
    await shapeWithCombinedFallback(raw),
  )

  const cached = feedCache.get(key)
  if (cached && Date.now() - cached.at < FEED_FRESH_MS) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return finalize(cached.data)
  }
  if (cached && Date.now() - cached.at < staleWindow(cached)) {
    refreshFeed(key, url).catch(() => {})
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return {
      ...await finalize(cached.data),
      stale: true,
    }
  }
  try {
    const data = await refreshFeed(key, url)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return finalize(data)
  } catch (err) {
    // A still-live TTL entry beats reporting an upstream failure, but expired
    // answers are removed rather than occupying heap forever.
    if (cached && Array.isArray(cached.data?.listings) && cached.data.listings.length) {
      setResponseHeader(event, 'Cache-Control', 'no-store')
      return {
        ...await finalize(cached.data),
        stale: true,
      }
    }
    setResponseStatus(event, 502)
    return { error: (err as Error).message, listings: [], count: 0, upstreamFailed: true }
  }
})
