import type { Canvas } from "fabric";
import type { Ref } from "vue";
import type { PdfDeletedImage, PdfImageEdit, PdfLinkRegion, PdfTextEditBlock } from "~/types/pdfEditor";
import { collectPdfImageEdits, collectPdfTextEdits } from "~/utils/pdfEditor/edits";
import { PDF_SERIALIZED_PROPERTIES, pixelsToPdfPoints } from "~/utils/pdfEditor/core";

interface PdfExportToolsOptions {
  docId: Readonly<Ref<string>>;
  pages: Ref<number>;
  page: Ref<number>;
  pageW: Ref<number>;
  pageH: Ref<number>;
  dpi: Ref<number>;
  isBusy: Ref<boolean>;
  errorMsg: Ref<string | null>;
  previewImg: Ref<HTMLImageElement | null>;
  pageJson: Record<number, any>;
  pageLinks: Record<number, PdfLinkRegion[]>;
  deletedImages: Record<number, PdfDeletedImage[]>;
  history: { lock: boolean };
  apiBase: string;
  getCanvas: () => Canvas | null;
  api: (path: string) => string;
  resizeToPreview: () => void;
  refreshInfo: () => Promise<void>;
}

export function usePdfExportTools(options: PdfExportToolsOptions) {
  const {
    docId,
    pages,
    page,
    pageW,
    pageH,
    dpi,
    isBusy,
    errorMsg,
    previewImg,
    pageJson,
    pageLinks,
    deletedImages,
    history,
    apiBase,
    getCanvas,
    api,
    resizeToPreview,
    refreshInfo,
  } = options;

  function calcMultiplier(): number {
    const image = previewImg.value;
    if (!image) return 1;

    const displayedWidth = Math.max(1, image.getBoundingClientRect().width);
    const naturalWidth = image.naturalWidth || 0;
    if (naturalWidth <= 0) return 1;

    const multiplier = naturalWidth / displayedWidth;
    return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  }

  async function exportOverlaysPngByPage(): Promise<{
    overlays: Record<number, string>;
    textEdits: Record<number, PdfTextEditBlock[]>;
    imageEdits: Record<number, PdfImageEdit[]>;
  }> {
    const canvas = getCanvas();
    if (!canvas) return { overlays: {}, textEdits: {}, imageEdits: {} };

    pageJson[page.value] = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);

    const overlays: Record<number, string> = {};
    const textEdits: Record<number, PdfTextEditBlock[]> = {};
    const imageEdits: Record<number, PdfImageEdit[]> = {};
    const currentPage = page.value;
    const currentJson = canvas.toJSON(PDF_SERIALIZED_PROPERTIES);

    for (let pageNo = 1; pageNo <= pages.value; pageNo++) {
      const json = pageJson[pageNo];
      if (!json) continue;

      await new Promise<void>((resolve, reject) => {
        history.lock = true;
        canvas.loadFromJSON(json, () => {
          history.lock = false;
          try {
            resizeToPreview();
            const multiplier = calcMultiplier();

            const blocks = collectPdfTextEdits(canvas, multiplier, dpi.value);
            if (blocks.length) textEdits[pageNo] = blocks;

            const changed = collectPdfImageEdits(canvas, multiplier, dpi.value);
            const presentNames = new Set(
              canvas
                .getObjects()
                .filter((object: any) => object?.tool === "pdfimg")
                .map((object: any) => String(object.name || "")),
            );
            const removed: PdfImageEdit[] = (deletedImages[pageNo] || [])
              .filter((deleted) => !presentNames.has(deleted.name))
              .map((deleted) => {
                const sourceDpi = deleted.dpi > 0 ? deleted.dpi : dpi.value;
                return {
                  name: deleted.name,
                  xPt: 0,
                  yPt: 0,
                  wPt: 0,
                  hPt: 0,
                  angle: 0,
                  deleted: true,
                  orig: {
                    xPt: pixelsToPdfPoints(deleted.x, sourceDpi),
                    yPt: pixelsToPdfPoints(deleted.y, sourceDpi),
                    wPt: pixelsToPdfPoints(deleted.w, sourceDpi),
                    hPt: pixelsToPdfPoints(deleted.h, sourceDpi),
                  },
                };
              });
            const edits = [...changed, ...removed];
            if (edits.length) imageEdits[pageNo] = edits;

            const hidden: any[] = [];
            canvas.getObjects().forEach((object: any) => {
              if (object?.tool === "pdftext" || object?.tool === "pdfimg") {
                object.visible = false;
                hidden.push(object);
              }
            });
            if (hidden.length) canvas.requestRenderAll();

            overlays[pageNo] = canvas.toDataURL({ format: "png", multiplier });

            hidden.forEach((object) => {
              object.visible = true;
            });
            if (hidden.length) canvas.requestRenderAll();

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    await new Promise<void>((resolve, reject) => {
      history.lock = true;
      canvas.loadFromJSON(currentJson, () => {
        history.lock = false;
        try {
          resizeToPreview();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    page.value = currentPage;
    return { overlays, textEdits, imageEdits };
  }

  async function saveDocument(): Promise<void> {
    if (!docId.value || isBusy.value) return;

    const image = previewImg.value;
    if (!image || !image.complete || image.naturalWidth === 0) {
      errorMsg.value = "Preview is not loaded yet. Please wait a moment.";
      return;
    }

    errorMsg.value = null;
    isBusy.value = true;
    try {
      const { overlays, textEdits, imageEdits } = await exportOverlaysPngByPage();
      const links: Record<number, Array<{
        xPt: number;
        yPt: number;
        wPt: number;
        hPt: number;
        uri: string;
      }>> = {};

      for (const [pageNo, pageRegions] of Object.entries(pageLinks)) {
        const regions = (pageRegions || [])
          .filter((region) => region.uri)
          .map((region) => ({
            xPt: pixelsToPdfPoints(region.x, dpi.value),
            yPt: pixelsToPdfPoints(region.y, dpi.value),
            wPt: pixelsToPdfPoints(region.w, dpi.value),
            hPt: pixelsToPdfPoints(region.h, dpi.value),
            uri: region.uri,
          }));
        if (regions.length) links[Number(pageNo)] = regions;
      }

      const result = await $fetch<{ downloadUrl: string; expiresAtResult?: number }>(api(`/pdf/save/${docId.value}`), {
        method: "POST",
        body: {
          overlays,
          textEdits,
          imageEdits,
          links,
          dpi: dpi.value,
          page: { widthPt: pageW.value, heightPt: pageH.value },
          coords: { space: "top-left", pointsPerInch: 72, pxDpi: dpi.value },
        },
      });

      await refreshInfo();

      if (result?.downloadUrl) {
        window.open(api(result.downloadUrl.replace(apiBase, "")) as any, "_blank");
      }
    } catch (error: any) {
      errorMsg.value = error?.data?.detail?.message || error?.message || "Save failed";
    } finally {
      isBusy.value = false;
    }
  }

  return {
    calcMultiplier,
    saveDocument,
  };
}
