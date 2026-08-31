<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import {
  composeTransform,
  IDENTITY_TRANSFORM_EDIT,
  isIdentityEdit,
  type TransformEdit,
} from "~/utils/svgTransform";

type TransformItem = {
  id: string;
  label: string;
  nodePath: number[];
  originalTransform: string;
  edit: TransformEdit;
};

const {t} = useI18n();

const open = defineModel<boolean>("open", {default: false});

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

function safeTrim(v: string) {
  return String(v || "").trim();
}

function parseSvg(raw: string) {
  const s = safeTrim(raw);
  if (!s) return {ok: false as const, errorKey: "services.svgEditor.errors.empty"};
  if (!/<svg[\s>]/i.test(s)) return {ok: false as const, errorKey: "services.svgEditor.errors.noSvgRoot"};

  try {
    const doc = new DOMParser().parseFromString(s, "image/svg+xml");
    const parseErr = doc.getElementsByTagName("parsererror")?.[0];
    if (parseErr) return {ok: false as const, errorKey: "services.svgEditor.errors.parse"};
    const svg = doc.documentElement as any;
    if (!svg || String(svg.tagName || "").toLowerCase() !== "svg") return {
      ok: false as const,
      errorKey: "services.svgEditor.errors.noSvgRoot",
    };
    return {ok: true as const, doc, svg: svg as SVGElement};
  } catch {
    return {ok: false as const, errorKey: "services.svgEditor.errors.parse"};
  }
}

function serialize(svg: SVGElement) {
  return new XMLSerializer().serializeToString(svg);
}

function nodeLabel(el: Element) {
  const tag = String(el.tagName || "").toLowerCase();
  const id = el.getAttribute("id");
  const cls = safeTrim(el.getAttribute("class") || "");
  const clsPart = cls ? `.${cls.split(/\s+/g).filter(Boolean).join(".")}` : "";
  const idPart = id ? `#${id}` : "";
  return `${tag}${idPart}${clsPart}`;
}

function computeNodePath(root: Element, target: Element) {
  const path: number[] = [];
  let cur: Element | null = target;

  while (cur && cur !== root) {
    const parent = cur.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children);
    path.unshift(siblings.indexOf(cur));
    cur = parent;
  }

  return path;
}

function getByPath(root: Element, path: number[]) {
  let cur: Element = root;
  for (const idx of path) {
    const next = cur.children.item(idx) as Element | null;
    if (!next) return null;
    cur = next;
  }
  return cur;
}

const TRANSFORMABLE_TAGS = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "g", "text", "image"];

function collectTransformItems(svgCode: string): TransformItem[] {
  const res = parseSvg(svgCode);
  if (!res.ok) return [];

  const svg = res.svg;
  const els = Array.from(svg.querySelectorAll(TRANSFORMABLE_TAGS.join(","))) as Element[];

  return els.map((el, i) => ({
    id: `tf_${i}_${Math.random().toString(16).slice(2)}`,
    label: nodeLabel(el),
    nodePath: computeNodePath(svg, el),
    originalTransform: el.getAttribute("transform") || "",
    edit: {...IDENTITY_TRANSFORM_EDIT},
  }));
}

// getBBox() only works on elements actually attached to the document (not a
// detached DOMParser document), so the source SVG is mounted off-screen for
// the moment it takes to read each element's bounding box.
function withMountedSvg<T>(svgCode: string, fn: (mountedRoot: SVGElement) => T): T | null {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  try {
    container.innerHTML = svgCode;
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
  const fallback = {cx: 0, cy: 0};
  const center = withMountedSvg(props.svg, (mountedRoot) => {
    const el = getByPath(mountedRoot, nodePath) as SVGGraphicsElement | null;
    if (!el || typeof el.getBBox !== "function") return fallback;
    try {
      const box = el.getBBox();
      return {cx: box.x + box.width / 2, cy: box.y + box.height / 2};
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
  const it = items.value.find((x) => x.id === selectedId.value);
  fieldError.value = null;
  if (!it) {
    moveXInput.value = "0";
    moveYInput.value = "0";
    scaleInput.value = "100";
    rotateInput.value = "0";
    return;
  }

  moveXInput.value = String(it.edit.translateX);
  moveYInput.value = String(it.edit.translateY);
  scaleInput.value = String(Math.round(it.edit.scale * 100));
  rotateInput.value = String(it.edit.rotateDeg);
}

watch(
    () => open.value,
    (v) => {
      if (!v) return;
      parseError.value = null;
      const res = parseSvg(props.svg);
      if (!res.ok) {
        items.value = [];
        selectedId.value = null;
        parseError.value = t(res.errorKey);
        return;
      }
      items.value = collectTransformItems(props.svg);
      resetSelection();
    }
);

watch(() => selectedId.value, loadSelectedToForm);

function parseFiniteNumber(v: string): number | null {
  const s = safeTrim(v);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function saveToLocalItem() {
  const it = items.value.find((x) => x.id === selectedId.value);
  if (!it) return;

  const tx = parseFiniteNumber(moveXInput.value);
  const ty = parseFiniteNumber(moveYInput.value);
  const scalePct = parseFiniteNumber(scaleInput.value);
  const rotate = parseFiniteNumber(rotateInput.value);

  if (tx === null || ty === null || rotate === null) {
    fieldError.value = t("services.svgEditor.modals.transform.errors.invalidNumber");
    return;
  }
  if (scalePct === null || scalePct <= 0) {
    fieldError.value = t("services.svgEditor.modals.transform.errors.invalidScale");
    return;
  }

  fieldError.value = null;
  it.edit = {translateX: tx, translateY: ty, scale: scalePct / 100, rotateDeg: rotate};
}

function resetSelectedItem() {
  const it = items.value.find((x) => x.id === selectedId.value);
  if (!it) return;
  it.edit = {...IDENTITY_TRANSFORM_EDIT};
  loadSelectedToForm();
}

function buildSvgWithEdits(): string | null {
  const res = parseSvg(props.svg);
  if (!res.ok) return null;

  const svg = res.svg;

  for (const it of items.value) {
    if (isIdentityEdit(it.edit)) continue;

    const el = getByPath(svg, it.nodePath);
    if (!el) continue;

    const {cx, cy} = bboxCenterFor(it.nodePath);
    const next = composeTransform(it.originalTransform, it.edit, cx, cy);
    if (next) el.setAttribute("transform", next);
    else el.removeAttribute("transform");
  }

  return serialize(svg);
}

// Live preview so move/scale/rotate - unlike stroke or color edits - are
// actually judged visually rather than by reading raw numbers. Each input's
// @update:model-value already calls saveToLocalItem() before this
// recomputes, so it.edit is current by the time buildSvgWithEdits() reads it.
const previewSvg = computed(() => buildSvgWithEdits() ?? props.svg);

function doApply() {
  saveToLocalItem();
  const next = buildSvgWithEdits();
  if (!next) return;
  emit("apply", {svg: next});
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
            <div class="svg-transform-modal__preview-inner" v-html="previewSvg"/>
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
      <u-button
          type="button"
          :title="t('services.svgEditor.modals.common.close')"
          @click="close()"
      >
        {{ t("services.svgEditor.modals.common.close") }}
      </u-button>

      <u-button
          type="button"
          :title="t('services.svgEditor.modals.common.apply')"
          @click="doApply"
      >
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
