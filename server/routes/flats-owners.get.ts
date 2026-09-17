import { FLAT_API_URL } from '../flats/feedLookup'

// Owner collections for the "Owners" tab: advertisers with two or more
// distinct active properties in a country, largest first.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const country = String(query.country || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) throw createError({ statusCode: 400, statusMessage: 'Invalid country' })
  const cursor = String(query.cursor || '')
  if (cursor && !/^\d{1,9}:[0-9a-f]{24}$/.test(cursor)) throw createError({ statusCode: 400, statusMessage: 'Invalid cursor' })

  const params = new URLSearchParams({ country, limit: '24' })
  if (cursor) params.set('cursor', cursor)
  try {
    const data = await $fetch<{ owners?: unknown[]; next?: string | null }>(`${FLAT_API_URL}/api/owners?${params}`, { timeout: 10_000, retry: 0 })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
    return { owners: Array.isArray(data?.owners) ? data.owners : [], next: data?.next ?? null }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Owners unavailable' })
  }
})
