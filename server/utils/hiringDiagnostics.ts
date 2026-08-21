// What each candidate source last did.
//
// Telegram channels and web CV boards fail in different ways — a channel goes
// quiet, a board starts serving a captcha or silently changes its markup — but
// both produce the same question: did this source return nothing because there
// was nothing, or because it is broken? A run that records only "fetched" and
// "candidates" cannot answer it, so every stage of the web funnel is counted
// here: pages requested, cards found, profiles parsed, blocks rejected,
// duplicates merged, profiles dropped by retention, profiles left standing.

/** The shape every source run shares; what durable storage needs. */
export interface SourceRun {
  /** "@channel" for Telegram, "web:<key>" for a board. */
  handle: string
  country: string
  status: 'ok' | 'empty' | 'error' | 'disabled'
  fetched: number
  candidates: number
  checkedAt: string
  error?: string
}

/** Telegram handles are bare; every web source handle carries its prefix. */
export function runOrigin(handle: string): 'telegram' | 'web' {
  return /^web:/i.test(handle) ? 'web' : 'telegram'
}

export interface WebSourceDiagnostic extends SourceRun {
  key: string
  label: string
  /** Listing pages actually requested this round. */
  pages: number
  /** Candidate cards found on those pages. */
  blocks: number
  /** Cards the parser turned into a profile. */
  parsed: number
  /** Cards the parser refused (no date, out of window, unusable shape). */
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
  /** Cursor state after the run — where the next one resumes. */
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
