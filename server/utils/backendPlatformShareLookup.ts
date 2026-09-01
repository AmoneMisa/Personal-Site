type PlatformShareDomain = 'vacancies' | 'cv'

const SHARE_LOOKUP_TIMEOUT_MS = Number(process.env.SHARE_LOOKUP_TIMEOUT_MS) || 2500
const cache = new Map<string, { at: number; value: any }>()
const HIT_TTL_MS = 10 * 60_000
const MISS_TTL_MS = 30_000

function baseUrl(domain: PlatformShareDomain): string {
  const key = domain === 'vacancies' ? 'VACANCIES_API_URL' : 'CV_API_URL'
  return String(process.env[key] || '').trim().replace(/\/$/, '')
}

function cached(key: string): { value: any } | null {
  const hit = cache.get(key)
  if (!hit) return null
  const ttl = hit.value ? HIT_TTL_MS : MISS_TTL_MS
  if (Date.now() - hit.at > ttl) {
    cache.delete(key)
    return null
  }
  return { value: hit.value }
}

function remember(key: string, value: any): any {
  if (cache.size > 500) cache.clear()
  cache.set(key, { at: Date.now(), value })
  return value
}

async function platformJson(domain: PlatformShareDomain, path: string, params: URLSearchParams): Promise<any | null> {
  const base = baseUrl(domain)
  if (!base) return null

  try {
    const response = await fetch(`${base}${path}?${params}`, {
      signal: AbortSignal.timeout(SHARE_LOOKUP_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function findPlatformSharedJob(value: string, byPublicId = false): Promise<any | null> {
  const wanted = String(value || '').trim()
  if (!wanted) return null

  const key = `platform:job:${byPublicId ? 'public' : 'legacy'}:${wanted}`
  const hit = cached(key)
  if (hit) return hit.value

  const params = new URLSearchParams({ [byPublicId ? 'publicId' : 'id']: wanted })
  const data = await platformJson('vacancies', '/jobs-vacancy', params)
  return remember(key, data?.job || null)
}

export async function findPlatformSharedCandidate(
  value: string,
  byPublicId = false,
  source = '',
  country = '',
): Promise<any | null> {
  const wanted = String(value || '').trim()
  if (!wanted) return null

  const normalizedSource = String(source || '').trim().toLowerCase()
  const normalizedCountry = String(country || '').trim().toUpperCase()
  const key = `platform:candidate:${byPublicId ? 'public' : 'legacy'}:${wanted}:${normalizedSource}:${normalizedCountry}`
  const hit = cached(key)
  if (hit) return hit.value

  const params = new URLSearchParams({
    [byPublicId ? 'publicId' : 'profileId']: wanted,
    limit: '1',
    offset: '0',
  })
  if (!byPublicId && normalizedSource) params.set('sources', normalizedSource)
  if (!byPublicId && /^[A-Z]{2}$/.test(normalizedCountry)) params.set('countries', normalizedCountry)

  const data = await platformJson('cv', '/hiring-feed', params)
  const profiles = Array.isArray(data?.profiles) ? data.profiles : []
  const found = byPublicId
    ? profiles.find((profile: any) => String(profile?.publicId ?? '') === wanted) || profiles[0] || null
    : profiles.find((profile: any) => String(profile?.id ?? '') === wanted || String(profile?.url ?? '') === wanted) || profiles[0] || null

  // A cold backend can legitimately miss a profile while warming; don't cache
  // that transient miss, otherwise social crawlers keep seeing the fallback.
  if (!found && data?.warming) return null
  return remember(key, found)
}
