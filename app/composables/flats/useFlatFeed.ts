import { nextTick, ref } from "vue";
import type { FlatFeedResult, FlatListing, FlatPriceBandKey, FlatStatistics, FlatStatsDealKey } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";

const PRICE_BAND_ORDER: FlatPriceBandKey[] = ["green", "blue", "pink", "orange", "yellow", "red"];

function listingDealKey(listing: FlatListing): FlatStatsDealKey {
  if (listing.roomOnly) return "roomRent";
  return listing.dealType || "unknown";
}

function priceBandForRatio(ratio: number): FlatPriceBandKey {
  if (ratio < 0.70) return "green";
  if (ratio < 0.85) return "blue";
  if (ratio <= 1.15) return "pink";
  if (ratio < 1.31) return "orange";
  if (ratio < 1.45) return "yellow";
  return "red";
}

function withLoadedPriceBands(statistics: FlatStatistics, listings: FlatListing[]): FlatStatistics {
  const counts = new Map<FlatStatsDealKey, Map<FlatPriceBandKey, number>>();
  const samples = new Map<FlatStatsDealKey, number>();

  for (const listing of listings) {
    const ratio = listing.marketComparison?.priceRatio;
    if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) continue;
    const deal = listingDealKey(listing);
    const band = priceBandForRatio(ratio);
    const dealCounts = counts.get(deal) || new Map<FlatPriceBandKey, number>();
    dealCounts.set(band, (dealCounts.get(band) || 0) + 1);
    counts.set(deal, dealCounts);
    samples.set(deal, (samples.get(deal) || 0) + 1);
  }

  const priceBandsByDeal: FlatStatistics["priceBandsByDeal"] = {};
  const priceBandSamplesByDeal: FlatStatistics["priceBandSamplesByDeal"] = {};
  for (const deal of ["sale", "longRent", "shortRent", "roomRent", "unknown"] as FlatStatsDealKey[]) {
    const dealCounts = counts.get(deal);
    const sampleCount = samples.get(deal) || 0;
    if (!dealCounts || sampleCount === 0) continue;
    priceBandsByDeal[deal] = PRICE_BAND_ORDER.map((key) => ({ key, count: dealCounts.get(key) || 0 }));
    priceBandSamplesByDeal[deal] = sampleCount;
  }

  return { ...statistics, priceBandsByDeal, priceBandSamplesByDeal };
}

export function useFlatFeed(options: { onAvailabilityChecked?: (keys: string[]) => void } = {}) {
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
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let warmParams: Record<string, string> | null = null;

  async function setStatisticsWithoutViewportJump(value: FlatStatistics) {
    const enriched = withLoadedPriceBands(value, listings.value);
    if (!import.meta.client) {
      statistics.value = enriched;
      return;
    }
    const top = window.scrollY;
    const left = window.scrollX;
    statistics.value = enriched;
    await nextTick();
    requestAnimationFrame(() => {
      // The analytics panel is inserted above the map/results. Preserve the exact
      // viewport so its late arrival cannot push the user's current cards away.
      if (Math.abs(window.scrollY - top) > 1 || Math.abs(window.scrollX - left) > 1) {
        window.scrollTo({ top, left, behavior: "auto" });
      }
    });
  }

  function refreshLoadedPriceBands() {
    if (!statistics.value) return;
    statistics.value = withLoadedPriceBands(statistics.value, listings.value);
  }

  function scheduleWarmPoll() {
    if (warmTimer) clearTimeout(warmTimer);
    if (!warming.value || !warmParams) return;
    warmTimer = setTimeout(() => {
      warmTimer = undefined;
      void loadFeed(warmParams!, { background: true });
    }, 1800);
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
      if (requestId !== statisticsRequestId || error || !data || data.error) return;
      if (data.statistics) await setStatisticsWithoutViewportJump(data.statistics);
    } finally {
      if (requestId === statisticsRequestId) statisticsLoading.value = false;
    }
  }

  async function loadFeed(params: Record<string, string>, options: { append?: boolean; background?: boolean } = {}): Promise<FlatFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    const requestId = requests.next();
    const wantsStatistics = !append && params.includeStats === "1";
    const currentStatisticsRequestId = !append ? ++statisticsRequestId : statisticsRequestId;
    if (!append) warmParams = { ...params };
    if (!background) {
      if (warmTimer) clearTimeout(warmTimer);
      if (append) loadingMore.value = true;
      else loading.value = true;
      failed.value = false;
    }

    // Statistics are substantially more expensive than the first page because
    // the backend has to deduplicate the complete result set and aggregate
    // percentiles/geographies. Do not make the user wait for that work before
    // the first cards can render; request it independently after the page is in.
    const feedParams = { ...params };
    if (wantsStatistics) delete feedParams.includeStats;

    const { data, error } = await safeFetch<FlatFeedResult>("/flats-feed", { params: feedParams });
    if (!requests.isLatest(requestId)) return undefined;
    if (error || !data || data.error) {
      if (!background) {
        failed.value = true;
        if (!append) { listings.value = []; total.value = 0; nextCursor.value = null; }
        sourceErrors.value = [];
        loading.value = false;
        loadingMore.value = false;
      }
      scheduleWarmPoll();
      return undefined;
    }
    if (data.availabilityChecked?.length) options.onAvailabilityChecked?.(data.availabilityChecked);
    if (background) {
      if (!append) total.value = data.count ?? total.value;
      sourceErrors.value = data.sourceErrors || [];
      if (data.statistics) void setStatisticsWithoutViewportJump(data.statistics);
      warming.value = !!data.warming;
      if (wantsStatistics) void loadStatistics(params, currentStatisticsRequestId);
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
    refreshLoadedPriceBands();
    if (!append) total.value = data.count ?? listings.value.length;
    // A page request deliberately omits includeStats, so it must not clear the
    // previous analytics snapshot while the independent statistics request is
    // still running. Replace statistics only when a response actually has them.
    if (!append && data.statistics) void setStatisticsWithoutViewportJump(data.statistics);
    sourceErrors.value = data.sourceErrors || [];
    warming.value = !!data.warming;
    loading.value = false;
    loadingMore.value = false;
    if (wantsStatistics) void loadStatistics(params, currentStatisticsRequestId);
    scheduleWarmPoll();
    return data;
  }

  onBeforeUnmount(() => {
    if (warmTimer) clearTimeout(warmTimer);
    statisticsRequestId++;
    requests.cancelPending();
  });

  return { listings, total, loading, loadingMore, warming, failed, sourceErrors, statistics, statisticsLoading, nextCursor, loadMoreSentinel, loadFeed };
}
