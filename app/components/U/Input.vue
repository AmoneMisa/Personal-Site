<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UInput>.
//
// Keeps v-model working with both `v-model` and `v-model.number` (the .number
// modifier is applied by Vue on the parent side, so we simply emit the raw
// value and let it convert). Attributes such as type/min/max/inputmode/
// placeholder fall through to the native input.
import { computed } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string | number | null;
  icon?: string;
  trailingIcon?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  // Nuxt UI's style-override object. We honour the class hooks (`base`/`root`)
  // because pages use them as styling handles — the price row, for instance,
  // strips this control's border through `.price-number-input` so the field can
  // sit inside its own bordered wrapper without drawing a second box.
  ui?: { base?: string; root?: string };
  /** Show a clear (x) button while the field has a value. */
  clearable?: boolean;
  /** Accessible name for that button. */
  clearLabel?: string;
}>(), { size: "md" });

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
  (e: "clear"): void;
}>();

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}

const hasValue = computed(() => props.modelValue != null && String(props.modelValue) !== "");

function clear() {
  emit("update:modelValue", "");
  emit("clear");
}
</script>

<template>
  <div
      class="u-input ui-control ui-focusable"
      :class="[`ui-control_${size}`, { 'ui-control_disabled': disabled }, props.ui?.root, props.ui?.base, $attrs.class]"
  >
    <UIcon v-if="icon" :name="icon" class="u-input__icon" />
    <input
        v-bind="{ ...$attrs, class: undefined }"
        :value="modelValue ?? ''"
        :disabled="disabled"
        class="u-input__field"
        @input="onInput"
    />
    <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="u-input__clear"
        :aria-label="clearLabel || 'Clear'"
        @click="clear"
    >
      <UIcon name="i-lucide-x" />
    </button>
    <UIcon v-if="trailingIcon" :name="trailingIcon" class="u-input__icon" />
  </div>
</template>

<style scoped>
/* Layout and colours come from .ui-control (assets/css/ui.css). Only the parts
   specific to a text input live here. */
.u-input__field {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: var(--ui-control-font);
  line-height: 1.2;
  padding: 0;
}
.u-input__field::placeholder { color: var(--ui-control-placeholder); }
/* Number inputs keep their own alignment but lose the spinners, which look
   broken against a transparent field. */
.u-input__field[type="number"] { appearance: textfield; -moz-appearance: textfield; }
.u-input__field[type="number"]::-webkit-outer-spin-button,
.u-input__field[type="number"]::-webkit-inner-spin-button { appearance: none; margin: 0; }

.u-input__icon { color: var(--ui-control-placeholder); font-size: 1.05em; }

/* Clear button: sits inside the field, only while there is something to clear. */
.u-input__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-control-placeholder);
  line-height: 1;
  cursor: pointer;
  transition: color var(--ui-transition), background-color var(--ui-transition);
}
.u-input__clear:hover { color: var(--text-primary); background: rgba(255, 255, 255, 0.1); }
.u-input__clear:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
</style>
