import { ref } from "vue";
import type { HiringCvProfile, HiringFeedResult } from "~/types/hiring";
import { safeFetch } from "~/utils/safeFetch";

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
  const fetchFeed = (params: Record<string, string>) => safeFetch<HiringFeedResult>("/hiring-feed", { params });
  return { profiles, total, loading, loadingMore, filtersPending, warming, failed, sourceErrors, usdRates, fetchFeed };
}
