/**
 * Data-rights request shape shared by the form and the BFF route (§47, §48).
 *
 * The backend (whiteslove.me-backend-platform, POST /api/privacy/requests)
 * owns validation and canonicalisation of identifiers; this module only
 * shapes what the form sends and rejects obviously unusable input early, so
 * the visitor gets an answer without a round trip. It deliberately has no
 * field for identity documents.
 */

export const REQUEST_TYPES = ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability', 'dispute'] as const
export type RequestType = typeof REQUEST_TYPES[number]

export const IDENTIFIER_TYPES = ['phone', 'telegram', 'email', 'whatsapp', 'viber', 'facebook', 'threads'] as const
export type IdentifierType = typeof IDENTIFIER_TYPES[number]

export const DISPUTE_TYPES = ['wrong_phone_association', 'wrong_identity_merge', 'incorrect_role', 'stale_username', 'wrong_property_association', 'incorrect_risk_evidence'] as const
export type DisputeType = typeof DISPUTE_TYPES[number]

export const MAX_IDENTIFIERS = 5
export const MAX_DETAILS = 4000

export type DataRightsDraft = {
  requestType: string
  requesterEmail: string
  identifiers: { type: string; value: string }[]
  disputeType?: string
  details?: string
}

export type DataRightsPayload = {
  requestType: RequestType
  requesterEmail: string
  identifiers: { type: IdentifierType; value: string }[]
  details: string | null
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/u
const REFERENCE = /^PR-[A-Za-z0-9_-]{20}$/u

export function isRequestReference(value: unknown): value is string {
  return typeof value === 'string' && REFERENCE.test(value)
}

/**
 * Builds the backend payload, or the list of field errors. The dispute kind
 * is folded into the free-text details: the public intake identifies people
 * by their identifiers, not by internal record ids a visitor cannot know, and
 * the reviewer opens the dispute case against the right record.
 */
export function buildDataRightsPayload(draft: DataRightsDraft): { ok: true; payload: DataRightsPayload } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const requestType = String(draft?.requestType ?? '') as RequestType
  if (!REQUEST_TYPES.includes(requestType)) errors.push('requestType')

  const requesterEmail = String(draft?.requesterEmail ?? '').trim()
  if (!EMAIL.test(requesterEmail) || requesterEmail.length > 254) errors.push('requesterEmail')

  const identifiers = (Array.isArray(draft?.identifiers) ? draft.identifiers : [])
    .map((item) => ({ type: String(item?.type ?? '') as IdentifierType, value: String(item?.value ?? '').trim() }))
    .filter((item) => item.value)
  if (!identifiers.length) errors.push('identifiers')
  if (identifiers.length > MAX_IDENTIFIERS) errors.push('identifiers')
  if (identifiers.some((item) => !IDENTIFIER_TYPES.includes(item.type) || item.value.length > 200)) errors.push('identifiers')

  let disputeLine = ''
  if (requestType === 'dispute') {
    const disputeType = String(draft?.disputeType ?? '') as DisputeType
    if (!DISPUTE_TYPES.includes(disputeType)) errors.push('disputeType')
    else disputeLine = `dispute_type: ${disputeType}`
  }

  const text = String(draft?.details ?? '').trim()
  if (text.length > MAX_DETAILS) errors.push('details')

  if (errors.length) return { ok: false, errors: [...new Set(errors)] }
  const details = [disputeLine, text].filter(Boolean).join('\n\n')
  return {
    ok: true,
    payload: { requestType, requesterEmail, identifiers: identifiers.slice(0, MAX_IDENTIFIERS), details: details || null },
  }
}
