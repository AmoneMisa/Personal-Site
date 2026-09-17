import { FLAT_API_URL } from '../flats/feedLookup'

// One owner, for the breadcrumb above an owner's collection.
export default defineEventHandler(async (event) => {
  const key = String(getQuery(event).key || '')
  if (!/^[0-9a-f]{24}$/.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid owner' })
  try {
    const data = await $fetch<{ owner?: unknown }>(`${FLAT_API_URL}/api/owners/${key}`, { timeout: 10_000, retry: 0 })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
    return { owner: data?.owner ?? null }
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode
    throw createError({ statusCode: status === 404 ? 404 : 502, statusMessage: status === 404 ? 'Owner not found' : 'Owner unavailable' })
  }
})
