<script setup lang="ts">
type InputType = "text" | "search" | "email" | "password" | "number" | "url";

type Props = {
  modelValue?: string | number
  type?: InputType
  label?: string
  labelKey?: string
  placeholder?: string
  placeholderKey?: string
  hint?: string
  hintKey?: string
  error?: string | null
  disabled?: boolean
  readonly?: boolean
  autocomplete?: string
  inputmode?: "text" | "numeric" | "decimal" | "email" | "search" | "tel" | "url"
  clearable?: boolean
  min?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: "text",
  label: "",
  labelKey: "",
  placeholder: "",
  placeholderKey: "",
  hint: "",
  hintKey: "",
  error: null,
  disabled: false,
  readonly: false,
  autocomplete: "off",
  inputmode: "text",
  clearable: true,
  modelValue: "",
  min: undefined,
  max: undefined,
})

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void
  (e: "clear"): void
}>()

const id = `in_${Math.random().toString(16).slice(2)}`;
const hasValue = computed(() => (props.modelValue || "").length > 0);

function onInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const value = input.value;

  if (props.type !== "number") {
    emit("update:modelValue", value);
    return
  }

  const parsed = parseNumber(value);

  if (parsed === null) {
    emit("update:modelValue", "");
    return;
  }

  const clamped = clamp(parsed);
  emit("update:modelValue", clamped);
}

function onKeydown(e: KeyboardEvent) {
  if (props.type !== "number") return

  const allowed = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "-",
    ".",
  ]

  if (
      allowed.includes(e.key) ||
      (e.key >= "0" && e.key <= "9")
  ) {
    return
  }

  e.preventDefault()
}

function parseNumber(value: string): number | null {
  if (value === "" || value === "-" || value === ".") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number) {
  if (props.min !== undefined && n < props.min) return props.min;
  if (props.max !== undefined && n > props.max) return props.max;
  return n;
}

function clear() {
  emit("update:modelValue", "")
  emit("clear")
}
</script>

<template>
  <div class="uii" :class="{ uii_error: !!error, uii_disabled: disabled }">
    <div v-if="labelKey || label" class="uii__label">
      <label :for="id">
        <span v-if="labelKey">{{ $t(labelKey) }}</span>
        <span v-else>{{ label }}</span>
      </label>
    </div>

    <div class="uii__box">
      <input
          :id="id"
          class="uii__input"
          :type="type"
          :value="modelValue"
          :placeholder="placeholderKey ? $t(placeholderKey) : placeholder"
          :disabled="disabled"
          :readonly="readonly"
          :autocomplete="autocomplete"
          :inputmode="inputmode"
          @input="onInput"
          @keydown="onKeydown"
          :min="type === 'number' ? min : undefined"
          :max="type === 'number' ? max : undefined"
      />

      <button
          v-if="clearable && !readonly && !disabled && hasValue && !(type === 'number')"
          class="uii__clear"
          type="button"
          @click="clear"
          :title="$t('services.mergeJson.titles.reset')"
      >
        <u-icon name="i-lucide-x" class="uii__clear-icon" />
      </button>
    </div>

    <div v-if="hintKey || hint" class="uii__hint">
      <span v-if="hintKey">{{ $t(hintKey) }}</span>
      <span v-else>{{ hint }}</span>
    </div>

    <div v-if="error" class="uii__error">{{ error }}</div>
  </div>
</template>

<style scoped>
.uii {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.uii__label {
  font-weight: 900;
  font-size: 13px;
  color: var(--text-white);
}

.uii__box {
  position: relative;
  border-radius: 6px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  padding: 3px 8px;
}

.uii__input {
  width: 100%;
  font-size: 13px;
  color: var(--ui-text);
  background: transparent;
  outline: none;
  border: 0;
  padding-right: 28px;

  &[type="number"] {
    padding-right: 0;
  }
}

.uii__clear {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 10px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  color: var(--ui-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.uii__clear-icon {
  width: 16px;
  height: 16px;
  opacity: 0.9;
}

.uii__hint {
  font-size: 11px;
  color: var(--ui-text-muted);
}

.uii__error {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-error, #ef4444);
}

.uii_error .uii__box {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}

.uii_disabled {
  opacity: 0.65;
}

.uii_disabled .uii__clear {
  display: none;
}
</style>
