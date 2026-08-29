<script setup lang="ts">
import FileInput from "~/components/common/FileInput.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import SvgCodeTextarea from "~/components/svgEditor/SvgCodeTextarea.vue";
import ColorsReplaceModal from "~/components/svgEditor/ColorsReplaceModal.vue";
import StrokeEditorModal from "~/components/svgEditor/StrokeEditorModal.vue";
import TransformEditorModal from "~/components/svgEditor/TransformEditorModal.vue";
import CustomButton from "~/components/common/CustomButton.vue";

type ParseResult =
    | { ok: true; doc: XMLDocument; svg: SVGElement }
    | { ok: false; errorKey: string };

const { t } = useI18n();

const fileError = ref<string | null>(null);
const codeError = ref<string | null>(null);

const inputCode = ref<string>("");
const normalizedCode = ref<string>("");

const previewSvg = ref<string>("");
const isReady = computed(() => (previewSvg.value || "").length > 0);

const colorsModalOpen = ref(false);
const strokeModalOpen = ref(false);
const transformModalOpen = ref(false);

function safeTrim(v: string) {
  return String(v || "").trim();
}

function parseSvg(raw: string): ParseResult {
  const s = safeTrim(raw);
  if (!s) return { ok: false, errorKey: "services.svgEditor.errors.empty" };

  const hasSvg = /<svg[\s>]/i.test(s);
  if (!hasSvg) return { ok: false, errorKey: "services.svgEditor.errors.noSvgRoot" };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(s, "image/svg+xml");
    const svg = doc.documentElement as any;

    const parseErr = doc.getElementsByTagName("parsererror")?.[0];
    if (parseErr) return { ok: false, errorKey: "services.svgEditor.errors.parse" };
    if (!svg || String(svg.tagName || "").toLowerCase() !== "svg") return { ok: false, errorKey: "services.svgEditor.errors.noSvgRoot" };

    return { ok: true, doc, svg: svg as SVGElement };
  } catch {
    return { ok: false, errorKey: "services.svgEditor.errors.parse" };
  }
}

function serializeSvg(svg: SVGElement) {
  return new XMLSerializer().serializeToString(svg);
}

function setPreviewFromCode(raw: string) {
  codeError.value = null;
  const res = parseSvg(raw);
  if (!res.ok) {
    previewSvg.value = "";
    normalizedCode.value = "";
    codeError.value = t(res.errorKey);
    return;
  }
  normalizedCode.value = serializeSvg(res.svg);
  previewSvg.value = normalizedCode.value;
}

function onFiles(files: File[]) {
  fileError.value = null;
  codeError.value = null;

  const f = files?.[0];
  if (!f) return;

  if (!/\.svg$/i.test(f.name)) {
    fileError.value = t("services.svgEditor.errors.fileNotSvg");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    inputCode.value = text;
    setPreviewFromCode(text);
  };
  reader.onerror = () => {
    fileError.value = t("services.svgEditor.errors.fileRead");
  };
  reader.readAsText(f);
}

function applyText() {
  setPreviewFromCode(inputCode.value);
}

function removeNodesByTag(svg: SVGElement, tag: string) {
  const list = Array.from(svg.getElementsByTagName(tag));
  for (const n of list) n.parentNode?.removeChild(n);
}

function removeComments(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const toRemove: Comment[] = [];
  while (walker.nextNode()) toRemove.push(walker.currentNode as Comment);
  for (const c of toRemove) c.parentNode?.removeChild(c);
}

function removeEmptyDefs(svg: SVGElement) {
  const defs = Array.from(svg.getElementsByTagName("defs"));
  for (const d of defs) {
    const hasChildren = Array.from(d.childNodes).some((n) => n.nodeType === 1);
    if (!hasChildren) d.parentNode?.removeChild(d);
  }
}

function minifySvg() {
  if (!isReady.value) return;

  const res = parseSvg(previewSvg.value);
  if (!res.ok) return;

  const svg = res.svg;

  const savedWidth = svg.getAttribute("width");
  const savedHeight = svg.getAttribute("height");

  removeNodesByTag(svg, "metadata");
  removeNodesByTag(svg, "title");
  removeNodesByTag(svg, "desc");
  removeComments(svg);
  removeEmptyDefs(svg);

  if (savedWidth != null) svg.setAttribute("width", savedWidth);
  else svg.removeAttribute("width");

  if (savedHeight != null) svg.setAttribute("height", savedHeight);
  else svg.removeAttribute("height");

  const next = serializeSvg(svg);
  previewSvg.value = next;
  normalizedCode.value = next;
  inputCode.value = next;
}

function removeDimensions() {
  if (!isReady.value) return;

  const res = parseSvg(previewSvg.value);
  if (!res.ok) return;

  const svg = res.svg;

  svg.removeAttribute("width");
  svg.removeAttribute("height");

  const next = serializeSvg(svg);
  previewSvg.value = next;
  normalizedCode.value = next;
  inputCode.value = next;
}

type ColorUsage = {
  key: string;
  value: string;
  count: number;
};

function normalizeColorKey(v: string) {
  return safeTrim(v).replace(/\s+/g, " ");
}

function isHardColor(v: string) {
  const s = safeTrim(v);
  if (!s) return false;
  if (/^none$/i.test(s)) return false;
  if (/^inherit$/i.test(s)) return false;
  if (/^url\(/i.test(s)) return false;
  return true;
}

function extractColorsFromStyle(style: string) {
  const out: { prop: "fill" | "stroke"; value: string }[] = [];
  const s = String(style || "");
  const mFill = s.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  const mStroke = s.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
  if (mFill) out.push({ prop: "fill", value: safeTrim(mFill[1]) });
  if (mStroke) out.push({ prop: "stroke", value: safeTrim(mStroke[1]) });
  return out;
}

function collectHardColors(svgCode: string): ColorUsage[] {
  const res = parseSvg(svgCode);
  if (!res.ok) return [];

  const svg = res.svg;
  const map = new Map<string, { value: string; count: number }>();

  const elements = [svg, ...Array.from(svg.querySelectorAll("*"))] as Element[];

  for (const el of elements) {
    const fill = el.getAttribute("fill");
    if (fill && isHardColor(fill)) {
      const k = normalizeColorKey(fill);
      map.set(k, { value: fill, count: (map.get(k)?.count || 0) + 1 });
    }

    const stroke = el.getAttribute("stroke");
    if (stroke && isHardColor(stroke)) {
      const k = normalizeColorKey(stroke);
      map.set(k, { value: stroke, count: (map.get(k)?.count || 0) + 1 });
    }

    const style = el.getAttribute("style");
    if (style) {
      for (const item of extractColorsFromStyle(style)) {
        if (!isHardColor(item.value)) continue;
        const k = normalizeColorKey(item.value);
        map.set(k, { value: item.value, count: (map.get(k)?.count || 0) + 1 });
      }
    }
  }

  return Array.from(map.entries())
      .map(([key, v]) => ({ key, value: v.value, count: v.count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function replaceColors(svgCode: string, replacements: Record<string, { mode: "color" | "currentColor"; color: string }>) {
  const res = parseSvg(svgCode);
  if (!res.ok) return svgCode;

  const svg = res.svg;
  const elements = [svg, ...Array.from(svg.querySelectorAll("*"))] as Element[];

  function mapValue(old: string) {
    const k = normalizeColorKey(old);
    const r = replacements[k];
    if (!r) return null;
    if (r.mode === "currentColor") return "currentColor";
    return r.color;
  }

  function replaceInStyle(style: string) {
    let s = String(style || "");
    const fillM = s.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
    const strokeM = s.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);

    if (fillM) {
      const next = mapValue(safeTrim(fillM[1]));
      if (next) s = s.replace(fillM[0], fillM[0].replace(fillM[1], ` ${next}`));
    }
    if (strokeM) {
      const next = mapValue(safeTrim(strokeM[1]));
      if (next) s = s.replace(strokeM[0], strokeM[0].replace(strokeM[1], ` ${next}`));
    }
    return s;
  }

  for (const el of elements) {
    const fill = el.getAttribute("fill");
    if (fill) {
      const next = mapValue(fill);
      if (next) el.setAttribute("fill", next);
    }

    const stroke = el.getAttribute("stroke");
    if (stroke) {
      const next = mapValue(stroke);
      if (next) el.setAttribute("stroke", next);
    }

    const style = el.getAttribute("style");
    if (style) {
      const nextStyle = replaceInStyle(style);
      if (nextStyle !== style) el.setAttribute("style", nextStyle);
    }
  }

  return serializeSvg(svg);
}

const detectedColors = computed(() => collectHardColors(previewSvg.value));

function openColorsModal() {
  if (!isReady.value) return;
  colorsModalOpen.value = true;
}

function openStrokeModal() {
  if (!isReady.value) return;
  strokeModalOpen.value = true;
}

function openTransformModal() {
  if (!isReady.value) return;
  transformModalOpen.value = true;
}

function onApplyColorReplacements(payload: { replacements: Record<string, { mode: "color" | "currentColor"; color: string }> }) {
  const next = replaceColors(previewSvg.value, payload.replacements);
  previewSvg.value = next;
  normalizedCode.value = next;
  inputCode.value = next;
}

function onApplyStrokeEdits(payload: { svg: string }) {
  previewSvg.value = payload.svg;
  normalizedCode.value = payload.svg;
  inputCode.value = payload.svg;
}

function onApplyTransformEdits(payload: { svg: string }) {
  previewSvg.value = payload.svg;
  normalizedCode.value = payload.svg;
  inputCode.value = payload.svg;
}
</script>

<template>
  <div class="svg-editor-shell">
    <div class="svg-editor-shell__grid">
      <div class="svg-editor-shell__panel">
        <u-card class="svg-editor-shell__card" :ui="{ root: 'ring-0 bg-transparent' }">
          <div class="svg-editor-shell__section">
            <div class="svg-editor-shell__section-title">{{ t("services.svgEditor.sections.input.title") }}</div>

            <file-input
                label-key="services.svgEditor.inputs.file"
                accept=".svg,image/svg+xml"
                :error="fileError"
                :max-bytes="5 * 1024 * 1024"
                max-bytes-error-key="services.svgEditor.errors.fileTooLarge"
                @files="onFiles"
            />

            <svg-code-textarea
                v-model="inputCode"
                :label-key="'services.svgEditor.inputs.code'"
                :placeholder-key="'services.svgEditor.inputs.codePlaceholder'"
                :error="codeError"
            />

            <div class="svg-editor-shell__actions">
              <custom-button
                  type="button"
                  :title="t('services.svgEditor.titles.apply')"
                  @click="applyText"
              >
                {{ t("services.svgEditor.actions.apply") }}
              </custom-button>

              <custom-button
                  type="button"
                  :disabled="!isReady"
                  :title="t('services.svgEditor.titles.minify')"
                  @click="minifySvg"
              >
                {{ t("services.svgEditor.actions.minify") }}
              </custom-button>

              <custom-button
                  type="button"
                  :disabled="!isReady"
                  :title="t('services.svgEditor.titles.removeDimensions')"
                  @click="removeDimensions"
              >
                {{ t("services.svgEditor.actions.removeDimensions") }}
              </custom-button>

              <custom-button
                  type="button"
                  :disabled="!isReady || detectedColors.length === 0"
                  :title="t('services.svgEditor.titles.replaceColors')"
                  @click="openColorsModal"
              >
                {{ t("services.svgEditor.actions.replaceColors") }}
              </custom-button>

              <custom-button
                  type="button"
                  :disabled="!isReady"
                  :title="t('services.svgEditor.titles.editStroke')"
                  @click="openStrokeModal"
              >
                {{ t("services.svgEditor.actions.editStroke") }}
              </custom-button>

              <custom-button
                  type="button"
                  :disabled="!isReady"
                  :title="t('services.svgEditor.titles.transform')"
                  @click="openTransformModal"
              >
                {{ t("services.svgEditor.actions.transform") }}
              </custom-button>
            </div>
          </div>
        </u-card>
      </div>

      <div class="svg-editor-shell__preview">
        <u-card class="svg-editor-shell__card" :ui="{ root: 'ring-0 bg-transparent' }">
          <div class="svg-editor-shell__section">
            <div class="svg-editor-shell__section-title">{{ t("services.svgEditor.sections.preview.title") }}</div>

            <div v-if="!isReady" class="svg-editor-shell__empty">
              <u-icon name="i-lucide-image" class="svg-editor-shell__empty-icon" />
              <div class="svg-editor-shell__empty-title">{{ t("services.svgEditor.preview.emptyTitle") }}</div>
              <div class="svg-editor-shell__empty-sub">{{ t("services.svgEditor.preview.emptySubtitle") }}</div>
            </div>

            <div v-else class="svg-editor-shell__preview-box">
              <div class="svg-editor-shell__preview-inner" v-html="previewSvg" />
            </div>

            <custom-input
                :model-value="normalizedCode"
                :label="t('services.svgEditor.outputs.normalized')"
                :placeholder="t('services.svgEditor.outputs.normalizedPlaceholder')"
                :readonly="true"
                :clearable="false"
            />
          </div>
        </u-card>
      </div>
    </div>

    <colors-replace-modal
        v-model:open="colorsModalOpen"
        :colors="detectedColors"
        @apply="onApplyColorReplacements"
    />

    <stroke-editor-modal
        v-model:open="strokeModalOpen"
        :svg="previewSvg"
        @apply="onApplyStrokeEdits"
    />

    <transform-editor-modal
        v-model:open="transformModalOpen"
        :svg="previewSvg"
        @apply="onApplyTransformEdits"
    />
  </div>
</template>

<style scoped lang="scss">
.svg-editor-shell__grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
  align-items: start;
}

.svg-editor-shell__card {
  border-radius: 20px;
  border: 1px solid var(--line);
  background: rgba(14, 12, 21, 0.55);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.svg-editor-shell__section {
  padding: 14px;
  display: grid;
  gap: 12px;
}

.svg-editor-shell__section-title {
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
}

.svg-editor-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.svg-editor-shell__btn {
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  font-weight: 600;
}

.svg-editor-shell__btn:hover {
  filter: brightness(1.06);
}

.svg-editor-shell__preview-box {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 14px;
  overflow: auto;
  min-height: 260px;
}

.svg-editor-shell__preview-inner {
  display: grid;
  place-items: center;
  min-height: 220px;
}

.svg-editor-shell__preview-inner :deep(svg) {
  max-width: 100%;
  height: auto;
  display: block;
}

.svg-editor-shell__empty {
  border-radius: 10px;
  border: 1px dashed var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 18px;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 6px;
  min-height: 260px;
  align-content: center;
}

.svg-editor-shell__empty-icon {
  font-size: 34px;
  opacity: 0.9;
}

.svg-editor-shell__empty-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--ui-text);
}

.svg-editor-shell__empty-sub {
  font-size: 12px;
  color: var(--ui-text-muted);
  max-width: 380px;
}

@media (max-width: 1100px) {
  .svg-editor-shell__grid {
    grid-template-columns: 1fr;
  }
}
</style>
