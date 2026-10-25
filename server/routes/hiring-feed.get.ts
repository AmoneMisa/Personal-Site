// Same-origin BFF for the isolated CV API in backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'
import { decorateHiringFeed, hiringUiLocale } from '../utils/hiringLabels'

export default defineEventHandler(async (event) => {
  const locale = hiringUiLocale(getQuery(event).locale)
  const payload = await requirePlatformGet(event, 'cv', '/hiring-feed', { dropParams: ['locale'] })
  return decorateHiringFeed(payload, locale)
})
