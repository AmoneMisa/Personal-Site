<script setup lang="ts">
import type { SearchMatchTier } from "~/types/search";

defineProps<{ value: number; tier: SearchMatchTier; suffix?: string }>();
</script>

<template>
  <span class="search-match-badge" :class="`search-match-badge_${tier}`">{{ Math.round(value) }}{{ suffix ?? '%' }}</span>
</template>

<style scoped>
.search-match-badge { display: inline-flex; align-items: center; white-space: nowrap; font-size: 11px; font-weight: 700; padding: 2px 8px; border: 1px solid currentColor; border-radius: 7px; background: rgba(2,6,23,.18); }
.search-match-badge_good { color: #34d399; }.search-match-badge_warning { color: #fbbf24; }.search-match-badge_bad { color: #f87171; }
</style>
