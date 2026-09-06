import type { LocationQuery, Router } from "vue-router";
import { onBeforeUnmount } from "vue";

interface SearchRouteStateOptions {
  router: Router;
  serialize: () => Record<string, string>;
  deserialize: (query: LocationQuery | Record<string, unknown>) => void;
  preserve?: () => Record<string, string>;
  debounceMs?: number;
}

export function useSearchRouteState(options: SearchRouteStateOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function restore(query: LocationQuery | Record<string, unknown>) {
    options.deserialize(query);
  }

  async function sync() {
    try {
      await options.router.replace({
        query: { ...options.serialize(), ...(options.preserve?.() || {}) },
      });
    } catch {
      // A newer route update can supersede this debounced navigation. The
      // current filter state remains authoritative, so there is nothing for
      // this helper to recover from.
    }
  }

  function schedule(delay = options.debounceMs ?? 180) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void sync();
    }, delay);
  }

  function cancelPending() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }

  onBeforeUnmount(cancelPending);
  return { restore, sync, schedule, cancelPending };
}
