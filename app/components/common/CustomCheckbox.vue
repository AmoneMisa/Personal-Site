<script setup lang="ts">
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

const id = `cb_${Math.random().toString(16).slice(2)}`
</script>

<template>
  <div class="cb" :class="{ cb_error: !!error, cb_disabled: disabled }">
    <label class="cb__row" :for="id">
      <input
          :id="id"
          class="cb__native"
          type="checkbox"
          :checked="modelValue"
          :disabled="disabled"
          @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
      />

      <span class="cb__box" aria-hidden="true">
        <u-icon name="i-lucide-check" class="cb__tick"/>
      </span>

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
}

.cb__row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ui-text);
  cursor: pointer;
  user-select: none;
}

.cb__native {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cb__box {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1px solid var(--ui-border);
  background: rgba(0, 0, 0, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.cb__tick {
  font-size: 12px;
  font-weight: 900;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 120ms ease, transform 120ms ease;
}

.cb__row:has(input:checked) .cb__tick {
  opacity: 1;
  transform: scale(1);
}

.cb__label {
  font-size: 12px;
  font-weight: 900;
  color: var(--ui-text-muted);
}

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
