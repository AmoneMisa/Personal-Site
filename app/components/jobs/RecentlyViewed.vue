<script setup lang="ts">
import type { RecentJob } from "~/types/jobs";

defineProps<{ jobs: RecentJob[] }>();
const emit = defineEmits<{ open: [id: string] }>();
const { t: translate } = useI18n();
const t = (key: string) => translate(`jobs.${key}`);
</script>

<template>
  <section v-if="jobs.length" class="recent">
    <div class="recent__title">{{ t("recentlyViewed") }}</div>
    <div class="recent__row">
      <button v-for="job in jobs" :key="job.id" type="button" class="recent__chip" @click="emit('open', job.id)">
        <span class="recent__chip-title">{{ job.title }}</span>
        <span class="recent__chip-company">{{ job.company }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.recent { margin: 6px 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.recent__title { font-size: 13px; font-weight: 700; opacity: .9; margin-bottom: 9px; }
.recent__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.recent__chip { display: flex; flex-direction: column; gap: 2px; text-align: left; min-width: 0; padding: 10px 13px; border-radius: 9px; border: 1px solid var(--line); background: linear-gradient(145deg, rgba(255,255,255,.05), rgba(255,255,255,.025)); cursor: pointer; transition: border-color 160ms ease; }
.recent__chip:hover { border-color: rgba(224,103,154,.4); }
.recent__chip-title { font-size: 12.5px; font-weight: 600; color: var(--text-white, inherit); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent__chip-company { font-size: 11px; color: var(--ui-text-muted); }
</style>
