<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  loading?: boolean;
  loadingLabel?: string;
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
    <slot name="toolbar" />
    <UiResultsLoader v-if="loading !== undefined" :loading="loading" :label="loadingLabel" min-height="420px">
      <slot />
    </UiResultsLoader>
    <slot v-else />
    <slot name="floating" />
    <slot name="dialogs" />
  </u-container>
</template>
