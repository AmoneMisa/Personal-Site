<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import PdfEditorControls from "~/components/pdfEditor/PdfEditorControls.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { BaseFabricObject, Canvas, Ellipse, FabricImage, FabricObject, PencilBrush, Rect, Textbox } from "fabric";
import {usePdfDraft} from "~/composables/pdfEditor/usePdfDraft";
import type {
  PdfAlignGuide as AlignGuide,
  PdfBrushShape as BrushShape,
  PdfDeletedImage as DeletedImg,
  PdfEditorMode as Mode,
  PdfEditorState,
  PdfImageEdit as ImageEdit,
  PdfImageRegion as ImageRegion,
  PdfLinkRegion as LinkRegion,
  PdfOriginalBlock as OrigBlock,
  PdfOriginalBlockMeta as OrigBlockMeta,
  PdfPhotoFrame as PhotoFrame,
  PdfSelectedObjectState,
  PdfTextAlign as TextAlign,
  PdfTextEditBlock as TextEditBlock,
} from "~/types/pdfEditor";
import {
  PDF_FONT_FAMILIES as FONT_FAMILIES,
  clampInt,
  createPdfBlockId as genBlockId,
  ensurePdfEditorFontsReady as ensureEditorFontsReady,
  hexFromColor,
  measurePdfTextWidth as measureMaxLineWidth,
  pixelsToPdfPoints as pxToPt,
  preloadImage,
  resolvePdfFontFamily as resolveFontFamily,
  rgbaFromHex,
  setFabricObjectByTopLeft as setByTopLeft,
  withPdfPointGeometry as withOrigPoints,
} from "~/utils/pdfEditor/core";

(BaseFabricObject as any).ownDefaults.originX = "center";
(BaseFabricObject as any).ownDefaults.originY = "center";

const config = useRuntimeConfig();
const { t } = useI18n();

// Per-user document workspaces must stay out of the index.
useServiceSeo("pdfEditorDoc", {robots: "noindex, nofollow"});
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

// Load the CV's embedded families as webfonts so the editable overlay matches
// the rendered background instead of falling back to Arial. Lato (body) is a
// Google font; "Now" (title) is commercial, so the closest free geometric sans
// Montserrat stands in; Aileron is a Helvetica clone and keeps the Arial stack.
useHead({
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;700;900&display=swap",
    },
  ],
});

const docId = computed(() => String(route.params.docId || ""));

// --- pdf meta
const pages = ref<number>(1);
const pageW = ref<number>(595);
const pageH = ref<number>(842);

const page = ref<number>(1);
const dpi = ref<number>(144);

const isBusy = ref(false);
const errorMsg = ref<string | null>(null);

const stageRef = ref<HTMLDivElement | null>(null);
const previewImgRef = ref<HTMLImageElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);

const bgColor = ref<string | null>(null);

// --- clickable links (auto-detected URLs / e-mails + source annotations)
// per-page link regions in rendered-PNG pixel space at `dpi`
const pageLinks = reactive<Record<number, LinkRegion[]>>({});
// display px per PNG px (previewWidth / naturalWidth); kept in sync on resize
const displayScale = ref(1);
// true while Ctrl/Cmd is held -> link hotspots become clickable
const linkArmed = ref(false);
// pages whose editable text was already auto-loaded on open
const autoLoaded = reactive<Record<number, boolean>>({});

// --- Figma-style alignment guides (shown while dragging an object)
// Each guide is a line in displayed-canvas CSS pixels: vertical guides use
// `pos` as x and span [start,end] in y; horizontal guides are the transpose.
const alignGuides = ref<AlignGuide[]>([]);
// snap threshold in CSS px: how close an edge/center must be to lock on
const SNAP_PX = 6;

// --- original embedded images loaded as movable objects
// raw extracted image as returned by the backend (PNG pixel space at `dpi`)
// originals the user deleted (kept per page so the exporter can redact them
// even though the canvas object is gone); px geometry at the given `dpi`
const deletedImages = reactive<Record<number, DeletedImg[]>>({});

// Circular photo frame per page, in *canvas* pixels. A source PDF that rounds a
// photo with a vector circle gives us this; any image whose centre sits inside
// the frame is clipped to the circle, and it reveals the full rectangle (on top)
// once dragged out. Lets you drop a different photo straight into the frame.
const photoFrames = reactive<Record<number, PhotoFrame>>({});

// --- editor tool state

const editor = reactive<PdfEditorState>({
  mode: "move" as Mode,
  color: "#7c3aed",
  opacity: 80, // 0..100
  size: 6, // brush width
  brushShape: "round" as BrushShape,

  // full editor mode (select + edit any object: text, size, position, style, fonts)
  fullMode: false,

  // text defaults
  textValue: "Hello!",
  textFont: "Helvetica",
  textSize: 32,
  textBold: false,
  textItalic: false,
  textUnderline: false,

  // signature defaults
  signatureSize: 2.0,
});

// --- inspector state (bound to the currently selected object)
const selected = reactive<PdfSelectedObjectState>({
  exists: false,
  isText: false,
  fontFamily: "Helvetica",
  fontSize: 32,
  bold: false,
  italic: false,
  underline: false,
  align: "left" as TextAlign,
  color: "#000000",
  opacity: 100, // 0..100
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  angle: 0,
});

// --- draft (per-page json)
const pageJson = reactive<Record<number, any>>({});

// --- history (per current page)
const history = reactive({
  stack: [] as any[],
  idx: -1,
  lock: false,
});

// fabric canvas instance
let c: Canvas | null = null;

// --- preview URL
const previewUrl = computed(() => {
  if (!docId.value) return "";
  // Once a page's text/images are loaded as editable objects, show the clean
  // background render (originals removed) so nothing is drawn twice. Pages with
  // no extractable content keep the normal full-page preview.
  const kind = autoLoaded[page.value] ? "background" : "preview";
  return `${config.public.apiBase}/pdf/${kind}/${docId.value}/${page.value}?dpi=${dpi.value}`;
});

watch(dpi, () => {
  dpi.value = clampInt(dpi.value, 72, 220);
});

// --- API helpers
function api(path: string) {
  return `${config.public.apiBase}${path}`;
}

// URL of the clean-background raster (originals removed) for a given page.
function backgroundUrl(pageNo: number): string {
  if (!docId.value) return "";
  return `${config.public.apiBase}/pdf/background/${docId.value}/${pageNo}?dpi=${dpi.value}`;
}

// =========================
// Draft: load/save Redis
// =========================
const {
  scheduleSave: scheduleSaveDraft,
  saveNow: saveDraftNow,
  load: loadDraft,
  dispose: disposeDraft,
} = usePdfDraft({
  docId,
  page,
  pageJson,
  deletedImages,
  api,
  getCurrentPageJson: () => c?.toJSON(["id", "tool", "opacityPct", "orig", "name"]) ?? null,
});

// =========================
// PDF info
// =========================
async function refreshInfo() {
  if (!docId.value) return;

  const info = await $fetch<{ pages: number; pageW: number; pageH: number }>(api(`/pdf/page-info/${docId.value}`));
  pages.value = info.pages;
  pageW.value = info.pageW;
  pageH.value = info.pageH;

  if (page.value > pages.value) page.value = pages.value;
  if (page.value < 1) page.value = 1;
}

// =========================
// Fabric helpers
// =========================
function pushHistory() {
  if (!c || history.lock) return;

  const snap = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);
  history.stack = history.stack.slice(0, history.idx + 1);
  history.stack.push(snap);
  history.idx = history.stack.length - 1;

  pageJson[page.value] = snap;
  scheduleSaveDraft();
}

function ensureFabric() {
  if (!overlayCanvasRef.value) return;

  if (c) {
    c.dispose();
    c = null;
  }

  c = new Canvas(overlayCanvasRef.value, {
    selection: true,
    preserveObjectStacking: true,
    stopContextMenu: true,
  });

  // Ensure brush exists (Fabric v7 may not create it until needed)
  if (!c.freeDrawingBrush) c.freeDrawingBrush = new PencilBrush(c);

  FabricObject.prototype.transparentCorners = false;
  FabricObject.prototype.cornerStyle = "circle";

  c.on("path:created", pushHistory);
  c.on("object:modified", pushHistory);
  c.on("object:removed", pushHistory);

  // keep the inspector panel in sync with the active selection
  const syncActive = () => syncSelectedFromObject(c?.getActiveObject() ?? null);
  c.on("selection:created", syncActive);
  c.on("selection:updated", syncActive);
  c.on("selection:cleared", () => {
    selected.exists = false;
  });
  c.on("object:modified", syncActive);
  c.on("object:moving", syncActive);
  c.on("object:scaling", syncActive);
  c.on("object:rotating", syncActive);

  // alignment guides: snap while moving, clear once the drag/gesture ends
  c.on("object:moving", onObjectMoving);
  c.on("object:modified", clearGuides);
  c.on("mouse:up", clearGuides);
  c.on("selection:cleared", clearGuides);

  // toggle the circular photo-frame clip as an image enters/leaves the circle
  // while dragging; on drop, fill+clip a photo that landed inside the circle.
  const clipOnMove = (e: any) => refreshImageClip(e?.target);
  c.on("object:moving", clipOnMove);
  c.on("object:scaling", clipOnMove);
  c.on("object:modified", (e: any) => onImageDrop(e?.target));

  // right-click a photo to swap it out (context menu -> file picker)
  c.on("mouse:down", onCanvasMouseDown);
  c.upperCanvasEl?.addEventListener("contextmenu", (ev) => ev.preventDefault());

  applyMode();
}

function resizeToPreview() {
  if (!c || !previewImgRef.value) return;

  const r = previewImgRef.value.getBoundingClientRect();
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);

  // Fabric handles retina scaling internally
  c.setDimensions({ width: w, height: h });
  c.calcOffset();
  c.requestRenderAll();

  // keep link hotspots aligned with the displayed preview size
  displayScale.value = 1 / (calcMultiplier() || 1);
}

// =========================
// Alignment guides + snapping (Figma-style)
// =========================
type Edges = { left: number; top: number; right: number; bottom: number; cx: number; cy: number };

function edgesOf(o: any): Edges {
  const r = o.getBoundingRect();
  return {
    left: r.left,
    top: r.top,
    right: r.left + r.width,
    bottom: r.top + r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  };
}

function clearGuides() {
  if (alignGuides.value.length) alignGuides.value = [];
}

// While dragging: snap the moving object's edges/center to the edges/centers of
// the other objects (and the canvas centre lines), and surface guide lines for
// every axis that locked on.
function onObjectMoving(e: any) {
  const obj = e?.target;
  if (!c || !obj) {
    clearGuides();
    return;
  }
  // only single, axis-aligned objects snap (skip multi-selections & rotated)
  if (obj.type === "activeselection" || Math.round(obj.angle || 0) % 360 !== 0) {
    clearGuides();
    return;
  }

  const others = c.getObjects().filter((o: any) => o !== obj && o.visible !== false);
  const m = edgesOf(obj);
  const cw = c.getWidth();
  const ch = c.getHeight();

  // vertical (x) snap candidates: {target x, y-extent of the reference}
  const vCand: { t: number; a: number; b: number }[] = [{ t: cw / 2, a: 0, b: ch }];
  // horizontal (y) snap candidates: {target y, x-extent of the reference}
  const hCand: { t: number; a: number; b: number }[] = [{ t: ch / 2, a: 0, b: cw }];
  for (const o of others) {
    const r = edgesOf(o);
    vCand.push({ t: r.left, a: r.top, b: r.bottom });
    vCand.push({ t: r.cx, a: r.top, b: r.bottom });
    vCand.push({ t: r.right, a: r.top, b: r.bottom });
    hCand.push({ t: r.top, a: r.left, b: r.right });
    hCand.push({ t: r.cy, a: r.left, b: r.right });
    hCand.push({ t: r.bottom, a: r.left, b: r.right });
  }

  let bestX: { d: number; t: number; a: number; b: number } | null = null;
  for (const mv of [m.left, m.cx, m.right]) {
    for (const cand of vCand) {
      const d = cand.t - mv;
      if (Math.abs(d) <= SNAP_PX && (bestX === null || Math.abs(d) < Math.abs(bestX.d))) {
        bestX = { d, t: cand.t, a: cand.a, b: cand.b };
      }
    }
  }

  let bestY: { d: number; t: number; a: number; b: number } | null = null;
  for (const mv of [m.top, m.cy, m.bottom]) {
    for (const cand of hCand) {
      const d = cand.t - mv;
      if (Math.abs(d) <= SNAP_PX && (bestY === null || Math.abs(d) < Math.abs(bestY.d))) {
        bestY = { d, t: cand.t, a: cand.a, b: cand.b };
      }
    }
  }

  if (bestX) obj.left = (obj.left || 0) + bestX.d;
  if (bestY) obj.top = (obj.top || 0) + bestY.d;
  if (bestX || bestY) obj.setCoords();

  const guides: AlignGuide[] = [];
  const mm = edgesOf(obj);
  if (bestX) {
    guides.push({
      k: "v",
      v: true,
      pos: bestX.t,
      start: Math.min(bestX.a, mm.top),
      end: Math.max(bestX.b, mm.bottom),
    });
  }
  if (bestY) {
    guides.push({
      k: "h",
      v: false,
      pos: bestY.t,
      start: Math.min(bestY.a, mm.left),
      end: Math.max(bestY.b, mm.right),
    });
  }
  alignGuides.value = guides;
}

// After restoring a draft, rebuild the page's photo frame from any image that
// still carries a circular clip, so entering/leaving the circle keeps toggling.
function recoverPhotoFrame(p: number) {
  if (!c || photoFrames[p]) return;
  for (const o of c.getObjects() as any[]) {
    const cp = o?.clipPath;
    if (isImageObject(o) && cp && typeof cp.rx === "number" && cp.absolutePositioned) {
      photoFrames[p] = { cx: cp.left, cy: cp.top, rx: cp.rx, ry: cp.ry };
      return;
    }
  }
}

function loadCanvasForPage(p: number) {
  if (!c) return;

  history.lock = true;
  c.clear();
  clearGuides();

  resizeToPreview();

  const json = pageJson[p];
  if (json) {
    c.loadFromJSON(json, () => {
      history.lock = false;
      history.stack = [c!.toJSON(["id", "tool", "opacityPct", "orig"])];
      history.idx = 0;
      recoverPhotoFrame(p);
      c!.requestRenderAll();
      // A draft saved before the width fix may hold boxes measured against the
      // fallback font; grow them once the real webfonts resolve so restored text
      // doesn't wrap into the block below.
      const fonts = (typeof document !== "undefined" ? (document as any).fonts : null);
      if (fonts?.ready) fonts.ready.then(() => refitPdfTextWidths()).catch(() => {});
      else refitPdfTextWidths();
    });
  } else {
    history.lock = false;
    history.stack = [c.toJSON(["id", "tool", "opacityPct", "orig", "name"])];
    history.idx = 0;
    c.requestRenderAll();
  }
}

function applyMode() {
  if (!c) return;

  const isMove = editor.mode === "move";
  const isDraw = editor.mode === "pen" || editor.mode === "highlighter" || editor.mode === "signature";

  c.selection = isMove;
  c.forEachObject((o) => {
    o.selectable = isMove;
    o.evented = true;
  });

  c.isDrawingMode = !isMove && isDraw;

  if (c.isDrawingMode) {
    if (!c.freeDrawingBrush) c.freeDrawingBrush = new PencilBrush(c);

    const alpha = editor.opacity / 100;
    c.freeDrawingBrush.color =
        editor.mode === "highlighter" ? rgbaFromHex(editor.color, alpha * 0.35) : rgbaFromHex(editor.color, alpha);

    c.freeDrawingBrush.width = Math.max(1, editor.mode === "signature" ? editor.signatureSize : editor.size);
  }

  c.defaultCursor = isMove ? "default" : "crosshair";
  c.hoverCursor = isMove ? "move" : "crosshair";
  c.requestRenderAll();
}

// =========================
// Tools actions (add objects)
// =========================
function addRect() {
  if (!c) return;

  const alpha = editor.opacity / 100;
  const fill = rgbaFromHex(editor.color, alpha * 0.25);
  const stroke = rgbaFromHex(editor.color, alpha);

  const rect = new Rect({
    width: 260,
    height: 140,
    fill,
    stroke,
    strokeWidth: 2,
    rx: editor.brushShape === "round" ? 14 : 0,
    ry: editor.brushShape === "round" ? 14 : 0,
  });

  setByTopLeft(rect, 80, 80);
  c.add(rect);
  c.setActiveObject(rect);
  c.requestRenderAll();

  editor.mode = "move";
  applyMode();
}

function addCircle() {
  if (!c) return;

  const alpha = editor.opacity / 100;
  const fill = rgbaFromHex(editor.color, alpha * 0.25);
  const stroke = rgbaFromHex(editor.color, alpha);

  const circle = new Ellipse({
    rx: 120,
    ry: 80,
    fill,
    stroke,
    strokeWidth: 2,
  });

  setByTopLeft(circle, 90, 90);
  c.add(circle);
  c.setActiveObject(circle);
  c.requestRenderAll();

  editor.mode = "move";
  applyMode();
}

function addTextBox() {
  if (!c) return;

  const alpha = editor.opacity / 100;

  const txt = new Textbox(editor.textValue || "Text", {
    width: 320,
    fill: rgbaFromHex(editor.color, alpha),
    fontFamily: editor.textFont || "Helvetica",
    fontSize: clampInt(editor.textSize, 8, 120),
    fontWeight: editor.textBold ? "bold" : "normal",
    fontStyle: editor.textItalic ? "italic" : "normal",
    underline: editor.textUnderline,
  });

  setByTopLeft(txt, 80, 80);
  c.add(txt);
  c.setActiveObject(txt);
  c.requestRenderAll();

  editor.mode = "move";
  applyMode();
}

const imageInput = ref<HTMLInputElement | null>(null);

function openImagePicker() {
  imageInput.value?.click();
}

async function onPickImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !c) return;

  const reader = new FileReader();
  reader.onload = async () => {
    const img = await FabricImage.fromURL(reader.result as string);
    img.set({ opacity: editor.opacity / 100 });

    const maxW = 360;
    const maxH = 220;
    const iw = img.width || 1;
    const ih = img.height || 1;
    const s = Math.min(maxW / iw, maxH / ih, 1);
    img.scale(s);

    setByTopLeft(img, 80, 80);
    c!.add(img);
    c!.setActiveObject(img);
    c!.requestRenderAll();

    editor.mode = "move";
    applyMode();
  };
  reader.readAsDataURL(file);
}

// Swap the pixels of the selected image (e.g. drop a new headshot into the
// existing circular frame) while keeping its position, on-canvas size and clip.
const replaceInput = ref<HTMLInputElement | null>(null);

function replaceSelectedImage() {
  if (!c) return;
  const obj: any = c.getActiveObject();
  if (!obj || typeof obj.setSrc !== "function") return;
  replaceInput.value?.click();
}

async function onPickReplaceImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || !c) return;

  const obj: any = c.getActiveObject();
  if (!obj || typeof obj.setSrc !== "function") return;

  // preserve the current footprint so the new photo lands in the same box/frame
  const prevW = obj.getScaledWidth();
  const prevH = obj.getScaledHeight();

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await obj.setSrc(reader.result as string, { crossOrigin: "anonymous" });
      const natW = obj.width || 1;
      const natH = obj.height || 1;
      obj.set({ scaleX: prevW / natW, scaleY: prevH / natH });
      obj.setCoords();
      c!.requestRenderAll();
      pushHistory();
      scheduleSaveDraft();
      refreshImageClip(obj);
    } catch {
      // leave the original image in place if the swap fails
    }
  };
  reader.readAsDataURL(file);
}

function isImageObject(obj: any): boolean {
  return !!obj && (obj.type === "image" || typeof obj.setSrc === "function");
}

// Right-click a photo to replace it: select the image under the cursor and open
// the file picker. The native context menu is suppressed on the canvas.
function onCanvasMouseDown(e: any) {
  if (!c || e?.e?.button !== 2) return;
  const obj: any = e.target;
  if (!isImageObject(obj)) return;
  c.setActiveObject(obj);
  c.requestRenderAll();
  replaceInput.value?.click();
}

// Clip an image to the page's circular photo frame while its centre sits inside
// the circle; drop the clip (and lift it to the front) once it's dragged out, so
// the full rectangle shows on top instead of vanishing under the frame. Used for
// the original avatar, replaced photos and any image dragged into the circle.
function refreshImageClip(obj: any) {
  if (!c || !isImageObject(obj)) return;
  const frame = photoFrames[page.value];
  if (!frame) return;

  const c2 = obj.getCenterPoint();
  const dx = (c2.x - frame.cx) / frame.rx;
  const dy = (c2.y - frame.cy) / frame.ry;
  const inside = dx * dx + dy * dy <= 1;

  if (inside) {
    obj.clipPath = new Ellipse({
      originX: "center",
      originY: "center",
      left: frame.cx,
      top: frame.cy,
      rx: frame.rx,
      ry: frame.ry,
      absolutePositioned: true,
    });
  } else if (obj.clipPath) {
    obj.clipPath = undefined;
    c.bringObjectToFront(obj);
  }
  obj.setCoords();
}

// Snap an image to completely fill the circular photo frame (cover-fit, centred)
// and clip it to the circle — the "drop a photo onto the avatar" behaviour. Runs
// on drop so it doesn't fight the drag. Returns true if the image was fitted.
function fitImageToFrame(obj: any): boolean {
  if (!c || !isImageObject(obj)) return false;
  const frame = photoFrames[page.value];
  if (!frame) return false;

  const cp = obj.getCenterPoint();
  const dx = (cp.x - frame.cx) / frame.rx;
  const dy = (cp.y - frame.cy) / frame.ry;
  if (dx * dx + dy * dy > 1) return false; // centre outside the circle: leave as-is

  const natW = obj.width || 1;
  const natH = obj.height || 1;
  // cover the ellipse's bounding box so no gaps show inside the circle
  const scale = Math.max((frame.rx * 2) / natW, (frame.ry * 2) / natH);
  const scaledW = natW * scale;
  const scaledH = natH * scale;

  obj.set({
    angle: 0,
    scaleX: scale,
    scaleY: scale,
    left: frame.cx - scaledW / 2,
    top: frame.cy - scaledH / 2,
  });
  obj.clipPath = new Ellipse({
    originX: "center",
    originY: "center",
    left: frame.cx,
    top: frame.cy,
    rx: frame.rx,
    ry: frame.ry,
    absolutePositioned: true,
  });
  obj.setCoords();
  return true;
}

// Drop handler: fill+clip a photo dropped onto the circle, otherwise fall back
// to the plain enter/leave clip toggle. Re-commits so the fit is saved/undoable.
function onImageDrop(obj: any) {
  if (!c) return;
  if (fitImageToFrame(obj)) {
    c.requestRenderAll();
    syncSelectedFromObject(obj);
    pushHistory();
  } else {
    refreshImageClip(obj);
  }
}

// Remember a deleted original image so the exporter can still redact it from
// the source (the canvas object won't exist at save time).
function trackDeletedImage(obj: any) {
  if (!obj || obj.tool !== "pdfimg" || !obj.orig) return;
  const o = obj.orig;
  const arr = deletedImages[page.value] || (deletedImages[page.value] = []);
  arr.push({ name: String(obj.name || ""), x: o.x, y: o.y, w: o.w, h: o.h, dpi: o.dpi });
}

function removeSelected() {
  if (!c) return;
  const obj: any = c.getActiveObject();
  if (!obj) return;

  // an active selection wraps several objects; track any images inside it
  if (typeof obj.getObjects === "function") {
    obj.getObjects().forEach(trackDeletedImage);
  } else {
    trackDeletedImage(obj);
  }

  c.remove(obj);
  c.discardActiveObject();
  c.requestRenderAll();
}

function clearPage() {
  if (!c) return;
  c.getObjects().forEach(trackDeletedImage);
  c.clear();
  c.requestRenderAll();
  pageJson[page.value] = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);
  scheduleSaveDraft();
}

// =========================
// Full editor: inspector (edit selected object)
// =========================
function activeObj(): any {
  return c?.getActiveObject() ?? null;
}

function isTextObject(o: any): boolean {
  const tp = String(o?.type || "").toLowerCase();
  return tp === "textbox" || tp === "text" || tp === "i-text";
}

// Read the selected object's props into the inspector state.
function syncSelectedFromObject(obj: any) {
  if (!obj || !c) {
    selected.exists = false;
    return;
  }

  selected.exists = true;
  selected.isText = isTextObject(obj);

  const sw = obj.getScaledWidth?.() ?? obj.width ?? 0;
  const sh = obj.getScaledHeight?.() ?? obj.height ?? 0;

  // origin is center (set globally), convert to top-left for display
  selected.x = Math.round((obj.left ?? 0) - sw / 2);
  selected.y = Math.round((obj.top ?? 0) - sh / 2);
  selected.w = Math.round(sw);
  selected.h = Math.round(sh);
  selected.angle = Math.round(obj.angle ?? 0);
  selected.opacity = Math.round((obj.opacity ?? 1) * 100);

  if (selected.isText) {
    selected.fontFamily = String(obj.fontFamily ?? "Helvetica");
    selected.fontSize = Math.round(obj.fontSize ?? 32);
    selected.bold = String(obj.fontWeight ?? "normal") === "bold";
    selected.italic = String(obj.fontStyle ?? "normal") === "italic";
    selected.underline = !!obj.underline;
    selected.align = (String(obj.textAlign ?? "left") as TextAlign);
    selected.color = hexFromColor(obj.fill);
  } else {
    selected.color = hexFromColor(obj.stroke ?? obj.fill);
  }
}

function commitSelected(obj: any) {
  if (!c || !obj) return;
  obj.setCoords?.();
  c.requestRenderAll();
  pushHistory();
}

function applySelectedFont() {
  const o = activeObj();
  if (!o || !isTextObject(o)) return;
  o.set("fontFamily", selected.fontFamily || "Helvetica");
  commitSelected(o);
  syncSelectedFromObject(o);
}

function applySelectedFontSize() {
  const o = activeObj();
  if (!o || !isTextObject(o)) return;
  o.set("fontSize", clampInt(selected.fontSize, 4, 400));
  commitSelected(o);
  syncSelectedFromObject(o);
}

function toggleSelectedStyle(kind: "bold" | "italic" | "underline") {
  const o = activeObj();
  if (!o || !isTextObject(o)) return;
  if (kind === "bold") {
    selected.bold = !selected.bold;
    o.set("fontWeight", selected.bold ? "bold" : "normal");
  } else if (kind === "italic") {
    selected.italic = !selected.italic;
    o.set("fontStyle", selected.italic ? "italic" : "normal");
  } else {
    selected.underline = !selected.underline;
    o.set("underline", selected.underline);
  }
  commitSelected(o);
}

function applySelectedAlign(align: TextAlign) {
  const o = activeObj();
  if (!o || !isTextObject(o)) return;
  selected.align = align;
  o.set("textAlign", align);
  commitSelected(o);
}

function applySelectedColor() {
  const o = activeObj();
  if (!o) return;
  if (isTextObject(o)) {
    o.set("fill", selected.color);
  } else {
    o.set("stroke", selected.color);
  }
  commitSelected(o);
}

function applySelectedOpacity() {
  const o = activeObj();
  if (!o) return;
  o.set("opacity", clampInt(selected.opacity, 0, 100) / 100);
  commitSelected(o);
}

// Apply size / position / rotation from the inspector inputs.
function applySelectedGeometry() {
  const o = activeObj();
  if (!o) return;

  const newW = Math.max(1, selected.w);
  const newH = Math.max(1, selected.h);

  if (isTextObject(o)) {
    // text reflows: width controls wrapping, height is derived
    o.set({ width: newW, scaleX: 1, scaleY: 1 });
  } else {
    const bw = o.width || 1;
    const bh = o.height || 1;
    o.set({ scaleX: newW / bw, scaleY: newH / bh });
  }

  o.set("angle", selected.angle);

  const sw = o.getScaledWidth?.() ?? newW;
  const sh = o.getScaledHeight?.() ?? newH;
  o.set({ left: selected.x + sw / 2, top: selected.y + sh / 2 });

  refreshImageClip(o);
  commitSelected(o);
  syncSelectedFromObject(o);
}

// Re-measure every extracted text box with its current font and grow its width
// so no hard line soft-wraps. Called once the real CV webfonts finish loading:
// they render wider than the fallback the box was first measured against, so a
// box sized while the font was still loading would wrap and push later lines
// down onto the next block. Never shrinks below the source width.
function refitPdfTextWidths(): void {
  if (!c) return;
  let changed = false;
  for (const o of c.getObjects() as any[]) {
    if (o?.tool !== "pdftext") continue;
    const bold = o.fontWeight === "bold" || o.fontWeight === 700 || o.fontWeight === "700";
    const italic = o.fontStyle === "italic";
    const measured = measureMaxLineWidth(o.text ?? "", o.fontSize ?? 12, o.fontFamily || "", bold, italic);
    const needed = Math.ceil(measured) + Math.ceil((o.fontSize ?? 12) * 0.6) + 4;
    const target = Math.max(o.baseW ?? 0, needed);
    if (target > (o.width ?? 0) + 0.5) {
      o.set("width", target);
      changed = true;
    }
  }
  if (changed) c.requestRenderAll();
}

// Load extractable PDF text of the current page as editable text boxes.
// Uses the backend text-extraction endpoint when available; degrades gracefully.
async function loadEditableText(silent = false): Promise<boolean> {
  if (!c || !docId.value || isBusy.value) return false;

  errorMsg.value = null;
  isBusy.value = true;
  try {
    type Block = OrigBlock;

    const res = await $fetch<{ blocks?: Block[]; links?: LinkRegion[]; images?: ImageRegion[] }>(
      api(`/pdf/text-blocks/${docId.value}/${page.value}?dpi=${dpi.value}`),
    );

    // clickable link regions (PNG pixel space at dpi) for this page
    pageLinks[page.value] = (res?.links ?? [])
      .map((l) => ({ x: l.x ?? 0, y: l.y ?? 0, w: l.w ?? 0, h: l.h ?? 0, uri: String(l.uri || "") }))
      .filter((l) => l.uri);

    const blocks = res?.blocks ?? [];
    const images = res?.images ?? [];
    if (!blocks.length && !images.length) {
      if (!silent) errorMsg.value = t("services.pdfEditor.full.noText");
      return false;
    }

    // Idempotent load: drop any editable originals already on the canvas for
    // this page before re-adding, so calling this twice (auto-load + the manual
    // "Load text" button) never stacks a duplicate copy over the first.
    c.getObjects()
      .filter((o: any) => o?.tool === "pdftext" || o?.tool === "pdfimg")
      .forEach((o) => c!.remove(o));

    // backend coordinates are in the rendered PNG pixel space (at `dpi`);
    // scale them into the displayed canvas space.
    const scale = 1 / (calcMultiplier() || 1);

    // wait for the CV webfonts so text is measured/placed with the real glyphs,
    // but bounded so a slow CDN can't block the load; if they arrive after we
    // already drew, repaint so the fallback glyphs are replaced with the real
    // ones without re-running the whole load.
    await ensureEditorFontsReady();
    const fonts = (typeof document !== "undefined" ? (document as any).fonts : null);
    if (fonts?.ready) fonts.ready.then(() => refitPdfTextWidths()).catch(() => {});

    blocks.forEach((b, i) => {
      const fontPx = clampInt(Math.round((b.fontSize ?? 12) * scale), 4, 400);

      // Match the original paragraph's line pitch so overlaid rows keep
      // aligning with background bullets/rules. Prefer the exact multiplier the
      // backend derived from real baselines; otherwise estimate it from the
      // block height / row count (Fabric's default ~1.16 stacks rows too tall).
      const nLines = Math.max(1, (b.text || "").split("\n").length);
      const boxHpx = (b.h ?? 0) * scale;
      const lineHeight =
        b.lineHeight && b.lineHeight > 0
          ? Math.min(3, Math.max(0.8, b.lineHeight))
          : nLines > 1 && boxHpx > 0
            ? Math.min(3, Math.max(0.8, boxHpx / nLines / fontPx))
            : 1.16;

      // Per-span (intra-line) bold/italic/colour so a block keeps each run's
      // style instead of collapsing to one dominant weight — e.g. a bold
      // MARHARYTA next to a regular KUBAI on the same line, or a regular date
      // over a bold company over an italic role.
      const lineRuns = Array.isArray(b.lineRuns) ? b.lineRuns : null;
      const anyBold =
        !!b.bold || !!lineRuns?.some((line) => line.some((r) => r.bold));
      let charStyles: Record<number, Record<number, any>> | undefined;
      if (lineRuns) {
        const textLines = (b.text || "").split("\n");
        const cs: Record<number, Record<number, any>> = {};
        for (let li = 0; li < textLines.length; li++) {
          const runs = lineRuns[li];
          const lineText = textLines[li] ?? "";
          if (!runs || !runs.length) continue;
          const perChar: Record<number, any> = {};
          let offset = 0;
          for (const run of runs) {
            const end = Math.min(lineText.length, offset + (run.n ?? 0));
            for (let ci = offset; ci < end; ci++) {
              perChar[ci] = {
                fontWeight: run.bold ? "bold" : "normal",
                fontStyle: run.italic ? "italic" : "normal",
                fill: run.color || b.color || "#111111",
              };
            }
            offset = end;
          }
          cs[li] = perChar;
        }
        charStyles = cs;
      }

      // Widen the box so no hard line soft-wraps under the substituted browser
      // font, but never shrink below the source width. This keeps the original
      // layout (single-line name, one row per list item) instead of wrapping.
      const fontFamily = resolveFontFamily(b.fontName);
      const baseW = Math.max(20, (b.w ?? 200) * scale);
      const measuredW = measureMaxLineWidth(
        b.text || "",
        fontPx,
        fontFamily,
        anyBold,
        !!b.italic,
      );
      // Generous slack (≈ half an em) absorbs the gap between our canvas
      // measurement and Fabric's own word metrics, and covers the case where the
      // real webfont (wider than the fallback) is still loading when we measure —
      // without it, a single wrapped word cascades every later line down into the
      // next block. refitPdfTextWidths() re-tightens once the fonts resolve.
      const boxW = Math.max(baseW, Math.ceil(measuredW) + Math.ceil(fontPx * 0.6) + 4);

      const box = new Textbox(b.text || "", {
        width: boxW,
        fill: b.color || "#111111",
        fontFamily,
        fontSize: fontPx,
        lineHeight,
        fontWeight: b.bold ? "bold" : "normal",
        fontStyle: b.italic ? "italic" : "normal",
        ...(charStyles ? { styles: charStyles } : {}),
      });
      (box as any).tool = "pdftext";
      (box as any).baseW = baseW;
      (box as any).id = b.id || genBlockId(page.value, i);

      // keep the original extracted block verbatim so the backend can match
      // the redaction region even after the user moves/edits the text.
      (box as any).orig = {
        id: b.id ?? null,
        page: page.value,
        dpi: dpi.value,
        x: b.x ?? 0,
        y: b.y ?? 0,
        w: b.w ?? 0,
        h: b.h ?? 0,
        text: b.text ?? "",
        fontSize: b.fontSize ?? null,
        fontName: b.fontName ?? null,
        bold: !!b.bold,
        italic: !!b.italic,
        color: b.color ?? null,
      } as OrigBlockMeta;

      setByTopLeft(box, (b.x ?? 0) * scale, (b.y ?? 0) * scale);
      c!.add(box);
    });

    // original embedded images as movable/resizable/rotatable objects; the
    // backend redacts each original and re-inserts (vector) only if it changed.
    for (const im of images) {
      try {
        const fimg = await FabricImage.fromURL(api(im.url), { crossOrigin: "anonymous" });
        const natW = fimg.width || 1;
        const natH = fimg.height || 1;
        const targetW = Math.max(1, (im.w ?? natW) * scale);
        const targetH = Math.max(1, (im.h ?? natH) * scale);
        fimg.set({ scaleX: targetW / natW, scaleY: targetH / natH });

        (fimg as any).tool = "pdfimg";
        (fimg as any).id = im.id || genBlockId(page.value, 0);
        (fimg as any).name = im.name;

        // Circular framing from the source PDF: remember the circle as a
        // page-level frame (canvas px) so this photo — and any other dropped in
        // later — is clipped to it while inside and shown full when moved out.
        if (im.clip) {
          photoFrames[page.value] = {
            cx: ((im.x ?? 0) + im.clip.cx * (im.w ?? 0)) * scale,
            cy: ((im.y ?? 0) + im.clip.cy * (im.h ?? 0)) * scale,
            rx: Math.max(1, im.clip.rx * (im.w ?? 0) * scale),
            ry: Math.max(1, im.clip.ry * (im.h ?? 0) * scale),
          };
        }
        (fimg as any).orig = {
          id: im.id ?? null,
          page: page.value,
          dpi: dpi.value,
          x: im.x ?? 0,
          y: im.y ?? 0,
          w: im.w ?? 0,
          h: im.h ?? 0,
          text: "",
          fontSize: null,
          fontName: null,
          bold: false,
          italic: false,
          color: null,
        } as OrigBlockMeta;

        setByTopLeft(fimg, (im.x ?? 0) * scale, (im.y ?? 0) * scale);
        c!.add(fimg);
        refreshImageClip(fimg);
      } catch {
        // skip an image that fails to load; text editing still works
      }
    }

    c.requestRenderAll();
    // The freshly loaded page IS the undo baseline: collapse history down to it
    // (rather than leaving the empty pre-load canvas underneath) so the first
    // Ctrl+Z can't revert to a blank page and wipe every extracted object.
    pushHistory();
    history.stack = [history.stack[history.idx]];
    history.idx = 0;

    // switch the preview raster to the clean background (originals removed) so
    // the editable objects we just added aren't shown on top of their copies.
    // Preload it first so the swap is instant and the page doesn't visibly jump.
    await preloadImage(backgroundUrl(page.value));
    autoLoaded[page.value] = true;

    editor.fullMode = true;
    editor.mode = "move";
    applyMode();
    return true;
  } catch (e: any) {
    if (!silent) errorMsg.value = e?.data?.detail?.message || t("services.pdfEditor.full.noText");
    return false;
  } finally {
    isBusy.value = false;
  }
}

// Auto-load the page's editable text on open (once per page), unless the draft
// already restored editable pdf-text objects. Requires the preview raster to be
// loaded so coordinates map correctly.
function currentHasPdfText(): boolean {
  return !!c && c.getObjects().some((o: any) => o?.tool === "pdftext" || o?.tool === "pdfimg");
}

async function maybeAutoLoadText() {
  if (!c || autoLoaded[page.value] || isBusy.value) return;

  const img = previewImgRef.value;
  if (!img || !img.complete || img.naturalWidth === 0) return;

  if (currentHasPdfText()) {
    autoLoaded[page.value] = true;
    return;
  }

  const ok = await loadEditableText(true);
  if (ok) autoLoaded[page.value] = true;
}

// Open a link region (Ctrl/Cmd-click) in a new tab.
function openLink(uri: string) {
  if (!uri) return;
  window.open(uri, "_blank", "noopener,noreferrer");
}

// Link hotspots for the current page, in displayed-preview pixels.
const linkHotspots = computed(() => {
  const arr = pageLinks[page.value] || [];
  const s = displayScale.value || 1;
  return arr.map((l, i) => ({
    key: `${page.value}_${i}`,
    uri: l.uri,
    left: l.x * s,
    top: l.y * s,
    width: Math.max(6, l.w * s),
    height: Math.max(6, l.h * s),
  }));
});

// Track Ctrl/Cmd so hotspots only intercept clicks while a modifier is held.
function onModKey(e: KeyboardEvent) {
  linkArmed.value = e.ctrlKey || e.metaKey;
}
function clearArmed() {
  linkArmed.value = false;
}

function toggleFullMode() {
  editor.fullMode = !editor.fullMode;
  if (editor.fullMode) {
    editor.mode = "move";
    applyMode();
    syncSelectedFromObject(activeObj());
  }
}

// =========================
// Undo/Redo (local)
// =========================
const canUndo = computed(() => history.idx > 0);
const canRedo = computed(() => history.idx >= 0 && history.idx < history.stack.length - 1);

function undo() {
  if (!c || !canUndo.value) return;
  history.idx -= 1;

  history.lock = true;
  c.loadFromJSON(history.stack[history.idx], () => {
    history.lock = false;
    c!.requestRenderAll();
    pageJson[page.value] = history.stack[history.idx];
    scheduleSaveDraft();
  });
}

function redo() {
  if (!c || !canRedo.value) return;
  history.idx += 1;

  history.lock = true;
  c.loadFromJSON(history.stack[history.idx], () => {
    history.lock = false;
    c!.requestRenderAll();
    pageJson[page.value] = history.stack[history.idx];
    scheduleSaveDraft();
  });
}

// =========================
// Page switching
// =========================
async function setPage(p: number) {
  if (!docId.value || !c) return;

  const nextP = clampInt(p, 1, pages.value);
  if (nextP === page.value) return;

  pageJson[page.value] = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);
  page.value = nextP;

  await nextTick();
  loadCanvasForPage(page.value);
  scheduleSaveDraft();
}

// Append an empty themed page (same coloured columns as page 1, no avatar) and
// jump to it. The backend edits source.pdf in place; existing pages are kept.
async function addDesignPage() {
  if (!docId.value || !c || isBusy.value) return;
  isBusy.value = true;
  errorMsg.value = null;
  try {
    const res = await $fetch<{ pages: number; page: number }>(
      api(`/pdf/add-design-page/${docId.value}`),
      { method: "POST" },
    );
    pages.value = res.pages;
    await setPage(res.page);
  } catch (e: any) {
    errorMsg.value =
      e?.data?.detail?.message || e?.data?.detail || e?.message || t("services.pdfEditor.addPageFailed");
  } finally {
    isBusy.value = false;
  }
}

watch(page, () => {
  if (page.value < 1) page.value = 1;
  if (page.value > pages.value) page.value = pages.value;
});

// =========================
// Save flow: export PNG overlays per page -> backend save
// =========================
function calcMultiplier(): number {
  const img = previewImgRef.value;
  if (!img) return 1;

  const r = img.getBoundingClientRect();
  const displayedW = Math.max(1, r.width);

  const naturalW = img.naturalWidth || 0;
  if (naturalW <= 0) return 1;

  const m = naturalW / displayedW;
  return Number.isFinite(m) && m > 0 ? m : 1;
}

// Collect editable PDF-text objects (tool === "pdftext") from the current canvas.
// `mult` converts display coords -> natural PNG pixels; `dpiVal` is the DPI those
// pixels were rendered at, used to also express geometry in DPI-independent points.
function collectTextEditsFromCanvas(mult: number, dpiVal: number): TextEditBlock[] {
  if (!c) return [];
  const blocks: TextEditBlock[] = [];

  c.getObjects().forEach((o: any) => {
    if (o?.tool !== "pdftext") return;

    const sw = o.getScaledWidth?.() ?? o.width ?? 0;
    const sh = o.getScaledHeight?.() ?? o.height ?? 0;

    // natural PNG pixels (at dpiVal), top-left origin
    const xPx = ((o.left ?? 0) - sw / 2) * mult;
    const yPx = ((o.top ?? 0) - sh / 2) * mult;
    const wPx = sw * mult;
    const hPx = sh * mult;
    const fsPx = (o.fontSize ?? 12) * mult;

    blocks.push({
      id: o.id,
      text: String(o.text ?? ""),
      x: Math.round(xPx),
      y: Math.round(yPx),
      w: Math.round(wPx),
      h: Math.round(hPx),
      fontSize: Math.round(fsPx),
      xPt: pxToPt(xPx, dpiVal),
      yPt: pxToPt(yPx, dpiVal),
      wPt: pxToPt(wPx, dpiVal),
      hPt: pxToPt(hPx, dpiVal),
      fontSizePt: pxToPt(fsPx, dpiVal),
      fontName: String(o.fontFamily ?? "Helvetica"),
      bold: String(o.fontWeight ?? "normal") === "bold",
      italic: String(o.fontStyle ?? "normal") === "italic",
      underline: !!o.underline,
      align: String(o.textAlign ?? "left"),
      color: hexFromColor(o.fill),
      opacity: o.opacity ?? 1,
      angle: o.angle ?? 0,
      orig: withOrigPoints((o.orig ?? null) as OrigBlockMeta | null),
    });
  });

  return blocks;
}

// Collect moved/resized/rotated original images (tool === "pdfimg") from the
// current canvas. Only images whose geometry differs from the extracted
// original are emitted; untouched images are left byte-for-byte in the source.
function collectImageEditsFromCanvas(mult: number, dpiVal: number): ImageEdit[] {
  if (!c) return [];
  const out: ImageEdit[] = [];

  c.getObjects().forEach((o: any) => {
    if (o?.tool !== "pdfimg" || !o.orig) return;

    const sw = o.getScaledWidth?.() ?? o.width ?? 0;
    const sh = o.getScaledHeight?.() ?? o.height ?? 0;
    const ctr = o.getCenterPoint?.() ?? { x: o.left ?? 0, y: o.top ?? 0 };

    // natural PNG pixels (at dpiVal), unrotated box, top-left origin
    const wPx = sw * mult;
    const hPx = sh * mult;
    const xPx = ctr.x * mult - wPx / 2;
    const yPx = ctr.y * mult - hPx / 2;
    const angle = o.angle ?? 0;

    const cur = {
      xPt: pxToPt(xPx, dpiVal),
      yPt: pxToPt(yPx, dpiVal),
      wPt: pxToPt(wPx, dpiVal),
      hPt: pxToPt(hPx, dpiVal),
    };

    const op = withOrigPoints(o.orig as OrigBlockMeta);
    const origPt = {
      xPt: op?.xPt ?? 0,
      yPt: op?.yPt ?? 0,
      wPt: op?.wPt ?? 0,
      hPt: op?.hPt ?? 0,
    };

    const moved =
      Math.abs(cur.xPt - origPt.xPt) > 0.5 ||
      Math.abs(cur.yPt - origPt.yPt) > 0.5 ||
      Math.abs(cur.wPt - origPt.wPt) > 0.5 ||
      Math.abs(cur.hPt - origPt.hPt) > 0.5 ||
      Math.abs(angle) > 0.1;
    if (!moved) return;

    out.push({ name: String(o.name || ""), ...cur, angle, deleted: false, orig: origPt });
  });

  return out;
}

async function exportOverlaysPngByPage(): Promise<{
  overlays: Record<number, string>;
  textEdits: Record<number, TextEditBlock[]>;
  imageEdits: Record<number, ImageEdit[]>;
}> {
  if (!c) return { overlays: {}, textEdits: {}, imageEdits: {} };

  // save current page json
  pageJson[page.value] = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);

  const overlays: Record<number, string> = {};
  const textEdits: Record<number, TextEditBlock[]> = {};
  const imageEdits: Record<number, ImageEdit[]> = {};

  const curPage = page.value;
  const curJson = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);

  for (let p = 1; p <= pages.value; p++) {
    const json = pageJson[p];
    if (!json) continue;

    await new Promise<void>((resolve, reject) => {
      history.lock = true;
      c!.loadFromJSON(json, () => {
        history.lock = false;

        try {
          resizeToPreview();
          const mult = calcMultiplier();

          // structured edited text blocks (backend redacts originals / re-typesets)
          const blocks = collectTextEditsFromCanvas(mult, dpi.value);
          if (blocks.length) textEdits[p] = blocks;

          // structured image edits: changed originals + originals deleted on
          // this page (backend redacts + vector re-inserts). Skip a "deleted"
          // entry whose image is actually still present (e.g. after undo).
          const changed = collectImageEditsFromCanvas(mult, dpi.value);
          const presentNames = new Set(
            c!.getObjects()
              .filter((o: any) => o?.tool === "pdfimg")
              .map((o: any) => String(o.name || "")),
          );
          const removed: ImageEdit[] = (deletedImages[p] || [])
            .filter((d) => !presentNames.has(d.name))
            .map((d) => {
              const dv = d.dpi > 0 ? d.dpi : dpi.value;
              return {
                name: d.name,
                xPt: 0,
                yPt: 0,
                wPt: 0,
                hPt: 0,
                angle: 0,
                deleted: true,
                orig: {
                  xPt: pxToPt(d.x, dv),
                  yPt: pxToPt(d.y, dv),
                  wPt: pxToPt(d.w, dv),
                  hPt: pxToPt(d.h, dv),
                },
              };
            });
          const imgEdits = [...changed, ...removed];
          if (imgEdits.length) imageEdits[p] = imgEdits;

          // hide editable pdf-text AND original images from the raster overlay so
          // they aren't baked in (the backend renders them from structured data;
          // untouched images stay in the source untouched)
          const hidden: any[] = [];
          c!.getObjects().forEach((o: any) => {
            if (o?.tool === "pdftext" || o?.tool === "pdfimg") {
              o.visible = false;
              hidden.push(o);
            }
          });
          if (hidden.length) c!.requestRenderAll();

          overlays[p] = c!.toDataURL({ format: "png", multiplier: mult });

          hidden.forEach((o) => {
            o.visible = true;
          });
          if (hidden.length) c!.requestRenderAll();

          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  // restore current
  await new Promise<void>((resolve, reject) => {
    history.lock = true;
    c!.loadFromJSON(curJson, () => {
      history.lock = false;
      try {
        resizeToPreview();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  page.value = curPage;
  return { overlays, textEdits, imageEdits };
}

async function saveDocument() {
  if (!docId.value) return;
  if (isBusy.value) return;

  // prevent "save while preview not loaded"
  const img = previewImgRef.value;
  if (!img || !img.complete || img.naturalWidth === 0) {
    errorMsg.value = "Preview is not loaded yet. Please wait a moment.";
    return;
  }

  errorMsg.value = null;
  isBusy.value = true;

  try {
    const { overlays, textEdits, imageEdits } = await exportOverlaysPngByPage();

    // clickable links per page, converted to DPI-independent PDF points
    const links: Record<number, Array<{ xPt: number; yPt: number; wPt: number; hPt: number; uri: string }>> = {};
    for (const [p, arr] of Object.entries(pageLinks)) {
      const list = (arr || [])
        .filter((l) => l.uri)
        .map((l) => ({
          xPt: pxToPt(l.x, dpi.value),
          yPt: pxToPt(l.y, dpi.value),
          wPt: pxToPt(l.w, dpi.value),
          hPt: pxToPt(l.h, dpi.value),
          uri: l.uri,
        }));
      if (list.length) links[Number(p)] = list;
    }

    const res = await $fetch<{ downloadUrl: string; expiresAtResult?: number }>(api(`/pdf/save/${docId.value}`), {
      method: "POST",
      body: {
        overlays,
        textEdits,
        imageEdits,
        links,
        dpi: dpi.value,
        // page size in PDF points, so the backend can map pixel/point coords and
        // flip the Y axis if it works in native PDF space (origin bottom-left).
        page: { widthPt: pageW.value, heightPt: pageH.value },
        // self-describing so the backend never has to guess the frame of reference.
        coords: { space: "top-left", pointsPerInch: 72, pxDpi: dpi.value },
      },
    });

    await refreshInfo();

    if (res?.downloadUrl) {
      window.open(api(res.downloadUrl.replace(config.public.apiBase, "")) as any, "_blank");
    }
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.message || e?.message || "Save failed";
  } finally {
    isBusy.value = false;
  }
}

// =========================
// Other actions
// =========================
function uploadNew() {
  router.push(localePath("/services/pdf-editor"));
}

function downloadSource() {
  if (!docId.value) return;
  window.open(`${config.public.apiBase}/pdf/download/${docId.value}`, "_blank");
}

// =========================
// Keyboard shortcuts
// =========================
function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = (t.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return true;
  return t.isContentEditable;
}

function onKeyDown(e: KeyboardEvent) {
  if (isBusy.value) return;
  if (isTypingTarget(e.target)) return;

  if ((e.key === "Delete" || e.key === "Backspace") && c?.getActiveObject()) {
    e.preventDefault();
    removeSelected();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
    e.preventDefault();
    redo();
    return;
  }
}

watch(
    () => [editor.mode, editor.color, editor.opacity, editor.size, editor.signatureSize, editor.brushShape],
    () => applyMode(),
);

// =========================
// Lifecycle
// =========================
let onResize: any = null;
let onPreviewLoad: any = null;

async function boot() {
  if (!docId.value) return;
  isBusy.value = true;
  errorMsg.value = null;

  try {
    await refreshInfo();
    await loadDraft();

    await nextTick();
    ensureFabric();

    // initial resize even if image already cached
    resizeToPreview();

    await nextTick();
    loadCanvasForPage(page.value);

    onResize = () => resizeToPreview();
    window.addEventListener("resize", onResize);

    // when the preview raster loads: resize, then auto-load editable text
    onPreviewLoad = () => {
      resizeToPreview();
      maybeAutoLoadText();
    };

    const img = previewImgRef.value;
    if (img) {
      img.addEventListener("load", onPreviewLoad, { passive: true });
      if (img.complete) onPreviewLoad();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onModKey);
    window.addEventListener("keyup", onModKey);
    window.addEventListener("blur", clearArmed);
  } catch (e: any) {
    errorMsg.value = e?.data?.detail?.message || e?.message || "Init failed";
  } finally {
    isBusy.value = false;
  }
}

watch(docId, async () => {
  page.value = 1;
  Object.keys(pageJson).forEach((k) => delete pageJson[Number(k)]);
  Object.keys(pageLinks).forEach((k) => delete pageLinks[Number(k)]);
  Object.keys(autoLoaded).forEach((k) => delete autoLoaded[Number(k)]);
  Object.keys(deletedImages).forEach((k) => delete deletedImages[Number(k)]);
  history.stack = [];
  history.idx = -1;
  errorMsg.value = null;

  await nextTick();
  await boot();
});

onMounted(boot);

onBeforeUnmount(() => {
  disposeDraft();

  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keydown", onModKey);
  window.removeEventListener("keyup", onModKey);
  window.removeEventListener("blur", clearArmed);
  if (onResize) window.removeEventListener("resize", onResize);

  const img = previewImgRef.value;
  if (img && onPreviewLoad) img.removeEventListener("load", onPreviewLoad as any);

  if (c) {
    pageJson[page.value] = c.toJSON(["id", "tool", "opacityPct", "orig", "name"]);
    saveDraftNow();
    c.dispose();
    c = null;
  }
});
</script>

<template>
  <u-container class="pdf">
    <service-page-header
        backdrop="treasure"
        title="services.pdfEditor.title"
        headline="services.pdfEditor.headline"
        description="services.pdfEditor.subtitle"
    />

    <div class="pdf__grid">
      <section class="ui-anim-border pdf__panel pdf__panel_preview">
        <div class="ui-anim-border__inner pdf__panel-inner">
          <div class="pdf__panel-head">
            <div class="pdf__panel-title">
              <u-icon name="i-lucide-file-image" />
              <span>{{ t("services.pdfEditor.preview") }}</span>
            </div>

            <div class="pdf__top-actions">
              <button type="button" class="ui-pill-btn" @click="uploadNew" :disabled="isBusy">
                <span class="ui-pill-btn__inner">
                  <u-icon name="i-lucide-upload" />
                  {{ t("services.pdfEditor.upload.new") }}
                </span>
              </button>

              <div class="pdf__sep" />

              <u-select
                  :disabled="isBusy"
                  v-model="bgColor"
                  :items="[
                  { label: t('services.pdfEditor.background.white'), value: 'white' },
                  { label: t('services.pdfEditor.background.black'), value: 'black' },
                  { label: t('services.pdfEditor.background.transparent'), value: null }
                ]"
              />

              <div class="pdf__sep" />

              <button
                  type="button"
                  class="pdf__icon-btn"
                  :disabled="isBusy || page <= 1"
                  @click="setPage(page - 1)"
              >
                <u-icon name="i-lucide-chevron-left" />
              </button>

              <div class="pdf__page-chip">
                {{ t("services.pdfEditor.page") }} {{ page }} / {{ pages }}
              </div>

              <button
                  type="button"
                  class="pdf__icon-btn"
                  :disabled="isBusy || page >= pages"
                  @click="setPage(page + 1)"
              >
                <u-icon name="i-lucide-chevron-right" />
              </button>

              <button type="button" class="ui-pill-btn" @click="addDesignPage" :disabled="isBusy">
                <span class="ui-pill-btn__inner">
                  <u-icon name="i-lucide-file-plus" />
                  {{ t("services.pdfEditor.addPage") }}
                </span>
              </button>

              <div class="pdf__sep" />

              <div class="pdf__toolbar-mini">
                <span class="text-muted">{{ t("services.pdfEditor.toolbar.dpiLabel") }}</span>
                <u-input v-model.number="dpi" type="number" min="72" max="220" class="pdf__dpi" />
              </div>

              <div class="pdf__sep" />

              <button type="button" class="pdf__icon-btn" @click="downloadSource" :disabled="isBusy">
                <u-icon name="i-lucide-download" />
              </button>

              <custom-button
                  variant="full"
                  class="pdf__save-btn"
                  :class="{ 'opacity-60 pointer-events-none': isBusy }"
                  @click="saveDocument"
              >
                {{ t("services.pdfEditor.editor.saveDocument") }}
              </custom-button>
            </div>
          </div>

          <pdf-editor-controls
              :editor="editor"
              :selected="selected"
              :font-families="FONT_FAMILIES"
              :busy="isBusy"
              :can-undo="canUndo"
              :can-redo="canRedo"
              @toggle-full="toggleFullMode"
              @set-mode="editor.mode = $event"
              @add-rect="addRect"
              @add-circle="addCircle"
              @add-text="addTextBox"
              @add-image="openImagePicker"
              @undo="undo"
              @redo="redo"
              @remove="removeSelected"
              @clear="clearPage"
              @load-text="loadEditableText()"
              @replace-image="replaceSelectedImage"
              @apply-font="applySelectedFont"
              @apply-font-size="applySelectedFontSize"
              @apply-color="applySelectedColor"
              @apply-opacity="applySelectedOpacity"
              @toggle-style="toggleSelectedStyle"
              @align="applySelectedAlign"
              @apply-geometry="applySelectedGeometry"
          />
          <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="onPickImage" />
          <input ref="replaceInput" type="file" accept="image/*" class="hidden" @change="onPickReplaceImage" />

          <div v-if="errorMsg" class="pdf__error">{{ errorMsg }}</div>

          <div class="pdf__canvas-wrap">
            <div
                ref="stageRef"
                class="pdf__stage"
                :class="{ pdf__stage_white: bgColor === 'white', pdf__stage_black: bgColor === 'black' }"
            >
              <img ref="previewImgRef" :src="previewUrl" class="pdf__preview" alt="" />
              <canvas ref="overlayCanvasRef" class="pdf__overlay" />

              <!-- Figma-style alignment guides while dragging an object. -->
              <div class="pdf__guides">
                <div
                    v-for="g in alignGuides"
                    :key="g.k"
                    class="pdf__guide"
                    :class="g.v ? 'pdf__guide_v' : 'pdf__guide_h'"
                    :style="g.v
                      ? { left: g.pos + 'px', top: g.start + 'px', height: (g.end - g.start) + 'px' }
                      : { top: g.pos + 'px', left: g.start + 'px', width: (g.end - g.start) + 'px' }"
                />
              </div>

              <!-- Clickable link hotspots (URLs / e-mails). Only intercept clicks
                   while Ctrl/Cmd is held, so normal clicks still edit the canvas. -->
              <div class="pdf__links" :class="{ pdf__links_armed: linkArmed }">
                <a
                    v-for="h in linkHotspots"
                    :key="h.key"
                    class="pdf__link-hotspot"
                    :href="h.uri"
                    :title="h.uri"
                    target="_blank"
                    rel="noopener noreferrer"
                    :style="{ left: h.left + 'px', top: h.top + 'px', width: h.width + 'px', height: h.height + 'px' }"
                    @click.prevent="openLink(h.uri)"
                />
              </div>

              <!-- Loading overlay while the page raster is fetched and the
                   editable text/images are being prepared. -->
              <div v-if="isBusy" class="pdf__loader" role="status" aria-live="polite">
                <span class="pdf__spinner" aria-hidden="true" />
                <span class="pdf__loader-text">{{ t("services.pdfEditor.full.preparing") }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </u-container>
</template>

<style scoped lang="scss">
/* Breathing room below the editor so it never butts up against the footer. */
.pdf {
  position: relative;
  isolation: isolate;
  padding-top: 24px;
  padding-bottom: 96px;
}

.pdf__panel-inner {
  border-radius: 10px;
  padding: 16px;
  background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}

.pdf__page-chip {
  display: inline-flex;
  align-items: center;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  font-weight: 600;
}

.pdf__top-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Match the pill/icon controls in the same row: same height, pill radius,
   so the primary action sits inline instead of towering over the toolbar. */
.pdf__save-btn {
  min-width: 170px;
  height: 40px !important;
  border-radius: 999px !important;
}

.pdf__sep {
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 6px;

  &_small {
    height: 22px;
    margin: 0 2px;
    opacity: 0.7;
  }
}

.pdf__toolbar-mini {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pdf__dpi {
  width: 120px;
}

/* Round icon buttons in the top actions row (page nav / download). Sized to
   match the pill/select/save controls beside them so the row aligns. */
.pdf__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.pdf__icon-btn:hover {
  filter: brightness(1.08);
}

.pdf__icon-btn:active {
  transform: translateY(1px);
}

.pdf__icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.pdf__canvas-wrap {
  margin-top: 10px;
}

.pdf__stage {
  position: relative;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);

  &_white {
    background-color: white !important;
  }

  &_black {
    background-color: black !important;
  }
}

/* Keep Fabric canvas-container pinned over the preview */
.pdf__stage :deep(.canvas-container) {
  position: absolute !important;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  /* Stop the browser from scrolling the page while dragging an object on the
     canvas (trackpad/touch/pen), which made the view "jump" mid-drag. */
  touch-action: none;
}

.pdf__stage :deep(.lower-canvas),
.pdf__stage :deep(.upper-canvas) {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.pdf__preview {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}

.pdf__overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
}

/* Loading overlay covering the stage while the page is fetched and prepared. */
.pdf__loader {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(12, 18, 28, 0.55);
  backdrop-filter: blur(2px);
}

.pdf__spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  animation: pdf-spin 0.8s linear infinite;
}

.pdf__loader-text {
  font-weight: 600;
  color: #fff;
  letter-spacing: 0.01em;
}

@keyframes pdf-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Alignment guide overlay: thin magenta lines drawn above the canvas while an
   object is being dragged. Purely visual, never intercepts pointer events. */
.pdf__guides {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
}

.pdf__guide {
  position: absolute;
  background: #f43f5e;
}

.pdf__guide_v {
  width: 1px;
}

.pdf__guide_h {
  height: 1px;
}

/* Link hotspot layer sits above the fabric canvas but is click-through until
   Ctrl/Cmd is held (pdf__links_armed), so it never blocks normal editing. */
.pdf__links {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.pdf__links_armed {
  pointer-events: auto;
}

.pdf__link-hotspot {
  position: absolute;
  display: block;
  border-radius: 3px;
  cursor: pointer;
}

.pdf__links_armed .pdf__link-hotspot {
  background: rgba(224, 103, 154, 0.18);
  outline: 1px solid rgba(224, 103, 154, 0.55);
}
</style>
