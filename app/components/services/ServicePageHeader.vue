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
  <div class="background-hero text-center space-y-3">
    <page-header
        :title="title"
        :headline="headline"
        :description="description"
        class="mb-6"
        :is-centered="true"
    />
  </div>
</template>
