/**
 * Owner collections: advertisers with two or more distinct active
 * properties, identified by an opaque owner key (never the phone number in
 * URLs). The backend builds them (whiteslove.me-backend-platform,
 * listingLineRepository.refreshListingOwners).
 */

export type FlatOwner = {
  ownerKey: string
  contact: string
  country: string
  city: string | null
  properties: number
  listings: number
  listingLine: string | null
  sample: { publicId: number; title: string; photo: string | null } | null
}

const OWNER_KEY_RE = /^[0-9a-f]{24}$/

export function isOwnerKey(value: unknown): value is string {
  return typeof value === 'string' && OWNER_KEY_RE.test(value)
}

/** Country calling code -> national grouping, for the markets the service
 * covers. Anything else is shown as the plain E.164 number: grouping digits
 * without knowing the country code's length produces wrong splits. */
const PHONE_GROUPS: Array<[string, number[]]> = [
  ['998', [2, 3, 2, 2]], // UZ +998 90 123 45 67
  ['996', [3, 3, 3]], // KG +996 555 123 456
  ['380', [2, 3, 2, 2]], // UA +380 67 123 45 67
  ['40', [3, 3, 3]], // RO +40 721 234 567
  ['7', [3, 3, 2, 2]], // KZ +7 701 234 56 78
]

/** Readable contact for a card or breadcrumb. */
export function ownerLabel(contact: string): string {
  if (!/^\+\d{7,15}$/.test(contact)) return contact
  const digits = contact.slice(1)
  for (const [code, groups] of PHONE_GROUPS) {
    const national = digits.slice(code.length)
    if (!digits.startsWith(code) || national.length !== groups.reduce((sum, size) => sum + size, 0)) continue
    const parts: string[] = []
    let offset = 0
    for (const size of groups) {
      parts.push(national.slice(offset, offset + size))
      offset += size
    }
    return `+${code} ${parts.join(' ')}`
  }
  return contact
}
