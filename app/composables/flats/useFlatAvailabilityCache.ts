// Availability freshness is owned by the flat-finder backend and persisted in
// PostgreSQL (`listings.availability_checked_at/status/reason`). The frontend
// must still ask the backend before opening an OLX listing; the backend decides
// whether the stored result is fresh enough to reuse or whether OLX must be
// probed again. Keeping a second browser TTL caused the UI to bypass newer
// backend availability decisions.
export function useFlatAvailabilityCache() {
  function isFresh(_key: string): boolean {
    return false;
  }

  function markFresh(_keys: string | string[], _at = Date.now()) {
    // Intentionally not cached in the browser. PostgreSQL is the source of truth.
  }

  function forget(_key: string) {
    // Nothing to evict client-side.
  }

  return { isFresh, markFresh, forget, ttlMs: 0 };
}
