<script setup lang="ts">
import { computed, useId } from "vue"

type Props = {
  modelValue?: boolean
  label?: string
  labelKey?: string
  hint?: string
  hintKey?: string
  error?: string | null
  disabled?: boolean
  variant?: "checkbox" | "switch"
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  labelKey: "",
  hint: "",
  hintKey: "",
  error: null,
  disabled: false,
  modelValue: false,
  variant: "checkbox",
})

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void
}>()

const id = useId()

// Country-fit still uses the old CustomCheckbox API. Render those two boolean
// controls through the same USwitch used by search filters instead of keeping a
// second checkbox visual language on that page. Other CustomCheckbox consumers
// remain unchanged until they explicitly opt into variant="switch".
const usesUiSwitch = computed(() =>
  props.variant === "switch" ||
  props.labelKey === "quizzes.countryFit.constraints.isShowUSA.label" ||
  props.labelKey === "quizzes.countryFit.constraints.isShowCountries.label"
)
</script>

<template>
  <div
    class="cb"
    :class="[
      { cb_error: !!error, cb_disabled: disabled, cb_ui_switch: usesUiSwitch },
      `cb_${variant}`,
    ]"
  >
    <label v-if="usesUiSwitch" class="cb__ui-switch" :for="id">
      <u-switch
        :id="id"
        :model-value="modelValue"
        :disabled="disabled"
        :aria-label="labelKey ? $t(labelKey) : label"
        @update:model-value="emit('update:modelValue', Boolean($event))"
      />
      <span class="cb__label cb__label_ui-switch">
        <span v-if="labelKey">{{ $t(labelKey) }}</span>
        <span v-else>{{ label }}</span>
      </span>
    </label>

    <label v-else class="cb__row" :for="id">
      <input
        :id="id"
        class="cb__native"
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />

      <span class="cb__box" aria-hidden="true"><u-icon name="i-lucide-check" class="cb__tick" /></span>

      <span class="cb__label">
        <span v-if="labelKey">{{ $t(labelKey) }}</span>
        <span v-else>{{ label }}</span>
      </span>
    </label>

    <div v-if="hintKey || hint" class="cb__hint">
      <span v-if="hintKey">{{ $t(hintKey) }}</span>
      <span v-else>{{ hint }}</span>
    </div>

    <div v-if="error" class="cb__error">{{ error }}</div>
  </div>
</template>

<style scoped>
.cb {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.cb__ui-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ui-control-h-md, 38px);
  color: var(--ui-text-muted);
  cursor: pointer;
  user-select: none;
}

.cb__ui-switch:has(input:checked) .cb__label_ui-switch {
  color: var(--ui-text);
}

.cb__ui-switch:has(input:focus-visible) {
  border-radius: var(--ui-control-radius, 8px);
  box-shadow: var(--ui-focus-ring, 0 0 0 3px rgba(224, 103, 154, 0.2));
}

.cb__row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 7px 10px;
  border-radius: var(--ui-control-radius, 8px);
  border: 1px solid var(--ui-border);
  background: var(--ui-control-bg, rgba(255, 255, 255, 0.035));
  color: var(--ui-text);
  cursor: pointer;
  user-select: none;
  transition: border-color var(--ui-transition, 150ms ease), background-color var(--ui-transition, 150ms ease), box-shadow var(--ui-transition, 150ms ease);
}
.cb__row:hover {
  border-color: rgba(224, 103, 154, 0.48);
  background: rgba(224, 103, 154, 0.055);
}

.cb__native {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cb__box {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ui-border);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.12);
  color: #fff;
  transition: border-color var(--ui-transition, 150ms ease), background-color var(--ui-transition, 150ms ease), box-shadow var(--ui-transition, 150ms ease);
}
.cb__tick {
  font-size: 12px;
  font-weight: 900;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 120ms ease, transform 120ms ease;
}
.cb_checkbox .cb__row:has(input:checked) .cb__tick { opacity: 1; transform: scale(1); }
.cb_checkbox .cb__row:has(input:checked) .cb__box {
  border-color: var(--accent-pink, #e0679a);
  background: linear-gradient(135deg, var(--accent-pink, #e0679a), #a855f7);
  box-shadow: 0 0 0 3px rgba(224, 103, 154, 0.13);
}

.cb__row:has(input:focus-visible) {
  border-color: var(--accent-pink, #e0679a);
  box-shadow: var(--ui-focus-ring, 0 0 0 3px rgba(224, 103, 154, 0.2));
}
.cb__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--ui-text-muted);
}
.cb__label_ui-switch {
  font-size: var(--ui-control-font, 12px);
}
.cb__hint { font-size: 11px; color: var(--ui-text-muted); opacity: 0.9; }
.cb__error { font-size: 12px; font-weight: 900; color: var(--color-error, #ef4444); }
.cb_error .cb__row { border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.06); }
.cb_disabled .cb__row,
.cb_disabled .cb__ui-switch { opacity: 0.6; cursor: not-allowed; }
</style>
