<script setup lang="ts">
import type { Job, JobStats } from "~/types/jobs";
import { locationLabel } from "~/utils/locationLabels";
import { canonicalCityValue } from "~~/shared/locationCatalog";

const props = defineProps<{
  jobs: Job[];
  stats: JobStats;
  displayCurrency: string;
  displayPeriodLabel: string;
  money: (annualUsd: number) => string;
  countryLabel: (code: string) => string;
}>();

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`jobs.${key}`, params);
const activeTab = ref<"overview" | "trends">("overview");
const trendDays = ref<1 | 3 | 7 | 60>(7);
const trendScope = ref<"world" | "country" | "city" | "position" | "positions">("world");
const colors = ["#e0679a", "#45c8ff", "#a78bfa", "#34d399"];
const countryStats = computed(() => Object.entries(props.stats.byCountry ?? {}).filter(([, value]) => value.medianUsd > 0).sort((a, b) => b[1].medianUsd - a[1].medianUsd));
const sourceStats = computed(() => Object.entries(props.stats.bySource ?? {}).filter(([, value]) => value.medianUsd > 0).sort((a, b) => b[1].medianUsd - a[1].medianUsd));
const languageStats = computed(() => Object.entries(props.stats.byLanguage ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8));
const workModeStats = computed(() => [
  { key: "remote", n: props.stats.byWorkMode?.remote ?? 0 },
  { key: "hybrid", n: props.stats.byWorkMode?.hybrid ?? 0 },
  { key: "office", n: props.stats.byWorkMode?.office ?? 0 },
].filter((item) => item.n > 0));

type SalaryPoint = { at: number; salary: number; group: string };

function salary(job: Job): number | null {
  if (job.salaryUsd != null && Number.isFinite(job.salaryUsd) && job.salaryUsd > 0) return job.salaryUsd;
  if (String(job.salaryCurrency || "").toUpperCase() !== "USD") return null;
  const values = [job.salaryMin, job.salaryMax].filter((value): value is number => value != null && value > 0);
  if (!values.length) return null;
  const base = values.reduce((sum, value) => sum + value, 0) / values.length;
  return job.salaryPeriod === "hour" ? base * 2080 : job.salaryPeriod === "month" ? base * 12 : base;
}

function groupKey(job: Job): string {
  if (trendScope.value === "country") return job.country || t("trendUnknown");
  if (trendScope.value === "city") return canonicalCityValue(job.city || job.location || t("trendUnknown"));
  if (trendScope.value === "position") return job.title || t("trendUnknown");
  if (trendScope.value === "positions") return t("trendPositionSet");
  return t("trendWorld");
}

const chart = computed(() => {
  const end = Date.now();
  const start = end - trendDays.value * 86_400_000;
  const bucketCount = trendDays.value === 1 ? 6 : trendDays.value === 3 ? 6 : trendDays.value === 7 ? 7 : 8;
  const bucketMs = (end - start) / bucketCount;
  const points: SalaryPoint[] = props.jobs.flatMap((job) => {
    const value = salary(job);
    const at = new Date(job.postedAt).getTime();
    return value == null || !Number.isFinite(at) || at < start || at > end ? [] : [{ at, salary: value, group: groupKey(job) }];
  });
  const counts = new Map<string, number>();
  for (const point of points) counts.set(point.group, (counts.get(point.group) || 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => key);
  const raw = groups.map((group) => {
    const buckets = Array.from({ length: bucketCount }, () => [] as number[]);
    for (const point of points) {
      if (point.group !== group) continue;
      const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((point.at - start) / bucketMs)));
      buckets[index].push(point.salary);
    }
    return { group, values: buckets.map((bucket) => bucket.length ? bucket.sort((a, b) => a - b)[Math.floor(bucket.length / 2)] : null) };
  });
  const lines = raw.map((line, lineIndex) => ({
    label: trendScope.value === "country"
      ? props.countryLabel(line.group)
      : trendScope.value === "city" ? locationLabel(line.group, locale.value, "city") : line.group,
    color: colors[lineIndex],
    values: line.values,
  }));
  const labels = Array.from({ length: bucketCount }, (_, index) => {
    const date = new Date(start + index * bucketMs);
    return trendDays.value === 1
      ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  });
  return { sampleCount: points.length, lines, labels };
});

const periodOptions = computed(() => [
  { value: 1, label: t("trendDay") }, { value: 3, label: t("trendThreeDays") },
  { value: 7, label: t("trendWeek") }, { value: 60, label: t("trendTwoMonths") },
]);
const scopeOptions = computed(() => [
  { value: "world", label: t("trendWorld") }, { value: "country", label: t("trendCountries") },
  { value: "city", label: t("trendCities") }, { value: "position", label: t("trendPositions") },
  { value: "positions", label: t("trendPositionSet") },
]);
</script>

<template>
  <UiAnalyticsPanel class="stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <template #controls>
      <nav class="stats__tabs" :aria-label="t('statsTabs')">
        <button type="button" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">{{ t("statsOverview") }}</button>
        <button type="button" :class="{ active: activeTab === 'trends' }" @click="activeTab = 'trends'">{{ t("statsTrends") }}</button>
      </nav>
    </template>

    <div v-if="activeTab === 'overview'" class="stats__grid">
      <article class="stats__card stats__card_salary"><div class="stats__label">{{ t("statsSalary") }} ({{ displayCurrency }}/{{ displayPeriodLabel }})</div><template v-if="stats.salary.count"><div class="stats__big">{{ money(stats.salary.medianUsd) }}</div><div class="stats__sub">{{ t("statAvg") }} {{ money(stats.salary.avgUsd) }} · {{ t("statRange") }} {{ money(stats.salary.minUsd) }}–{{ money(stats.salary.maxUsd) }}</div><div class="stats__sub">{{ t("statSamples", { n: stats.salary.count }) }}</div></template><div v-else class="stats__sub">{{ t("statNone") }}</div></article>
      <article v-if="countryStats.length" class="stats__card"><div class="stats__label">{{ t("statByCountry") }}</div><div v-for="[code, value] in countryStats.slice(0, 6)" :key="code" class="stats__row"><span>{{ countryLabel(code) }}</span><strong>{{ money(value.medianUsd) }} <em>({{ value.count }})</em></strong></div></article>
      <article v-if="sourceStats.length" class="stats__card"><div class="stats__label">{{ t("statBySource") }}</div><div v-for="[source, value] in sourceStats.slice(0, 6)" :key="source" class="stats__row"><span>{{ source }}</span><strong>{{ money(value.medianUsd) }} <em>({{ value.count }})</em></strong></div></article>
      <article v-if="workModeStats.length" class="stats__card"><div class="stats__label">{{ t("statByMode") }}</div><div v-for="mode in workModeStats" :key="mode.key" class="stats__row"><span>{{ t("wm" + mode.key.charAt(0).toUpperCase() + mode.key.slice(1)) }}</span><strong>{{ mode.n }}</strong></div><div class="stats__row stats__row_divider"><span>{{ t("foreigner") }}</span><strong>{{ stats.foreignerFriendly }}</strong></div></article>
      <article v-if="languageStats.length" class="stats__card"><div class="stats__label">{{ t("statLanguages") }}</div><div class="stats__chips"><span v-for="[language, count] in languageStats" :key="language">{{ language }} · {{ count }}</span></div></article>
      <article v-if="stats.topSkills.length" class="stats__card stats__card_wide"><div class="stats__label">{{ t("statTopSkills") }}</div><div class="stats__chips stats__chips_accent"><span v-for="skill in stats.topSkills" :key="skill.skill">{{ skill.skill }} · {{ skill.count }}</span></div></article>
    </div>

    <div v-else class="trends">
      <div class="trends__filters">
        <div class="trends__segments"><button v-for="option in periodOptions" :key="option.value" type="button" :class="{ active: trendDays === option.value }" @click="trendDays = option.value">{{ option.label }}</button></div>
        <div class="trends__segments trends__segments_scope"><button v-for="option in scopeOptions" :key="option.value" type="button" :class="{ active: trendScope === option.value }" @click="trendScope = option.value">{{ option.label }}</button></div>
      </div>
      <div v-if="chart.sampleCount && chart.lines.some((line) => line.values.some((value) => value != null))" class="trends__chart-wrap">
        <UiAnalyticsLine :series="chart.lines" :labels="chart.labels" :format="money" />
        <p class="trends__samples">{{ t("trendSamples", { n: chart.sampleCount }) }}</p>
      </div>
      <div v-else class="trends__empty"><u-icon name="i-lucide-chart-spline" /><span>{{ t("trendNotEnough") }}</span></div>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped>
.stats__tabs,.trends__segments { display: flex; flex-wrap: wrap; gap: 5px; padding: 4px; border: 1px solid rgba(85,111,174,.32); border-radius: 10px; background: rgba(5,10,31,.62); }
.stats__tabs button,.trends__segments button { min-height: 32px; padding: 6px 11px; border: 0; border-radius: 7px; background: transparent; color: var(--ui-text-muted); font-weight: 650; cursor: pointer; }.stats__tabs button.active,.trends__segments button.active { background: rgba(224,103,154,.18); color: #f2a2c5; box-shadow: inset 0 0 0 1px rgba(224,103,154,.35); }
.stats__grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }.stats__card { min-width: 0; padding: 14px; border: 1px solid rgba(85,111,174,.3); border-radius: 11px; background: rgba(12,18,48,.9); }.stats__card_wide { grid-column: 1/-1; }
.stats__label { margin-bottom: 9px; color: var(--ui-text-muted); font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }.stats__big { color: #f08ab8; font-size: 28px; font-weight: 750; overflow-wrap: anywhere; }.stats__sub { margin-top: 4px; color: var(--ui-text-muted); font-size: 12px; }.stats__row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 13px; }.stats__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.stats__row strong { flex: 0 0 auto; }.stats__row em { color: var(--ui-text-muted); font-size: 11px; font-style: normal; }.stats__row_divider { margin-top: 5px; padding-top: 7px; border-top: 1px solid var(--line); }.stats__chips { display: flex; flex-wrap: wrap; gap: 6px; }.stats__chips span { padding: 3px 9px; border: 1px solid rgba(85,111,174,.34); border-radius: 999px; color: var(--ui-text-muted); font-size: 12px; }.stats__chips_accent span { border-color: rgba(224,103,154,.38); color: #ee9bc0; }
.trends__filters { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }.trends__segments_scope { justify-content: flex-end; }.trends__chart-wrap { padding: 12px 12px 8px; border: 1px solid rgba(85,111,174,.3); border-radius: 11px; background: rgba(5,10,31,.58); }.trends__legend { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 2px 5px 8px; color: var(--ui-text-muted); font-size: 12px; }.trends__legend span { display: inline-flex; align-items: center; gap: 6px; }.trends__legend i { width: 9px; height: 9px; border-radius: 50%; }.trends__chart { display: block; width: 100%; min-height: 260px; overflow: visible; }.trends__chart .axis { stroke: rgba(128,149,208,.28); }.trends__chart text { fill: var(--ui-text-muted); font-size: 9px; }.trends__samples { margin: 0; text-align: right; color: var(--ui-text-muted); font-size: 11px; }.trends__empty { min-height: 230px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--ui-text-muted); text-align: center; }.trends__empty :deep(svg) { font-size: 35px; color: rgba(224,103,154,.7); }
@media(max-width:900px){.stats__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats__card_wide{grid-column:1/-1}.trends__filters{flex-direction:column}.trends__segments_scope{justify-content:flex-start}.trends__chart{min-height:220px}}
@media(max-width:620px){.stats__tabs{width:100%}.stats__tabs button{flex:1}.stats__grid{grid-template-columns:1fr}.stats__card_wide{grid-column:auto}.trends__segments{width:100%}.trends__segments button{flex:1 1 auto}.trends__chart{min-height:190px}.trends__chart text{font-size:8px}}
</style>
