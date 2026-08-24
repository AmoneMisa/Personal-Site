<script setup lang="ts">
import type { JobStatEntry, JobStats, WorkModeStat } from "~/types/jobs";

defineProps<{
  stats: JobStats;
  displayCurrency: string;
  displayPeriodLabel: string;
  countryStats: JobStatEntry[];
  sourceStats: JobStatEntry[];
  workModeStats: WorkModeStat[];
  languageStats: [string, number][];
  money: (annualUsd: number) => string;
  countryLabel: (code: string) => string;
}>();

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`jobs.${key}`, params);
</script>

<template>
  <section class="stats">
    <div class="stats__head"><u-icon name="i-lucide-bar-chart-3" class="stats__icon" /><span class="stats__title">{{ t("statsTitle") }}</span></div>
    <div class="stats__grid">
      <div class="stats__card">
        <div class="stats__label">{{ t("statsSalary") }} ({{ displayCurrency }}/{{ displayPeriodLabel }})</div>
        <template v-if="stats.salary.count">
          <div class="stats__big">{{ money(stats.salary.medianUsd) }}</div>
          <div class="stats__sub text-muted">{{ t("statAvg") }} {{ money(stats.salary.avgUsd) }} · {{ t("statRange") }} {{ money(stats.salary.minUsd) }}–{{ money(stats.salary.maxUsd) }}</div>
          <div class="stats__sub text-muted">{{ t("statSamples", { n: stats.salary.count }) }}</div>
        </template>
        <div v-else class="stats__sub text-muted">{{ t("statNone") }}</div>
      </div>
      <div v-if="countryStats.length" class="stats__card">
        <div class="stats__label">{{ t("statByCountry") }}</div>
        <div v-for="[code, value] in countryStats.slice(0, 6)" :key="code" class="stats__row"><span class="stats__row-key">{{ countryLabel(code) }}</span><span class="stats__row-val">{{ money(value.medianUsd) }} <em class="text-muted">({{ value.count }})</em></span></div>
      </div>
      <div v-if="sourceStats.length" class="stats__card">
        <div class="stats__label">{{ t("statBySource") }}</div>
        <div v-for="[source, value] in sourceStats.slice(0, 6)" :key="source" class="stats__row"><span class="stats__row-key">{{ source }}</span><span class="stats__row-val">{{ money(value.medianUsd) }} <em class="text-muted">({{ value.count }})</em></span></div>
      </div>
      <div v-if="workModeStats.length" class="stats__card">
        <div class="stats__label">{{ t("statByMode") }}</div>
        <div v-for="mode in workModeStats" :key="mode.key" class="stats__row"><span class="stats__row-key">{{ t("wm" + mode.key.charAt(0).toUpperCase() + mode.key.slice(1)) }}</span><span class="stats__row-val">{{ mode.n }}</span></div>
        <div class="stats__row stats__row_hl"><span class="stats__row-key">{{ t("foreigner") }}</span><span class="stats__row-val">{{ stats.foreignerFriendly }}</span></div>
      </div>
      <div v-if="languageStats.length" class="stats__card">
        <div class="stats__label">{{ t("statLanguages") }}</div>
        <div class="stats__chips"><span v-for="[language, count] in languageStats" :key="language" class="stats__chip">{{ language }} · {{ count }}</span></div>
      </div>
      <div v-if="stats.topSkills.length" class="stats__card stats__card_wide">
        <div class="stats__label">{{ t("statTopSkills") }}</div>
        <div class="stats__chips"><span v-for="skill in stats.topSkills" :key="skill.skill" class="stats__chip stats__chip_skill">{{ skill.skill }} · {{ skill.count }}</span></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stats { margin: 4px 0 26px; padding: 16px; border-radius: 10px; border: 1px solid var(--line); background: rgba(52,211,153,.05); }
.stats__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.stats__icon { font-size: 20px; color: #34d399; }
.stats__title { font-weight: 600; }
.stats__grid { display: grid; gap: 12px; grid-template-columns: 1fr; }
.stats__card { padding: 12px 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,.03); }
.stats__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; opacity: .7; margin-bottom: 8px; }
.stats__big { font-size: 26px; font-weight: 600; color: #34d399; }
.stats__sub { font-size: 12px; margin-top: 2px; }
.stats__row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 2px 0; }
.stats__row_hl { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; }
.stats__row-key, .stats__row-val { font-weight: 600; }
.stats__row-val { white-space: nowrap; }
.stats__row-val em { font-weight: 500; font-style: normal; font-size: 11px; }
.stats__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stats__chip { font-size: 12px; padding: 2px 9px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.stats__chip_skill { border-color: rgba(224,103,154,.35); color: #e79ec0; }
@media (min-width: 640px) { .stats__grid { grid-template-columns: 1fr 1fr; } .stats__card_wide { grid-column: 1 / -1; } }
@media (min-width: 1000px) { .stats__grid { grid-template-columns: repeat(3,1fr); } }
</style>
