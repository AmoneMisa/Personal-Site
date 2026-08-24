<script setup lang="ts">
import type { Job, JobAtsResult } from "~/types/jobs";
defineProps<{ items: Array<{ job: Job; ats: JobAtsResult | null }> }>();
defineSlots<{ default(props: { job: Job; ats: JobAtsResult | null }): unknown }>();
</script>

<template>
  <div class="job-grid"><slot v-for="item in items" :key="item.job.id" :job="item.job" :ats="item.ats" /></div>
</template>

<style scoped>
.job-grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: 1fr; }
@media (min-width: 640px) { .job-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .job-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .job-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
