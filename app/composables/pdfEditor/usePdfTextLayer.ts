import { FabricImage, Textbox, type Canvas } from "fabric";
import type { Ref } from "vue";
import type {
  PdfEditorState,
  PdfImageRegion,
  PdfLinkRegion,
  PdfOriginalBlock,
  PdfOriginalBlockMeta,
  PdfPhotoFrame,
} from "~/types/pdfEditor";
import {
  clampInt,
  createPdfBlockId,
  ensurePdfEditorFontsReady,
  measurePdfTextWidth,
  preloadImage,
  resolvePdfFontFamily,
  setFabricObjectByTopLeft,
} from "~/utils/pdfEditor/core";

interface PdfTextLayerOptions {
  docId: Readonly<Ref<string>>;
  page: Ref<number>;
  dpi: Ref<number>;
  isBusy: Ref<boolean>;
  errorMsg: Ref<string | null>;
  previewImg: Ref<HTMLImageElement | null>;
  editor: PdfEditorState;
  pageLinks: Record<number, PdfLinkRegion[]>;
  autoLoaded: Record<number, boolean>;
  photoFrames: Record<number, PdfPhotoFrame>;
  history: { stack: any[]; idx: number };
  getCanvas: () => Canvas | null;
  api: (path: string) => string;
  backgroundUrl: (pageNo: number) => string;
  calcMultiplier: () => number;
  refreshImageClip: (obj: any) => void;
  applyMode: () => void;
  pushHistory: () => void;
  translate: (key: string) => string;
}

export function usePdfTextLayer(options: PdfTextLayerOptions) {
  const {
    docId,
    page,
    dpi,
    isBusy,
    errorMsg,
    previewImg,
    editor,
    pageLinks,
    autoLoaded,
    photoFrames,
    history,
    getCanvas,
    api,
    backgroundUrl,
    calcMultiplier,
    refreshImageClip,
    applyMode,
    pushHistory,
    translate,
  } = options;

  function refitPdfTextWidths(): void {
    const canvas = getCanvas();
    if (!canvas) return;

    let changed = false;
    for (const object of canvas.getObjects() as any[]) {
      if (object?.tool !== "pdftext") continue;
      const bold = object.fontWeight === "bold" || object.fontWeight === 700 || object.fontWeight === "700";
      const italic = object.fontStyle === "italic";
      const measured = measurePdfTextWidth(
        object.text ?? "",
        object.fontSize ?? 12,
        object.fontFamily || "",
        bold,
        italic,
      );
      const needed = Math.ceil(measured) + Math.ceil((object.fontSize ?? 12) * 0.6) + 4;
      const target = Math.max(object.baseW ?? 0, needed);
      if (target > (object.width ?? 0) + 0.5) {
        object.set("width", target);
        changed = true;
      }
    }
    if (changed) canvas.requestRenderAll();
  }

  async function loadEditableText(silent = false): Promise<boolean> {
    const canvas = getCanvas();
    if (!canvas || !docId.value || isBusy.value) return false;

    errorMsg.value = null;
    isBusy.value = true;
    try {
      const res = await $fetch<{
        blocks?: PdfOriginalBlock[];
        links?: PdfLinkRegion[];
        images?: PdfImageRegion[];
      }>(api(`/pdf/text-blocks/${docId.value}/${page.value}?dpi=${dpi.value}`));

      pageLinks[page.value] = (res?.links ?? [])
        .map((link) => ({
          x: link.x ?? 0,
          y: link.y ?? 0,
          w: link.w ?? 0,
          h: link.h ?? 0,
          uri: String(link.uri || ""),
        }))
        .filter((link) => link.uri);

      const blocks = res?.blocks ?? [];
      const images = res?.images ?? [];
      if (!blocks.length && !images.length) {
        if (!silent) errorMsg.value = translate("services.pdfEditor.full.noText");
        return false;
      }

      canvas
        .getObjects()
        .filter((object: any) => object?.tool === "pdftext" || object?.tool === "pdfimg")
        .forEach((object) => canvas.remove(object));

      const scale = 1 / (calcMultiplier() || 1);

      await ensurePdfEditorFontsReady();
      const fonts = typeof document !== "undefined" ? (document as any).fonts : null;
      if (fonts?.ready) fonts.ready.then(() => refitPdfTextWidths()).catch(() => {});

      blocks.forEach((block, index) => {
        const fontPx = clampInt(Math.round((block.fontSize ?? 12) * scale), 4, 400);
        const lineCount = Math.max(1, (block.text || "").split("\n").length);
        const boxHeight = (block.h ?? 0) * scale;
        const lineHeight =
          block.lineHeight && block.lineHeight > 0
            ? Math.min(3, Math.max(0.8, block.lineHeight))
            : lineCount > 1 && boxHeight > 0
              ? Math.min(3, Math.max(0.8, boxHeight / lineCount / fontPx))
              : 1.16;

        const lineRuns = Array.isArray(block.lineRuns) ? block.lineRuns : null;
        const anyBold = !!block.bold || !!lineRuns?.some((line) => line.some((run) => run.bold));
        let charStyles: Record<number, Record<number, any>> | undefined;
        if (lineRuns) {
          const textLines = (block.text || "").split("\n");
          const styles: Record<number, Record<number, any>> = {};
          for (let lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
            const runs = lineRuns[lineIndex];
            const lineText = textLines[lineIndex] ?? "";
            if (!runs?.length) continue;

            const perChar: Record<number, any> = {};
            let offset = 0;
            for (const run of runs) {
              const end = Math.min(lineText.length, offset + (run.n ?? 0));
              for (let charIndex = offset; charIndex < end; charIndex++) {
                perChar[charIndex] = {
                  fontWeight: run.bold ? "bold" : "normal",
                  fontStyle: run.italic ? "italic" : "normal",
                  fill: run.color || block.color || "#111111",
                };
              }
              offset = end;
            }
            styles[lineIndex] = perChar;
          }
          charStyles = styles;
        }

        const fontFamily = resolvePdfFontFamily(block.fontName);
        const baseWidth = Math.max(20, (block.w ?? 200) * scale);
        const measuredWidth = measurePdfTextWidth(
          block.text || "",
          fontPx,
          fontFamily,
          anyBold,
          !!block.italic,
        );
        const boxWidth = Math.max(baseWidth, Math.ceil(measuredWidth) + Math.ceil(fontPx * 0.6) + 4);

        const box = new Textbox(block.text || "", {
          width: boxWidth,
          fill: block.color || "#111111",
          fontFamily,
          fontSize: fontPx,
          lineHeight,
          fontWeight: block.bold ? "bold" : "normal",
          fontStyle: block.italic ? "italic" : "normal",
          ...(charStyles ? { styles: charStyles } : {}),
        });
        (box as any).tool = "pdftext";
        (box as any).baseW = baseWidth;
        (box as any).id = block.id || createPdfBlockId(page.value, index);
        (box as any).orig = {
          id: block.id ?? null,
          page: page.value,
          dpi: dpi.value,
          x: block.x ?? 0,
          y: block.y ?? 0,
          w: block.w ?? 0,
          h: block.h ?? 0,
          text: block.text ?? "",
          fontSize: block.fontSize ?? null,
          fontName: block.fontName ?? null,
          bold: !!block.bold,
          italic: !!block.italic,
          color: block.color ?? null,
        } as PdfOriginalBlockMeta;

        setFabricObjectByTopLeft(box, (block.x ?? 0) * scale, (block.y ?? 0) * scale);
        canvas.add(box);
      });

      for (const image of images) {
        try {
          const fabricImage = await FabricImage.fromURL(api(image.url), { crossOrigin: "anonymous" });
          const naturalWidth = fabricImage.width || 1;
          const naturalHeight = fabricImage.height || 1;
          const targetWidth = Math.max(1, (image.w ?? naturalWidth) * scale);
          const targetHeight = Math.max(1, (image.h ?? naturalHeight) * scale);
          fabricImage.set({ scaleX: targetWidth / naturalWidth, scaleY: targetHeight / naturalHeight });

          (fabricImage as any).tool = "pdfimg";
          (fabricImage as any).id = image.id || createPdfBlockId(page.value, 0);
          (fabricImage as any).name = image.name;

          if (image.clip) {
            photoFrames[page.value] = {
              cx: ((image.x ?? 0) + image.clip.cx * (image.w ?? 0)) * scale,
              cy: ((image.y ?? 0) + image.clip.cy * (image.h ?? 0)) * scale,
              rx: Math.max(1, image.clip.rx * (image.w ?? 0) * scale),
              ry: Math.max(1, image.clip.ry * (image.h ?? 0) * scale),
            };
          }
          (fabricImage as any).orig = {
            id: image.id ?? null,
            page: page.value,
            dpi: dpi.value,
            x: image.x ?? 0,
            y: image.y ?? 0,
            w: image.w ?? 0,
            h: image.h ?? 0,
            text: "",
            fontSize: null,
            fontName: null,
            bold: false,
            italic: false,
            color: null,
          } as PdfOriginalBlockMeta;

          setFabricObjectByTopLeft(fabricImage, (image.x ?? 0) * scale, (image.y ?? 0) * scale);
          canvas.add(fabricImage);
          refreshImageClip(fabricImage);
        } catch {
          // A broken embedded image must not block text editing.
        }
      }

      canvas.requestRenderAll();
      pushHistory();
      history.stack = [history.stack[history.idx]];
      history.idx = 0;

      await preloadImage(backgroundUrl(page.value));
      autoLoaded[page.value] = true;

      editor.fullMode = true;
      editor.mode = "move";
      applyMode();
      return true;
    } catch (error: any) {
      if (!silent) {
        errorMsg.value = error?.data?.detail?.message || translate("services.pdfEditor.full.noText");
      }
      return false;
    } finally {
      isBusy.value = false;
    }
  }

  function currentHasPdfText(): boolean {
    const canvas = getCanvas();
    return !!canvas && canvas.getObjects().some((object: any) => object?.tool === "pdftext" || object?.tool === "pdfimg");
  }

  async function maybeAutoLoadText(): Promise<void> {
    if (!getCanvas() || autoLoaded[page.value] || isBusy.value) return;

    const image = previewImg.value;
    if (!image || !image.complete || image.naturalWidth === 0) return;

    if (currentHasPdfText()) {
      autoLoaded[page.value] = true;
      return;
    }

    const loaded = await loadEditableText(true);
    if (loaded) autoLoaded[page.value] = true;
  }

  return {
    currentHasPdfText,
    loadEditableText,
    maybeAutoLoadText,
    refitPdfTextWidths,
  };
}
