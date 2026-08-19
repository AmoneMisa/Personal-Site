<script setup lang="ts">
// Replacement for Nuxt UI's <UApp> provider. Nuxt UI used this to mount its
// toast/tooltip portals; our components need no provider, so this is just the
// root element and keeps app.vue unchanged.
</script>

<template>
  <div class="u-app"><slot /></div>
</template>

<style scoped>
.u-app { display: contents; }
</style>
