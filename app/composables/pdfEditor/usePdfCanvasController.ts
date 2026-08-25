import {
  BaseFabricObject,
  Canvas,
  Ellipse,
  FabricObject,
  PencilBrush,
  Rect,
  Textbox,
} from "fabric";
import type { Ref } from "vue";
import type { PdfEditorState, PdfSelectedObjectState } from "~/types/pdfEditor";
import {
  PDF_SERIALIZED_PROPERTIES,
  clampInt,
  rgbaFromHex,
  setFabricObjectByTopLeft,
} from "~/utils/pdfEditor/core";

(BaseFabricObject as any).ownDefaults.originX = "center";
(BaseFabricObject as any).ownDefaults.originY = "center";

interface PdfCanvasControllerOptions {
  page: Ref<number>;
  editor: PdfEditorState;
  selected: PdfSelectedObjectState;
  previewImg: Ref<HTMLImageElement | null>;
  overlayCanvas: Ref<HTMLCanvasElement | null>;
  displayScale: Ref<number>;
  pageJson: Record<number, any>;
  history: { lock: boolean; stack: any[]; idx: number };
  getCanvas: () => Canvas | null;
  setCanvas: (canvas: Canvas | null) => void;
  calcMultiplier: () => number;
  pushHistory: () => void;
  syncSelected: (object: any) => void;
  onObjectMoving: (event: any) => void;
  clearGuides: () => void;
  refreshImageClip: (object: any) => void;
  onImageDrop: (object: any) => void;
  onCanvasMouseDown: (event: any) => void;
  recoverPhotoFrame: (pageNo: number) => void;
  refitPdfTextWidths: () => void;
}

export function usePdfCanvasController(options: PdfCanvasControllerOptions) {
  const {
    page,
    editor,
    selected,
    previewImg,
    overlayCanvas,
    displayScale,
    pageJson,
    history,
    getCanvas,
    setCanvas,
    calcMultiplier,
    pushHistory,
    syncSelected,
    onObjectMoving,
    clearGuides,
    refreshImageClip,
    onImageDrop,
    onCanvasMouseDown,
    recoverPhotoFrame,
    refitPdfTextWidths,
  } = options;

  function applyMode(): void {
    const canvas = getCanvas();
    if (!canvas) return;

    const isMove = editor.mode === "move";
    const isDraw = editor.mode === "pen" || editor.mode === "highlighter" || editor.mode === "signature";

    canvas.selection = isMove;
    canvas.forEachObject((object) => {
      object.selectable = isMove;
      object.evented = true;
    });
    canvas.isDrawingMode = !isMove && isDraw;

    if (canvas.isDrawingMode) {
      if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
      const alpha = editor.opacity / 100;
      canvas.freeDrawingBrush.color =
        editor.mode === "highlighter"
          ? rgbaFromHex(editor.color, alpha * 0.35)
          : rgbaFromHex(editor.color, alpha);
      canvas.freeDrawingBrush.width = Math.max(
        1,
        editor.mode === "signature" ? editor.signatureSize : editor.size,
      );
    }

    canvas.defaultCursor = isMove ? "default" : "crosshair";
    canvas.hoverCursor = isMove ? "move" : "crosshair";
    canvas.requestRenderAll();
  }

  function ensureFabric(): void {
    if (!overlayCanvas.value) return;

    getCanvas()?.dispose();
    const canvas = new Canvas(overlayCanvas.value, {
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
    });
    setCanvas(canvas);

    if (!canvas.freeDrawingBrush) canvas.freeDrawingBrush = new PencilBrush(canvas);
    FabricObject.prototype.transparentCorners = false;
    FabricObject.prototype.cornerStyle = "circle";

    canvas.on("path:created", () => pushHistory());
    canvas.on("object:modified", () => pushHistory());
    canvas.on("object:removed", () => pushHistory());

    const syncActive = () => syncSelected(canvas.getActiveObject() ?? null);
    canvas.on("selection:created", syncActive);
    canvas.on("selection:updated", syncActive);
    canvas.on("selection:cleared", () => {
      selected.exists = false;
    });
    canvas.on("object:modified", syncActive);
    canvas.on("object:moving", syncActive);
    canvas.on("object:scaling", syncActive);
    canvas.on("object:rotating", syncActive);

    canvas.on("object:moving", onObjectMoving);
    canvas.on("object:modified", clearGuides);
    canvas.on("mouse:up", clearGuides);
    canvas.on("selection:cleared", clearGuides);

    const clipOnMove = (event: any) => refreshImageClip(event?.target);
    canvas.on("object:moving", clipOnMove);
    canvas.on("object:scaling", clipOnMove);
    canvas.on("object:modified", (event: any) => onImageDrop(event?.target));
    canvas.on("mouse:down", onCanvasMouseDown);
    canvas.upperCanvasEl?.addEventListener("contextmenu", (event) => event.preventDefault());

    applyMode();
  }

  function resizeToPreview(): void {
    const canvas = getCanvas();
    const image = previewImg.value;
    if (!canvas || !image) return;

    const rect = image.getBoundingClientRect();
    canvas.setDimensions({
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    });
    canvas.calcOffset();
    canvas.requestRenderAll();
    displayScale.value = 1 / (calcMultiplier() || 1);
  }

  function loadCanvasForPage(pageNo: number): void {
    const canvas = getCanvas();
    if (!canvas) return;

    history.lock = true;
    canvas.clear();
    clearGuides();
    resizeToPreview();

    const json = pageJson[pageNo];
    if (!json) {
      history.lock = false;
      history.stack = [canvas.toJSON(PDF_SERIALIZED_PROPERTIES)];
      history.idx = 0;
      canvas.requestRenderAll();
      return;
    }

    canvas.loadFromJSON(json, () => {
      history.lock = false;
      history.stack = [canvas.toJSON(PDF_SERIALIZED_PROPERTIES)];
      history.idx = 0;
      recoverPhotoFrame(pageNo);
      canvas.requestRenderAll();

      const fonts = typeof document !== "undefined" ? (document as any).fonts : null;
      if (fonts?.ready) fonts.ready.then(() => refitPdfTextWidths()).catch(() => {});
      else refitPdfTextWidths();
    });
  }

  function finishAdding(object: FabricObject, x = 80, y = 80): void {
    const canvas = getCanvas();
    if (!canvas) return;
    setFabricObjectByTopLeft(object, x, y);
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    editor.mode = "move";
    applyMode();
  }

  function addRect(): void {
    const alpha = editor.opacity / 100;
    finishAdding(new Rect({
      width: 260,
      height: 140,
      fill: rgbaFromHex(editor.color, alpha * 0.25),
      stroke: rgbaFromHex(editor.color, alpha),
      strokeWidth: 2,
      rx: editor.brushShape === "round" ? 14 : 0,
      ry: editor.brushShape === "round" ? 14 : 0,
    }));
  }

  function addCircle(): void {
    const alpha = editor.opacity / 100;
    finishAdding(new Ellipse({
      rx: 120,
      ry: 80,
      fill: rgbaFromHex(editor.color, alpha * 0.25),
      stroke: rgbaFromHex(editor.color, alpha),
      strokeWidth: 2,
    }), 90, 90);
  }

  function addTextBox(): void {
    const alpha = editor.opacity / 100;
    finishAdding(new Textbox(editor.textValue || "Text", {
      width: 320,
      fill: rgbaFromHex(editor.color, alpha),
      fontFamily: editor.textFont || "Helvetica",
      fontSize: clampInt(editor.textSize, 8, 120),
      fontWeight: editor.textBold ? "bold" : "normal",
      fontStyle: editor.textItalic ? "italic" : "normal",
      underline: editor.textUnderline,
    }));
  }

  function disposeCanvas(): void {
    getCanvas()?.dispose();
    setCanvas(null);
  }

  return {
    addCircle,
    addRect,
    addTextBox,
    applyMode,
    disposeCanvas,
    ensureFabric,
    loadCanvasForPage,
    resizeToPreview,
  };
}
