<script setup lang="ts">
import type { ActivitySummary } from "~/types/listingActivity";
defineProps<{ summary?: ActivitySummary }>();
defineEmits<{ open: [] }>();
const { t, locale } = useI18n();
const date = (value: string, time = false) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(locale.value, { day: "numeric", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } as const : {}) }) : "";
};
</script>

<template>
  <button v-if="summary?.firstSeenAt" type="button" class="listing-activity-line" @click.stop="$emit('open')">
    <u-icon name="i-lucide-history" aria-hidden="true" />
    <span><span v-if="summary.latestSourcePublishedAt" class="listing-activity-line__latest">{{ t("listingActivity.dateUpdated", { date: date(summary.latestSourcePublishedAt, true) }) }}</span>{{ t("listingActivity.since", { date: date(summary.firstSeenAt) }) }}<template v-if="summary.repostCount"> · {{ t("listingActivity.reposts", { n: summary.repostCount }) }}</template><template v-else-if="summary.dateUpdateCount"> · {{ t("listingActivity.updates", { n: summary.dateUpdateCount }) }}</template><template v-else-if="summary.reappearanceCount"> · {{ t("listingActivity.reappearances", { n: summary.reappearanceCount }) }}</template></span>
    <u-icon name="i-lucide-chevron-right" class="listing-activity-line__arrow" aria-hidden="true" />
  </button>
</template>

<style scoped>
.listing-activity-line { display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; min-height: 32px; margin-top: 5px; padding: 7px 0 0; border: 0; border-top: 1px solid var(--line); background: transparent; color: var(--text-muted); font-size: 11.5px; line-height: 1.4; text-align: left; cursor: pointer; }
.listing-activity-line span { min-width: 0; overflow-wrap: anywhere; }
.listing-activity-line__latest { display: block; color: var(--text-soft); }
.listing-activity-line :deep(svg) { width: 13px; height: 13px; flex-shrink: 0; }
.listing-activity-line__arrow { margin-left: auto; color: var(--accent-pink); }
.listing-activity-line:hover { color: var(--text-primary); }
.listing-activity-line:focus-visible { outline: 2px solid var(--accent-pink); outline-offset: 2px; }
@media (pointer: coarse) { .listing-activity-line { min-height: 44px; } }
</style>
