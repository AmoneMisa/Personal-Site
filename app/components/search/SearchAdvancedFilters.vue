<script setup lang="ts">
import SearchAdvancedToggle from "~/components/search/SearchAdvancedToggle.vue";

const open = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
  label: string;
  hideLabel?: string;
  /** The page renders SearchAdvancedToggle itself (e.g. in its filter footer). */
  externalToggle?: boolean;
}>(), {
  hideLabel: "",
  externalToggle: false,
});
</script>

<template>
  <div class="search-advanced-filters">
    <div v-if="!externalToggle" class="search-advanced-filters__toggle">
      <SearchAdvancedToggle v-model="open" :label="label" :hide-label="hideLabel" />
    </div>

    <div v-if="open" class="search-advanced-filters__panel">
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.search-advanced-filters {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 8px;
}
.search-advanced-filters__toggle {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}
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
.search-advanced-filters__panel > :deep(.search-filter-blocks) {
  grid-column: 1 / -1;
}

@include bp-down(md) {
  .search-advanced-filters__toggle {
    margin-top: 2px;
    padding: 12px 12px 0;
    border-top: 1px solid var(--line);
  }

  .search-advanced-filters__toggle :deep(.search-advanced-toggle) {
    width: 100%;
    min-height: 44px;
    padding: 0 2px;
    justify-content: flex-start;
    font-size: 14px;
  }
}

@include bp-up(md) {
  .search-advanced-filters__panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
