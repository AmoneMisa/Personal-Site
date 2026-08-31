<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import {
  composeTransform,
  IDENTITY_TRANSFORM_EDIT,
  isIdentityEdit,
  type TransformEdit,
} from "~/utils/svgTransform";
import { parseAndSanitizeSvg, sanitizeSvgMarkup } from "~/utils/svgEditor/sanitizeSvg";

type TransformItem = {
  id: string;
  label: string;
  nodePath: number[];
  originalTransform: string;
  edit: TransformEdit;
};

const { t } = useI18n();
const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  svg: string;
}>();

const emit = defineEmits<{
  (e: "apply", payload: { svg: string }): void;
}>();

const parseError = ref<string | null>(null);
const items = ref<TransformItem[]>([]);
const selectedId = ref<string | null>(null);
const moveXInput = ref<string>("0");
const moveYInput = ref<string>("0");
const scaleInput = ref<string>("100");
const rotateInput = ref<string>("0");
const fieldError = ref<string | null>(null);

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

function serialize(svg: SVGElement) {
  return new XMLSerializer().serializeToString(svg);
}

function nodeLabel(element: Element) {
  const tag = String(element.tagName || "").toLowerCase();
  const id = element.getAttribute("id");
  const cls = safeTrim(element.getAttribute("class") || "");
  const clsPart = cls ? `.${cls.split(/\s+/g).filter(Boolean).join(".")}` : "";
  const idPart = id ? `#${id}` : "";
  return `${tag}${idPart}${clsPart}`;
}

function computeNodePath(root: Element, target: Element) {
  const path: number[] = [];
  let current: Element | null = target;

  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children);
    path.unshift(siblings.indexOf(current));
    current = parent;
  }

  return path;
}

function getByPath(root: Element, path: number[]) {
  let current: Element = root;
  for (const index of path) {
    const next = current.children.item(index) as Element | null;
    if (!next) return null;
    current = next;
  }
  return current;
}

const TRANSFORMABLE_TAGS = [
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "g",
  "text",
  "image",
];

function collectTransformItems(svgCode: string): TransformItem[] {
  const result = parseSvg(svgCode);
  if (!result.ok) return [];

  const elements = Array.from(result.svg.querySelectorAll(TRANSFORMABLE_TAGS.join(","))) as Element[];
  return elements.map((element, index) => ({
    id: `tf_${index}_${Math.random().toString(16).slice(2)}`,
    label: nodeLabel(element),
    nodePath: computeNodePath(result.svg, element),
    originalTransform: element.getAttribute("transform") || "",
    edit: { ...IDENTITY_TRANSFORM_EDIT },
  }));
}

// getBBox() only works on elements attached to the document. The SVG is
// sanitized again immediately before the off-screen mount so this helper is
// never an alternate injection path around the editor preview boundary.
function withMountedSvg<T>(svgCode: string, fn: (mountedRoot: SVGElement) => T): T | null {
  const sanitized = sanitizeSvgMarkup(svgCode);
  if (!sanitized) return null;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  try {
    container.innerHTML = sanitized;
    const mounted = container.querySelector("svg");
    if (!mounted) return null;
    return fn(mounted as SVGElement);
  } catch {
    return null;
  } finally {
    document.body.removeChild(container);
  }
}

function bboxCenterFor(nodePath: number[]): { cx: number; cy: number } {
  const fallback = { cx: 0, cy: 0 };
  const center = withMountedSvg(props.svg, (mountedRoot) => {
    const element = getByPath(mountedRoot, nodePath) as SVGGraphicsElement | null;
    if (!element || typeof element.getBBox !== "function") return fallback;
    try {
      const box = element.getBBox();
      return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
    } catch {
      return fallback;
    }
  });
  return center ?? fallback;
}

function resetSelection() {
  const first = items.value[0];
  selectedId.value = first ? first.id : null;
  loadSelectedToForm();
}

function loadSelectedToForm() {
  const item = items.value.find((candidate) => candidate.id === selectedId.value);
  fieldError.value = null;
  if (!item) {
    moveXInput.value = "0";
    moveYInput.value = "0";
    scaleInput.value = "100";
    rotateInput.value = "0";
    return;
  }

  moveXInput.value = String(item.edit.translateX);
  moveYInput.value = String(item.edit.translateY);
  scaleInput.value = String(Math.round(item.edit.scale * 100));
  rotateInput.value = String(item.edit.rotateDeg);
}

watch(
  () => open.value,
  (value) => {
    if (!value) return;
    parseError.value = null;
    const result = parseSvg(props.svg);
    if (!result.ok) {
      items.value = [];
      selectedId.value = null;
      parseError.value = t(result.errorKey);
      return;
    }
    items.value = collectTransformItems(result.markup);
    resetSelection();
  },
);

watch(() => selectedId.value, loadSelectedToForm);

function parseFiniteNumber(value: string): number | null {
  const normalized = safeTrim(value);
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function saveToLocalItem() {
  const item = items.value.find((candidate) => candidate.id === selectedId.value);
  if (!item) return;

  const translateX = parseFiniteNumber(moveXInput.value);
  const translateY = parseFiniteNumber(moveYInput.value);
  const scalePercent = parseFiniteNumber(scaleInput.value);
  const rotate = parseFiniteNumber(rotateInput.value);

  if (translateX === null || translateY === null || rotate === null) {
    fieldError.value = t("services.svgEditor.modals.transform.errors.invalidNumber");
    return;
  }
  if (scalePercent === null || scalePercent <= 0) {
    fieldError.value = t("services.svgEditor.modals.transform.errors.invalidScale");
    return;
  }

  fieldError.value = null;
  item.edit = {
    translateX,
    translateY,
    scale: scalePercent / 100,
    rotateDeg: rotate,
  };
}

function resetSelectedItem() {
  const item = items.value.find((candidate) => candidate.id === selectedId.value);
  if (!item) return;
  item.edit = { ...IDENTITY_TRANSFORM_EDIT };
  loadSelectedToForm();
}

function buildSvgWithEdits(): string | null {
  const result = parseSvg(props.svg);
  if (!result.ok) return null;

  for (const item of items.value) {
    if (isIdentityEdit(item.edit)) continue;

    const element = getByPath(result.svg, item.nodePath);
    if (!element) continue;

    const { cx, cy } = bboxCenterFor(item.nodePath);
    const next = composeTransform(item.originalTransform, item.edit, cx, cy);
    if (next) element.setAttribute("transform", next);
    else element.removeAttribute("transform");
  }

  return sanitizeSvgMarkup(serialize(result.svg));
}

const previewSvg = computed(() => {
  const edited = buildSvgWithEdits();
  return edited ?? sanitizeSvgMarkup(props.svg) ?? "";
});

function doApply() {
  saveToLocalItem();
  const next = buildSvgWithEdits();
  if (!next) return;
  emit("apply", { svg: next });
  open.value = false;
}
</script>

<template>
  <modal v-model:open="open" max-width-class="max-w-[760px]">
    <template #title>
      <div class="svg-transform-modal__title">
        {{ t("services.svgEditor.modals.transform.title") }}
      </div>
    </template>

    <div class="svg-transform-modal">
      <div v-if="parseError" class="svg-transform-modal__error">
        {{ parseError }}
      </div>

      <div v-else class="svg-transform-modal__grid">
        <div class="svg-transform-modal__left">
          <div class="svg-transform-modal__subtitle">{{ t("services.svgEditor.modals.transform.elements") }}</div>

          <div class="svg-transform-modal__list">
            <button
              v-for="it in items"
              :key="it.id"
              type="button"
              class="svg-transform-modal__item"
              :class="{ 'svg-transform-modal__item_active': it.id === selectedId }"
              :title="it.label"
              @click="selectedId = it.id"
            >
              <span class="svg-transform-modal__item-text">{{ it.label }}</span>
            </button>
          </div>

          <div class="svg-transform-modal__preview">
            <div class="svg-transform-modal__preview-inner" v-html="previewSvg" />
          </div>
        </div>

        <div class="svg-transform-modal__right">
          <div class="svg-transform-modal__subtitle">{{ t("services.svgEditor.modals.transform.edit") }}</div>

          <div class="svg-transform-modal__row2">
            <custom-input
              :model-value="moveXInput"
              type="number"
              inputmode="decimal"
              :label="t('services.svgEditor.modals.transform.moveX')"
              @update:model-value="moveXInput = $event; saveToLocalItem()"
            />
            <custom-input
              :model-value="moveYInput"
              type="number"
              inputmode="decimal"
              :label="t('services.svgEditor.modals.transform.moveY')"
              @update:model-value="moveYInput = $event; saveToLocalItem()"
            />
          </div>

          <custom-input
            :model-value="scaleInput"
            type="number"
            inputmode="decimal"
            :label="t('services.svgEditor.modals.transform.scale')"
            :placeholder="t('services.svgEditor.modals.transform.placeholders.scale')"
            @update:model-value="scaleInput = $event; saveToLocalItem()"
          />

          <custom-input
            :model-value="rotateInput"
            type="number"
            inputmode="decimal"
            :label="t('services.svgEditor.modals.transform.rotate')"
            :placeholder="t('services.svgEditor.modals.transform.placeholders.rotate')"
            @update:model-value="rotateInput = $event; saveToLocalItem()"
          />

          <div v-if="fieldError" class="svg-transform-modal__field-error">{{ fieldError }}</div>

          <div class="svg-transform-modal__form-actions">
            <u-button
              type="button"
              variant="soft"
              :title="t('services.svgEditor.modals.transform.titles.resetElement')"
              @click="resetSelectedItem"
            >
              {{ t("services.svgEditor.modals.transform.reset") }}
            </u-button>
          </div>
        </div>
      </div>
    </div>

    <template #actions="{ close }">
      <u-button type="button" :title="t('services.svgEditor.modals.common.close')" @click="close()">
        {{ t("services.svgEditor.modals.common.close") }}
      </u-button>

      <u-button type="button" :title="t('services.svgEditor.modals.common.apply')" @click="doApply">
        {{ t("services.svgEditor.modals.common.apply") }}
      </u-button>
    </template>
  </modal>
</template>

<style scoped lang="scss">
.svg-transform-modal {
  display: grid;
  gap: 12px;
}

.svg-transform-modal__title {
  font-weight: 600;
  font-size: 16px;
}

.svg-transform-modal__error {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
  color: var(--ui-text);
  font-weight: 600;
  font-size: 12px;
}

.svg-transform-modal__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.svg-transform-modal__subtitle {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
  margin-bottom: 8px;
}

.svg-transform-modal__list {
  display: grid;
  gap: 8px;
  max-height: 180px;
  overflow: auto;
  padding-right: 6px;
}

.svg-transform-modal__item {
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  cursor: pointer;
}

.svg-transform-modal__item_active {
  background: rgba(224, 103, 154, 0.16);
  border-color: rgba(224, 103, 154, 0.28);
}

.svg-transform-modal__item-text {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.svg-transform-modal__preview {
  margin-top: 8px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  min-height: 160px;
  display: grid;
  place-items: center;
}

.svg-transform-modal__preview-inner :deep(svg) {
  max-width: 100%;
  max-height: 220px;
  height: auto;
  display: block;
}

.svg-transform-modal__right {
  display: grid;
  gap: 10px;
  align-content: start;
}

.svg-transform-modal__row2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.svg-transform-modal__field-error {
  font-size: 12px;
  font-weight: 600;
  color: rgb(239, 68, 68);
}

.svg-transform-modal__form-actions {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 900px) {
  .svg-transform-modal__grid {
    grid-template-columns: 1fr;
  }
}
</style>