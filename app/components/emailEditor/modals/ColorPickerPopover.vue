<script setup lang="ts">
import CustomInput from "~/components/common/CustomInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import CustomButton from "~/components/common/CustomButton.vue";

type ColorFormat = "hex" | "rgb" | "rgba";

const { t } = useI18n();

const open = defineModel<boolean>("open", { default: false });
const color = defineModel<string>("color", { default: "#15162A" });
const preferHex = defineModel<boolean>("preferHex", { default: true });

const props = defineProps<{
  anchorClientX: number;
  anchorClientY: number;
}>();

const emit = defineEmits<{
  (e: "apply"): void;
  (e: "close"): void;
}>();

const format = ref<ColorFormat>("hex");
const codeInput = ref<string>("");
const parseError = ref<string | null>(null);

const rgba = reactive({ r: 21, g: 22, b: 42, a: 1 });

const formatItems = computed(() => [
  { label: t("services.emailEditor.modals.colorPicker.formats.hex"), value: "hex" },
  { label: t("services.emailEditor.modals.colorPicker.formats.rgb"), value: "rgb" },
  { label: t("services.emailEditor.modals.colorPicker.formats.rgba"), value: "rgba" },
]);

const style = computed(() => {
  const x = Math.max(12, props.anchorClientX);
  const y = Math.max(12, props.anchorClientY);
  return { left: `${x}px`, top: `${y}px` };
});

const previewCss = computed(() => `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round2(rgba.a)})`);

const hasEyeDropper = computed(() => typeof (globalThis as any).EyeDropper !== "undefined");

function close() {
  open.value = false;
  emit("close");
}

function apply() {
  const out = buildOutputString();
  color.value = out;
  emit("apply");
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function clamp255(v: number) {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function toHex2(v: number) {
  return clamp255(v).toString(16).padStart(2, "0").toUpperCase();
}

function rgbaToHexString() {
  return `#${toHex2(rgba.r)}${toHex2(rgba.g)}${toHex2(rgba.b)}`;
}

function rgbaToRgbString() {
  return `rgb(${clamp255(rgba.r)}, ${clamp255(rgba.g)}, ${clamp255(rgba.b)})`;
}

function rgbaToRgbaString() {
  return `rgba(${clamp255(rgba.r)}, ${clamp255(rgba.g)}, ${clamp255(rgba.b)}, ${round2(clamp01(rgba.a))})`;
}

function buildOutputString() {
  if (preferHex.value && rgba.a >= 0.999) return rgbaToHexString();
  if (format.value === "hex") return rgbaToHexString();
  if (format.value === "rgb") return rgbaToRgbString();
  return rgbaToRgbaString();
}

function syncCodeInputFromRgba() {
  codeInput.value = buildOutputString();
  parseError.value = null;
}

function setRgba(next: { r: number; g: number; b: number; a: number }) {
  rgba.r = clamp255(next.r);
  rgba.g = clamp255(next.g);
  rgba.b = clamp255(next.b);
  rgba.a = clamp01(next.a);
  syncCodeInputFromRgba();
}

function parseColorString(raw: string) {
  const s = String(raw || "").trim();

  const hex = s.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const v = hex[1];
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = s.match(/^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: 1,
    };
  }

  const rgbaM = s.match(
      /^rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i
  );
  if (rgbaM) {
    return {
      r: Number(rgbaM[1]),
      g: Number(rgbaM[2]),
      b: Number(rgbaM[3]),
      a: Number(rgbaM[4]),
    };
  }

  return null;
}

function onCodeInput(v: string) {
  codeInput.value = v;
  const parsed = parseColorString(v);
  if (!parsed) {
    parseError.value = t("services.emailEditor.modals.colorPicker.errors.invalidColorCode");
    return;
  }
  parseError.value = null;
  rgba.r = clamp255(parsed.r);
  rgba.g = clamp255(parsed.g);
  rgba.b = clamp255(parsed.b);
  rgba.a = clamp01(parsed.a);
  color.value = buildOutputString();
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = clamp255(r) / 255;
  const gn = clamp255(g) / 255;
  const bn = clamp255(b) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h >= 0 && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h >= 60 && h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h >= 120 && h < 180) [r1, g1, b1] = [0, c, x];
  else if (h >= 180 && h < 240) [r1, g1, b1] = [0, x, c];
  else if (h >= 240 && h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function adjustLightness(dir: -1 | 1) {
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);
  const step = 0.06;
  const nextL = clamp01(hsl.l + dir * step);
  const nextRgb = hslToRgb(hsl.h, hsl.s, nextL);
  setRgba({ r: nextRgb.r, g: nextRgb.g, b: nextRgb.b, a: rgba.a });
  color.value = buildOutputString();
}

function adjustAlpha(dir: -1 | 1) {
  const step = 0.05;
  setRgba({ r: rgba.r, g: rgba.g, b: rgba.b, a: clamp01(rgba.a + dir * step) });
  color.value = buildOutputString();
}

function onNativePick(hex: string) {
  const parsed = parseColorString(hex);
  if (!parsed) return;
  setRgba({ ...parsed, a: rgba.a });
  color.value = buildOutputString();
}

async function pickFromScreen() {
  try {
    const ED = (globalThis as any).EyeDropper;
    if (!ED) return;
    const ed = new ED();
    const res = await ed.open();
    const parsed = parseColorString(res?.sRGBHex);
    if (!parsed) return;
    setRgba({ ...parsed, a: rgba.a });
    color.value = buildOutputString();
  } catch {
  }
}

watch(
    () => open.value,
    (v) => {
      if (!v) return;
      const parsed = parseColorString(color.value) ?? parseColorString("#15162A");
      if (parsed) setRgba(parsed);
      syncCodeInputFromRgba();
    }
);

watch(
    () => [format.value, preferHex.value],
    () => {
      syncCodeInputFromRgba();
    }
);
</script>

<template>
  <teleport to="body">
    <div v-if="open" class="color-picker-popover" @mousedown.self="close">
      <div class="color-picker-popover__panel" :style="style">
        <div class="color-picker-popover__header">
          <div class="color-picker-popover__title">
            <u-icon name="i-lucide-palette" />
            <span>{{ t("services.emailEditor.modals.colorPicker.title") }}</span>
          </div>

          <button
              type="button"
              class="color-picker-popover__close"
              @click="close"
              :aria-label="t('services.emailEditor.modals.common.close')"
              :title="t('services.emailEditor.modals.common.close')"
          >
            <u-icon name="i-lucide-x" />
          </button>
        </div>

        <div class="color-picker-popover__content">
          <div class="color-picker-popover__top">
            <div class="color-picker-popover__row">
              <input
                  class="color-picker-popover__native"
                  type="color"
                  :value="rgbaToHexString()"
                  @input="onNativePick(($event.target as HTMLInputElement).value)"
                  :title="t('services.emailEditor.modals.colorPicker.titles.nativePicker')"
              />
              <div class="color-picker-popover__preview" :style="{ background: previewCss }" />
            </div>

            <button
                v-if="hasEyeDropper"
                type="button"
                class="color-picker-popover__tool"
                @click="pickFromScreen"
                :title="t('services.emailEditor.modals.colorPicker.titles.eyedropper')"
            >
              <u-icon name="i-lucide-pipette" />
            </button>

            <u-select
                v-model="format"
                class="color-picker-popover__format"
                :items="formatItems"
                option-attribute="label"
                value-attribute="value"
                :ui="{
    base: 'w-full',
    trigger:
      'h-11 rounded-[14px] border border-white/28 bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/16 hover:border-white/34',
    leadingIcon: 'text-white/95',
    trailingIcon: 'text-white/95',
    content:
      'z-[100000] rounded-[14px] border border-white/18 bg-[rgba(8,7,12,0.98)] backdrop-blur-xl shadow-[0_22px_70px_rgba(0,0,0,0.55)]',
    item: 'text-white/92',
    itemActive: 'bg-[rgba(224, 103, 154,0.24)]',
    itemSelected: 'bg-[rgba(224, 103, 154,0.30)]'
  }"
            />
          </div>

          <custom-input
              :model-value="codeInput"
              :label="t('services.emailEditor.modals.colorPicker.code')"
              :placeholder="t('services.emailEditor.modals.colorPicker.placeholders.code')"
              :error="parseError"
              @update:model-value="onCodeInput"
          />

          <custom-checkbox
              v-model="preferHex"
              :label="t('services.emailEditor.modals.colorPicker.preferHex')"
          />

          <div class="color-picker-popover__controls">
            <div class="color-picker-popover__control">
              <button
                  type="button"
                  class="color-picker-popover__mini"
                  @click="adjustLightness(-1)"
                  :title="t('services.emailEditor.modals.colorPicker.titles.darker')"
              >
                <u-icon name="i-lucide-minus" />
              </button>

              <div class="color-picker-popover__control-label">
                {{ t("services.emailEditor.modals.colorPicker.lightness") }}
              </div>

              <button
                  type="button"
                  class="color-picker-popover__mini"
                  @click="adjustLightness(1)"
                  :title="t('services.emailEditor.modals.colorPicker.titles.lighter')"
              >
                <u-icon name="i-lucide-plus" />
              </button>
            </div>

            <div class="color-picker-popover__control">
              <button
                  type="button"
                  class="color-picker-popover__mini"
                  @click="adjustAlpha(-1)"
                  :title="t('services.emailEditor.modals.colorPicker.titles.moreTransparent')"
              >
                <u-icon name="i-lucide-minus" />
              </button>

              <div class="color-picker-popover__control-label">
                {{ t("services.emailEditor.modals.colorPicker.opacity") }}
              </div>

              <button
                  type="button"
                  class="color-picker-popover__mini"
                  @click="adjustAlpha(1)"
                  :title="t('services.emailEditor.modals.colorPicker.titles.lessTransparent')"
              >
                <u-icon name="i-lucide-plus" />
              </button>
            </div>
          </div>

          <div class="color-picker-popover__actions">
            <custom-button variant="secondary" @click="close">
              {{ t("services.emailEditor.modals.colorPicker.close") }}
            </custom-button>
            <custom-button variant="full" @click="apply">
              {{ t("services.emailEditor.modals.colorPicker.apply") }}
            </custom-button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped lang="scss">
.color-picker-popover {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.color-picker-popover__panel {
  position: fixed;
  width: 360px;
  max-width: calc(100vw - 24px);
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(14, 12, 21, 0.92);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  padding: 12px;
}

.color-picker-popover__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.color-picker-popover__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
}

.color-picker-popover__close {
  height: 34px;
  width: 34px;
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.18);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
  color: rgba(255, 255, 255, 0.9);
}

.color-picker-popover__close:hover {
  filter: brightness(1.06);
}

.color-picker-popover__close:active {
  transform: translateY(1px);
}

.color-picker-popover__content {
  display: grid;
  gap: 10px;
}

.color-picker-popover__top {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: start;
}

.color-picker-popover__row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker-popover__native {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  padding: 0;
  overflow: hidden;
}

.color-picker-popover__preview {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-light);
}

.color-picker-popover__tool {
  height: 44px;
  width: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.color-picker-popover__tool:hover {
  filter: brightness(1.06);
}

.color-picker-popover__tool:active {
  transform: translateY(1px);
}

.color-picker-popover__format {
  min-width: 150px;
}

.color-picker-popover__controls {
  display: grid;
  gap: 8px;
}

.color-picker-popover__control {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
}

.color-picker-popover__mini {
  height: 38px;
  width: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.9);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: filter 160ms ease, transform 140ms ease;
}

.color-picker-popover__mini:hover {
  filter: brightness(1.06);
}

.color-picker-popover__mini:active {
  transform: translateY(1px);
}

.color-picker-popover__control-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.color-picker-popover__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 4px;
}
</style>
