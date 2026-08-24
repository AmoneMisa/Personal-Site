import { ref } from "vue";
import type { FlatFeedResult, FlatListing, FlatStatistics } from "~/types/flats";
import { safeFetch } from "~/utils/safeFetch";

export function useFlatFeed() {
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
  const fetchFeed = (params: Record<string, string>) => safeFetch<FlatFeedResult>("/flats-feed", { params });
  return { listings, total, loading, loadingMore, warming, failed, sourceErrors, statistics, nextCursor, loadMoreSentinel, fetchFeed };
}
