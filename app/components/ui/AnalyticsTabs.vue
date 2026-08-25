<script setup lang="ts">
export interface AnalyticsTabItem {
  value: string;
  label: string;
  count?: number;
}

withDefaults(defineProps<{
  modelValue: string;
  items: readonly AnalyticsTabItem[];
  ariaLabel?: string;
  compact?: boolean;
}>(), {
  ariaLabel: undefined,
  compact: false,
});

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div
    class="analytics-tabs"
    :class="{ 'analytics-tabs_compact': compact }"
    role="tablist"
    :aria-label="ariaLabel"
  >
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      role="tab"
      class="analytics-tabs__item"
      :class="{ 'analytics-tabs__item_active': modelValue === item.value }"
      :aria-selected="modelValue === item.value"
      @click="$emit('update:modelValue', item.value)"
    >
      <span>{{ item.label }}</span>
      <small v-if="item.count != null">{{ item.count }}</small>
    </button>
  </div>
</template>

<style scoped>
.analytics-tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  padding: 4px;
  border: 1px solid rgba(85, 111, 174, 0.34);
  border-radius: 10px;
  background: rgba(5, 10, 31, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
}
.analytics-tabs__item {
  min-height: 32px;
  padding: 6px 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}
.analytics-tabs__item:hover {
  color: var(--text-white);
  background: rgba(255, 255, 255, 0.04);
}
.analytics-tabs__item_active {
  color: var(--text-white);
  border-color: rgba(224, 103, 154, 0.42);
  background: linear-gradient(135deg, rgba(224, 103, 154, 0.23), rgba(122, 92, 255, 0.14));
  box-shadow: inset 0 0 0 1px rgba(224, 103, 154, 0.05), 0 4px 12px rgba(4, 7, 24, 0.2);
}
.analytics-tabs__item small {
  color: inherit;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.72;
}
.analytics-tabs_compact {
  padding: 3px;
  border-radius: 9px;
}
.analytics-tabs_compact .analytics-tabs__item {
  min-height: 28px;
  padding: 5px 9px;
  font-size: 10.5px;
}
@media (max-width: 620px) {
  .analytics-tabs {
    width: 100%;
  }
  .analytics-tabs__item {
    flex: 1 1 auto;
  }
}
</style>
