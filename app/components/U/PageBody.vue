<script setup lang="ts">
// Replacement for Nuxt UI's <UPageBody>.
defineProps<{ ui?: unknown }>();
</script>

<template>
  <div class="u-page-body"><slot /></div>
</template>

<style scoped>
.u-page-body { display: block; }
</style>
