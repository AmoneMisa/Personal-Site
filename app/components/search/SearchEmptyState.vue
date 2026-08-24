<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<template>
  <div class="search-empty-state">
    <div class="text-muted">{{ message }}</div>
    <slot />
  </div>
</template>

<style scoped>
.search-empty-state { margin-top: 18px; padding: 18px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-panel); text-align: center; }
</style>
