<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";

type StrokeItem = {
  id: string;
  label: string;
  nodePath: number[];
  stroke: string;
  strokeWidth: string;
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

const items = ref<StrokeItem[]>([]);
const selectedId = ref<string | null>(null);

const editStrokeWidth = ref<string>("");
const editStrokeColor = ref<string>("");
const useCurrentColor = ref(false);

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
      errorKey: "services.svgEditor.errors.noSvgRoot"
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
    const idx = siblings.indexOf(cur);
    path.unshift(idx);
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

function collectStrokeItems(svgCode: string): StrokeItem[] {
  const res = parseSvg(svgCode);
  if (!res.ok) return [];

  const svg = res.svg;
  const tags = ["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "g"];
  const els = Array.from(svg.querySelectorAll(tags.join(","))) as Element[];

  const out: StrokeItem[] = [];
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const stroke = el.getAttribute("stroke") || "";
    const strokeWidth = el.getAttribute("stroke-width") || "";
    out.push({
      id: `st_${i}_${Math.random().toString(16).slice(2)}`,
      label: nodeLabel(el),
      nodePath: computeNodePath(svg, el),
      stroke,
      strokeWidth,
    });
  }

  return out;
}

function resetSelection() {
  const first = items.value[0];
  selectedId.value = first ? first.id : null;
  loadSelectedToForm();
}

function loadSelectedToForm() {
  const it = items.value.find((x) => x.id === selectedId.value);
  if (!it) {
    editStrokeWidth.value = "";
    editStrokeColor.value = "";
    useCurrentColor.value = false;
    return;
  }

  editStrokeWidth.value = it.strokeWidth || "";
  const s = safeTrim(it.stroke || "");
  useCurrentColor.value = /^currentColor$/i.test(s);
  editStrokeColor.value = useCurrentColor.value ? "" : (s || "");
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
      items.value = collectStrokeItems(props.svg);
      resetSelection();
    }
);

watch(
    () => selectedId.value,
    () => {
      loadSelectedToForm();
    }
);

function validateStrokeWidth(v: string) {
  const s = safeTrim(v);
  if (!s) return {ok: true as const};
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return {
    ok: false as const,
    errorKey: "services.svgEditor.modals.stroke.errors.strokeWidth"
  };
  return {ok: true as const};
}

function saveToLocalItem() {
  const it = items.value.find((x) => x.id === selectedId.value);
  if (!it) return;

  const valid = validateStrokeWidth(editStrokeWidth.value);
  if (!valid.ok) {
    parseError.value = t(valid.errorKey);
    return;
  }

  parseError.value = null;

  it.strokeWidth = safeTrim(editStrokeWidth.value);
  it.stroke = useCurrentColor.value ? "currentColor" : safeTrim(editStrokeColor.value);
}

function buildSvgWithEdits() {
  const res = parseSvg(props.svg);
  if (!res.ok) return null;

  const svg = res.svg;

  for (const it of items.value) {
    const el = getByPath(svg, it.nodePath);
    if (!el) continue;

    const stroke = safeTrim(it.stroke);
    const sw = safeTrim(it.strokeWidth);

    if (stroke) el.setAttribute("stroke", stroke);
    else el.removeAttribute("stroke");

    if (sw) el.setAttribute("stroke-width", sw);
    else el.removeAttribute("stroke-width");
  }

  return serialize(svg);
}

function doApply() {
  saveToLocalItem();
  const next = buildSvgWithEdits();
  if (!next) return;
  emit("apply", {svg: next});
  open.value = false;
}

const strokeColorError = ref<string | null>(null)

function parseColorString(raw: string) {
  const s = String(raw || "").trim();
  const hex = s.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return {hex: `#${hex[1].toUpperCase()}`};

  const rgb = s.match(/^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i);
  if (rgb) {
    const r = Math.min(255, Math.max(0, Number(rgb[1])));
    const g = Math.min(255, Math.max(0, Number(rgb[2])));
    const b = Math.min(255, Math.max(0, Number(rgb[3])));
    return {hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase()};
  }

  const rgba = s.match(/^rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (rgba) {
    const r = Math.min(255, Math.max(0, Number(rgba[1])));
    const g = Math.min(255, Math.max(0, Number(rgba[2])));
    const b = Math.min(255, Math.max(0, Number(rgba[3])));
    return {hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase()};
  }

  return null;
}

function nativeStrokeHex() {
  const parsed = parseColorString(editStrokeColor.value || "#15162A")
  return parsed?.hex || "#15162A"
}

function onStrokeCodeInput(v: string) {
  if (useCurrentColor.value) return
  editStrokeColor.value = v

  const parsed = parseColorString(v)
  if (!parsed) {
    strokeColorError.value = t("services.svgEditor.modals.stroke.errors.invalidColor")
    return
  }

  strokeColorError.value = null
}

function onStrokeNativePick(hex: string) {
  if (useCurrentColor.value) return
  strokeColorError.value = null
  editStrokeColor.value = hex
}

watch(
    () => useCurrentColor.value,
    (v) => {
      if (v) strokeColorError.value = null
    }
)
</script>

<template>
  <modal v-model:open="open" max-width-class="max-w-[600px]">
    <template #title>
      <div class="svg-stroke-modal__title">
        {{ t("services.svgEditor.modals.stroke.title") }}
      </div>
    </template>

    <div class="svg-stroke-modal">
      <div v-if="parseError" class="svg-stroke-modal__error">
        {{ parseError }}
      </div>

      <div v-else class="svg-stroke-modal__grid">
        <div class="svg-stroke-modal__left">
          <div class="svg-stroke-modal__subtitle">{{ t("services.svgEditor.modals.stroke.elements") }}</div>

          <div class="svg-stroke-modal__list">
            <button
                v-for="it in items"
                :key="it.id"
                type="button"
                class="svg-stroke-modal__item"
                :class="{ 'svg-stroke-modal__item_active': it.id === selectedId }"
                :title="it.label"
                @click="selectedId = it.id"
            >
              <span class="svg-stroke-modal__item-text">{{ it.label }}</span>
            </button>
          </div>
        </div>

        <div class="svg-stroke-modal__right">
          <div class="svg-stroke-modal__subtitle">{{ t("services.svgEditor.modals.stroke.edit") }}</div>
          <custom-input
              :model-value="editStrokeWidth"
              type="number"
              inputmode="decimal"
              :label="t('services.svgEditor.modals.stroke.strokeWidth')"
              :placeholder="t('services.svgEditor.modals.stroke.placeholders.strokeWidth')"
              @update:model-value="editStrokeWidth = $event"
          />

          <custom-checkbox
              v-model="useCurrentColor"
              :label="t('services.svgEditor.modals.stroke.useCurrentColor')"
          />

          <div class="svg-stroke-modal__color-row">
            <input
                class="svg-stroke-modal__native"
                type="color"
                :disabled="useCurrentColor"
                :value="nativeStrokeHex()"
                :title="t('services.svgEditor.modals.stroke.titles.nativePicker')"
                @input="onStrokeNativePick(($event.target as HTMLInputElement).value)"
            />

            <custom-input
                :model-value="useCurrentColor ? '' : editStrokeColor"
                :label="t('services.svgEditor.modals.stroke.strokeColor')"
                :placeholder="t('services.svgEditor.modals.stroke.placeholders.strokeColor')"
                :disabled="useCurrentColor"
                :error="strokeColorError"
                @update:model-value="onStrokeCodeInput"
            />
          </div>

          <div class="svg-stroke-modal__form-actions">
            <u-button
                type="button"
                :title="t('services.svgEditor.modals.stroke.titles.saveElement')"
                @click="saveToLocalItem"
            >
              {{ t("services.svgEditor.modals.stroke.saveElement") }}
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
.svg-stroke-modal {
  display: grid;
  gap: 12px;
}

.svg-stroke-modal__title {
  font-weight: 600;
  font-size: 16px;
}

.svg-stroke-modal__error {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
  color: var(--ui-text);
  font-weight: 600;
  font-size: 12px;
}

.svg-stroke-modal__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.svg-stroke-modal__subtitle {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
  margin-bottom: 8px;
}

.svg-stroke-modal__list {
  display: grid;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
  padding-right: 6px;
}

.svg-stroke-modal__item {
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  cursor: pointer;
}

.svg-stroke-modal__item_active {
  background: rgba(224, 103, 154, 0.16);
  border-color: rgba(224, 103, 154, 0.28);
}

.svg-stroke-modal__item-text {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.svg-stroke-modal__right {
  display: grid;
  gap: 10px;
  align-content: start;
}

.svg-stroke-modal__color-row {
  display: grid;
  grid-template-columns: 1fr 44px;
  gap: 10px;
  align-items: end;
}

.svg-stroke-modal__form-actions {
  display: flex;
  justify-content: flex-end;
}

.svg-stroke-modal__color-row {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: end;
}

.svg-stroke-modal__native {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .svg-stroke-modal__grid {
    grid-template-columns: 1fr;
  }
}
</style>
