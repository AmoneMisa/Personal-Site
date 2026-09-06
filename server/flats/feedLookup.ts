import {
  FEED_STALE_MS,
  cachePublicId,
  cachedFeedValues,
  getCachedPublicId,
} from './feedCache'
import { shapeListing, shapeLiveListing } from './feedListingShape'

// Flat Finder is a separate internal service. Keep the Docker service name as
// the local default; production deployments can override it explicitly, but
// must never fall back to an embedded public HTTP address.
export const FLAT_API_URL = process.env.FLAT_API_URL || 'http://flat-finder-backend:4000'
export const EXACT_LOOKUP_TIMEOUT_MS = 8_000

type PublicListingLookupResult = {
  data: any
  upstreamFailed: boolean
}

export async function lookupPublicListing(publicId: string): Promise<PublicListingLookupResult> {
  const cached = getCachedPublicId(publicId)
  if (cached) return { data: cached, upstreamFailed: false }

  try {
    const result = await $fetch<any>(
      `${FLAT_API_URL}/api/listing/by-public-id/${encodeURIComponent(publicId)}`,
      { timeout: EXACT_LOOKUP_TIMEOUT_MS },
    )
    if (!result?.listing) {
      return { data: { count: 0, listings: [] }, upstreamFailed: false }
    }

    const data = { count: 1, listings: [shapeListing(result.listing)] }
    cachePublicId(publicId, data)
    return { data, upstreamFailed: false }
  } catch (error: any) {
    const status = Number(error?.statusCode || error?.response?.status || 0)
    if (status === 404) {
      return { data: { count: 0, listings: [] }, upstreamFailed: false }
    }
    return {
      data: { count: 0, listings: [], error: 'Listing lookup failed' },
      upstreamFailed: true,
    }
  }
}

export async function verifyOlxListingLive(listingId: string, country: string): Promise<any> {
  try {
    const exact = await $fetch<any>(
      `${FLAT_API_URL}/api/listing/olx/${encodeURIComponent(listingId)}?country=${encodeURIComponent(country)}`,
      { timeout: EXACT_LOOKUP_TIMEOUT_MS },
    )
    if (exact?.listing && String(exact.listing.id ?? '') === listingId) {
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

export function findCachedExactListing(listingId: string, source: string, country: string): any | null {
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
