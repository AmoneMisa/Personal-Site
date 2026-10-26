import { FLAT_API_URL } from '../flats/feedLookup'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const publicId = Number(query.publicId)
  const section = String(query.section || 'history')
  const before = query.before == null ? undefined : String(query.before)
  if (!Number.isSafeInteger(publicId) || publicId <= 0 || !['history', 'duplicates'].includes(section)
    || (before != null && !/^\d{1,19}$/.test(before))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid activity query' })
  }
  try {
    const result = await $fetch(`${FLAT_API_URL}/api/listing/by-public-id/${publicId}/${section}`, {
      params: before ? { before } : {}, timeout: 10_000, retry: 0,
    })
    setResponseHeader(event, 'Cache-Control', 'public, max-age=30')
    return result
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Listing activity unavailable' })
  }
})
