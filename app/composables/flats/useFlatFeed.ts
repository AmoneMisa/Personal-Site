import { nextTick, ref } from "vue";
import type { FlatFeedResult, FlatListing, FlatStatistics } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";
import { useFeedPolling } from "~/composables/search/useFeedPolling";

// Named `feedOptions`, not `options`: loadFeed() below takes its own `options`
// parameter, and the two used to collide. The inner one shadowed this, so
// `options.onAvailabilityChecked?.()` inside loadFeed silently resolved to
// undefined and the availability cache was never refreshed from feed responses.
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

  const polling = useFeedPolling<Record<string, string>>({
    onWarmPoll: (params) => {
      void loadFeed(params, { background: true });
    },
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
    const statsParams = {
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
    options: { append?: boolean; background?: boolean } = {},
  ): Promise<FlatFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;

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

    const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params: feedParams });
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
      }
      sourceErrors.value = data.sourceErrors || [];
      if (data.statistics) {
        void setStatisticsWithoutViewportJump(data.statistics);
      }
      warming.value = !!data.warming;
      if (wantsStatistics) {
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
  };
}
