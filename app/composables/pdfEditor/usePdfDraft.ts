import type {Ref} from "vue";
import type {PdfDeletedImage, PdfDraft} from "~/types/pdfEditor";
import {clampInt} from "~/utils/pdfEditor/core";

type PdfDraftOptions = {
  docId: Ref<string>;
  page: Ref<number>;
  pageJson: Record<number, any>;
  deletedImages: Record<number, PdfDeletedImage[]>;
  api: (path: string) => string;
  getCurrentPageJson: () => any | null;
};

export function usePdfDraft(options: PdfDraftOptions) {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  async function saveNow() {
    if (!options.docId.value) return;
    try {
      const currentPageJson = options.getCurrentPageJson();
      if (currentPageJson) options.pageJson[options.page.value] = currentPageJson;
      const draft: PdfDraft = {
        v: 1,
        updatedAt: Date.now(),
        pages: {...options.pageJson},
        deletedImages: {...options.deletedImages},
        ui: {page: options.page.value},
      };
      await $fetch(options.api(`/pdf/draft/${options.docId.value}`), {method: "PUT", body: {draft}});
    } catch {
      // Draft persistence is best-effort and must not interrupt editing.
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 650);
  }

  async function load() {
    if (!options.docId.value) return;
    try {
      const response = await $fetch<{draft: PdfDraft}>(options.api(`/pdf/draft/${options.docId.value}`));
      if (!response?.draft?.pages) return;
      Object.assign(options.pageJson, response.draft.pages);
      if (response.draft.deletedImages) Object.assign(options.deletedImages, response.draft.deletedImages);
      if (response.draft.ui?.page) options.page.value = clampInt(response.draft.ui.page, 1, 9999);
    } catch {
      // A missing draft is an expected first-open state.
    }
  }

  function dispose() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
  }

  return {scheduleSave, saveNow, load, dispose};
}
