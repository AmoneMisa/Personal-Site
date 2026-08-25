<script setup lang="ts">
withDefaults(defineProps<{
  dense?: boolean;
  equalRows?: boolean;
}>(), {
  dense: false,
  equalRows: false,
});
</script>

<template>
  <div
    class="search-result-grid"
    :class="{
      'search-result-grid_dense': dense,
      'search-result-grid_equal': equalRows,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.search-result-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: stretch;
}
.search-result-grid_equal { grid-auto-rows: 1fr; }
@media (min-width: 640px) {
  .search-result-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .search-result-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1180px) {
  .search-result-grid_dense { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (min-width: 1440px) {
  .search-result-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
