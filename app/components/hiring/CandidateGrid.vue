<script setup lang="ts">
import type { HiringCvProfile } from "~/types/hiring";
defineProps<{ profiles: HiringCvProfile[]; dense?: boolean }>();
defineSlots<{ default(props: { profile: HiringCvProfile }): unknown }>();
</script>

<template>
  <div class="candidate-grid" :class="{ 'candidate-grid_dense': dense }">
    <slot v-for="profile in profiles" :key="profile.id" :profile="profile" />
  </div>
</template>

<style scoped>
.candidate-grid { display: grid; gap: 14px; grid-template-columns: 1fr; grid-auto-rows: 1fr; align-items: stretch; }
@media (min-width: 640px) { .candidate-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .candidate-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1180px) { .candidate-grid_dense { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1600px) { .candidate-grid { grid-template-columns: repeat(4, 1fr); } }
</style>
