import { isRequestReference } from '~~/shared/legal/dataRightsRequest'
import { enforceLimit, privacyApiRequest, statusLimiter } from '../utils/privacyRequestProxy'

// Status of a data-rights request by its reference. The reference is the only
// credential; the answer contains only status and dates.
export default defineEventHandler(async (event) => {
  const clientIp = enforceLimit(event, statusLimiter)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const reference = getQuery(event).reference
  if (!isRequestReference(reference)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_reference' }
  }

  const { status, body } = await privacyApiRequest(`/api/privacy/requests/${encodeURIComponent(reference)}`, { method: 'GET', clientIp })
  setResponseStatus(event, status)
  return body
})
