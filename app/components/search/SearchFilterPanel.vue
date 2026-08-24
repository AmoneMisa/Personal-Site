<script setup lang="ts">
import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";
import type { SearchFilterBlock } from "~/types/search";

withDefaults(defineProps<{
  tag?: "form" | "section" | "div";
  title?: string;
  resetLabel?: string;
  advanced?: boolean;
  advancedLabel?: string;
  blocks?: SearchFilterBlock[];
  advancedBlocks?: SearchFilterBlock[];
}>(), {
  tag: "section",
  blocks: () => [],
  advancedBlocks: () => [],
});
const emit = defineEmits<{
  reset: [];
  submit: [];
  "update:advanced": [value: boolean];
}>();
</script>

<template>
  <component :is="tag" class="search-filter-panel" @submit.prevent="emit('submit')">
    <div v-if="title || resetLabel" class="search-filter-panel__header">
      <h2 v-if="title">{{ title }}</h2>
      <button v-if="resetLabel" type="button" @click="emit('reset')">{{ resetLabel }}</button>
    </div>
    <slot />
    <SearchFilterBlocks v-if="blocks.length" :blocks="blocks">
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps || {}" />
      </template>
    </SearchFilterBlocks>
    <button
      v-if="advancedLabel"
      type="button"
      class="search-filter-panel__advanced"
      @click="emit('update:advanced', !advanced)"
    >
      {{ advancedLabel }}
    </button>
    <template v-if="advanced">
      <slot name="advanced-before" />
      <SearchFilterBlocks v-if="advancedBlocks.length" :blocks="advancedBlocks">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps || {}" />
        </template>
      </SearchFilterBlocks>
      <slot name="advanced" />
    </template>
    <slot name="footer" />
  </component>
</template>
