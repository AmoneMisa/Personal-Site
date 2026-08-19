<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UInput>.
//
// Keeps v-model working with both `v-model` and `v-model.number` (the .number
// modifier is applied by Vue on the parent side, so we simply emit the raw
// value and let it convert). Attributes such as type/min/max/inputmode/
// placeholder fall through to the native input.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{
  modelValue?: string | number | null;
  icon?: string;
  trailingIcon?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  ui?: unknown; // accepted and ignored (Nuxt UI style override)
}>(), { size: "md" });

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
}>();

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="u-input ui-focusable" :class="[`u-input_${size}`, { 'u-input_disabled': disabled }, $attrs.class]">
    <UIcon v-if="icon" :name="icon" class="u-input__icon" />
    <input
        v-bind="{ ...$attrs, class: undefined }"
        :value="modelValue ?? ''"
        :disabled="disabled"
        class="u-input__field"
        @input="onInput"
    />
    <UIcon v-if="trailingIcon" :name="trailingIcon" class="u-input__icon" />
  </div>
</template>

<style scoped>
.u-input {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: var(--ui-control-h-md);
  padding-inline: var(--ui-control-px);
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  background: var(--ui-control-bg);
  color: var(--ui-control-text);
  transition: border-color var(--ui-transition), box-shadow var(--ui-transition);
}
.u-input_sm { min-height: var(--ui-control-h-sm); padding-inline: 9px; }
.u-input_lg { min-height: var(--ui-control-h-lg); }
.u-input_disabled { opacity: 0.6; }

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
</style>
