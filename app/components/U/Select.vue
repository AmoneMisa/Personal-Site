<script setup lang="ts">
// Single-value select built on the existing themed SelectMenu rather than a
// native <select>. Native option popups ignore most of the site's dark theme
// (Windows in particular paints the active option blue), which made service
// pages look like they were using a different component library.
import { computed } from "vue";
import SelectMenu from "./SelectMenu.vue";

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
  label?: string;
  name?: string;
}>(), { items: () => [] });

const emit = defineEmits<{ (e: "update:modelValue", value: string | number | null): void }>();

const labelProp = computed(() => props.optionAttribute || props.labelKey || "label");
const valueProp = computed(() => props.valueAttribute || props.valueKey || "value");

const options = computed(() =>
  (props.items || []).map((item) =>
    item != null && typeof item === "object"
      ? { label: String(item[labelProp.value] ?? ""), value: item[valueProp.value] }
      : { label: String(item), value: item },
  ),
);

function update(value: unknown) {
  emit("update:modelValue", value as string | number | null);
}
</script>

<template>
  <div class="u-select" :class="$attrs.class">
    <SelectMenu
        :model-value="modelValue"
        :items="options"
        label-key="label"
        value-key="value"
        :placeholder="placeholder"
        :disabled="disabled"
        :label="label"
        :search-input="false"
        :ui="ui"
        v-bind="{ ...$attrs, class: undefined }"
        @update:model-value="update"
    />
    <input
        v-if="name"
        type="hidden"
        :name="name"
        :value="modelValue == null ? '' : String(modelValue)"
    />
  </div>
</template>

<style scoped>
.u-select {
  display: block;
  min-width: 0;
}

.u-select :deep(.u-select-menu),
.u-select :deep(.u-select-menu__trigger) {
  width: 100%;
}
</style>
