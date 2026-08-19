<script setup lang="ts">
// Replacement for Nuxt UI's <UPage> layout wrapper.
defineProps<{ ui?: unknown }>();
</script>

<template>
  <div class="u-page"><slot /></div>
</template>

<style scoped>
.u-page { display: flex; flex-direction: column; gap: 28px; padding-block: 32px; }
@media (min-width: 1024px) { .u-page { gap: 32px; } }
</style>
