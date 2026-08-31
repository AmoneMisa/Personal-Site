import { canonicalMetroValue } from '../utils/tashkentMetroLabels'
import {
  ALL_FEED_SOURCES,
  CURRENT_ALL_SOURCE_TOKENS,
  shapeListing,
  shapeLiveListing,
  shapeResponse,
} from '../flats/feedListingShape'
import {
  FEED_FRESH_MS,
  FEED_STALE_MS,
  cachedFeedValues,
  cachePublicId,
  getCachedFeed,
  getCachedPublicId,
  normalizedSearchKey,
  refreshFeed,
  staleWindow,
} from '../flats/feedCache'

const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'
const EXACT_LOOKUP_TIMEOUT_MS = 8_000

function exactCountry(params: URLSearchParams): string {
  const countries = (params.get('countries') || '')
    .split(',')
    .map((country) => country.trim().toUpperCase())
    .filter((country) => /^[A-Z]{2}$/.test(country))
  return countries.length === 1 ? countries[0]! : ''
}

function findCachedExactListing(listingId: string, source: string, country: string): any | null {
  const now = Date.now()
  for (const entry of cachedFeedValues(now)) {
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

  const legacyAllSources = rawRequestedSources.length === 2
    && rawRequestedSources.includes('olx')
    && rawRequestedSources.includes('telegram')
  const currentAllSources = CURRENT_ALL_SOURCE_TOKENS.every((source) => requestedSourceTokens.includes(source))
  const allSourcesRequest = legacyAllSources || currentAllSources
  const requestedSources = allSourcesRequest ? [] : rawRequestedSources

  const upstreamParams = new URLSearchParams(incoming.searchParams)
  if (allSourcesRequest) upstreamParams.delete('sources')
  const metro = upstreamParams.get('metro')
  if (metro) upstreamParams.set('metro', canonicalMetroValue(metro))

  const publicIdParam = String(upstreamParams.get('publicId') || '').trim()
  if (publicIdParam && /^\d+$/.test(publicIdParam)) {
    const canonicalPublicId = publicIdParam.replace(/^0+(?=\d)/, '')
    setResponseHeader(event, 'Cache-Control', 'no-store')
    const cached = getCachedPublicId(canonicalPublicId)
    if (cached) return cached
    try {
      const result = await $fetch<any>(
        `${FLAT_API_URL}/api/listing/by-public-id/${encodeURIComponent(canonicalPublicId)}`,
        { timeout: EXACT_LOOKUP_TIMEOUT_MS },
      )
      if (result?.listing) {
        const data = { count: 1, listings: [shapeListing(result.listing)] }
        cachePublicId(canonicalPublicId, data)
        return data
      }
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
    if (
      raw?.warming
      || requestedSources.length !== 1
      || shaped.listings.length
      || Number(raw?.sourceCounts?.[requestedSources[0]!]) > 0
    ) {
      return enforcePage(shaped)
    }

    const combinedParams = new URLSearchParams(upstreamParams)
    combinedParams.delete('sources')
    const combinedKey = `combined:${normalizedSearchKey(combinedParams)}`
    const combinedUrl = `${FLAT_API_URL}/api/listings?${combinedParams}`
    const combinedCached = getCachedFeed(combinedKey)
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
    if (!cachedListing) return response
    return {
      ...response,
      count: 1,
      listings: [shapeListing(cachedListing)],
      exactListingFallback: 'cache',
    }
  }

  const finalize = async (raw: any) => withExactListingFallback(
    await shapeWithCombinedFallback(raw),
  )

  const cached = getCachedFeed(key)
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
