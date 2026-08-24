interface JobRouteStateOptions {
  storageKey: string;
  serialize: () => Record<string, string>;
  deserialize: (state: Record<string, string>) => void;
  extraQuery?: () => Record<string, string>;
  ignoredUrlKeys?: string[];
}

export function useJobRouteState(options: JobRouteStateOptions) {
  function persist() {
    if (!import.meta.client) return;
    const state = options.serialize();
    try {
      localStorage.setItem(options.storageKey, JSON.stringify(state));
    } catch { /* storage full or disabled */ }
    const query = { ...state, ...(options.extraQuery?.() || {}) };
    const search = new URLSearchParams(query).toString();
    window.history.replaceState(window.history.state, "", search ? `?${search}` : window.location.pathname);
  }

  function restore() {
    if (!import.meta.client) return;
    const fromUrl = new URLSearchParams(window.location.search);
    const ignored = new Set(options.ignoredUrlKeys || []);
    if ([...fromUrl.keys()].some((key) => !ignored.has(key))) {
      options.deserialize(Object.fromEntries(fromUrl.entries()));
      return;
    }
    try {
      const raw = localStorage.getItem(options.storageKey);
      if (raw) options.deserialize(JSON.parse(raw));
    } catch { /* corrupt state */ }
  }

  return { persist, restore };
}
