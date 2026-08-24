export type FlatDealType = 'sale' | 'longRent' | 'shortRent'

const SOCIAL_SOURCES = new Set(['telegram', 'facebook', 'threads'])

function normalizedText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function listingText(listing: any): string {
  const tags = Array.isArray(listing?.tags) ? listing.tags.join(' ') : ''
  return normalizedText([
    listing?.title,
    listing?.description,
    listing?.text,
    listing?.originalText,
    listing?.priceText,
    listing?.url,
    listing?.id,
    tags,
  ].filter(Boolean).join(' '))
}

export function normalizeFlatRoomOnly(listing: any): boolean {
  if (listing?.roomOnly === true) return true
  const text = listingText(listing)
  return /(?:student\s+qizlarga|talaba\s+qizlarga|qiz\s+olinadi|подселени\p{L}*|койко\s+мест\p{L}*|шеринг)/u.test(text)
}

export function normalizeFlatPrice(listing: any): { price: number | null; currency: string } {
  const existingPrice = normalizedPrice(listing?.price)
  const existingCurrency = String(listing?.currency || '').toUpperCase()
  if (existingPrice != null && existingPrice > 0) {
    return { price: existingPrice, currency: existingCurrency }
  }

  const source = normalizedText(listing?.source)
  const title = String(listing?.title || '').trim()
  if (!SOCIAL_SOURCES.has(source) || /(?:ming|минг|тыс|million|миллион|млн|sum|сум|uzs)/iu.test(title)) {
    return { price: null, currency: existingCurrency }
  }

  // Compact Telegram posts often put a dollar rent directly after the district
  // (for example, "Шайхонтохур 500") while leaving the structured price empty.
  const trailingAmount = title.match(/(?:^|\s)(\d{2,4})(?:\s*(?:usd|у\.?\s*е\.?|\$))?\s*$/iu)
  const inferredPrice = trailingAmount ? Number(trailingAmount[1]) : null
  if (inferredPrice == null || inferredPrice < 100 || inferredPrice > 5_000) {
    return { price: null, currency: existingCurrency }
  }

  return { price: inferredPrice, currency: 'USD' }
}

function normalizedPrice(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(String(value || '').replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function socialPriceLooksLikeMonthlyRent(listing: any): boolean {
  const source = normalizedText(listing?.source)
  if (!SOCIAL_SOURCES.has(source)) return false

  const price = normalizedPrice(listing?.price)
  if (price == null || price <= 0) return false

  const currency = String(listing?.currency || '').toUpperCase()
  const monthlyUpperBounds: Record<string, number> = {
    USD: 5_000,
    EUR: 5_000,
    UZS: 50_000_000,
    UAH: 100_000,
    KZT: 2_500_000,
    KGS: 500_000,
    RON: 25_000,
  }
  const upperBound = monthlyUpperBounds[currency]
  return typeof upperBound === 'number' && price <= upperBound
}

/**
 * Normalizes upstream aliases and restores the deal type omitted by some
 * persisted social listings. Explicit upstream values always win.
 */
export function normalizeFlatDealType(listing: any): FlatDealType | null {
  const raw = normalizedText(listing?.dealType).replace(/\s/g, '')
  if (['sale', 'sell', 'forsale'].includes(raw)) return 'sale'
  if (['longrent', 'rent', 'monthly', 'monthlyrent'].includes(raw)) return 'longRent'
  if (['shortrent', 'daily', 'dailyrent'].includes(raw)) return 'shortRent'

  const text = listingText(listing)
  const isShortRent = /(?:посуточн\p{L}*|сутк\p{L}*|на сутки|кунлик|kunlik|sutkalik|суткалик)/u.test(text)
  if (isShortRent) return 'shortRent'

  const isSale = /(?:продам|продается|продажа|продамиз|sotiladi|sotaman|sotuv|for sale)/u.test(text)
  if (isSale) return 'sale'

  const isLongRent = /(?:сдам|сдается|снять|аренд\p{L}*|ижара\p{L}*|ijara\p{L}*|ijaraga|берилади|beriladi|for rent|oyiga|в месяц|месяц|mingdan|мингдан|qiz\s+olinadi|student\s+qizlarga|talaba\s+qizlarga)/u.test(text)
  if (isLongRent || normalizeFlatRoomOnly(listing) || socialPriceLooksLikeMonthlyRent(listing)) return 'longRent'

  return null
}
