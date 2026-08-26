<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";

withDefaults(defineProps<{
  backdrop: string;
  title: string;
  headline?: string;
  description?: string;
}>(), {
  headline: undefined,
  description: undefined,
});
</script>

<template>
  <ocean-page-backdrop :variant="backdrop" />
  <div class="service-page-header background-hero text-center space-y-3">
    <page-header
        :title="title"
        :headline="headline"
        :description="description"
        :is-centered="true"
    />
  </div>
</template>

<style>
/*
 * All service tools are intentionally allowed to keep their own internal UI,
 * but they share one outer grid. This prevents the service pages from jumping
 * between narrow, full-width and differently-spaced layouts.
 */
.service-page-header {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding-inline: 24px;
  box-sizing: border-box;
}

.service-page-header + * {
  width: min(100%, 1440px) !important;
  max-width: 1440px !important;
  margin: 28px auto 0 !important;
  box-sizing: border-box;
}

/* Direct tool surfaces get the same visual frame without touching nested
 * editors/previews, which all have service-specific behavior. */
.service-page-header + section,
.service-page-header + .tabs-row {
  border: 1px solid var(--color-border, var(--line));
  border-radius: 14px;
  background: var(--secondary-bg-gradient, rgba(255, 255, 255, 0.025));
  box-shadow: var(--shadow-light, inset 0 1px 0 rgba(255, 255, 255, 0.04));
}

@media (max-width: 767px) {
  .service-page-header {
    padding-inline: 16px;
  }

  .service-page-header + * {
    margin-top: 20px !important;
  }
}
</style>
