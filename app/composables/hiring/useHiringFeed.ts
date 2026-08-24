import { ref } from "vue";
import type { HiringCvProfile, HiringFeedResult } from "~/types/hiring";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";

export function useHiringFeed() {
  const profiles = ref<HiringCvProfile[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const loadingMore = ref(false);
  const filtersPending = ref(false);
  const warming = ref(false);
  const failed = ref(false);
  const sourceErrors = ref<HiringFeedResult["sourceErrors"]>([]);
  const usdRates = ref<Record<string, number>>({ USD: 1 });
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

  async function loadFeed(params: Record<string, string>, options: { append?: boolean; background?: boolean } = {}): Promise<HiringFeedResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    const requestId = requests.next();
    if (!append) warmParams = { ...params };
    if (!background) {
      if (warmTimer) clearTimeout(warmTimer);
      if (append) loadingMore.value = true;
      else loading.value = !profiles.value.length;
      failed.value = false;
    }

    const { data, error } = await safeFetch<HiringFeedResult>("/hiring-feed", { params });
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
      sourceErrors.value = data.sourceErrors || [];
      if (data.rates && typeof data.rates === "object") usdRates.value = data.rates;
      warming.value = !!data.warming;
    }
    if (!background) {
      loading.value = false;
      loadingMore.value = false;
      filtersPending.value = false;
    }
    scheduleWarmPoll();
    return !error && data && !data.error ? data : undefined;
  }

  onBeforeUnmount(() => {
    if (warmTimer) clearTimeout(warmTimer);
    requests.cancelPending();
  });

  return { profiles, total, loading, loadingMore, filtersPending, warming, failed, sourceErrors, usdRates, loadFeed };
}
