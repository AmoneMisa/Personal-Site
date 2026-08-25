<script setup lang="ts">
import { useId } from "vue"

type Props = {
  modelValue?: boolean
  label?: string
  labelKey?: string
  hint?: string
  hintKey?: string
  error?: string | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: "",
  labelKey: "",
  hint: "",
  hintKey: "",
  error: null,
  disabled: false,
  modelValue: false,
})

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void
}>()

const id = useId()
</script>

<template>
  <div class="cb" :class="{ cb_error: !!error, cb_disabled: disabled }">
    <label class="cb__row" :for="id">
      <input
        :id="id"
        class="cb__native"
        type="checkbox"
        role="switch"
        :checked="modelValue"
        :aria-checked="modelValue"
        :disabled="disabled"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />

      <span class="cb__switch" aria-hidden="true"><span class="cb__knob" /></span>

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

.cb__switch {
  position: relative;
  width: 34px;
  height: 20px;
  flex: 0 0 34px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  background: rgba(4, 8, 27, 0.62);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.28);
  transition: border-color var(--ui-transition, 150ms ease), background var(--ui-transition, 150ms ease), box-shadow var(--ui-transition, 150ms ease);
}

.cb__knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #9aa6c7;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.38);
  transition: transform 160ms ease, background-color 160ms ease;
}

.cb__row:has(input:checked) {
  border-color: rgba(224, 103, 154, 0.36);
  background: rgba(224, 103, 154, 0.055);
}
.cb__row:has(input:checked) .cb__switch {
  border-color: rgba(224, 103, 154, 0.72);
  background: linear-gradient(135deg, rgba(224, 103, 154, 0.92), rgba(168, 85, 247, 0.88));
  box-shadow: 0 0 0 3px rgba(224, 103, 154, 0.11);
}
.cb__row:has(input:checked) .cb__knob {
  transform: translateX(14px);
  background: #fff;
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
.cb__row:has(input:checked) .cb__label { color: var(--ui-text); }

.cb__hint {
  font-size: 11px;
  color: var(--ui-text-muted);
  opacity: 0.9;
}

.cb__error {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-error, #ef4444);
}

.cb_error .cb__row {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}

.cb_disabled .cb__row {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
