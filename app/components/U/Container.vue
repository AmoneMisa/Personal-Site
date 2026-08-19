<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UContainer>: a centred, max-width page
// wrapper with responsive gutters.
defineProps<{ as?: string; ui?: unknown }>();
</script>

<template>
  <component :is="as || 'div'" class="u-container">
    <slot />
  </component>
</template>

<style scoped>
.u-container {
  width: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: 16px;
}
@media (min-width: 640px) { .u-container { padding-inline: 24px; } }
@media (min-width: 1024px) { .u-container { padding-inline: 32px; } }
</style>
