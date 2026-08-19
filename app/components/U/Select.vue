<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <USelect>.
//
// Unlike SelectMenu (custom listbox, multi-select, search) this is a plain
// native <select>: the call sites only need single choice from a short list,
// and the native control gives correct keyboard and mobile behaviour for free.
// Both prop namings used in the app are supported: option-attribute /
// value-attribute and label-key / value-key.
import { computed } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string | number | null;
  items?: any[];
  optionAttribute?: string;
  valueAttribute?: string;
  labelKey?: string;
  valueKey?: string;
  placeholder?: string;
  disabled?: boolean;
  ui?: unknown;
}>(), { items: () => [] });

const emit = defineEmits<{ (e: "update:modelValue", value: string | number): void }>();

const labelProp = computed(() => props.optionAttribute || props.labelKey || "label");
const valueProp = computed(() => props.valueAttribute || props.valueKey || "value");

const options = computed(() =>
  (props.items || []).map((item) =>
    item != null && typeof item === "object"
      ? { label: String(item[labelProp.value] ?? ""), value: item[valueProp.value] }
      : { label: String(item), value: item },
  ),
);
</script>

<template>
  <div class="u-select" :class="$attrs.class">
    <select
        class="u-select__control ui-control ui-focusable"
        :value="modelValue ?? ''"
        :disabled="disabled"
        v-bind="{ ...$attrs, class: undefined }"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="(option, index) in options" :key="String(option.value) + index" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <UIcon name="i-lucide-chevron-down" class="u-select__chevron" />
  </div>
</template>

<style scoped>
.u-select { position: relative; display: block; min-width: 0; }

/* Base surface comes from .ui-control; only select-specific bits are here. */
.u-select__control {
  /* Room for the chevron drawn on top of the native control. */
  padding-right: 32px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
/* The popup is rendered by the OS, so its options need explicit colours. */
.u-select__control option { background: var(--bg-panel, #131730); color: var(--text-primary, #eef0f7); }

.u-select__chevron {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--ui-control-placeholder);
}
</style>
