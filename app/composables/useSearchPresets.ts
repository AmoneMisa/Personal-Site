export interface SearchPreset {
  name: string;
  query: Record<string, string>;
}

interface SearchPresetOptions {
  storageKey: string;
  getQuery: () => Record<string, string>;
  applyQuery: (query: Record<string, string>) => void;
  afterApply?: () => void;
}

export function useSearchPresets(options: SearchPresetOptions) {
  const presets = ref<SearchPreset[]>([]);
  const presetName = ref("");

  function persist() {
    writeStoredList(options.storageKey, presets.value);
  }

  function loadPresets() {
    presets.value = readStoredList<SearchPreset>(options.storageKey);
  }

  function savePreset(): boolean {
    const name = presetName.value.trim();
    if (!name) return false;
    presets.value = [
      ...presets.value.filter((item) => item.name.toLocaleLowerCase() !== name.toLocaleLowerCase()),
      { name, query: options.getQuery() },
    ];
    persist();
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
  }

  return { presets, presetName, loadPresets, savePreset, applyPreset, removePreset };
}
import { readStoredList, writeStoredList } from "~/utils/browserStorage";
