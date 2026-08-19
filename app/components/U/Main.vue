<script setup lang="ts">
// Replacement for Nuxt UI's <UMain>: the page's main region.
defineProps<{ as?: string }>();
</script>

<template>
  <component :is="as || 'main'" class="u-main"><slot /></component>
</template>

<style scoped>
.u-main { display: block; }
</style>
