/**
 * The operator's legal identity, read from configuration only (§43, §56).
 *
 * Nothing here has a default value. The operator is a natural person; their
 * name and privacy contact are deployment configuration, not source code, so
 * they can change without a release and are not committed to a repository
 * that may be public. Missing values are reported, and the legal pages show
 * that they still require operator review instead of inventing anything.
 */

export type LegalIdentity = {
  controllerName: string
  contactEmail: string
  operatorType: 'natural_person' | 'organization' | ''
  governingLaw: string
  complete: boolean
  missing: string[]
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/u

function clean(value: unknown, max = 200): string {
  // Control characters stripped by code point, so a configured value cannot
  // carry line breaks or escapes into a page.
  const text = [...String(value ?? '')].filter((char) => {
    const code = char.codePointAt(0) ?? 0
    return code > 0x1f && code !== 0x7f
  }).join('')
  return text.trim().slice(0, max)
}

export function readLegalIdentity(env: Record<string, string | undefined>): LegalIdentity {
  const controllerName = clean(env.PRIVACY_CONTROLLER_NAME)
  const rawEmail = clean(env.PRIVACY_CONTACT_EMAIL)
  const contactEmail = EMAIL.test(rawEmail) ? rawEmail : ''
  const rawType = clean(env.LEGAL_OPERATOR_TYPE)
  const operatorType = rawType === 'natural_person' || rawType === 'organization' ? rawType : ''
  const governingLaw = clean(env.LEGAL_GOVERNING_LAW)

  const missing: string[] = []
  if (!controllerName) missing.push('PRIVACY_CONTROLLER_NAME')
  if (!contactEmail) missing.push('PRIVACY_CONTACT_EMAIL')
  if (!operatorType) missing.push('LEGAL_OPERATOR_TYPE')
  if (!governingLaw) missing.push('LEGAL_GOVERNING_LAW')

  return { controllerName, contactEmail, operatorType, governingLaw, complete: missing.length === 0, missing }
}
