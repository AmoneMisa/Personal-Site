import { onBeforeUnmount } from "vue";

// Timing shared by the jobs, hiring and flats feeds. These were three identical
// copies before; keep them here so the three feeds cannot silently drift apart.
const FILTER_REQUEST_DEBOUNCE_MS = 180;
const WARM_POLL_INTERVAL_MS = 1800;

export interface FeedPollingOptions<Params> {
  /** Re-issued in the background while the upstream reports itself still warming. */
  onWarmPoll: (params: Params) => void;
  /**
   * Overrides FILTER_REQUEST_DEBOUNCE_MS. Pass 0 from a feed whose page already
   * debounces its filter interactions: two debounces in series just add their
   * delays, and the user waits out both before the request even starts.
   */
  filterDebounceMs?: number;
}

/**
 * The mechanical half of a search feed: filter debouncing, background re-polling
 * while upstream warms up, and unmount cleanup.
 *
 * Deliberately owns no domain state. Each feed keeps its own endpoint, response
 * shape and merge/error semantics — those differ on purpose (jobs clears results
 * on error and dedupes by url||id; hiring preserves the previous page and dedupes
 * by id), and collapsing them would be a behaviour change, not a refactor.
 */
export function useFeedPolling<Params>(options: FeedPollingOptions<Params>) {
  const filterDebounceMs = options.filterDebounceMs ?? FILTER_REQUEST_DEBOUNCE_MS;
  let warmTimer: ReturnType<typeof setTimeout> | undefined;
  let warmParams: Params | null = null;
  let filterDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  let filterDebounceResolve: ((run: boolean) => void) | undefined;

  /**
   * Resolves true when this call is the newest one within the debounce window,
   * false when a later call superseded it (the caller should then do nothing).
   */
  function debounceFilterRequest(): Promise<boolean> {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceResolve?.(false);
    // Not merely a zero-length timer: a caller that debounces upstream should
    // reach the network in this tick, without yielding to the event loop first.
    if (!filterDebounceMs) return Promise.resolve(true);
    return new Promise((resolve) => {
      filterDebounceResolve = resolve;
      filterDebounceTimer = setTimeout(() => {
        filterDebounceTimer = undefined;
        filterDebounceResolve = undefined;
        resolve(true);
      }, filterDebounceMs);
    });
  }

  /** Remembers the params a warm re-poll should repeat. */
  function rememberWarmParams(params: Params) {
    warmParams = params;
  }

  function cancelWarmPoll() {
    if (warmTimer) clearTimeout(warmTimer);
    warmTimer = undefined;
  }

  /** Schedules the next background refresh; a no-op unless still warming. */
  function scheduleWarmPoll(warming: boolean) {
    if (warmTimer) clearTimeout(warmTimer);
    if (!warming || !warmParams) return;
    warmTimer = setTimeout(() => {
      warmTimer = undefined;
      options.onWarmPoll(warmParams!);
    }, WARM_POLL_INTERVAL_MS);
  }

  function dispose() {
    cancelWarmPoll();
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = undefined;
    filterDebounceResolve?.(false);
    filterDebounceResolve = undefined;
  }

  onBeforeUnmount(dispose);

  return { debounceFilterRequest, rememberWarmParams, scheduleWarmPoll, cancelWarmPoll, dispose };
}
