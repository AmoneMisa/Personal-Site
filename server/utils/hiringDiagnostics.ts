// What each candidate source last did.
//
// Telegram channels and web/social candidate sources fail in different ways —
// a channel goes quiet, a board starts serving a captcha, or a social target is
// no longer public — but all produce the same question: did this source return
// nothing because there was nothing, or because it is broken? A run that
// records only "fetched" and "candidates" cannot answer it, so every stage of
// the web/social funnel is counted here.

/** The shape every source run shares; what durable storage needs. */
export interface SourceRun {
  /** "@channel" for Telegram, "web:<key>" / "social:<key>" otherwise. */
  handle: string
  country: string
  status: 'ok' | 'empty' | 'error' | 'disabled'
  fetched: number
  candidates: number
  checkedAt: string
  error?: string
}

/** Telegram handles are bare; web/social sources carry an explicit prefix. */
export function runOrigin(handle: string): 'telegram' | 'web' | 'social' {
  if (/^social:/i.test(handle)) return 'social'
  return /^web:/i.test(handle) ? 'web' : 'telegram'
}

export interface WebSourceDiagnostic extends SourceRun {
  key: string
  label: string
  /** Listing pages / social result surfaces actually requested this round. */
  pages: number
  /** Candidate cards/posts found on those surfaces. */
  blocks: number
  /** Cards/posts the parser turned into a profile. */
  parsed: number
  /** Cards/posts the parser refused (date, intent, vacancy, unusable shape). */
  rejected: number
  /** Profiles merged into one another because they share a URL. */
  duplicate: number
  /** Stored profiles from this source dropped by the three-month window. */
  expired: number
  /** Stored profiles from this source still inside the window after the run. */
  shown: number
  fetchDurationMs: number
  newestActivityAt: string | null
  oldestActivityAt: string | null
  /** Cursor state after the run — empty for non-cursor sources such as social search. */
  lastSeenProfileId: string
  lastSuccessAt: string | null
  /** True when the run stopped early because it reached the previous cursor. */
  reachedCursor: boolean
}

// Kept in memory only: this is a live view of the current process, and the
// durable history lives in the source_runs table.
const webDiagnostics = new Map<string, WebSourceDiagnostic>()

export function recordWebDiagnostic(diagnostic: WebSourceDiagnostic): void {
  webDiagnostics.set(diagnostic.key, diagnostic)
}

export function getHiringWebDiagnostics(): WebSourceDiagnostic[] {
  return [...webDiagnostics.values()].sort((a, b) => a.key.localeCompare(b.key))
}