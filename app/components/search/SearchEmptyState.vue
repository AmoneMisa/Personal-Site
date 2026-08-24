<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="search-empty-state">
    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
    <slot />
  </div>
</template>
