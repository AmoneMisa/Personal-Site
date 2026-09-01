<script setup lang="ts">
import Modal from "~/components/common/Modal.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import CustomInput from "~/components/common/CustomInput.vue";

type ColorUsage = {
  key: string;
  value: string;
  count: number;
};

type Replacement = { mode: "color" | "currentColor"; color: string };

const { t } = useI18n();

const open = defineModel<boolean>("open", { default: false });

const props = defineProps<{
  colors: ColorUsage[];
}>();

const emit = defineEmits<{
  (e: "apply", payload: { replacements: Record<string, Replacement> }): void;
}>();

const replacements = ref<Record<string, Replacement>>({});

watch(
    () => open.value,
    (v) => {
      if (!v) return;
      const next: Record<string, Replacement> = {};
      for (const c of props.colors || []) {
        next[c.key] = { mode: "color", color: c.value };
      }
      replacements.value = next;
    }
);

function setCurrentColor(key: string, v: boolean) {
  const cur = replacements.value[key] || { mode: "color" as const, color: "#15162A" };
  replacements.value[key] = { ...cur, mode: v ? "currentColor" : "color" };
}

const rowErrors = ref<Record<string, string | null>>({})

function parseColorString(raw: string) {
  const s = String(raw || "").trim();

  const hex = s.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) return { hex: `#${hex[1].toUpperCase()}` };

  const rgb = s.match(/^rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)$/i);
  if (rgb) {
    const r = Math.min(255, Math.max(0, Number(rgb[1])));
    const g = Math.min(255, Math.max(0, Number(rgb[2])));
    const b = Math.min(255, Math.max(0, Number(rgb[3])));
    return { hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase() };
  }

  const rgba = s.match(/^rgba\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (rgba) {
    const r = Math.min(255, Math.max(0, Number(rgba[1])));
    const g = Math.min(255, Math.max(0, Number(rgba[2])));
    const b = Math.min(255, Math.max(0, Number(rgba[3])));
    return { hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase() };
  }

  return null;
}

function ensureRowError(key: string, msg: string | null) {
  rowErrors.value = { ...rowErrors.value, [key]: msg }
}

function onColorCodeInput(key: string, v: string) {
  const cur = replacements.value[key] || { mode: "color" as const, color: "#15162A" }
  if (cur.mode === "currentColor") return

  const parsed = parseColorString(v)
  if (!parsed) {
    ensureRowError(key, t("services.svgEditor.modals.colors.errors.invalidColor"))
    replacements.value[key] = { ...cur, color: v }
    return
  }

  ensureRowError(key, null)
  replacements.value[key] = { ...cur, color: v }
}

function onNativePick(key: string, hex: string) {
  const cur = replacements.value[key] || { mode: "color" as const, color: "#15162A" }
  if (cur.mode === "currentColor") return
  ensureRowError(key, null)
  replacements.value[key] = { ...cur, mode: "color", color: hex }
}

function nativeHexFor(key: string) {
  const cur = replacements.value[key]
  const v = cur?.color || "#15162A"
  const parsed = parseColorString(v)
  return parsed?.hex || "#15162A"
}

function doApply() {
  const hasErrors = Object.values(rowErrors.value).some((e) => !!e)
  if (hasErrors) return
  emit("apply", { replacements: replacements.value })
  open.value = false
}
</script>

<template>
  <modal v-model:open="open" max-width-class="sm:max-w-3xl">
    <template #title>
      <div class="svg-colors-modal__title">
        {{ t("services.svgEditor.modals.colors.title") }}
      </div>
    </template>

    <div class="svg-colors-modal">
      <div v-if="!colors?.length" class="svg-colors-modal__empty">
        {{ t("services.svgEditor.modals.colors.empty") }}
      </div>

      <div v-else class="svg-colors-modal__list">
        <div v-for="c in colors" :key="c.key" class="svg-colors-modal__row">
          <div class="svg-colors-modal__meta">
            <div class="svg-colors-modal__badge" :style="{ background: c.value }" />
            <div class="svg-colors-modal__info">
              <div class="svg-colors-modal__from">
                <span class="svg-colors-modal__label">{{ t("services.svgEditor.modals.colors.from") }}</span>
                <span class="svg-colors-modal__code">{{ c.value }}</span>
              </div>
              <div class="svg-colors-modal__count">
                {{ t("services.svgEditor.modals.colors.count") }}: {{ c.count }}
              </div>
            </div>
          </div>

          <div class="svg-colors-modal__to">
            <div class="svg-colors-modal__picker">
              <input
                  class="svg-colors-modal__native"
                  type="color"
                  :disabled="replacements[c.key]?.mode === 'currentColor'"
                  :value="nativeHexFor(c.key)"
                  :title="t('services.svgEditor.modals.colors.titles.nativePicker')"
                  @input="onNativePick(c.key, ($event.target as HTMLInputElement).value)"
              />

              <custom-input
                  :model-value="replacements[c.key]?.mode === 'currentColor' ? '' : (replacements[c.key]?.color || '')"
                  :label="t('services.svgEditor.modals.colors.to')"
                  :placeholder="t('services.svgEditor.modals.colors.placeholders.color')"
                  :disabled="replacements[c.key]?.mode === 'currentColor'"
                  :error="rowErrors[c.key] || null"
                  @update:model-value="onColorCodeInput(c.key, $event)"
              />
            </div>
            <custom-checkbox
                :model-value="replacements[c.key]?.mode === 'currentColor'"
                :label="t('services.svgEditor.modals.colors.useCurrentColor')"
                @update:model-value="setCurrentColor(c.key, $event)"
            />
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
.svg-colors-modal {
  display: grid;
  gap: 12px;
}

.svg-colors-modal__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.svg-colors-modal__empty {
  padding: 14px;
  border-radius: 8px;
  border: 1px dashed var(--line);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ui-text-muted);
  font-weight: 600;
  font-size: 12px;
}

.svg-colors-modal__list {
  display: grid;
  gap: 10px;
}

.svg-colors-modal__row {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.svg-colors-modal__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.svg-colors-modal__badge {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-light);
  flex: 0 0 auto;
}

.svg-colors-modal__info {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.svg-colors-modal__from {
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
  min-width: 0;
}

.svg-colors-modal__label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.svg-colors-modal__code {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svg-colors-modal__count {
  font-size: 11px;
  color: var(--ui-text-muted);
}

.svg-colors-modal__to {
  display: grid;
  gap: 10px;
  align-content: start;
}

.svg-colors-modal__picker {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: end;
}

.svg-colors-modal__native {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: transparent;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .svg-colors-modal__row {
    grid-template-columns: 1fr;
  }
}
</style>
