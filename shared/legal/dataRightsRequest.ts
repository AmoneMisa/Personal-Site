/**
 * Data-rights request shape for the /data-rights form (§47, §48).
 *
 * Shapes what the form puts into the email and rejects obviously unusable
 * input early. It deliberately has no field for identity documents.
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
const MAILTO_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u

/**
 * The request as an email to the operator's privacy address.
 *
 * Requests go to the operator's inbox rather than a database queue: there is
 * no admin interface, and a queue nobody reads would miss the one-month
 * deadline. Nothing is sent by the site; the visitor's own mail client opens
 * with the text filled in, and they decide whether to send it.
 */
export function buildDataRightsMailto(to: string, payload: DataRightsPayload): string | null {
  // Stricter than EMAIL: the address goes into a URL unencoded, so anything
  // that could start a query (?cc=, &bcc=) or break out of it is refused.
  if (!MAILTO_ADDRESS.test(to)) return null
  const subject = `Data request: ${payload.requestType}`
  const body = [
    `Request type: ${payload.requestType}`,
    `Reply to: ${payload.requesterEmail}`,
    'Identifiers:',
    ...payload.identifiers.map((item) => `- ${item.type}: ${item.value}`),
    ...(payload.details ? ['', payload.details] : []),
  ].join('\n')
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
