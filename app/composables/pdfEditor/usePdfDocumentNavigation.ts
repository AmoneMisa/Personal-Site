import type { Canvas } from "fabric";
import { nextTick, watch, type Ref } from "vue";
import { PDF_SERIALIZED_PROPERTIES, clampInt } from "~/utils/pdfEditor/core";

interface PdfDocumentNavigationOptions {
  docId: Readonly<Ref<string>>;
  pages: Ref<number>;
  page: Ref<number>;
  pageW: Ref<number>;
  pageH: Ref<number>;
  isBusy: Ref<boolean>;
  errorMsg: Ref<string | null>;
  pageJson: Record<number, any>;
  getCanvas: () => Canvas | null;
  api: (path: string) => string;
  loadCanvasForPage: (pageNo: number) => void;
  scheduleSave: () => void;
  translate: (key: string) => string;
}

export function usePdfDocumentNavigation(options: PdfDocumentNavigationOptions) {
  const {
    docId,
    pages,
    page,
    pageW,
    pageH,
    isBusy,
    errorMsg,
    pageJson,
    getCanvas,
    api,
    loadCanvasForPage,
    scheduleSave,
    translate,
  } = options;

  async function refreshInfo(): Promise<void> {
    if (!docId.value) return;

    const info = await $fetch<{ pages: number; pageW: number; pageH: number }>(
      api(`/pdf/page-info/${docId.value}`),
    );
    pages.value = info.pages;
    pageW.value = info.pageW;
    pageH.value = info.pageH;
    page.value = clampInt(page.value, 1, pages.value);
  }

  async function setPage(nextPage: number): Promise<void> {
    const canvas = getCanvas();
    if (!docId.value || !canvas) return;

    const target = clampInt(nextPage, 1, pages.value);
    if (target === page.value) return;

    pageJson[page.value] = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);
    page.value = target;
    await nextTick();
    loadCanvasForPage(page.value);
    scheduleSave();
  }

  async function addDesignPage(): Promise<void> {
    if (!docId.value || !getCanvas() || isBusy.value) return;

    isBusy.value = true;
    errorMsg.value = null;
    try {
      const result = await $fetch<{ pages: number; page: number }>(
        api(`/pdf/add-design-page/${docId.value}`),
        { method: "POST" },
      );
      pages.value = result.pages;
      await setPage(result.page);
    } catch (error: any) {
      errorMsg.value =
        error?.data?.detail?.message ||
        error?.data?.detail ||
        error?.message ||
        translate("services.pdfEditor.addPageFailed");
    } finally {
      isBusy.value = false;
    }
  }

  watch(page, () => {
    page.value = clampInt(page.value, 1, pages.value);
  });

  return {
    addDesignPage,
    refreshInfo,
    setPage,
  };
}
