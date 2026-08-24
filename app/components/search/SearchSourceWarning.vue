<script setup lang="ts">
defineProps<{ title?: string; message: string }>();
</script>

<template>
  <aside class="search-source-warning" role="status">
    <strong v-if="title">{{ title }}</strong>
    <p>{{ message }}</p>
    <slot />
  </aside>
</template>
