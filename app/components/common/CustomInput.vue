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

const { t } = useI18n();

const resolvedLabel = computed(() => (props.labelKey ? t(props.labelKey) : props.label));
const resolvedPlaceholder = computed(() => (props.placeholderKey ? t(props.placeholderKey) : props.placeholder));

// The clear button is UInput's; a number field never had one here.
const showClear = computed(() => props.clearable && !props.readonly && !props.disabled && props.type !== "number");

function onInput(value: string | number) {
  if (props.type !== "number") {
    emit("update:modelValue", String(value));
    return
  }

  const parsed = parseNumber(String(value));

  if (parsed === null) {
    emit("update:modelValue", "");
    return;
  }

  const clamped = clamp(parsed);
  emit("update:modelValue", String(clamped));
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
    <!-- Presentation is UInput's, so this field animates its label and matches
         every other control in the app. What stays here is what UInput has no
         opinion about: the i18n key variants, the number clamping, the hint and
         the error line. -->
    <u-input
        :model-value="modelValue"
        :label="resolvedLabel || undefined"
        :type="type"
        :placeholder="resolvedPlaceholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :clearable="showClear"
        :clear-label="$t('services.mergeJson.titles.reset')"
        :min="type === 'number' ? min : undefined"
        :max="type === 'number' ? max : undefined"
        @update:model-value="onInput"
        @keydown="onKeydown"
        @clear="clear"
    />

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

.uii__hint {
  font-size: 11px;
  color: var(--ui-text-muted);
}

.uii__error {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-error, #ef4444);
}

/* The outline and the lifted label both read these, so recolouring the field
   for an error is a matter of two variables rather than reaching into UInput. */
.uii_error {
  --ui-control-border: rgba(239, 68, 68, 0.55);
  --accent-pink: var(--color-error, #ef4444);
}

.uii_disabled {
  opacity: 0.65;
}
</style>
