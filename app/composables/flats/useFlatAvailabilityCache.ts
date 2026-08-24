const CACHE_KEY = "flats:availability:v1";
const VERIFIED_TTL_MS = 15 * 60_000;

export function useFlatAvailabilityCache() {
  const checkedAt = useState<Record<string, number>>("flats-availability-cache", () => ({}));
  let hydrated = false;

  function hydrate() {
    if (hydrated || !import.meta.client) return;
    hydrated = true;
    try {
      const value = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
      if (value && typeof value === "object") checkedAt.value = value;
    } catch {
      checkedAt.value = {};
    }
    prune();
  }

  function persist() {
    if (!import.meta.client) return;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(checkedAt.value));
  }

  function prune(now = Date.now()) {
    const next = Object.fromEntries(Object.entries(checkedAt.value).filter(([, at]) => now - Number(at) < VERIFIED_TTL_MS));
    if (Object.keys(next).length !== Object.keys(checkedAt.value).length) {
      checkedAt.value = next;
      persist();
    }
  }

  function isFresh(key: string): boolean {
    hydrate();
    return Date.now() - Number(checkedAt.value[key] || 0) < VERIFIED_TTL_MS;
  }

  function markFresh(keys: string | string[], at = Date.now()) {
    hydrate();
    const next = { ...checkedAt.value };
    for (const key of Array.isArray(keys) ? keys : [keys]) if (key) next[key] = at;
    checkedAt.value = next;
    prune(at);
    persist();
  }

  function forget(key: string) {
    hydrate();
    if (!(key in checkedAt.value)) return;
    const next = { ...checkedAt.value };
    delete next[key];
    checkedAt.value = next;
    persist();
  }

  return { isFresh, markFresh, forget, ttlMs: VERIFIED_TTL_MS };
}
