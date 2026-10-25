// Same-origin BFF for CV filter metadata in backend-platform.
import { requirePlatformGet } from '../utils/backendPlatformProxy'
import { decorateHiringMeta, hiringUiLocale } from '../utils/hiringLabels'

export default defineEventHandler(async (event) => {
  const locale = hiringUiLocale(getQuery(event).locale)
  const payload = await requirePlatformGet(event, 'cv', '/hiring-meta', { dropParams: ['locale'] })
  return decorateHiringMeta(payload, locale)
})
