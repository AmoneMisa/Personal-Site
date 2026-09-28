import { readStoredList, writeStoredList } from "~/utils/browserStorage";
import { useAccountLists, type AccountListDomain } from "~/composables/useAccountLists";
export interface SearchPreset {
  name: string;
  query: Record<string, string>;
}

interface SearchPresetOptions {
  storageKey: string;
  getQuery: () => Record<string, string>;
  applyQuery: (query: Record<string, string>) => void;
  afterApply?: () => void;
  /** Keep presets with the site's Google account while signed in. */
  accountSync?: { domain: AccountListDomain };
}

export function useSearchPresets(options: SearchPresetOptions) {
  const presets = ref<SearchPreset[]>([]);
  const presetName = ref("");

  function persist() {
    writeStoredList(options.storageKey, presets.value);
  }

  const account = options.accountSync ? useAccountLists(options.accountSync.domain) : null;
  // Names are unique ignoring case (savePreset), so that is the account key.
  const presetKey = (preset: SearchPreset) => preset.name.toLocaleLowerCase();
  let accountStarted = false;

  function loadPresets() {
    presets.value = readStoredList<SearchPreset>(options.storageKey);
    if (!account || accountStarted) return;
    accountStarted = true;
    account.syncList<SearchPreset>("presets", {
      read: () => presets.value,
      write: (items) => {
        presets.value = items;
        persist();
      },
      keyOf: presetKey,
      toPayload: (preset) => preset,
      fromPayload: (row) => {
        const value = row.payload as Partial<SearchPreset> | null;
        return value && typeof value.name === "string" && value.query && typeof value.query === "object"
          ? { name: value.name, query: value.query as Record<string, string> }
          : null;
      },
      limit: 100,
      // savePreset appends, so the local list is oldest first.
      oldestFirst: true,
    });
  }

  function savePreset(): boolean {
    const name = presetName.value.trim();
    if (!name) return false;
    presets.value = [
      ...presets.value.filter((item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase()),
      { name, query: options.getQuery() },
    ];
    persist();
    const saved = presets.value[presets.value.length - 1]!;
    account?.put("presets", presetKey(saved), saved);
    presetName.value = "";
    return true;
  }

  function applyPreset(preset: SearchPreset) {
    options.applyQuery(preset.query);
    options.afterApply?.();
  }

  function removePreset(name: string) {
    presets.value = presets.value.filter((item) => item.name !== name);
    persist();
    account?.remove("presets", name.toLocaleLowerCase());
  }

  return { presets, presetName, loadPresets, savePreset, applyPreset, removePreset };
}
