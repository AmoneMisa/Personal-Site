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
        :class="{ 'search-advanced-filters__button_open': open }"
        :aria-expanded="open"
        @click="open = !open"
      >
        <u-icon
          class="search-advanced-filters__icon"
          :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'"
        />
        <span>{{ open ? (hideLabel || label) : label }}</span>
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
.search-advanced-filters__button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: rgba(230, 233, 248, 0.82);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.25;
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease;
}
.search-advanced-filters__icon {
  flex: 0 0 auto;
  color: rgba(205, 211, 239, 0.82);
  font-size: 16px;
  transition: color 160ms ease;
}
.search-advanced-filters__button:hover {
  color: var(--text-white, #fff);
  border-color: rgba(132, 119, 220, 0.28);
  background: rgba(255, 255, 255, 0.045);
}
.search-advanced-filters__button:hover .search-advanced-filters__icon,
.search-advanced-filters__button_open .search-advanced-filters__icon {
  color: rgba(224, 191, 255, 0.96);
}
.search-advanced-filters__button_open {
  color: var(--text-white, #fff);
  background: rgba(128, 90, 245, 0.08);
}
.search-advanced-filters__button:focus-visible {
  outline: 2px solid rgba(205, 153, 255, 0.72);
  outline-offset: 2px;
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

@media (max-width: 699px) {
  .search-advanced-filters__toggle {
    margin-top: 2px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }

  .search-advanced-filters__button {
    width: 100%;
    min-height: 44px;
    padding: 0 8px;
    justify-content: flex-start;
    font-size: 14px;
  }
}

@media (min-width: 700px) {
  .search-advanced-filters__panel { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
