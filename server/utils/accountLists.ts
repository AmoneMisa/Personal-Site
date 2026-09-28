// The sections whose saved lists live with the Google account, besides flats
// (which have their own saved-state API). Mirrors LIST_DOMAINS in
// whiteslove.me-backend-platform apps/flats/src/mobile/mobile-lists.js.
export const ACCOUNT_LIST_DOMAINS = ['jobs', 'cv'] as const
export type AccountListDomain = typeof ACCOUNT_LIST_DOMAINS[number]

// The backend's per-request cap.
export const ACCOUNT_LIST_MAX_OPS = 200

export function accountListDomain(value: unknown): AccountListDomain | null {
  const domain = String(value ?? '')
  return (ACCOUNT_LIST_DOMAINS as readonly string[]).includes(domain) ? domain as AccountListDomain : null
}
