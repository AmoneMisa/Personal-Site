<script setup lang="ts">
// The "more filters / hide filters" button on its own, so a page can place it
// wherever its layout wants (the flat finder puts it in the filter footer)
// without SearchAdvancedFilters teleporting it there after hydration.
const open = defineModel<boolean>({ default: false });

withDefaults(defineProps<{
  label: string;
  hideLabel?: string;
}>(), {
  hideLabel: "",
});
</script>

<template>
  <button
    type="button"
    class="search-advanced-toggle"
    :aria-expanded="open"
    @click="open = !open"
  >
    <u-icon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-right'" />
    <span>{{ open ? (hideLabel || label) : label }}</span>
  </button>
</template>

<style scoped>
.search-advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ui-text-muted);
  font-size: 13px;
  font-weight: 650;
  line-height: 1.25;
  cursor: pointer;
}
.search-advanced-toggle:hover { color: var(--text-white); }
</style>
