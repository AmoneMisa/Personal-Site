import type { MaybeRefOrGetter, Ref } from "vue";
import { onBeforeUnmount, onMounted, toValue, watch } from "vue";

interface InfiniteFeedOptions {
  sentinel: Ref<HTMLElement | null>;
  hasMore: MaybeRefOrGetter<boolean>;
  loading: MaybeRefOrGetter<boolean>;
  loadMore: () => void | Promise<void>;
  rootMargin?: string;
  threshold?: number;
  canLoad?: MaybeRefOrGetter<boolean>;
}

export function useInfiniteFeed(options: InfiniteFeedOptions) {
  let observer: IntersectionObserver | undefined;

  function observe(element: HTMLElement | null) {
    if (element) observer?.observe(element);
  }

  function setup() {
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!toValue(options.hasMore) || toValue(options.loading)) return;
      if (options.canLoad !== undefined && !toValue(options.canLoad)) return;
      void options.loadMore();
    }, {
      rootMargin: options.rootMargin ?? "400px 0px",
      threshold: options.threshold,
    });
    observe(options.sentinel.value);
  }

  onMounted(setup);
  watch(options.sentinel, (current, previous) => {
    if (previous) observer?.unobserve(previous);
    observe(current);
  });
  onBeforeUnmount(() => observer?.disconnect());

  return { setup, disconnect: () => observer?.disconnect() };
}
