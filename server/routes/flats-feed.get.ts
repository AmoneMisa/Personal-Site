import { canonicalMetroValue } from '../utils/tashkentMetroLabels'

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
// A direct single-offer lookup should be faster than a country refresh. Keep it
// below the main proxy budget so a broken OLX detail endpoint cannot hold the
// share-link request open for the full feed timeout.
const EXACT_LOOKUP_TIMEOUT_MS = 12_000
const feedCache = new Map<string, { at: number; data: any }>()
const feedRefreshes = new Map<string, Promise<any>>()
const ALL_FEED_SOURCES = ['olx', 'telegram', 'facebook', 'threads'] as const
const SOCIAL_FEED_SOURCES = new Set(['telegram', 'facebook', 'threads'])

function rewritePhoto(p: unknown): unknown {
  return typeof p === 'string' && p.startsWith('/api/tg-photo/')
    ? `/flats-photo?path=${encodeURIComponent(p)}`
    : p
}

function shapeListing(listing: any): any {
  return {
    ...listing,
    photo: rewritePhoto(listing?.photo),
    photos: Array.isArray(listing?.photos) ? listing.photos.map(rewritePhoto) : [],
  }
}

function normalizeFeedDedupeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/giu, ' ')
    .replace(/(?:^|\s)@[\p{L}\p{N}_]{3,}/gu, ' ')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function socialDedupeKey(listing: any): string | null {
  const source = String(listing?.source || '').toLowerCase()
  if (!SOCIAL_FEED_SOURCES.has(source)) return null

  const text = normalizeFeedDedupeText(
    `${listing?.title || ''}\n${listing?.description || listing?.text || listing?.originalText || ''}`,
  )
  // Short cards are too ambiguous to fingerprint safely. Keep their source IDs
  // independent instead of risking two real apartments collapsing.
  if (text.length < 80) return null

  const areaSqm = Number(listing?.areaSqm)
  const normalizedArea = Number.isFinite(areaSqm) ? Math.round(areaSqm * 2) / 2 : ''

  // Source is deliberately omitted: exact Telegram/Facebook/Threads reposts of
  // the same housing ad should produce one card, not one card per network.
  return [
    String(listing?.country || '').toUpperCase(),
    String(listing?.city || '').toLowerCase(),
    String(listing?.dealType || ''),
    String(listing?.propertyType || ''),
    String(listing?.price ?? ''),
    String(listing?.currency || '').toUpperCase(),
    String(listing?.rooms ?? ''),
    String(normalizedArea),
    text,
  ].join('|')
}

function dedupeFeedListings(listings: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []

  for (const listing of listings) {
    const key = socialDedupeKey(listing)
    if (!key) {
      out.push(listing)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(listing)
  }

  return out
}

function shapeResponse(raw: any, requestedSources: string[]): any {
  const data = { ...raw }
  const rawListings = Array.isArray(raw?.listings) ? raw.listings : []

  // An empty requestedSources list means "all sources". Do not run that result
  // through a second hardcoded allow-list: the upstream may add/rename a source
  // before this proxy is updated, which previously produced the impossible UI
  // state `count > 0` together with an empty listings array. Explicit source
  // filters still get the defensive client-side check below.
  const selectedListings = requestedSources.length
    ? rawListings.filter((listing: any) => requestedSources.includes(String(listing?.source || '').toLowerCase()))
    : rawListings

  data.listings = dedupeFeedListings(selectedListings.map(shapeListing))
  const backendSources = Array.isArray(raw?.filters?.sources) ? raw.filters.sources : []
  data.count = requestedSources.length && backendSources.length === 0
    ? data.listings.length
    : typeof raw?.count === 'number' ? raw.count : data.listings.length
  return data
}

/** How long a cached answer may still be served: empty ones expire quickly. */
function staleWindow(entry: { data: any } | undefined): number {
  const listings = entry?.data?.listings
  return Array.isArray(listings) && listings.length && !entry?.data?.warming
    ? FEED_STALE_MS
    : EMPTY_STALE_MS
}

function refreshFeed(key: string, url: string): Promise<any> {
  const current = feedRefreshes.get(key)
  if (current) return current
  const request = $fetch<any>(url, { timeout: UPSTREAM_TIMEOUT_MS })
    .then((data) => {
      const at = data?.warming ? Date.now() - FEED_FRESH_MS : Date.now()
      feedCache.set(key, { at, data })
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
  for (const entry of feedCache.values()) {
    // A detail link may outlive the exact filtered cache key that produced it,
    // but we should not resurrect an arbitrarily old/deleted advert from memory.
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
  const rawRequestedSources = (incoming.searchParams.get('sources') || '')
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter((source) => ALL_FEED_SOURCES.includes(source as typeof ALL_FEED_SOURCES[number]))

  // The current web UI historically sent `olx,telegram` to mean "all" because
  // those were the only sources when the page was built. Social housing is now
  // persisted too, so preserve the UI contract while letting the default feed
  // return every available source. A single explicit source remains a real filter.
  const legacyAllSources = rawRequestedSources.length === 2
    && rawRequestedSources.includes('olx')
    && rawRequestedSources.includes('telegram')
  const requestedSources = legacyAllSources ? [] : rawRequestedSources

  const upstreamParams = new URLSearchParams(incoming.searchParams)
  if (legacyAllSources) upstreamParams.delete('sources')
  const metro = upstreamParams.get('metro')
  if (metro) upstreamParams.set('metro', canonicalMetroValue(metro))

  const url = `${FLAT_API_URL}/api/listings?${upstreamParams}`
  const key = upstreamParams.toString()
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
    const combinedKey = `combined:${combinedParams}`
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
    if (!listingId || (Array.isArray(response?.listings) && response.listings.length)) return response

    const source = requestedSources.length === 1 ? requestedSources[0]! : ''
    const country = exactCountry(upstreamParams)
    const cachedListing = findCachedExactListing(listingId, source, country)
    if (cachedListing) {
      return {
        ...response,
        count: 1,
        listings: [shapeListing(cachedListing)],
        exactListingFallback: 'cache',
      }
    }

    // Shared OLX links should not depend on the current rotating country
    // snapshot. The flat-finder backend already exposes a single-offer endpoint;
    // use it as the last resort when listingId was not present in the snapshot.
    if (source === 'olx' && country) {
      try {
        const exact = await $fetch<any>(
          `${FLAT_API_URL}/api/listing/olx/${encodeURIComponent(listingId)}?country=${encodeURIComponent(country)}`,
          { timeout: EXACT_LOOKUP_TIMEOUT_MS },
        )
        if (exact?.listing && String(exact.listing.id ?? '') === listingId) {
          return {
            ...response,
            count: 1,
            listings: [shapeListing(exact.listing)],
            exactListingFallback: 'source',
          }
        }
      } catch {
        // Keep the original empty response. The UI may retry while the country
        // store is warming; a failed direct lookup must not turn the feed into 502.
      }
    }

    return response
  }

  const cached = feedCache.get(key)
  if (cached && Date.now() - cached.at < FEED_FRESH_MS) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return withExactListingFallback(await shapeWithCombinedFallback(cached.data))
  }
  if (cached && Date.now() - cached.at < staleWindow(cached)) {
    refreshFeed(key, url).catch(() => {})
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return {
      ...await withExactListingFallback(await shapeWithCombinedFallback(cached.data)),
      stale: true,
    }
  }
  try {
    const data = await refreshFeed(key, url)
    setResponseHeader(event, 'Cache-Control', 'no-store')
    return withExactListingFallback(await shapeWithCombinedFallback(data))
  } catch (err) {
    // A stale answer, however old, beats reporting a failure — but only if it
    // actually has something in it.
    if (cached && Array.isArray(cached.data?.listings) && cached.data.listings.length) {
      setResponseHeader(event, 'Cache-Control', 'no-store')
      return {
        ...await withExactListingFallback(await shapeWithCombinedFallback(cached.data)),
        stale: true,
      }
    }
    setResponseStatus(event, 502)
    return { error: (err as Error).message, listings: [], count: 0, upstreamFailed: true }
  }
})