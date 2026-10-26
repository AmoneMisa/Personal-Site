import { onScopeDispose, ref, shallowRef, toValue, type MaybeRefOrGetter } from "vue";
import type { FlatMapFeedResult } from "~/types/flats";
import { stableQueryKey } from "~/utils/stableQueryKey";
import { useLatestRequest } from "~/composables/search/useLatestRequest";

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 40;

/** Query-scoped map snapshots. Personal collections supply their own points. */
export function useFlatMapFeed<T>(options: {
  query: () => Record<string, string>;
  enabled: MaybeRefOrGetter<boolean>;
  shape: (data: FlatMapFeedResult) => T[];
}) {
  const points = shallowRef<T[]>([]);
  const failed = ref(false);
  const loading = ref(false);
  const requests = useLatestRequest();
  const cache = new Map<string, { at: number; points: T[] }>();
  let displayedKey: string | null = null;
  let pendingKey: string | null = null;
  let pending: Promise<void> | null = null;

  async function load({ force = false }: { force?: boolean } = {}): Promise<void> {
    if (!toValue(options.enabled)) {
      requests.cancelPending();
      pendingKey = null;
      pending = null;
      displayedKey = null;
      points.value = [];
      failed.value = false;
      loading.value = false;
      return;
    }
    const query = options.query();
    const key = stableQueryKey(query);
    if (pendingKey === key && pending) return pending;
    const entry = cache.get(key);
    const cached = entry && Date.now() - entry.at <= CACHE_TTL_MS ? entry : null;
    if (displayedKey !== key) points.value = cached?.points ?? [];
    displayedKey = key;
    if (!force && cached && !failed.value) {
      points.value = cached.points;
    }
    const request = requests.next();
    pendingKey = key;
    loading.value = true;
    failed.value = false;
    const task = (async () => {
      try {
        const data = await $fetch<FlatMapFeedResult>("/flats-map", { query, signal: requests.signal() });
        if (!requests.isLatest(request)) return;
        const shaped = options.shape(data);
        points.value = shaped;
        cache.delete(key);
        cache.set(key, { at: Date.now(), points: shaped });
        while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      } catch {
        if (requests.isLatest(request)) failed.value = true;
      } finally {
        if (requests.isLatest(request)) {
          loading.value = false;
          pendingKey = null;
          pending = null;
        }
      }
    })();
    pending = task;
    return task;
  }

  onScopeDispose(() => requests.cancelPending());
  return { points, failed, loading, load };
}
