<script setup lang="ts">
export interface SearchViewTab {
  value: string;
  label: string;
  count?: number;
}

defineProps<{
  modelValue: string;
  items: SearchViewTab[];
  ariaLabel?: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="search-view-tabs" :aria-label="ariaLabel">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="search-view-tabs__item"
      :class="{ 'search-view-tabs__item_active': modelValue === item.value }"
      @click="$emit('update:modelValue', item.value)"
    >
      {{ item.label }}<template v-if="item.count != null"> · {{ item.count }}</template>
    </button>
  </div>
</template>

<style scoped>
.search-view-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-left: 12px;
  border-left: 1px solid var(--line);
}

.search-view-tabs__item {
  min-height: 34px;
  padding: 0 13px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: filter 180ms ease, color 180ms ease, border-color 180ms ease, background-color 180ms ease;
}

.search-view-tabs__item:hover { color: var(--text-white); }
.search-view-tabs__item_active {
  color: var(--text-white);
  border-color: rgba(224, 103, 154, 0.4);
  background: rgba(224, 103, 154, 0.18);
}

@media (max-width: 640px) {
  .search-view-tabs {
    width: 100%;
    padding-left: 0;
    border-left: 0;
  }
  .search-view-tabs__item { flex: 1 1 auto; }
}
</style>
