import { readonly, ref } from "vue";

export function useLatestRequest() {
  const loading = ref(false);
  const loadingMore = ref(false);
  let sequence = 0;

  function next(): number {
    return ++sequence;
  }

  function current(): number {
    return sequence;
  }

  function begin(append = false): number {
    const request = next();
    if (append) loadingMore.value = true;
    else loading.value = true;
    return request;
  }

  function isLatest(request: number): boolean {
    return request === sequence;
  }

  function finish(request: number, append = false): boolean {
    if (!isLatest(request)) return false;
    if (append) loadingMore.value = false;
    else loading.value = false;
    return true;
  }

  function cancelPending() {
    sequence += 1;
    loading.value = false;
    loadingMore.value = false;
  }

  async function runLatest<T>(task: () => Promise<T>, append = false): Promise<T | undefined> {
    const request = begin(append);
    try {
      const result = await task();
      return isLatest(request) ? result : undefined;
    } finally {
      finish(request, append);
    }
  }

  return {
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    next,
    current,
    begin,
    finish,
    isLatest,
    runLatest,
    cancelPending,
  };
}
