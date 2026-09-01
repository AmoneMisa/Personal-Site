<script setup lang="ts">
import FileInput from "~/components/common/FileInput.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import SvgCodeTextarea from "~/components/svgEditor/SvgCodeTextarea.vue";
import ColorsReplaceModal from "~/components/svgEditor/ColorsReplaceModal.vue";
import StrokeEditorModal from "~/components/svgEditor/StrokeEditorModal.vue";
import TransformEditorModal from "~/components/svgEditor/TransformEditorModal.vue";
import CustomButton from "~/components/common/CustomButton.vue";
import { parseAndSanitizeSvg } from "~/utils/svgEditor/sanitizeSvg";

const { t } = useI18n();

const fileError = ref<string | null>(null);
const codeError = ref<string | null>(null);
const inputCode = ref<string>("");
const normalizedCode = ref<string>("");
const previewSvg = ref<string>("");
const isReady = computed(() => previewSvg.value.length > 0);

const colorsModalOpen = ref(false);
const strokeModalOpen = ref(false);
const transformModalOpen = ref(false);

function safeTrim(value: string) {
  return String(value || "").trim();
}

function errorKeyForSvg(reason: "empty" | "noSvgRoot" | "parse") {
  if (reason === "empty") return "services.svgEditor.errors.empty";
  if (reason === "noSvgRoot") return "services.svgEditor.errors.noSvgRoot";
  return "services.svgEditor.errors.parse";
}

function parseSvg(raw: string) {
  const result = parseAndSanitizeSvg(raw);
  if (result.ok) return result;
  return {
    ok: false as const,
    errorKey: errorKeyForSvg(result.reason),
  };
}

function serializeSvg(svg: SVGElement) {
  return new XMLSerializer().serializeToString(svg);
}

function commitSanitizedSvg(raw: string, showError = false): boolean {
  const result = parseSvg(raw);
  if (!result.ok) {
    if (showError) codeError.value = t(result.errorKey);
    previewSvg.value = "";
    normalizedCode.value = "";
    return false;
  }

  previewSvg.value = result.markup;
  normalizedCode.value = result.markup;
  inputCode.value = result.markup;
  return true;
}

function setPreviewFromCode(raw: string) {
  codeError.value = null;
  commitSanitizedSvg(raw, true);
}

function onFiles(files: File[]) {
  fileError.value = null;
  codeError.value = null;

  const file = files?.[0];
  if (!file) return;

  if (!/\.svg$/i.test(file.name)) {
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
  reader.readAsText(file);
}

function applyText() {
  setPreviewFromCode(inputCode.value);
}

function removeNodesByTag(svg: SVGElement, tag: string) {
  const list = Array.from(svg.getElementsByTagName(tag));
  for (const node of list) node.parentNode?.removeChild(node);
}

function removeComments(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const toRemove: Comment[] = [];
  while (walker.nextNode()) toRemove.push(walker.currentNode as Comment);
  for (const comment of toRemove) comment.parentNode?.removeChild(comment);
}

function removeEmptyDefs(svg: SVGElement) {
  const defs = Array.from(svg.getElementsByTagName("defs"));
  for (const item of defs) {
    const hasChildren = Array.from(item.childNodes).some((node) => node.nodeType === 1);
    if (!hasChildren) item.parentNode?.removeChild(item);
  }
}

function minifySvg() {
  if (!isReady.value) return;

  const result = parseSvg(previewSvg.value);
  if (!result.ok) return;

  const svg = result.svg;
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

  commitSanitizedSvg(serializeSvg(svg));
}

function removeDimensions() {
  if (!isReady.value) return;

  const result = parseSvg(previewSvg.value);
  if (!result.ok) return;

  result.svg.removeAttribute("width");
  result.svg.removeAttribute("height");
  commitSanitizedSvg(serializeSvg(result.svg));
}

type ColorUsage = {
  key: string;
  value: string;
  count: number;
};

function normalizeColorKey(value: string) {
  return safeTrim(value).replace(/\s+/g, " ");
}

function isHardColor(value: string) {
  const normalized = safeTrim(value);
  if (!normalized) return false;
  if (/^none$/i.test(normalized)) return false;
  if (/^inherit$/i.test(normalized)) return false;
  return !/^url\(/i.test(normalized);

}

function extractColorsFromStyle(style: string) {
  const out: { prop: "fill" | "stroke"; value: string }[] = [];
  const source = String(style || "");
  const fill = source.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  const stroke = source.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);
  if (fill) out.push({ prop: "fill", value: safeTrim(fill[1]) });
  if (stroke) out.push({ prop: "stroke", value: safeTrim(stroke[1]) });
  return out;
}

function collectHardColors(svgCode: string): ColorUsage[] {
  const result = parseSvg(svgCode);
  if (!result.ok) return [];

  const map = new Map<string, { value: string; count: number }>();
  const elements = [result.svg, ...Array.from(result.svg.querySelectorAll("*"))] as Element[];

  for (const element of elements) {
    const fill = element.getAttribute("fill");
    if (fill && isHardColor(fill)) {
      const key = normalizeColorKey(fill);
      map.set(key, { value: fill, count: (map.get(key)?.count || 0) + 1 });
    }

    const stroke = element.getAttribute("stroke");
    if (stroke && isHardColor(stroke)) {
      const key = normalizeColorKey(stroke);
      map.set(key, { value: stroke, count: (map.get(key)?.count || 0) + 1 });
    }

    const style = element.getAttribute("style");
    if (!style) continue;
    for (const item of extractColorsFromStyle(style)) {
      if (!isHardColor(item.value)) continue;
      const key = normalizeColorKey(item.value);
      map.set(key, { value: item.value, count: (map.get(key)?.count || 0) + 1 });
    }
  }

  return Array.from(map.entries())
    .map(([key, value]) => ({ key, value: value.value, count: value.count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function replaceColors(
  svgCode: string,
  replacements: Record<string, { mode: "color" | "currentColor"; color: string }>,
) {
  const result = parseSvg(svgCode);
  if (!result.ok) return svgCode;

  const elements = [result.svg, ...Array.from(result.svg.querySelectorAll("*"))] as Element[];

  function mapValue(old: string) {
    const replacement = replacements[normalizeColorKey(old)];
    if (!replacement) return null;
    return replacement.mode === "currentColor" ? "currentColor" : replacement.color;
  }

  function replaceInStyle(style: string) {
    let nextStyle = String(style || "");
    const fill = nextStyle.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
    const stroke = nextStyle.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/i);

    if (fill) {
      const next = mapValue(safeTrim(fill[1]));
      if (next) nextStyle = nextStyle.replace(fill[0], fill[0].replace(fill[1], ` ${next}`));
    }
    if (stroke) {
      const next = mapValue(safeTrim(stroke[1]));
      if (next) nextStyle = nextStyle.replace(stroke[0], stroke[0].replace(stroke[1], ` ${next}`));
    }
    return nextStyle;
  }

  for (const element of elements) {
    const fill = element.getAttribute("fill");
    if (fill) {
      const next = mapValue(fill);
      if (next) element.setAttribute("fill", next);
    }

    const stroke = element.getAttribute("stroke");
    if (stroke) {
      const next = mapValue(stroke);
      if (next) element.setAttribute("stroke", next);
    }

    const style = element.getAttribute("style");
    if (style) {
      const nextStyle = replaceInStyle(style);
      if (nextStyle !== style) element.setAttribute("style", nextStyle);
    }
  }

  return serializeSvg(result.svg);
}

const detectedColors = computed(() => collectHardColors(previewSvg.value));

function openColorsModal() {
  if (isReady.value) colorsModalOpen.value = true;
}

function openStrokeModal() {
  if (isReady.value) strokeModalOpen.value = true;
}

function openTransformModal() {
  if (isReady.value) transformModalOpen.value = true;
}

function onApplyColorReplacements(payload: { replacements: Record<string, { mode: "color" | "currentColor"; color: string }> }) {
  commitSanitizedSvg(replaceColors(previewSvg.value, payload.replacements));
}

function onApplyStrokeEdits(payload: { svg: string }) {
  commitSanitizedSvg(payload.svg);
}

function onApplyTransformEdits(payload: { svg: string }) {
  commitSanitizedSvg(payload.svg);
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
              <custom-button type="button" :title="t('services.svgEditor.titles.apply')" @click="applyText">
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