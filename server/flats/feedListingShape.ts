export const ALL_FEED_SOURCES = ['olx', 'telegram', 'facebook', 'threads'] as const
export const CURRENT_ALL_SOURCE_TOKENS = [...ALL_FEED_SOURCES, 'custom'] as const
const SOCIAL_FEED_SOURCES = new Set(['telegram', 'facebook', 'threads'])

const LIVE_REFRESH_FIELDS = new Set([
  'id',
  'publicId',
  'source',
  'country',
  'title',
  'description',
  'propertyType',
  'byAgency',
  'price',
  'currency',
  'rooms',
  'areaSqm',
  'city',
  'district',
  'lat',
  'lng',
  'photo',
  'photos',
  'url',
  'createdAt',
  'dealType',
])

const TG_PHOTO_PATH_RE = /^\/api\/tg-photo\/[A-Za-z0-9_]{3,64}\/\d+$/

/**
 * Telegram media is served by Flat Finder over its private HTTP network. The
 * browser must use the site's HTTPS proxy instead. Flat Finder has emitted
 * both relative and absolute forms over time, so normalize either form while
 * retaining a narrow, path-only allowlist for the proxy endpoint.
 */
function rewritePhoto(photo: unknown): unknown {
  if (typeof photo !== 'string') return photo

  try {
    const url = new URL(photo, 'https://flat-photo.invalid')
    if (!TG_PHOTO_PATH_RE.test(url.pathname) || url.search || url.hash) return photo
    return `/flats-photo?path=${encodeURIComponent(url.pathname)}`
  } catch {
    return photo
  }
}

export function shapeListing(listing: any): any {
  return {
    ...listing,
    photo: rewritePhoto(listing?.photo),
    photos: Array.isArray(listing?.photos) ? listing.photos.map(rewritePhoto) : [],
  }
}

export function shapeLiveListing(listing: any): any {
  const shaped = shapeListing(listing)
  const live: Record<string, any> = {}
  for (const [field, value] of Object.entries(shaped)) {
    if (!LIVE_REFRESH_FIELDS.has(field)) continue
    if (value == null) continue
    if (typeof value === 'string' && !value.trim()) continue
    if (Array.isArray(value) && value.length === 0) continue
    live[field] = value
  }
  return live
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
  if (text.length < 80) return null

  const areaSqm = Number(listing?.areaSqm)
  const normalizedArea = Number.isFinite(areaSqm) ? Math.round(areaSqm * 2) / 2 : ''
  return [
    String(listing?.country || '').toUpperCase(),
    String(listing?.city || '').trim(),
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

export function shapeResponse(raw: any, requestedSources: string[]): any {
  const data = { ...raw }
  const rawListings = Array.isArray(raw?.listings) ? raw.listings : []
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

// Map points are fetched through a compact upstream response instead of the
// regular listing feed. Keep their Telegram media on the exact same proxy path
// as list cards and detail galleries.
export function shapeMapResponse(raw: any): any {
  return {
    ...raw,
    mapPoints: Array.isArray(raw?.mapPoints)
      ? raw.mapPoints.map((point: any) => typeof point?.photo === 'string'
        ? { ...point, photo: rewritePhoto(point.photo) }
        : point)
      : [],
  }
}
