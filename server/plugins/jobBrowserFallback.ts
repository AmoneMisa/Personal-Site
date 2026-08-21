const FALLBACK_STATUSES = new Set([403, 429])
const DEFAULT_BROWSER_HOSTS = new Set([
  'taskfavour.com',
  'remote.co',
  'simplyhired.com',
  'visajobsearch.com',
  'visajobfinder.com',
  'migratemate.co',
  'gcsservices.careers.microsoft.com',
])

type FetchInput = Parameters<typeof globalThis.fetch>[0]
type FetchInit = Parameters<typeof globalThis.fetch>[1]

function normalizedHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
}

function targetHosts(): Set<string> {
  const out = new Set(DEFAULT_BROWSER_HOSTS)
  for (const raw of (process.env.JOB_BROWSER_ALLOWED_HOSTS || '').split(',')) {
    const host = normalizedHost(raw.trim())
    if (host) out.add(host)
  }
  return out
}

function inputUrl(input: FetchInput): URL | null {
  try {
    if (input instanceof Request) return new URL(input.url)
    return new URL(String(input))
  } catch {
    return null
  }
}

function inputMethod(input: FetchInput, init?: FetchInit): string {
  return String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
}

function forwardedHeaders(input: FetchInput, init?: FetchInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }
  return {
    accept: headers.get('accept') || undefined,
    acceptLanguage: headers.get('accept-language') || undefined,
  }
}

export default defineNitroPlugin(() => {
  const endpoint = (process.env.JOB_BROWSER_FETCHER_URL || '').trim().replace(/\/+$/, '')
  if (!endpoint) return

  const hosts = targetHosts()
  const originalFetch = globalThis.fetch.bind(globalThis)
  const proxyTimeoutMs = Math.max(5_000, Number(process.env.JOB_BROWSER_PROXY_TIMEOUT_MS) || 65_000)

  const browserFallback = async (url: URL, input: FetchInput, init?: FetchInit): Promise<Response> => {
    return originalFetch(`${endpoint}/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.toString(), ...forwardedHeaders(input, init) }),
      signal: AbortSignal.timeout(proxyTimeoutMs),
    })
  }

  const wrappedFetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    const url = inputUrl(input)
    if (!url || url.protocol !== 'https:' || inputMethod(input, init) !== 'GET') {
      return originalFetch(input, init)
    }

    const host = normalizedHost(url.hostname)
    if (!hosts.has(host)) return originalFetch(input, init)

    let primaryResponse: Response | undefined
    let primaryError: unknown

    try {
      primaryResponse = await originalFetch(input, init)
      if (!FALLBACK_STATUSES.has(primaryResponse.status)) return primaryResponse
      console.warn(`[jobs:browser-fallback] ${host} -> ${primaryResponse.status}; retrying with Chrome impersonation`)
    } catch (error) {
      primaryError = error
      console.warn(`[jobs:browser-fallback] ${host} native fetch failed; retrying with Chrome impersonation`)
    }

    try {
      const fallback = await browserFallback(url, input, init)
      if (fallback.ok) {
        console.info(`[jobs:browser-fallback] ${host} recovered via Chrome impersonation`)
      } else {
        console.warn(`[jobs:browser-fallback] ${host} browser fetch -> ${fallback.status}`)
      }
      return fallback
    } catch (fallbackError) {
      console.warn(
        `[jobs:browser-fallback] ${host} sidecar failed:`,
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      )
      if (primaryResponse) return primaryResponse
      throw primaryError instanceof Error ? primaryError : fallbackError
    }
  }

  globalThis.fetch = wrappedFetch as typeof globalThis.fetch
})
