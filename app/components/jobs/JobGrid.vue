<script setup lang="ts">
import type { Job, JobAtsResult } from "~/types/jobs";
defineProps<{ items: Array<{ job: Job; ats: JobAtsResult | null }> }>();
defineSlots<{ default(props: { job: Job; ats: JobAtsResult | null }): unknown }>();
</script>

<template>
  <div class="job-grid"><slot v-for="item in items" :key="item.job.id" :job="item.job" :ats="item.ats" /></div>
</template>

<style scoped>
.job-grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: start; grid-auto-rows: auto; }
/* Cards used to be stretched to the tallest card in each grid row while their
   footer also had margin-top:auto. That combination created the large blank
   area visible between the description and ATS chips. Keep cards content-sized. */
.job-grid :deep(.job-card) { height: auto; min-height: 0; }
.job-grid :deep(.job-card__footer) { margin-top: 12px; padding-top: 0; }
@media (min-width: 640px) { .job-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .job-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .job-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
