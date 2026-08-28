import { ref } from "vue";
import type { Ref } from "vue";
import type { Job, JobResult, JobStats } from "~/types/jobs";
import { safeFetch } from "~/utils/safeFetch";
import { useLatestRequest } from "~/composables/search/useLatestRequest";
import { useFeedPolling } from "~/composables/search/useFeedPolling";

export function useJobFeed(usdRates: Ref<Record<string, number>>) {
  const jobs = ref<Job[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const stats = ref<JobStats | null>(null);
  const loading = ref(false);
  const loadingMore = ref(false);
  const failed = ref(false);
  const warming = ref(false);
  const loadedSourceCount = ref(0);
  const pendingSourceCount = ref(0);
  const loadMoreSentinel = ref<HTMLElement | null>(null);
  const requests = useLatestRequest();
  const polling = useFeedPolling<Record<string, string>>({
    onWarmPoll: (params) => { void loadFeed(params, { background: true }); },
  });

  async function loadFeed(params: Record<string, string>, options: { append?: boolean; background?: boolean } = {}): Promise<JobResult | undefined> {
    const append = !!options.append;
    const background = !!options.background;
    if (!append && !background && !(await polling.debounceFilterRequest())) return undefined;

    const requestId = requests.next();
    if (!append) polling.rememberWarmParams({ ...params });
    if (!background) {
      polling.cancelWarmPoll();
      if (append) loadingMore.value = true;
      else loading.value = true;
      failed.value = false;
    }

    const { data, error } = await safeFetch<JobResult>("/jobs-feed", { params });
    if (!requests.isLatest(requestId)) return undefined;
    if (error || !data) {
      if (!background) {
        failed.value = true;
        if (!append) { jobs.value = []; total.value = 0; stats.value = null; }
      }
    } else {
      if (data.rates && data.rates.USD) usdRates.value = data.rates;
      if (append) {
        const known = new Set(jobs.value.map((job) => job.url || job.id));
        jobs.value = [...jobs.value, ...data.jobs.filter((job) => !known.has(job.url || job.id))];
      } else {
        jobs.value = data.jobs;
      }
      total.value = data.total;
      page.value = data.page;
      pageSize.value = data.pageSize;
      stats.value = data.stats;
      warming.value = !!data.warming;
      loadedSourceCount.value = data.loadedSources?.length ?? 0;
      pendingSourceCount.value = data.pendingSources?.length ?? 0;
    }
    if (!background) {
      loading.value = false;
      loadingMore.value = false;
    }
    polling.scheduleWarmPoll(warming.value);
    return !error ? data : undefined;
  }

  onBeforeUnmount(() => {
    requests.cancelPending();
  });

  return { jobs, total, page, pageSize, stats, loading, loadingMore, failed, warming, loadedSourceCount, pendingSourceCount, loadMoreSentinel, usdRates, loadFeed };
}
