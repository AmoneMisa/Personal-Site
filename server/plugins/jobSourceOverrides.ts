const STALE_INTELLIAS_LEVER = /^https:\/\/api\.lever\.co\/v0\/postings\/intellias(?:\?|$)/i

export default defineNitroPlugin(() => {
  // Job-source fetch overrides belong to the isolated jobs runtime. The public
  // Nuxt renderer must leave global fetch untouched.
  if (String(process.env.JOBS_EXECUTION_ENABLED || 'off').toLowerCase() !== 'on') return

  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let url = ''
    try {
      url = input instanceof Request ? input.url : String(input)
    } catch {
      return originalFetch(input, init)
    }

    if (STALE_INTELLIAS_LEVER.test(url)) {
      // Intellias no longer exposes a Lever board. Returning an empty board keeps
      // the legacy seeded handle harmless while the real vacancies are loaded
      // from career.intellias.com's public WordPress API.
      return new Response('[]', {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Job-Source-Override': 'intellias-wp-api',
        },
      })
    }

    return originalFetch(input, init)
  }) as typeof globalThis.fetch
})
