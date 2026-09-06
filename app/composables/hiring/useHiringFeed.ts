import { ref } from "vue";
import type { HiringCvProfile, HiringFeedResult, HiringStatistics } from "~/types/hiring";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";
import { useFeedPolling } from "~/composables/search/useFeedPolling";

export function useHiringFeed() {
  const profiles = ref<HiringCvProfile[]>([]);
  const total = ref(0);
  const statistics = ref<HiringStatistics | null>(null);
  const loading = ref(false);
  const loadingMore = ref(false);
  const filtersPending = ref(false);
  const warming = ref(false);
  const failed = ref(false);
  const sourceErrors = ref<HiringFeedResult["sourceErrors"]>([]);
  const usdRates = ref<Record<string, number>>({ USD: 1 });
  const requests = useLatestRequest();
  const polling = useFeedPolling<Record<string, string>>({
    onWarmPoll: (params) => { void loadFeed(params, { background: true }); },
  });

  async function loadFeed(params: Record<string, string>, options: { append?: boolean; background?: boolean } = {}): Promise<HiringFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    if (!append && !background && !(await polling.debounceFilterRequest())) return undefined;

    const requestId = requests.next();
    if (!append) polling.rememberWarmParams({ ...params });
    if (!background) {
      polling.cancelWarmPoll();
      if (append) loadingMore.value = true;
      else loading.value = !profiles.value.length;
      failed.value = false;
    }

    const { data, error } = await safeFetch<HiringFeedResult>("/hiring-feed", { params, signal: requests.signal() });
    if (!requests.isLatest(requestId)) return undefined;
    if (error || !data || data.error) {
      if (!background) {
        failed.value = !profiles.value.length;
        sourceErrors.value = [];
      }
    } else {
      const nextProfiles = data.profiles || [];
      profiles.value = append
        ? [...new Map([...profiles.value, ...nextProfiles].map((item) => [item.id, item])).values()]
        : nextProfiles;
      total.value = data.count ?? profiles.value.length;
      statistics.value = data.statistics || null;
      sourceErrors.value = data.sourceErrors || [];
      if (data.rates && typeof data.rates === "object") usdRates.value = data.rates;
      warming.value = !!data.warming;
    }
    if (!background) {
      loading.value = false;
      loadingMore.value = false;
      filtersPending.value = false;
    }
    polling.scheduleWarmPoll(warming.value);
    return !error && data && !data.error ? data : undefined;
  }

  onBeforeUnmount(() => {
    requests.cancelPending();
  });

  return { profiles, total, statistics, loading, loadingMore, filtersPending, warming, failed, sourceErrors, usdRates, loadFeed };
}
