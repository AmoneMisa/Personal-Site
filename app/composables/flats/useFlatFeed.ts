import { nextTick, ref } from "vue";
import type { FlatFeedResult, FlatListing, FlatStatistics } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";
import { stableQueryKey } from "~/utils/stableQueryKey";
import { useLatestRequest } from "~/composables/search/useLatestRequest";
import { useFeedPolling } from "~/composables/search/useFeedPolling";

// Named `feedOptions`, not `options`: loadFeed() below takes its own `options`
// parameter, and the two used to collide. The inner one shadowed this, so
// `options.onAvailabilityChecked?.()` inside loadFeed silently resolved to
// undefined and the availability cache was never refreshed from feed responses.
// A first page the browser has already been given. The Nuxt route caches
// upstream responses too, but it answers with `Cache-Control: no-store`, so
// without this every re-visited filter combination still costs a full round
// trip -- and toggling a checkbox off and back on is the commonest thing a
// person does while narrowing a search.
const FEED_CACHE_TTL_MS = 60_000;
const FEED_CACHE_MAX_ENTRIES = 40;

/** Stable regardless of the order buildFeedParams happened to insert keys in. */
export function feedCacheKey(params: Record<string, string>): string {
  return stableQueryKey(params);
}

export function useFlatFeed(feedOptions: { onAvailabilityChecked?: (keys: string[]) => void } = {}) {
  const listings = ref<FlatListing[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const loadingMore = ref(false);
  const warming = ref(false);
  const failed = ref(false);
  const sourceErrors = ref<FlatFeedResult["sourceErrors"]>([]);
  const statistics = ref<FlatStatistics | null>(null);
  const statisticsLoading = ref(false);
  const nextCursor = ref<string | null>(null);
  const loadMoreSentinel = ref<HTMLElement | null>(null);
  const requests = useLatestRequest();
  let statisticsRequestId = 0;
  const responseCache = new Map<string, { at: number; data: FlatFeedResult }>();

  function readFeedCache(params: Record<string, string>): FlatFeedResult | undefined {
    const key = feedCacheKey(params);
    const entry = responseCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.at > FEED_CACHE_TTL_MS) {
      responseCache.delete(key);
      return undefined;
    }
    // Map insertion order is used for eviction, so a read must promote the
    // entry or this is FIFO rather than the intended LRU cache.
    responseCache.delete(key);
    responseCache.set(key, entry);
    return entry.data;
  }

  /** Lets the page skip its own filter debounce for an answer already in hand. */
  function isFeedCached(params: Record<string, string>): boolean {
    return readFeedCache(params) !== undefined;
  }

  function writeFeedCache(params: Record<string, string>, data: FlatFeedResult) {
    // A still-warming upstream response is a placeholder, not an answer.
    if (data.warming) return;
    const key = feedCacheKey(params);
    responseCache.delete(key);
    responseCache.set(key, { at: Date.now(), data });
    // Insertion-ordered, so the oldest key is the first one out.
    while (responseCache.size > FEED_CACHE_MAX_ENTRIES) {
      const oldest = responseCache.keys().next().value;
      if (oldest === undefined) break;
      responseCache.delete(oldest);
    }
  }

  /** Paints a cached first page. Mirrors the non-append branch of loadFeed. */
  function applyFirstPage(data: FlatFeedResult) {
    nextCursor.value = data.nextCursor || null;
    listings.value = Array.isArray(data.listings) ? data.listings : [];
    total.value = data.count ?? listings.value.length;
    sourceErrors.value = data.sourceErrors || [];
    warming.value = !!data.warming;
    if (data.statistics) void setStatisticsWithoutViewportJump(data.statistics);
  }

  const polling = useFeedPolling<Record<string, string>>({
    onWarmPoll: (params) => {
      void loadFeed(params, { background: true, warmPoll: true });
    },
    // The flat-finder page debounces every filter interaction itself, at a
    // longer interval chosen for its own uncached-query costs. Keeping this
    // second one only added its delay to that one before anything was sent.
    filterDebounceMs: 0,
  });

  function resetFirstPageState() {
    listings.value = [];
    total.value = 0;
    nextCursor.value = null;
  }

  async function setStatisticsWithoutViewportJump(value: FlatStatistics) {
    if (!import.meta.client) {
      statistics.value = value;
      return;
    }

    const top = window.scrollY;
    const left = window.scrollX;
    statistics.value = value;
    await nextTick();

    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - top) > 1 || Math.abs(window.scrollX - left) > 1) {
        window.scrollTo({ top, left, behavior: "auto" });
      }
    });
  }

  async function loadStatistics(params: Record<string, string>, requestId: number) {
    statisticsLoading.value = true;
    const statsParams: Record<string, string> = {
      ...params,
      includeStats: "1",
      statsOnly: "1",
      limit: "1",
      offset: "0",
    };
    delete statsParams.cursor;

    try {
      const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params: statsParams });
      if (requestId !== statisticsRequestId || error || !data || data.error) {
        return;
      }
      if (data.statistics) {
        await setStatisticsWithoutViewportJump(data.statistics);
      }
    } finally {
      if (requestId === statisticsRequestId) {
        statisticsLoading.value = false;
      }
    }
  }

  async function loadFeed(
    params: Record<string, string>,
    options: { append?: boolean; background?: boolean; warmPoll?: boolean } = {},
  ): Promise<FlatFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    const warmPoll = !!options.warmPoll;

    // Cache hit: paint now, then revalidate behind the result. The visitor sees
    // the previous answer to this exact question immediately instead of a
    // spinner, and a changed upstream still lands a moment later.
    if (!append && !background) {
      const cached = readFeedCache(params);
      if (cached) {
        requests.next();
        applyFirstPage(cached);
        loading.value = false;
        loadingMore.value = false;
        failed.value = false;
        void loadFeed(params, { background: true });
        return cached;
      }
    }

    // Show the pending state before the debounce, not after it. The filter
    // debounce here stacks on top of the page's own one, so the results grid
    // used to sit there looking settled for half a second after a click before
    // the first skeleton appeared. A superseded call leaves the flag alone:
    // the call that superseded it is still loading.
    if (!append && !background) {
      loading.value = true;
      failed.value = false;
      if (!(await polling.debounceFilterRequest())) return undefined;
    }

    const requestId = requests.next();
    const wantsStatistics = !append && params.includeStats === "1";
    const currentStatisticsRequestId = !append ? ++statisticsRequestId : statisticsRequestId;

    if (!append) {
      polling.rememberWarmParams({ ...params });
    }

    if (!background) {
      polling.cancelWarmPoll();
      if (append) {
        loadingMore.value = true;
      } else {
        loading.value = true;
      }
      failed.value = false;
    }

    // Keep the first page fast: PostgreSQL statistics are requested separately,
    // but they are always calculated over the complete filtered result set.
    const feedParams = { ...params };
    if (wantsStatistics) {
      delete feedParams.includeStats;
    }

    const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params: feedParams, signal: requests.signal() });
    if (!requests.isLatest(requestId)) {
      return undefined;
    }

    if (error || !data || data.error) {
      if (!background) {
        failed.value = true;
        if (!append) {
          resetFirstPageState();
        }
        sourceErrors.value = [];
        loading.value = false;
        loadingMore.value = false;
      }
      polling.scheduleWarmPoll(warming.value);
      return undefined;
    }

    if (data.availabilityChecked?.length) {
      feedOptions.onAvailabilityChecked?.(data.availabilityChecked);
    }

    if (background) {
      if (!append) {
        total.value = data.count ?? total.value;
        writeFeedCache(params, data);
      }
      sourceErrors.value = data.sourceErrors || [];
      if (data.statistics) {
        void setStatisticsWithoutViewportJump(data.statistics);
      }
      warming.value = !!data.warming;
      if (wantsStatistics && !warmPoll) {
        void loadStatistics(params, currentStatisticsRequestId);
      }
      polling.scheduleWarmPoll(warming.value);
      return data;
    }

    nextCursor.value = data.nextCursor || null;
    const nextListings = Array.isArray(data.listings) ? data.listings : [];

    if (append) {
      const existingKeys = new Set(listings.value.map((item) => `${item.source}:${item.country}:${item.id}`));
      const unique = nextListings.filter((item) => {
        const key = `${item.source}:${item.country}:${item.id}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
      listings.value = [...listings.value, ...unique];
    } else {
      listings.value = nextListings;
    }

    if (!append) {
      total.value = data.count ?? listings.value.length;
    }
    if (!append && data.statistics) {
      void setStatisticsWithoutViewportJump(data.statistics);
    }

    sourceErrors.value = data.sourceErrors || [];
    warming.value = !!data.warming;
    loading.value = false;
    loadingMore.value = false;
    if (!append) writeFeedCache(params, data);

    if (wantsStatistics) {
      void loadStatistics(params, currentStatisticsRequestId);
    }

    polling.scheduleWarmPoll(warming.value);
    return data;
  }

  onBeforeUnmount(() => {
    statisticsRequestId++;
    requests.cancelPending();
  });

  return {
    listings,
    total,
    loading,
    loadingMore,
    warming,
    failed,
    sourceErrors,
    statistics,
    statisticsLoading,
    nextCursor,
    loadMoreSentinel,
    loadFeed,
    isFeedCached,
  };
}
