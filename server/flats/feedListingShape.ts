import { normalizeFlatDealType, normalizeFlatPrice, normalizeFlatRoomOnly } from '../utils/flatDealType'
import { isPotentiallyUnsafeFlat } from '../utils/flatSafety'
import { canonicalCityValue } from '../../shared/locationCatalog'

export const ALL_FEED_SOURCES = ['olx', 'telegram', 'facebook', 'threads'] as const
export const CURRENT_ALL_SOURCE_TOKENS = [...ALL_FEED_SOURCES, 'custom'] as const
const SOCIAL_FEED_SOURCES = new Set(['telegram', 'facebook', 'threads'])

const BOOLEAN_LISTING_FIELDS = [
  'roomOnly',
  'balcony',
  'terrace',
  'privateYard',
  'dishwasher',
  'airConditioner',
  'gas',
  'newBuilding',
  'cadastral',
  'firstRental',
  'communalSeparated',
  'petsAllowed',
  'childrenAllowed',
  'deposit',
  'commission',
  'furnished',
  'parking',
  'elevator',
  'heating',
  'hotWater',
  'internet',
  'smokingAllowed',
  'negotiable',
] as const

type BooleanListingField = typeof BOOLEAN_LISTING_FIELDS[number]

function normalizeBooleanLike(field: BooleanListingField, value: any): any {
  if (typeof value === 'boolean' || value == null) return value
  if (value === 1) return true
  if (value === 0) return false

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')

  if (['yes', 'true', 'present'].includes(normalized)) return true
  if (['no', 'false', 'absent'].includes(normalized)) return false
  if (['petsAllowed', 'childrenAllowed', 'smokingAllowed'].includes(field)) {
    if (['allowed', 'available'].includes(normalized)) return true
    if (['not allowed', 'unavailable'].includes(normalized)) return false
  }
  if (field === 'furnished') {
    if (normalized === 'furnished') return true
    if (normalized === 'unfurnished') return false
  }
  if (field === 'communalSeparated') {
    if (['separate', 'separated', 'not included'].includes(normalized)) return true
    if (['included', 'utilities included'].includes(normalized)) return false
  }
  return value
}

function normalizeConditionValue(value: any): any {
  if (value == null || typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ')
  if (['needs renovation', 'renovation needed', 'needs repair', 'poor'].includes(normalized)) return 'needs_renovation'
  if (['basic', 'simple'].includes(normalized)) return 'basic'
  if (['good', 'good condition'].includes(normalized)) return 'good'
  if (['modern', 'modern renovation', 'euro renovation', 'renovated'].includes(normalized)) return 'modern'
  if (['luxury', 'premium', 'designer renovation'].includes(normalized)) return 'luxury'
  return value
}

function normalizeAudienceValue(value: any): any {
  if (value == null || typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase().replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ')
  if (['women', 'woman', 'female', 'girls', 'girls only', 'women only'].includes(normalized)) return 'women'
  if (['men', 'man', 'male', 'men only'].includes(normalized)) return 'men'
  if (['family', 'families', 'family only'].includes(normalized)) return 'family'
  return value
}

function normalizeListingSemantics(listing: any): any {
  const normalized = { ...listing }
  for (const field of BOOLEAN_LISTING_FIELDS) {
    if (field in normalized) normalized[field] = normalizeBooleanLike(field, normalized[field])
  }
  if ('condition' in normalized) normalized.condition = normalizeConditionValue(normalized.condition)
  if ('audience' in normalized) normalized.audience = normalizeAudienceValue(normalized.audience)
  return normalized
}

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

function rewritePhoto(photo: unknown): unknown {
  return typeof photo === 'string' && photo.startsWith('/api/tg-photo/')
    ? `/flats-photo?path=${encodeURIComponent(photo)}`
    : photo
}

export function shapeListing(listing: any): any {
  const semanticListing = normalizeListingSemantics(listing)
  const normalizedPrice = normalizeFlatPrice(semanticListing)
  const listingWithPrice = { ...semanticListing, ...normalizedPrice }
  const normalizedListing = {
    ...listingWithPrice,
    roomOnly: normalizeFlatRoomOnly(listingWithPrice),
  }
  return {
    ...normalizedListing,
    dealType: normalizeFlatDealType(normalizedListing),
    potentiallyUnsafe: isPotentiallyUnsafeFlat(normalizedListing),
    photo: rewritePhoto(normalizedListing?.photo),
    photos: Array.isArray(normalizedListing?.photos) ? normalizedListing.photos.map(rewritePhoto) : [],
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
