<script setup lang="ts">
defineProps<{ label?: string }>();
</script>

<template>
  <div class="search-loading-state" role="status" aria-live="polite">
    <span class="search-loading-state__indicator" aria-hidden="true" />
    <span v-if="label">{{ label }}</span>
  </div>
</template>
