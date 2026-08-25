<script setup lang="ts">
const open = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
  label: string;
  hideLabel?: string;
}>(), {
  hideLabel: "",
});
</script>

<template>
  <div class="search-advanced-filters">
    <div class="search-advanced-filters__toggle">
      <button
        type="button"
        class="search-advanced-filters__button"
        :aria-expanded="open"
        @click="open = !open"
      >
        <u-icon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
        {{ open && hideLabel ? hideLabel : label }}
      </button>
    </div>

    <div v-if="open" class="search-advanced-filters__panel">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.search-advanced-filters {
  grid-column: 1 / -1;
  display: grid;
  min-width: 0;
  gap: 8px;
}
.search-advanced-filters__toggle {
  display: flex;
  align-items: center;
  min-width: 0;
}
.search-advanced-filters__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
}
.search-advanced-filters__button:hover { color: var(--text-white); }
.search-advanced-filters__panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}
.search-advanced-filters__panel::before,
.search-advanced-filters__panel::after {
  content: "";
  position: absolute;
  z-index: 0;
  border: 1px solid rgba(75, 145, 255, 0.1);
  border-radius: 999px;
  pointer-events: none;
}
.search-advanced-filters__panel::before {
  width: 8px;
  height: 8px;
  left: calc(50% - 4px);
  top: 49%;
  box-shadow: 0 -142px 0 -2px rgba(67, 119, 221, 0.07);
}
.search-advanced-filters__panel::after {
  width: 6px;
  height: 6px;
  right: 1.4%;
  top: 24%;
  border-color: rgba(207, 92, 220, 0.1);
  box-shadow: 0 250px 0 -1px rgba(118, 83, 226, 0.06);
}
.search-advanced-filters__panel > :deep(*) {
  position: relative;
  z-index: 1;
}
@media (min-width: 700px) {
  .search-advanced-filters__panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
