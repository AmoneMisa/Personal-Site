import { buildDataRightsPayload } from '~~/shared/legal/dataRightsRequest'
import { enforceLimit, intakeLimiter, privacyApiRequest } from '../utils/privacyRequestProxy'

// Same-origin intake for the /data-rights form. Not under /api/** (that prefix
// is proxied to the legacy backend). Answers identically whether or not any
// data exists about the identifiers, like the backend it forwards to.
export default defineEventHandler(async (event) => {
  const clientIp = enforceLimit(event, intakeLimiter)
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const built = buildDataRightsPayload(await readBody(event))
  if (!built.ok) {
    setResponseStatus(event, 400)
    return { ok: false, errors: built.errors }
  }

  const { status, body } = await privacyApiRequest('/api/privacy/requests', { method: 'POST', body: built.payload, clientIp })
  setResponseStatus(event, status)
  return body
})
