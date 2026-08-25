import type { Canvas } from "fabric";
import type { PdfSelectedObjectState, PdfTextAlign } from "~/types/pdfEditor";
import { clampInt, hexFromColor } from "~/utils/pdfEditor/core";

interface PdfSelectionInspectorOptions {
  selected: PdfSelectedObjectState;
  getCanvas: () => Canvas | null;
  pushHistory: () => void;
  refreshImageClip: (object: any) => void;
}

export function usePdfSelectionInspector(options: PdfSelectionInspectorOptions) {
  const { selected, getCanvas, pushHistory, refreshImageClip } = options;

  function activeObj(): any {
    return getCanvas()?.getActiveObject() ?? null;
  }

  function isTextObject(object: any): boolean {
    const type = String(object?.type || "").toLowerCase();
    return type === "textbox" || type === "text" || type === "i-text";
  }

  function syncSelectedFromObject(object: any): void {
    const canvas = getCanvas();
    if (!object || !canvas) {
      selected.exists = false;
      return;
    }

    selected.exists = true;
    selected.isText = isTextObject(object);

    const scaledWidth = object.getScaledWidth?.() ?? object.width ?? 0;
    const scaledHeight = object.getScaledHeight?.() ?? object.height ?? 0;
    selected.x = Math.round((object.left ?? 0) - scaledWidth / 2);
    selected.y = Math.round((object.top ?? 0) - scaledHeight / 2);
    selected.w = Math.round(scaledWidth);
    selected.h = Math.round(scaledHeight);
    selected.angle = Math.round(object.angle ?? 0);
    selected.opacity = Math.round((object.opacity ?? 1) * 100);

    if (selected.isText) {
      selected.fontFamily = String(object.fontFamily ?? "Helvetica");
      selected.fontSize = Math.round(object.fontSize ?? 32);
      selected.bold = String(object.fontWeight ?? "normal") === "bold";
      selected.italic = String(object.fontStyle ?? "normal") === "italic";
      selected.underline = !!object.underline;
      selected.align = String(object.textAlign ?? "left") as PdfTextAlign;
      selected.color = hexFromColor(object.fill);
    } else {
      selected.color = hexFromColor(object.stroke ?? object.fill);
    }
  }

  function commitSelected(object: any): void {
    const canvas = getCanvas();
    if (!canvas || !object) return;
    object.setCoords?.();
    canvas.requestRenderAll();
    pushHistory();
  }

  function applySelectedFont(): void {
    const object = activeObj();
    if (!object || !isTextObject(object)) return;
    object.set("fontFamily", selected.fontFamily || "Helvetica");
    commitSelected(object);
    syncSelectedFromObject(object);
  }

  function applySelectedFontSize(): void {
    const object = activeObj();
    if (!object || !isTextObject(object)) return;
    object.set("fontSize", clampInt(selected.fontSize, 4, 400));
    commitSelected(object);
    syncSelectedFromObject(object);
  }

  function toggleSelectedStyle(kind: "bold" | "italic" | "underline"): void {
    const object = activeObj();
    if (!object || !isTextObject(object)) return;

    if (kind === "bold") {
      selected.bold = !selected.bold;
      object.set("fontWeight", selected.bold ? "bold" : "normal");
    } else if (kind === "italic") {
      selected.italic = !selected.italic;
      object.set("fontStyle", selected.italic ? "italic" : "normal");
    } else {
      selected.underline = !selected.underline;
      object.set("underline", selected.underline);
    }
    commitSelected(object);
  }

  function applySelectedAlign(align: PdfTextAlign): void {
    const object = activeObj();
    if (!object || !isTextObject(object)) return;
    selected.align = align;
    object.set("textAlign", align);
    commitSelected(object);
  }

  function applySelectedColor(): void {
    const object = activeObj();
    if (!object) return;
    object.set(isTextObject(object) ? "fill" : "stroke", selected.color);
    commitSelected(object);
  }

  function applySelectedOpacity(): void {
    const object = activeObj();
    if (!object) return;
    object.set("opacity", clampInt(selected.opacity, 0, 100) / 100);
    commitSelected(object);
  }

  function applySelectedGeometry(): void {
    const object = activeObj();
    if (!object) return;

    const width = Math.max(1, selected.w);
    const height = Math.max(1, selected.h);

    if (isTextObject(object)) {
      object.set({ width, scaleX: 1, scaleY: 1 });
    } else {
      object.set({
        scaleX: width / (object.width || 1),
        scaleY: height / (object.height || 1),
      });
    }

    object.set("angle", selected.angle);
    const scaledWidth = object.getScaledWidth?.() ?? width;
    const scaledHeight = object.getScaledHeight?.() ?? height;
    object.set({
      left: selected.x + scaledWidth / 2,
      top: selected.y + scaledHeight / 2,
    });

    refreshImageClip(object);
    commitSelected(object);
    syncSelectedFromObject(object);
  }

  return {
    activeObj,
    applySelectedAlign,
    applySelectedColor,
    applySelectedFont,
    applySelectedFontSize,
    applySelectedGeometry,
    applySelectedOpacity,
    syncSelectedFromObject,
    toggleSelectedStyle,
  };
}
