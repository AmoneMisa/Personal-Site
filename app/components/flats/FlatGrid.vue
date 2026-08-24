<script setup lang="ts">
import type { FlatListing } from "~/types/flats";
defineProps<{ listings: FlatListing[] }>();
defineSlots<{ default(props: { listing: FlatListing }): unknown }>();
</script>

<template>
  <div class="flat-grid"><slot v-for="listing in listings" :key="`${listing.source}:${listing.country}:${listing.id}`" :listing="listing" /></div>
</template>

<style scoped>
.flat-grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: 1fr; }
@media (min-width: 640px) { .flat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .flat-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .flat-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 1800px) { .flat-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
</style>
