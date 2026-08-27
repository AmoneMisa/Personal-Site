<script setup lang="ts">
export interface SearchSourceOption {
  value: string;
  label?: string;
  labelKey?: string;
}

const props = defineProps<{ modelValue: string; items: readonly SearchSourceOption[] }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <div class="search-source-tabs">
    <button
      v-for="item in props.items"
      :key="item.value"
      type="button"
      class="search-source-tabs__item"
      :class="{ 'search-source-tabs__item_active': modelValue === item.value }"
      @click="$emit('update:modelValue', item.value)"
    >
      <slot name="label" :item="item">{{ item.label }}</slot>
    </button>
  </div>
</template>

<style scoped>
.search-source-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.search-source-tabs__item { min-height: 34px; padding: 0 13px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,.03); color: var(--ui-text-muted); font-size: 12px; font-weight: 700; text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease, border-color 180ms ease, background-color 180ms ease; }
.search-source-tabs__item:hover { color: var(--text-white); }
.search-source-tabs__item_active { color: var(--text-white); border-color: rgba(224,103,154,.4); background: rgba(224,103,154,.18); }
</style>
