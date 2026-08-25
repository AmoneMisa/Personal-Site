import type {PdfOriginalBlockMeta} from "~/types/pdfEditor";

export const PDF_SERIALIZED_PROPERTIES = ["id", "tool", "opacityPct", "orig", "name"];

export const PDF_FONT_FAMILIES = [
  "Helvetica",
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
];

const EDITOR_WEBFONT_SPECS = [
  '400 16px "Montserrat"',
  '700 16px "Montserrat"',
  '900 16px "Montserrat"',
  '400 16px "Lato"',
  '700 16px "Lato"',
  'italic 400 16px "Lato"',
];
const SERIF_HINTS = ["times", "serif", "georgia", "garamond", "roman", "minion", "cambria", "antiqua"];

export function clampInt(value: number, min: number, max: number) {
  const normalized = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, normalized));
}

export function setFabricObjectByTopLeft(object: any, left: number, top: number) {
  const width = object.getScaledWidth?.() ?? object.width ?? 0;
  const height = object.getScaledHeight?.() ?? object.height ?? 0;
  object.set({left: left + width / 2, top: top + height / 2});
  object.setCoords?.();
}

export function rgbaFromHex(hex: string, alpha: number) {
  const value = (hex || "").replace("#", "").trim();
  const normalized = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const parsed = parseInt(normalized || "ffffff", 16);
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha))})`;
}

export function hexFromColor(input: unknown): string {
  const value = String(input ?? "").trim();
  if (!value) return "#000000";
  if (value.startsWith("#")) {
    const raw = value.replace("#", "");
    const normalized = raw.length === 3 ? raw.split("").map((part) => part + part).join("") : raw.slice(0, 6);
    return `#${(normalized || "000000").padEnd(6, "0")}`;
  }
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match?.[1]) return "#000000";
  const parts = match[1].split(",").map((part) => parseFloat(part.trim()));
  const toHex = (part: number | undefined) =>
    Math.max(0, Math.min(255, Math.round(part || 0))).toString(16).padStart(2, "0");
  return `#${toHex(parts[0])}${toHex(parts[1])}${toHex(parts[2])}`;
}

export function resolvePdfFontFamily(raw?: string): string {
  const name = (raw || "").trim();
  if (!name) return "Arial, Helvetica, sans-serif";
  const base = name.replace(/^[A-Z]{6}\+/, "").split(/[-,]/)[0]?.trim() ?? "";
  const lower = base.toLowerCase();
  if (lower.includes("now")) return '"Montserrat", Arial, sans-serif';
  if (lower.includes("lato")) return '"Lato", Arial, sans-serif';
  if (lower.includes("aileron")) return 'Arial, "Helvetica Neue", Helvetica, sans-serif';
  const isSerif = SERIF_HINTS.some((hint) => lower.includes(hint));
  const known = PDF_FONT_FAMILIES.find((font) => font.toLowerCase() === lower);
  if (known) return `"${known}", ${isSerif ? "serif" : "sans-serif"}`;
  return isSerif ? "Georgia, 'Times New Roman', serif" : "Arial, Helvetica, sans-serif";
}

export async function ensurePdfEditorFontsReady(): Promise<void> {
  const fonts = typeof document !== "undefined" ? (document as any).fonts : null;
  if (!fonts?.load) return;
  const loading = (async () => {
    try {
      await Promise.all(EDITOR_WEBFONT_SPECS.map((spec) => fonts.load(spec)));
      await fonts.ready;
    } catch {
      // A blocked font host must not prevent the editor from opening.
    }
  })();
  await Promise.race([loading, new Promise<void>((resolve) => setTimeout(resolve, 1200))]);
}

export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (!url) return resolve();
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

export function pixelsToPdfPoints(pixels: number, dpi: number): number {
  const normalizedDpi = dpi > 0 ? dpi : 72;
  return Math.round(((pixels * 72) / normalizedDpi) * 100) / 100;
}

export function withPdfPointGeometry(original: PdfOriginalBlockMeta | null): PdfOriginalBlockMeta | null {
  if (!original) return null;
  const dpi = original.dpi > 0 ? original.dpi : 72;
  return {
    ...original,
    xPt: pixelsToPdfPoints(original.x, dpi),
    yPt: pixelsToPdfPoints(original.y, dpi),
    wPt: pixelsToPdfPoints(original.w, dpi),
    hPt: pixelsToPdfPoints(original.h, dpi),
    fontSizePt: original.fontSize != null ? pixelsToPdfPoints(original.fontSize, dpi) : null,
  };
}

let blockIdSequence = 0;
export function createPdfBlockId(page: number, index: number): string {
  const randomId = (globalThis.crypto as any)?.randomUUID?.();
  if (randomId) return randomId;
  blockIdSequence += 1;
  return `blk_${page}_${index}_${Date.now()}_${blockIdSequence}`;
}

let measureContext: CanvasRenderingContext2D | null = null;
export function measurePdfTextWidth(
  text: string,
  fontPixels: number,
  fontFamily: string,
  bold: boolean,
  italic: boolean,
): number {
  if (!measureContext) measureContext = document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  measureContext.font = `${italic ? "italic " : ""}${bold ? "700 " : "400 "}${fontPixels}px ${fontFamily || "Helvetica"}`;
  return Math.max(0, ...(text || "").split("\n").map((line) => measureContext!.measureText(line).width));
}
