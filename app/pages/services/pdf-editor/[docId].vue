<script setup lang="ts">
import CustomButton from "~/components/common/CustomButton.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";
import PdfEditorControls from "~/components/pdfEditor/PdfEditorControls.vue";
import { computed, reactive, ref } from "vue";
import type { Canvas } from "fabric";
import {usePdfDraft} from "~/composables/pdfEditor/usePdfDraft";
import {usePdfAlignmentGuides} from "~/composables/pdfEditor/usePdfAlignmentGuides";
import {usePdfCanvasController} from "~/composables/pdfEditor/usePdfCanvasController";
import {usePdfCanvasHistory} from "~/composables/pdfEditor/usePdfCanvasHistory";
import {usePdfDocumentNavigation} from "~/composables/pdfEditor/usePdfDocumentNavigation";
import {usePdfEditorSession} from "~/composables/pdfEditor/usePdfEditorSession";
import {usePdfExportTools} from "~/composables/pdfEditor/usePdfExportTools";
import {usePdfImageTools} from "~/composables/pdfEditor/usePdfImageTools";
import {usePdfLinkHotspots} from "~/composables/pdfEditor/usePdfLinkHotspots";
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
  createDeferredPdfAction,
  PDF_FONT_FAMILIES as FONT_FAMILIES,
  PDF_SERIALIZED_PROPERTIES,
} from "~/utils/pdfEditor/core";

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

const previewImgRef = ref<HTMLImageElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);

const bgColor = ref<string | null>(null);

// --- clickable links (auto-detected URLs / e-mails + source annotations)
// per-page link regions in rendered-PNG pixel space at `dpi`
const pageLinks = reactive<Record<number, LinkRegion[]>>({});

const {
  clearLinkArmed,
  displayScale,
  linkArmed,
  linkHotspots,
  onModifierKey,
  openLink,
} = usePdfLinkHotspots({ page, pageLinks });
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

const applyModeAction = createDeferredPdfAction<[]>();
const loadCanvasAction = createDeferredPdfAction<[number]>();
const resizeCanvasAction = createDeferredPdfAction<[]>();
const refreshImageClipAction = createDeferredPdfAction<[any]>();

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
  refreshImageClip: refreshImageClipAction.invoke,
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
  applyMode: applyModeAction.invoke,
  pushHistory,
  scheduleSave: scheduleSaveDraft,
  syncSelected: syncSelectedFromObject,
});

refreshImageClipAction.resolve(refreshImageClip);

const { addDesignPage, refreshInfo, setPage } = usePdfDocumentNavigation({
  docId,
  pages,
  page,
  pageW,
  pageH,
  isBusy,
  errorMsg,
  pageJson,
  getCanvas: () => c,
  api,
  loadCanvasForPage: loadCanvasAction.invoke,
  scheduleSave: scheduleSaveDraft,
  translate: t,
});

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
  resizeToPreview: resizeCanvasAction.invoke,
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
  applyMode: applyModeAction.invoke,
  pushHistory,
  translate: t,
});

const {
  addCircle,
  addRect,
  addTextBox,
  applyMode,
  disposeCanvas,
  ensureFabric,
  loadCanvasForPage,
  resizeToPreview,
} = usePdfCanvasController({
  page,
  editor,
  selected,
  previewImg: previewImgRef,
  overlayCanvas: overlayCanvasRef,
  displayScale,
  pageJson,
  history,
  getCanvas: () => c,
  setCanvas: (canvas) => {
    c = canvas;
  },
  calcMultiplier,
  pushHistory,
  syncSelected: syncSelectedFromObject,
  onObjectMoving,
  clearGuides,
  refreshImageClip,
  onImageDrop,
  onCanvasMouseDown,
  recoverPhotoFrame,
  refitPdfTextWidths,
});

applyModeAction.resolve(applyMode);
loadCanvasAction.resolve(loadCanvasForPage);
resizeCanvasAction.resolve(resizeToPreview);

usePdfEditorSession({
  docId,
  page,
  dpi,
  isBusy,
  errorMsg,
  previewImg: previewImgRef,
  editor,
  pageJson,
  pageLinks,
  autoLoaded,
  deletedImages,
  getCanvas: () => c,
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
});

function toggleFullMode() {
  editor.fullMode = !editor.fullMode;
  if (editor.fullMode) {
    editor.mode = "move";
    applyMode();
    syncSelectedFromObject(activeObj());
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
