import { shapeListing } from '../flats/feedListingShape'
import { FLAT_API_URL } from '../flats/feedLookup'

// The same contact's other listings, for the popup's "more from this contact"
// tab. Shaped like feed listings so photos go through the same proxy rewrite.
export default defineEventHandler(async (event) => {
  const publicId = Number(getQuery(event).publicId)
  if (!Number.isSafeInteger(publicId) || publicId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid public id' })
  }

  try {
    const data = await $fetch<{ listings?: unknown[] }>(
      `${FLAT_API_URL}/api/listing/by-public-id/${publicId}/contact-listings`,
      { timeout: 10_000, retry: 0 },
    )
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
    return { listings: Array.isArray(data?.listings) ? data.listings.map(shapeListing) : [] }
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Contact listings unavailable' })
  }
})
