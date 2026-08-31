import type { Canvas } from "fabric";
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from "vue";
import type { PdfDeletedImage, PdfEditorState, PdfLinkRegion } from "~/types/pdfEditor";
import { PDF_SERIALIZED_PROPERTIES, clampInt } from "~/utils/pdfEditor/core";

interface PdfEditorSessionOptions {
  docId: Readonly<Ref<string>>;
  page: Ref<number>;
  dpi: Ref<number>;
  isBusy: Ref<boolean>;
  errorMsg: Ref<string | null>;
  previewImg: Ref<HTMLImageElement | null>;
  editor: PdfEditorState;
  pageJson: Record<number, any>;
  pageLinks: Record<number, PdfLinkRegion[]>;
  autoLoaded: Record<number, boolean>;
  deletedImages: Record<number, PdfDeletedImage[]>;
  getCanvas: () => Canvas | null;
  refreshInfo: () => Promise<void>;
  loadDraft: () => Promise<void>;
  ensureFabric: () => void;
  resizeToPreview: () => void;
  loadCanvasForPage: (pageNo: number) => void;
  maybeAutoLoadText: () => Promise<void>;
  applyMode: () => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  onModifierKey: (event: KeyboardEvent) => void;
  clearLinkArmed: () => void;
  resetHistory: () => void;
  disposeDraft: () => void;
  saveDraftNow: () => void;
  disposeCanvas: () => void;
}

export function usePdfEditorSession(options: PdfEditorSessionOptions) {
  const {
    docId,
    page,
    dpi,
    isBusy,
    errorMsg,
    previewImg,
    editor,
    pageJson,
    pageLinks,
    autoLoaded,
    deletedImages,
    getCanvas,
    refreshInfo,
    loadDraft,
    ensureFabric,
    resizeToPreview,
    loadCanvasForPage,
    maybeAutoLoadText,
    applyMode,
    removeSelected,
    undo,
    redo,
    onModifierKey,
    clearLinkArmed,
    resetHistory,
    disposeDraft,
    saveDraftNow,
    disposeCanvas,
  } = options;

  let onResize: (() => void) | null = null;
  let onPreviewLoad: (() => void) | null = null;

  function isTypingTarget(target: EventTarget | null): boolean {
    const element = target as HTMLElement | null;
    if (!element) return false;
    const tag = (element.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || element.isContentEditable;
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (isBusy.value || isTypingTarget(event.target)) return;

    if ((event.key === "Delete" || event.key === "Backspace") && getCanvas()?.getActiveObject()) {
      event.preventDefault();
      removeSelected();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      undo();
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
    ) {
      event.preventDefault();
      redo();
    }
  }

  function detachListeners(): void {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keydown", onModifierKey);
    window.removeEventListener("keyup", onModifierKey);
    window.removeEventListener("blur", clearLinkArmed);
    if (onResize) window.removeEventListener("resize", onResize);
    if (previewImg.value && onPreviewLoad) {
      previewImg.value.removeEventListener("load", onPreviewLoad);
    }
    onResize = null;
    onPreviewLoad = null;
  }

  async function boot(): Promise<void> {
    if (!docId.value) return;

    detachListeners();
    isBusy.value = true;
    errorMsg.value = null;
    try {
      await refreshInfo();
      await loadDraft();
      await nextTick();
      ensureFabric();
      resizeToPreview();
      await nextTick();
      loadCanvasForPage(page.value);

      onResize = resizeToPreview;
      window.addEventListener("resize", onResize);

      onPreviewLoad = () => {
        resizeToPreview();
        void maybeAutoLoadText();
      };
      const image = previewImg.value;
      if (image) {
        image.addEventListener("load", onPreviewLoad, { passive: true });
        if (image.complete) onPreviewLoad();
      }

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keydown", onModifierKey);
      window.addEventListener("keyup", onModifierKey);
      window.addEventListener("blur", clearLinkArmed);
    } catch (error: any) {
      errorMsg.value = error?.data?.detail?.message || error?.message || "Init failed";
    } finally {
      isBusy.value = false;
    }
  }

  watch(dpi, () => {
    dpi.value = clampInt(dpi.value, 72, 220);
  });

  watch(
    () => [editor.mode, editor.color, editor.opacity, editor.size, editor.signatureSize, editor.brushShape],
    applyMode,
  );

  watch(docId, async () => {
    page.value = 1;
    for (const record of [pageJson, pageLinks, autoLoaded, deletedImages]) {
      Object.keys(record).forEach((key) => Reflect.deleteProperty(record, Number(key)));
    }
    resetHistory();
    errorMsg.value = null;
    await nextTick();
    await boot();
  });

  onMounted(boot);

  onBeforeUnmount(() => {
    disposeDraft();
    detachListeners();

    const canvas = getCanvas();
    if (canvas) {
      pageJson[page.value] = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);
      saveDraftNow();
    }
    disposeCanvas();
  });
}
