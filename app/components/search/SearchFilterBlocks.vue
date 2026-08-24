<script setup lang="ts">
import SearchFilterControl from "~/components/search/SearchFilterControl.vue";
import UiFilterSection from "~/components/ui/FilterSection.vue";
import type { SearchFilterBlock } from "~/types/search";

defineProps<{ blocks: SearchFilterBlock[] }>();
</script>

<template>
  <div class="search-filter-blocks">
    <UiFilterSection
      v-for="block in blocks"
      :key="block.id"
      :title="block.title"
      :icon="block.icon"
      :class="block.class"
    >
      <slot :name="`block-${block.id}`" :block="block">
        <div class="search-filter-blocks__grid" :class="block.gridClass">
          <SearchFilterControl v-for="field in block.fields" :key="field.id" :field="field">
            <template #default="slotProps">
              <slot :name="`field-${field.id}`" v-bind="slotProps" />
            </template>
          </SearchFilterControl>
        </div>
      </slot>
    </UiFilterSection>
  </div>
</template>

<style scoped>
.search-filter-blocks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.search-filter-blocks__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 760px) {
  .search-filter-blocks,
  .search-filter-blocks__grid { grid-template-columns: 1fr; }
}
</style>
