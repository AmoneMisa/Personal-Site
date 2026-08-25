import type { Canvas } from "fabric";
import type {
  PdfImageEdit,
  PdfOriginalBlockMeta,
  PdfTextEditBlock,
} from "~/types/pdfEditor";
import {
  hexFromColor,
  pixelsToPdfPoints,
  withPdfPointGeometry,
} from "~/utils/pdfEditor/core";

export function collectPdfTextEdits(canvas: Canvas, multiplier: number, dpi: number): PdfTextEditBlock[] {
  const blocks: PdfTextEditBlock[] = [];

  canvas.getObjects().forEach((object: any) => {
    if (object?.tool !== "pdftext") return;

    const scaledWidth = object.getScaledWidth?.() ?? object.width ?? 0;
    const scaledHeight = object.getScaledHeight?.() ?? object.height ?? 0;
    const xPx = ((object.left ?? 0) - scaledWidth / 2) * multiplier;
    const yPx = ((object.top ?? 0) - scaledHeight / 2) * multiplier;
    const widthPx = scaledWidth * multiplier;
    const heightPx = scaledHeight * multiplier;
    const fontSizePx = (object.fontSize ?? 12) * multiplier;

    blocks.push({
      id: object.id,
      text: String(object.text ?? ""),
      x: Math.round(xPx),
      y: Math.round(yPx),
      w: Math.round(widthPx),
      h: Math.round(heightPx),
      fontSize: Math.round(fontSizePx),
      xPt: pixelsToPdfPoints(xPx, dpi),
      yPt: pixelsToPdfPoints(yPx, dpi),
      wPt: pixelsToPdfPoints(widthPx, dpi),
      hPt: pixelsToPdfPoints(heightPx, dpi),
      fontSizePt: pixelsToPdfPoints(fontSizePx, dpi),
      fontName: String(object.fontFamily ?? "Helvetica"),
      bold: String(object.fontWeight ?? "normal") === "bold",
      italic: String(object.fontStyle ?? "normal") === "italic",
      underline: !!object.underline,
      align: String(object.textAlign ?? "left"),
      color: hexFromColor(object.fill),
      opacity: object.opacity ?? 1,
      angle: object.angle ?? 0,
      orig: withPdfPointGeometry((object.orig ?? null) as PdfOriginalBlockMeta | null),
    });
  });

  return blocks;
}

export function collectPdfImageEdits(canvas: Canvas, multiplier: number, dpi: number): PdfImageEdit[] {
  const edits: PdfImageEdit[] = [];

  canvas.getObjects().forEach((object: any) => {
    if (object?.tool !== "pdfimg" || !object.orig) return;

    const scaledWidth = object.getScaledWidth?.() ?? object.width ?? 0;
    const scaledHeight = object.getScaledHeight?.() ?? object.height ?? 0;
    const center = object.getCenterPoint?.() ?? { x: object.left ?? 0, y: object.top ?? 0 };
    const widthPx = scaledWidth * multiplier;
    const heightPx = scaledHeight * multiplier;
    const xPx = center.x * multiplier - widthPx / 2;
    const yPx = center.y * multiplier - heightPx / 2;
    const angle = object.angle ?? 0;
    const current = {
      xPt: pixelsToPdfPoints(xPx, dpi),
      yPt: pixelsToPdfPoints(yPx, dpi),
      wPt: pixelsToPdfPoints(widthPx, dpi),
      hPt: pixelsToPdfPoints(heightPx, dpi),
    };
    const original = withPdfPointGeometry(object.orig as PdfOriginalBlockMeta);
    const originalPoints = {
      xPt: original?.xPt ?? 0,
      yPt: original?.yPt ?? 0,
      wPt: original?.wPt ?? 0,
      hPt: original?.hPt ?? 0,
    };
    const moved =
      Math.abs(current.xPt - originalPoints.xPt) > 0.5 ||
      Math.abs(current.yPt - originalPoints.yPt) > 0.5 ||
      Math.abs(current.wPt - originalPoints.wPt) > 0.5 ||
      Math.abs(current.hPt - originalPoints.hPt) > 0.5 ||
      Math.abs(angle) > 0.1;

    if (moved) {
      edits.push({
        name: String(object.name || ""),
        ...current,
        angle,
        deleted: false,
        orig: originalPoints,
      });
    }
  });

  return edits;
}
