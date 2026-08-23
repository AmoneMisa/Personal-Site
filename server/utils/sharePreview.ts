export const SHARE_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://whiteslove.me').replace(/\/$/, '')
const FLAT_API_URL = process.env.FLAT_API_URL || 'http://185.5.206.229:8082'
const JOBS_API_URL = (process.env.JOBS_API_URL || 'http://jobs-api:3000').replace(/\/$/, '')
const VALID_FLAT_SOURCES = new Set(['olx', 'telegram'])

// Social crawlers abandon a preview after only a few seconds (Telegram is the
// strictest), and these lookups run inside the SSR render hook. Keep the budget
// well below the reverse-proxy timeout.
const SHARE_LOOKUP_TIMEOUT_MS = Number(process.env.SHARE_LOOKUP_TIMEOUT_MS) || 2500

// Crawlers fetch the same URL several times (and users re-share links), so cache
// resolved lookups briefly. Negative results are cached too, for less time, so a
// cold backend cannot be hammered once per crawl.
const shareCache = new Map<string, { at: number; value: any }>()
const SHARE_CACHE_HIT_MS = 10 * 60_000
const SHARE_CACHE_MISS_MS = 30_000

function cacheGet(key: string): { value: any } | null {
  const hit = shareCache.get(key)
  if (!hit) return null
  const ttl = hit.value ? SHARE_CACHE_HIT_MS : SHARE_CACHE_MISS_MS
  if (Date.now() - hit.at > ttl) {
    shareCache.delete(key)
    return null
  }
  return { value: hit.value }
}

function cacheSet(key: string, value: any): any {
  if (shareCache.size > 500) shareCache.clear()
  shareCache.set(key, { at: Date.now(), value })
  return value
}

export type ShareMeta = {
  title: string
  description: string
  image: string
  imageType: 'image/png' | 'image/jpeg'
  url: string
  type: 'article' | 'website'
}

export function cleanShareText(value: unknown, max = 220): string {
  const text = String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function wrapShareText(value: unknown, maxChars = 34, maxLines = 3): string[] {
  const words = cleanShareText(value, 260).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars || !current) {
      current = next
      continue
    }
    lines.push(current)
    current = word
    if (lines.length >= maxLines - 1) break
  }

  if (current && lines.length < maxLines) lines.push(current)
  const consumed = lines.join(' ').length
  const original = words.join(' ')
  if (original.length > consumed && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1]!.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
  }
  return lines
}

export async function findSharedJob(id: string): Promise<any | null> {
  const wanted = String(id || '').trim()
  if (!wanted) return null
  const cached = cacheGet(`job:${wanted}`)
  if (cached) return cached.value

  try {
    // SSR never imports the vacancy ingestion store. A tiny read-only API lookup
    // is enough for the social card and keeps crawler work out of the renderer.
    const response = await fetch(`${JOBS_API_URL}/jobs-vacancy?id=${encodeURIComponent(wanted)}`, {
      signal: AbortSignal.timeout(SHARE_LOOKUP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return cacheSet(`job:${wanted}`, null)
    const data = await response.json() as { job?: any }
    return cacheSet(`job:${wanted}`, data?.job || null)
  } catch {
    return null
  }
}

export async function findSharedFlat(id: string, source = '', country = ''): Promise<any | null> {
  const wanted = String(id || '').trim()
  if (!wanted) return null

  const params = new URLSearchParams({ listingId: wanted, limit: '1', offset: '0' })
  const normalizedSource = String(source || '').trim().toLowerCase()
  const normalizedCountry = String(country || '').trim().toUpperCase()
  if (VALID_FLAT_SOURCES.has(normalizedSource)) params.set('sources', normalizedSource)
  if (/^[A-Z]{2}$/.test(normalizedCountry)) params.set('countries', normalizedCountry)

  const key = `flat:${params}`
  const cached = cacheGet(key)
  if (cached) return cached.value

  try {
    const response = await fetch(`${FLAT_API_URL}/api/listings?${params}`, {
      signal: AbortSignal.timeout(SHARE_LOOKUP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return cacheSet(key, null)
    const data = await response.json() as any
    const found = Array.isArray(data?.listings)
      ? data.listings.find((listing: any) => String(listing?.id) === wanted) || data.listings[0] || null
      : null
    // Don't cache a miss caused by a cold snapshot — the listing may well appear
    // once the country finishes warming.
    if (!found && data?.warming) return null
    return cacheSet(key, found)
  } catch {
    return null
  }
}

function salaryLabel(job: any): string {
  const min = Number(job?.salaryMin)
  const max = Number(job?.salaryMax)
  if (!Number.isFinite(min) && !Number.isFinite(max)) return ''
  const currency = cleanShareText(job?.salaryCurrency || 'USD', 8)
  const period = job?.salaryPeriod ? `/${cleanShareText(job.salaryPeriod, 12)}` : ''
  const format = (value: number) => Math.round(value).toLocaleString('en-US')
  if (Number.isFinite(min) && Number.isFinite(max)) return `${format(min)}–${format(max)} ${currency}${period}`
  if (Number.isFinite(min)) return `from ${format(min)} ${currency}${period}`
  return `up to ${format(max)} ${currency}${period}`
}

function flatPriceLabel(flat: any): string {
  const price = Number(flat?.price)
  if (!Number.isFinite(price)) return ''
  return `${Math.round(price).toLocaleString('en-US')} ${cleanShareText(flat?.currency || '', 8)}`.trim()
}

export function buildJobShareMeta(job: any, id: string, pathname = '/jobs'): ShareMeta {
  const title = cleanShareText([job?.title, job?.company].filter(Boolean).join(' — '), 120) || 'Vacancy · Job Finder'
  const details = [
    cleanShareText(job?.location, 80),
    job?.remote ? 'Remote' : '',
    salaryLabel(job),
    Array.isArray(job?.skills) ? job.skills.slice(0, 5).join(' · ') : '',
  ].filter(Boolean)
  const description = cleanShareText(details.join(' · ') || job?.description || 'Vacancy from Job Finder', 200)
  const encoded = encodeURIComponent(id)
  return {
    title,
    description,
    image: `${SHARE_SITE_URL}/share/job-og.png?job=${encoded}`,
    imageType: 'image/png',
    url: `${SHARE_SITE_URL}${pathname}?job=${encoded}`,
    type: 'article',
  }
}

export function buildFlatShareMeta(flat: any, id: string, source = '', country = '', pathname = '/flat-finder'): ShareMeta {
  const fallbackTitle = [
    Number.isFinite(Number(flat?.rooms)) ? `${flat.rooms}-room` : '',
    flat?.propertyType === 'house' ? 'house' : 'apartment',
    cleanShareText(flat?.city, 50),
  ].filter(Boolean).join(' · ')
  const title = cleanShareText(flat?.title, 120) || fallbackTitle || 'Property listing · Flat Finder'
  const floor = Number.isFinite(Number(flat?.floor))
    ? Number.isFinite(Number(flat?.totalFloors)) ? `${flat.floor}/${flat.totalFloors} floor` : `${flat.floor} floor`
    : ''
  const description = cleanShareText([
    flatPriceLabel(flat),
    [flat?.city, flat?.district, flat?.area || flat?.kvartal].filter(Boolean).join(', '),
    Number.isFinite(Number(flat?.areaSqm)) ? `${flat.areaSqm} m²` : '',
    floor,
    flat?.petsAllowed === true ? 'Pet-friendly' : '',
  ].filter(Boolean).join(' · ') || flat?.description || 'Property listing from Flat Finder', 200)

  const imageParams = new URLSearchParams({ flat: id })
  if (source) imageParams.set('source', source)
  if (country) imageParams.set('country', country)
  const pageParams = new URLSearchParams({ flat: id })
  if (source) pageParams.set('flatSource', source)
  if (country) pageParams.set('flatCountry', country)

  return {
    title,
    description,
    image: `${SHARE_SITE_URL}/share/flat-og.jpg?${imageParams}`,
    imageType: 'image/jpeg',
    url: `${SHARE_SITE_URL}${pathname}?${pageParams}`,
    type: 'website',
  }
}

export function flatPhotoUrl(flat: any): string | null {
  const raw = flat?.photo || (Array.isArray(flat?.photos) ? flat.photos.find(Boolean) : null)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

export function upstreamFlatPhotoUrl(photo: string): string | null {
  if (/^\/api\/tg-photo\/[A-Za-z0-9_]{3,64}\/\d+$/.test(photo)) return `${FLAT_API_URL}${photo}`
  if (/^https?:\/\//i.test(photo)) return photo
  return null
}
