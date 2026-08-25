<script setup lang="ts">
import type { Job, JobAtsResult } from "~/types/jobs";
defineProps<{ items: Array<{ job: Job; ats: JobAtsResult | null }> }>();
defineSlots<{ default(props: { job: Job; ats: JobAtsResult | null }): unknown }>();
</script>

<template>
  <div class="job-grid"><slot v-for="item in items" :key="item.job.id" :job="item.job" :ats="item.ats" /></div>
</template>

<style scoped>
.job-grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: auto; }
/* Let CSS Grid equalize cards inside each row without forcing every implicit row
   to the height of the tallest card on the whole page. */
.job-grid :deep(.job-card) { height: 100%; min-height: 0; }
.job-grid :deep(.job-card__footer) { margin-top: 12px; padding-top: 0; }
.job-grid :deep(.job-card__salary-separator) { display: none; }
@media (min-width: 640px) { .job-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .job-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .job-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
