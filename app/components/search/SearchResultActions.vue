<script setup lang="ts">
import type { SearchResultAction } from "~/types/search";

defineProps<{ actions: SearchResultAction[]; labels?: Partial<Record<SearchResultAction, string>> }>();
const emit = defineEmits<{ action: [action: SearchResultAction] }>();
</script>

<template>
  <div class="search-result-actions">
    <button v-for="action in actions" :key="action" type="button" :aria-label="labels?.[action] || action" @click.stop="emit('action', action)">
      <slot :name="action" :action="action">{{ labels?.[action] || action }}</slot>
    </button>
  </div>
</template>
