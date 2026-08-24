<script setup lang="ts">
import type { HiringCvProfile } from "~/types/hiring";

const props = defineProps<{ profiles: HiringCvProfile[]; rates: Record<string, number> }>();
const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`hiring.${key}`, params);
const activityDays = ref<7 | 30 | 60>(30);
const activityOptions: Array<7 | 30 | 60> = [7, 30, 60];
const palette = ["#e0679a", "#24a7d6", "#10b981", "#d99a0b", "#8b5cf6"];

function countBy(getKey: (profile: HiringCvProfile) => string) {
  const counts = new Map<string, number>();
  for (const profile of props.profiles) { const key = getKey(profile).trim(); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function median(values: number[]) { const sorted = [...values].sort((a, b) => a - b); if (!sorted.length) return null; const i = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2; }
function usdSalary(profile: HiringCvProfile): number | null {
  const values = [profile.salaryMin, profile.salaryMax].filter((value): value is number => value != null && value > 0);
  if (!values.length) return null;
  const value = values.reduce((sum, item) => sum + item, 0) / values.length;
  const currency = String(profile.currency || "USD").toUpperCase(); const rate = props.rates[currency]; const usd = props.rates.USD || 1;
  return currency === "USD" ? value : rate ? value * rate / usd : null;
}

const genderItems = computed(() => {
  const counts = countBy((profile) => profile.gender || "unknown");
  return ["female", "male", "unknown"].map((key, index) => ({ label: t(`gender${key.charAt(0).toUpperCase()}${key.slice(1)}`), value: counts.find(([item]) => item === key)?.[1] || 0, color: palette[index] }));
});
const locationBars = computed(() => countBy((profile) => profile.city || profile.country || t("statsUnknown")).slice(0, 6).map(([label, value], index) => ({ label, value, color: palette[index % palette.length] })));
const platformBars = computed(() => countBy((profile) => profile.sourceLabel || profile.source || profile.origin || t("statsUnknown")).slice(0, 6).map(([label, value], index) => ({ label, value, color: palette[index % palette.length] })));

const experienceSalary = computed(() => {
  const brackets = [
    { label: "0–1", from: 0, to: 2 }, { label: "2–3", from: 2, to: 4 }, { label: "4–6", from: 4, to: 7 },
    { label: "7–10", from: 7, to: 11 }, { label: "10+", from: 11, to: Infinity },
  ];
  const values = brackets.map((bracket) => median(props.profiles.flatMap((profile) => {
    const salary = usdSalary(profile); const years = profile.experienceYears;
    return salary != null && years != null && years >= bracket.from && years < bracket.to ? [salary] : [];
  })));
  return { labels: brackets.map((item) => item.label), series: [{ label: t("statsDesiredSalary"), color: "#e0679a", values }] };
});

const activity = computed(() => {
  const count = activityDays.value === 7 ? 7 : activityDays.value === 30 ? 10 : 12;
  const end = Date.now(); const start = end - activityDays.value * 86_400_000; const bucket = (end - start) / count; const values = Array.from({ length: count }, () => 0);
  for (const profile of props.profiles) { const at = new Date(profile.createdAt || "").getTime(); if (!Number.isFinite(at) || at < start || at > end) continue; values[Math.min(count - 1, Math.floor((at - start) / bucket))] += 1; }
  const labels = Array.from({ length: count }, (_, index) => new Date(start + index * bucket).toLocaleDateString([], { day: "2-digit", month: "2-digit" }));
  return { labels, series: [{ label: t("statsCandidates"), color: "#24a7d6", values }] };
});
const salarySamples = computed(() => props.profiles.filter((profile) => usdSalary(profile) != null).length);
</script>

<template>
  <UiAnalyticsPanel v-if="profiles.length" class="hiring-stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <div class="hiring-stats__grid">
      <article class="analytics-card analytics-card_wide"><div class="analytics-card__head"><h3>{{ t("statsActivity") }}</h3><div class="segments"><button v-for="days in activityOptions" :key="days" type="button" :class="{active:activityDays===days}" @click="activityDays=days">{{ t("statsDays",{n:days}) }}</button></div></div><UiAnalyticsLine :series="activity.series" :labels="activity.labels" /></article>
      <article class="analytics-card"><h3>{{ t("statsGender") }}</h3><UiAnalyticsDonut :items="genderItems" :center-label="t('statsCandidates')" /></article>
      <article class="analytics-card"><h3>{{ t("statsPlatforms") }}</h3><UiAnalyticsBars :items="platformBars" /></article>
      <article class="analytics-card"><h3>{{ t("statsLocations") }}</h3><UiAnalyticsBars :items="locationBars" /></article>
      <article class="analytics-card analytics-card_salary"><div class="analytics-card__head"><h3>{{ t("statsSalaryExperience") }}</h3><small>{{ t("statsSalarySamples",{n:salarySamples}) }}</small></div><UiAnalyticsLine :series="experienceSalary.series" :labels="experienceSalary.labels" :format="(value)=>`$${Math.round(value).toLocaleString()}`" /></article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped>
.hiring-stats__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.analytics-card{min-width:0;padding:14px;border:1px solid rgba(85,111,174,.3);border-radius:11px;background:rgba(12,18,48,.9)}.analytics-card_wide{grid-column:span 2}.analytics-card_salary{grid-column:span 2}.analytics-card h3{margin:0 0 12px;color:var(--ui-text-muted);font-size:11px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.analytics-card__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.analytics-card__head small{color:var(--ui-text-muted)}.segments{display:flex;gap:4px;padding:3px;border:1px solid rgba(85,111,174,.3);border-radius:8px}.segments button{padding:4px 8px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-muted);font-size:10px;cursor:pointer}.segments button.active{background:rgba(224,103,154,.18);color:#f2a2c5}
@media(max-width:1000px){.hiring-stats__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-card_wide,.analytics-card_salary{grid-column:1/-1}}@media(max-width:650px){.hiring-stats__grid{grid-template-columns:1fr;padding-inline:12px}.analytics-card_wide,.analytics-card_salary{grid-column:auto}.hiring-stats__toggle{font-size:0!important}.analytics-card__head{flex-direction:column}.segments{width:100%}.segments button{flex:1}}
</style>
