<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import PdfEditorControls from "~/components/pdfEditor/PdfEditorControls.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { BaseFabricObject, Canvas, Ellipse, FabricObject, PencilBrush, Rect, Textbox } from "fabric";
import {usePdfDraft} from "~/composables/pdfEditor/usePdfDraft";
import {usePdfAlignmentGuides} from "~/composables/pdfEditor/usePdfAlignmentGuides";
import {usePdfCanvasHistory} from "~/composables/pdfEditor/usePdfCanvasHistory";
import {usePdfExportTools} from "~/composables/pdfEditor/usePdfExportTools";
import {usePdfImageTools} from "~/composables/pdfEditor/usePdfImageTools";
import {usePdfSelectionInspector} from "~/composables/pdfEditor/usePdfSelectionInspector";
import {usePdfTextLayer} from "~/composables/pdfEditor/usePdfTextLayer";
import type {
  PdfBrushShape as BrushShape,
  PdfDeletedImage as DeletedImg,
  PdfEditorMode as Mode,
  PdfEditorState,
  PdfLinkRegion as LinkRegion,
  PdfPhotoFrame as PhotoFrame,
  PdfSelectedObjectState,
  PdfTextAlign as TextAlign,
} from "~/types/pdfEditor";
import {
  PDF_FONT_FAMILIES as FONT_FAMILIES,
  PDF_SERIALIZED_PROPERTIES,
  clampInt,
  rgbaFromHex,
  setFabricObjectByTopLeft as setByTopLeft,
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

// fabric canvas instance
let c: Canvas | null = null;

const { alignGuides, clearGuides, onObjectMoving } = usePdfAlignmentGuides(() => c);

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
  getCurrentPageJson: () => c?.toJSON(PDF_SERIALIZED_PROPERTIES) ?? null,
});

const {
  history,
  canUndo,
  canRedo,
  pushHistory,
  undo,
  redo,
  resetHistory,
} = usePdfCanvasHistory({
  page,
  pageJson,
  getCanvas: () => c,
  scheduleSave: scheduleSaveDraft,
});

let refreshSelectedImageClip = (_object: any) => {};

const {
  activeObj,
  applySelectedAlign,
  applySelectedColor,
  applySelectedFont,
  applySelectedFontSize,
  applySelectedGeometry,
  applySelectedOpacity,
  syncSelectedFromObject,
  toggleSelectedStyle,
} = usePdfSelectionInspector({
  selected,
  getCanvas: () => c,
  pushHistory,
  refreshImageClip: (object) => refreshSelectedImageClip(object),
});

const {
  imageInput,
  replaceInput,
  openImagePicker,
  onPickImage,
  replaceSelectedImage,
  onPickReplaceImage,
  onCanvasMouseDown,
  recoverPhotoFrame,
  refreshImageClip,
  onImageDrop,
  removeSelected,
  clearPage,
} = usePdfImageTools({
  page,
  editor,
  deletedImages,
  photoFrames,
  pageJson,
  getCanvas: () => c,
  applyMode,
  pushHistory,
  scheduleSave: scheduleSaveDraft,
  syncSelected: syncSelectedFromObject,
});

refreshSelectedImageClip = refreshImageClip;

const { calcMultiplier, saveDocument } = usePdfExportTools({
  docId,
  pages,
  page,
  pageW,
  pageH,
  dpi,
  isBusy,
  errorMsg,
  previewImg: previewImgRef,
  pageJson,
  pageLinks,
  deletedImages,
  history,
  apiBase: config.public.apiBase,
  getCanvas: () => c,
  api,
  resizeToPreview,
  refreshInfo,
});

const {
  loadEditableText,
  maybeAutoLoadText,
  refitPdfTextWidths,
} = usePdfTextLayer({
  docId,
  page,
  dpi,
  isBusy,
  errorMsg,
  previewImg: previewImgRef,
  editor,
  pageLinks,
  autoLoaded,
  photoFrames,
  history,
  getCanvas: () => c,
  api,
  backgroundUrl,
  calcMultiplier,
  refreshImageClip,
  applyMode,
  pushHistory,
  translate: t,
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
      history.stack = [c!.toJSON(PDF_SERIALIZED_PROPERTIES)];
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
    history.stack = [c.toJSON(PDF_SERIALIZED_PROPERTIES)];
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
// Page switching
// =========================
async function setPage(p: number) {
  if (!docId.value || !c) return;

  const nextP = clampInt(p, 1, pages.value);
  if (nextP === page.value) return;

  pageJson[page.value] = c.toJSON(PDF_SERIALIZED_PROPERTIES);
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
  resetHistory();
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
    pageJson[page.value] = c.toJSON(PDF_SERIALIZED_PROPERTIES);
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
