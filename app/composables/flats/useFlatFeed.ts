import { ref } from "vue";
import type { FlatFeedResult, FlatListing, FlatStatistics } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";

export function useFlatFeed(options: { onAvailabilityChecked?: (keys: string[]) => void } = {}) {
  const listings = ref<FlatListing[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const loadingMore = ref(false);
  const warming = ref(false);
  const failed = ref(false);
  const sourceErrors = ref<FlatFeedResult["sourceErrors"]>([]);
  const statistics = ref<FlatStatistics | null>(null);
  const nextCursor = ref<string | null>(null);
  const loadMoreSentinel = ref<HTMLElement | null>(null);
  const requests = useLatestRequest();
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let warmParams: Record<string, string> | null = null;

  function scheduleWarmPoll() {
    if (warmTimer) clearTimeout(warmTimer);
    if (!warming.value || !warmParams) return;
    warmTimer = setTimeout(() => {
      warmTimer = undefined;
      void loadFeed(warmParams!, { background: true });
    }, 1800);
  }

  async function loadFeed(params: Record<string, string>, options: { append?: boolean; background?: boolean } = {}): Promise<FlatFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    const requestId = requests.next();
    if (!append) warmParams = { ...params };
    if (!background) {
      if (warmTimer) clearTimeout(warmTimer);
      if (append) loadingMore.value = true;
      else loading.value = true;
      failed.value = false;
    }

    const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params });
    if (!requests.isLatest(requestId)) return undefined;
    if (error || !data || data.error) {
      if (!background) {
        failed.value = true;
        if (!append) { listings.value = []; total.value = 0; statistics.value = null; nextCursor.value = null; }
        sourceErrors.value = [];
        loading.value = false;
        loadingMore.value = false;
      }
      scheduleWarmPoll();
      return undefined;
    }
    if (data.availabilityChecked?.length) options.onAvailabilityChecked?.(data.availabilityChecked);
    if (background) {
      total.value = data.count ?? total.value;
      sourceErrors.value = data.sourceErrors || [];
      if (data.statistics) statistics.value = data.statistics;
      warming.value = !!data.warming;
      scheduleWarmPoll();
      return data;
    }

    nextCursor.value = data.nextCursor || null;
    const nextListings = Array.isArray(data.listings) ? data.listings : [];
    if (append) {
      const existingKeys = new Set(listings.value.map((item) => `${item.source}:${item.country}:${item.id}`));
      const unique = nextListings.filter((item) => {
        const key = `${item.source}:${item.country}:${item.id}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });
      listings.value = [...listings.value, ...unique];
    } else {
      listings.value = nextListings;
    }
    total.value = data.count ?? listings.value.length;
    if (!append) statistics.value = data.statistics || null;
    sourceErrors.value = data.sourceErrors || [];
    warming.value = !!data.warming;
    loading.value = false;
    loadingMore.value = false;
    scheduleWarmPoll();
    return data;
  }

  onBeforeUnmount(() => {
    if (warmTimer) clearTimeout(warmTimer);
    requests.cancelPending();
  });

  return { listings, total, loading, loadingMore, warming, failed, sourceErrors, statistics, nextCursor, loadMoreSentinel, loadFeed };
}
