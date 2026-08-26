<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  className?: string;
  headerClass?: string;
  titleClass?: string;
  descriptionClass?: string;
}>();
</script>

<template>
  <u-container :class="['search-page', className]">
    <slot name="backdrop"><ocean-page-backdrop /></slot>
    <slot name="header">
      <header :class="['search-page__header text-center space-y-3', headerClass]">
        <h1 :class="['search-page__title', titleClass]">{{ title }}</h1>
        <p v-if="description" :class="['search-page__description text-muted mx-auto', descriptionClass]">{{ description }}</p>
      </header>
    </slot>
    <slot />
  </u-container>
</template>

<style scoped>
.search-page {
  min-width: 0;
  max-width: 100%;
  overflow-x: clip;
}

.search-page > * {
  min-width: 0;
}
</style>
