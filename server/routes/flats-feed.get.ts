import { canonicalMetroValue } from '../utils/tashkentMetroLabels'
import { normalizeFlatDealType, normalizeFlatPrice, normalizeFlatRoomOnly } from '../utils/flatDealType'
import { canonicalCityValue } from '../../shared/locationCatalog'

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
// A direct single-offer lookup should be faster than a country refresh. Keep it
// below the main proxy budget so a broken OLX detail endpoint cannot hold the
// share-link request open for the full feed timeout.
const EXACT_LOOKUP_TIMEOUT_MS = 12_000
const AVAILABILITY_TIMEOUT_MS = 5_000
const AVAILABILITY_FRESH_MS = 15 * 60_000
const feedCache = new Map<string, { at: number; data: any }>()
const feedRefreshes = new Map<string, Promise<any>>()
const availabilityCache = new Map<string, { at: number; status: 'active' | 'inactive' }>()
const ALL_FEED_SOURCES = ['olx', 'telegram', 'facebook', 'threads'] as const
const SOCIAL_FEED_SOURCES = new Set(['telegram', 'facebook', 'threads'])

function rewritePhoto(p: unknown): unknown {
  return typeof p === 'string' && p.startsWith('/api/tg-photo/')
    ? `/flats-photo?path=${encodeURIComponent(p)}`
    : p
}

function shapeListing(listing: any): any {
  const normalizedPrice = normalizeFlatPrice(listing)
  const listingWithPrice = { ...listing, ...normalizedPrice }
  const normalizedListing = {
    ...listingWithPrice,
    roomOnly: normalizeFlatRoomOnly(listingWithPrice),
  }
  return {
    ...normalizedListing,
    dealType: normalizeFlatDealType(normalizedListing),
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
    canonicalCityValue(String(listing?.city || '')).toLowerCase(),
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

function availabilityKey(value: any): string {
  return `${String(value?.source || '').toLowerCase()}:${String(value?.country || '').toUpperCase()}:${String(value?.id ?? '')}`
}

async function filterPersistedInactiveOlx(response: any): Promise<any> {
  const listings = Array.isArray(response?.listings) ? response.listings : []
  const unique = new Map<string, { source: string; country: string; id: string }>()

  for (const listing of listings) {
    const source = String(listing?.source || '').toLowerCase()
    const country = String(listing?.country || '').toUpperCase()
    const id = String(listing?.id ?? '').trim()
    if (source !== 'olx' || !/^[A-Z]{2}$/.test(country) || !id) continue
    unique.set(`${source}:${country}:${id}`, { source, country, id })
  }

  if (!unique.size) return response

  const now = Date.now()
  const statuses = new Map<string, 'active' | 'inactive'>()
  const pending: Array<{ source: string; country: string; id: string }> = []
  for (const [key, item] of unique) {
    const cached = availabilityCache.get(key)
    if (cached && now - cached.at < AVAILABILITY_FRESH_MS) statuses.set(key, cached.status)
    else pending.push(item)
  }

  const applyStatuses = () => {
    const inactive = new Set([...statuses].filter(([, status]) => status === 'inactive').map(([key]) => key))
    const availabilityChecked = [...statuses].filter(([, status]) => status === 'active').map(([key]) => key)
    const filtered = listings.filter((listing: any) => !inactive.has(availabilityKey(listing)))
    const removed = listings.length - filtered.length
    const count = Number(response?.count)
    return {
      ...response,
      listings: filtered,
      count: Number.isFinite(count) ? Math.max(0, count - removed) : filtered.length,
      ...(availabilityChecked.length ? { availabilityChecked } : {}),
      ...(removed ? { availabilityFiltered: removed } : {}),
    }
  }

  try {
    if (pending.length) {
      const verification = await $fetch<any>(`${FLAT_API_URL}/api/listings/verify`, {
        method: 'POST',
        body: { items: pending },
        timeout: AVAILABILITY_TIMEOUT_MS,
      })
      for (const result of Array.isArray(verification?.results) ? verification.results : []) {
        if (result?.status !== 'active' && result?.status !== 'inactive') continue
        const key = availabilityKey(result)
        statuses.set(key, result.status)
        availabilityCache.set(key, { at: now, status: result.status })
      }
    }

    return applyStatuses()
  } catch {
    // Availability reads are a safety filter, not a reason to take the feed down.
    // Still apply fresh cached answers; the direct lookup below remains the
    // fallback for a shared OLX link that has not been checked yet.
    return applyStatuses()
  }
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
  const statsOnly = /(?:[?&])statsOnly=(?:1|true)(?:&|$)/u.test(url)
  const request = $fetch<any>(url, { timeout: statsOnly ? STATS_UPSTREAM_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS })
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
    if (!listingId) return response

    const source = requestedSources.length === 1 ? requestedSources[0]! : ''
    const country = exactCountry(upstreamParams)

    // OLX exact links must never be resurrected from the site cache. The direct
    // backend endpoint performs the forced live availability check and persists
    // inactive state before returning 404.
    if (source === 'olx' && country) {
      try {
        const exact = await $fetch<any>(
          `${FLAT_API_URL}/api/listing/olx/${encodeURIComponent(listingId)}?country=${encodeURIComponent(country)}`,
          { timeout: EXACT_LOOKUP_TIMEOUT_MS },
        )
        if (exact?.listing && String(exact.listing.id ?? '') === listingId) {
          availabilityCache.set(availabilityKey(exact.listing), { at: Date.now(), status: 'active' })
          return {
            ...response,
            count: 1,
            listings: [shapeListing(exact.listing)],
            exactListingFallback: 'source',
          }
        }
      } catch (error: any) {
        const status = Number(error?.statusCode || error?.response?.status || 0)
        if (status === 404) {
          availabilityCache.set(`olx:${country}:${listingId}`, { at: Date.now(), status: 'inactive' })
          return {
            ...response,
            count: 0,
            listings: [],
            exactListingFallback: 'source-inactive',
          }
        }
        // A transient source-check failure should not take the whole page down.
        // Persisted inactive state is still filtered before the response leaves.
        return response
      }
      return response
    }

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

  const finalize = async (raw: any) => filterPersistedInactiveOlx(
    await withExactListingFallback(await shapeWithCombinedFallback(raw)),
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
    // A stale answer, however old, beats reporting a failure — but only if it
    // actually has something in it.
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
