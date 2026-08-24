import { ref } from "vue";
import type { Job, JobResult, JobStats } from "~/types/jobs";
import { safeFetch } from "~/utils/safeFetch";

export function useJobFeed() {
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
  const fetchFeed = (params: Record<string, string>) => safeFetch<JobResult>("/jobs-feed", { params });
  return { jobs, total, page, pageSize, stats, loading, loadingMore, failed, warming, loadedSourceCount, pendingSourceCount, loadMoreSentinel, fetchFeed };
}
