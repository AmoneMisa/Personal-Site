import { ref } from "vue";
import type { FlatFeedResult, FlatPriceRange } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";
import { stableQueryKey } from "~/utils/stableQueryKey";
import { useLatestRequest } from "~/composables/search/useLatestRequest";

// Paging, sorting and the price filter itself do not change which prices exist
// under the other filters, so they are left out of the request (and its key).
const IGNORED_PARAMS = new Set(["priceMin", "priceMax", "priceCurrency", "limit", "offset", "cursor", "sort", "includeStats", "statsOnly"]);
const CACHE_MAX_ENTRIES = 30;

/**
 * Cheapest and dearest listing price under the current filters, in the
 * currency the visitor filters by. Flat Finder computes it; the page only uses
 * it to bound the price slider and inputs.
 */
export function useFlatPriceRange() {
  const priceRange = ref<FlatPriceRange | null>(null);
  const requests = useLatestRequest();
  const cache = new Map<string, FlatPriceRange | null>();

  async function refreshPriceRange(feedParams: Record<string, string>, currency: string) {
    const params: Record<string, string> = {
      ...Object.fromEntries(Object.entries(feedParams).filter(([key]) => !IGNORED_PARAMS.has(key))),
      priceRangeOnly: "1",
      priceCurrency: currency,
      limit: "1",
      offset: "0",
    };

    const key = stableQueryKey(params);
    if (cache.has(key)) {
      requests.cancelPending();
      priceRange.value = cache.get(key) ?? null;
      return;
    }

    const request = requests.next();
    const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params, signal: requests.signal() });
    if (!requests.isLatest(request)) return;
    // Keep the previous bounds through a failed request: a slider that briefly
    // disappears is worse than one that is a moment out of date.
    if (error || !data || data.error) return;

    const range = data.priceRange && data.priceRange.max > data.priceRange.min ? data.priceRange : null;
    cache.set(key, range);
    if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    priceRange.value = range;
  }

  return { priceRange, refreshPriceRange };
}
