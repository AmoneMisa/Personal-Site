type PlatformDomain = 'vacancies' | 'cv'

const TIMEOUT_MS = 20_000

function platformBaseUrl(domain: PlatformDomain): string {
  const key = domain === 'vacancies' ? 'VACANCIES_API_URL' : 'CV_API_URL'
  return String(process.env[key] || '').trim().replace(/\/$/, '')
}

/**
 * Forward one public read-only BFF request to the backend platform. Missing
 * configuration fails closed because the legacy domain implementation no
 * longer belongs to the website runtime.
 */
export async function requirePlatformGet(
  event: Parameters<typeof getRequestURL>[0],
  domain: PlatformDomain,
  path: string,
): Promise<unknown> {
  const baseUrl = platformBaseUrl(domain)
  if (!baseUrl) {
    throw createError({
      statusCode: 503,
      statusMessage: `${domain} backend is not configured`,
    })
  }

  const incoming = getRequestURL(event)
  const upstream = new URL(path, `${baseUrl}/`)
  upstream.search = incoming.search

  try {
    const response = await fetch(upstream, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': getRequestHeader(event, 'accept-language') || '',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    const cacheControl = response.headers.get('cache-control')
    if (cacheControl) setResponseHeader(event, 'Cache-Control', cacheControl)
    setResponseHeader(event, 'X-Backend-Platform', domain)
    return response.json()
  } catch (error) {
    console.error(`[backend-platform:${domain}] ${upstream.pathname} failed:`, error)
    throw createError({
      statusCode: 502,
      statusMessage: `${domain} backend is unavailable`,
    })
  }
}
