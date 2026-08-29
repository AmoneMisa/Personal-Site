<script setup lang="ts">
import { computed, ref } from "vue";

export interface SearchSourceOption {
  value: string;
  label?: string;
  labelKey?: string;
}

const props = withDefaults(defineProps<{
  modelValue: string;
  items: readonly SearchSourceOption[];
  toggleLabel?: string;
}>(), { toggleLabel: "" });
defineEmits<{ "update:modelValue": [value: string] }>();

// Collapsed by default: the active source is almost always "any", so the row of
// tabs is rarely worth its own space until someone actually wants to narrow it.
const expanded = ref(false);

const activeItem = computed(() => props.items.find((item) => item.value === props.modelValue));
</script>

<template>
  <div class="search-source-tabs">
    <button
      type="button"
      class="search-source-tabs__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <u-icon name="i-lucide-chevron-right" class="search-source-tabs__chevron" :class="{ 'search-source-tabs__chevron_open': expanded }" />
      <span>{{ toggleLabel }}</span>
      <span v-if="!expanded && activeItem" class="search-source-tabs__active">
        <slot name="label" :item="activeItem">{{ activeItem.label }}</slot>
      </span>
    </button>

    <div v-if="expanded" class="search-source-tabs__list">
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
  </div>
</template>

<style scoped>
.search-source-tabs { display: flex; flex-direction: column; gap: 8px; }
.search-source-tabs__toggle {
  display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
  min-height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px;
  background: rgba(255,255,255,.03); color: var(--ui-text-muted); font-size: 12px; font-weight: 700;
  cursor: pointer; transition: color 180ms ease, border-color 180ms ease;
}
.search-source-tabs__toggle:hover { color: var(--text-white); }
.search-source-tabs__chevron { font-size: 14px; transition: transform 160ms ease; }
.search-source-tabs__chevron_open { transform: rotate(90deg); }
.search-source-tabs__active { color: var(--accent-pink, #e0679a); text-transform: capitalize; }
.search-source-tabs__list { display: flex; flex-wrap: wrap; gap: 8px; }
.search-source-tabs__item { min-height: 34px; padding: 0 13px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,.03); color: var(--ui-text-muted); font-size: 12px; font-weight: 700; text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease, border-color 180ms ease, background-color 180ms ease; }
.search-source-tabs__item:hover { color: var(--text-white); }
.search-source-tabs__item_active { color: var(--text-white); border-color: rgba(224,103,154,.4); background: rgba(224,103,154,.18); }
</style>
