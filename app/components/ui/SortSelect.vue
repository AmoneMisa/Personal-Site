<script setup lang="ts">
export interface SortSelectItem {
  label: string;
  value: string;
}

defineProps<{
  modelValue: string;
  items: SortSelectItem[];
  label: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <label class="sort-select">
    <span class="sort-select__icon" aria-hidden="true">
      <u-icon name="i-lucide-arrow-down-wide-narrow" />
    </span>
    <span class="sort-select__label">{{ label }}</span>
    <u-select-menu
      :model-value="modelValue"
      :items="items"
      value-key="value"
      label-key="label"
      :search-input="false"
      :aria-label="label"
      class="sort-select__control"
      @update:model-value="$emit('update:modelValue', $event as string)"
    />
  </label>
</template>

<style scoped>
.sort-select {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.sort-select__icon {
  display: grid;
  place-items: center;
  color: var(--ui-text-muted);
  font-size: 20px;
}

.sort-select__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sort-select__control {
  width: 100%;
  min-width: 0;
}

.sort-select__control :deep(button) {
  width: 100%;
  min-width: 0;
}

.sort-select__control :deep(button > span:first-child) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
