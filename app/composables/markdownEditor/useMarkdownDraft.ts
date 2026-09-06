import {onBeforeUnmount, watch, type Ref} from "vue";
import {readStoredValue, writeStoredValue} from "~/utils/browserStorage";
import type {MarkdownPlatform} from "~/utils/markdownEditor/platformFormatters";

export type MarkdownViewMode = "md" | "preview";

type DraftState = {
  input?: string;
  platform?: MarkdownPlatform;
  viewMode?: MarkdownViewMode;
  spellcheckEnabled?: boolean;
};

type DraftOptions = {
  storageKey: string;
  maxLength: number;
  input: Ref<string>;
  platform: Ref<MarkdownPlatform>;
  viewMode: Ref<MarkdownViewMode>;
  spellcheckEnabled: Ref<boolean>;
};

export function useMarkdownDraft(options: DraftOptions) {
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  function save() {
    writeStoredValue<DraftState>(options.storageKey, {
      input: options.input.value,
      platform: options.platform.value,
      viewMode: options.viewMode.value,
      spellcheckEnabled: options.spellcheckEnabled.value,
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      save();
    }, 300);
  }

  function load() {
    const stored = readStoredValue<DraftState>(options.storageKey);
    if (!stored) return;

    if (typeof stored.input === "string") {
      options.input.value = stored.input.slice(0, options.maxLength);
    }
    if (["telegram", "whatsapp", "tiktok"].includes(stored.platform || "")) {
      options.platform.value = stored.platform as MarkdownPlatform;
    }
    if (stored.viewMode === "md" || stored.viewMode === "preview") {
      options.viewMode.value = stored.viewMode;
    }
    if (typeof stored.spellcheckEnabled === "boolean") {
      options.spellcheckEnabled.value = stored.spellcheckEnabled;
    }
  }

  watch(options.input, () => {
    if (options.input.value.length > options.maxLength) {
      options.input.value = options.input.value.slice(0, options.maxLength);
    }
    scheduleSave();
  });
  watch([options.platform, options.viewMode, options.spellcheckEnabled], scheduleSave);

  onBeforeUnmount(() => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    save();
  });

  return {load};
}
