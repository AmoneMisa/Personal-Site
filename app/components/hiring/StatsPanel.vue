<script setup lang="ts">
import type { HiringCvProfile, HiringStatistics } from "~/types/hiring";
import { locationLabel } from "~/utils/locationLabels";
import { buildHiringStatistics } from "~~/shared/hiringStatistics";
import { hiringStatisticGroupLabel } from "~~/shared/hiringStatisticGroups";
import { hiringProfessionLabel, hiringProfessionLocale } from "~~/shared/hiringProfessionLabels";

const props = defineProps<{ profiles: HiringCvProfile[]; rates: Record<string, number>; statistics?: HiringStatistics | null }>();
const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`hiring.${key}`, params);
const activityDays = ref<7 | 30 | 60>(30);
const activityOptions: Array<7 | 30 | 60> = [7, 30, 60];
const palette = ["#e0679a", "#24a7d6", "#10b981", "#d99a0b", "#8b5cf6"];

const localStatistics = computed(() => buildHiringStatistics(props.profiles, {
  provider: (profile) => profile.sourceLabel || profile.sourceKey || profile.source || profile.origin || "__unknown__",
  toUsd: (amount, currency) => {
    const rate = props.rates[currency];
    const usd = props.rates.USD || 1;
    return currency === "USD" ? amount : rate ? amount * rate / usd : undefined;
  },
}));
const currentStatistics = computed(() => props.statistics || localStatistics.value);
const professionLocale = computed(() => hiringProfessionLocale(locale.value));

const genderItems = computed(() => {
  return (["female", "male", "unknown"] as const).map((key, index) => ({ label: t(`gender${key.charAt(0).toUpperCase()}${key.slice(1)}`), value: currentStatistics.value.genders[key], color: palette[index] }));
});
const locationBars = computed(() => currentStatistics.value.locations.slice(0, 6).map((item, index) => ({ label: item.label === "__unknown__" ? t("statsUnknown") : locationLabel(item.label, locale.value, "city"), value: item.value, color: palette[index % palette.length] })));
const platformBars = computed(() => currentStatistics.value.platforms.slice(0, 6).map((item, index) => ({ label: item.label === "__unknown__" ? t("statsUnknown") : item.label, value: item.value, color: palette[index % palette.length] })));
const ageBars = computed(() => currentStatistics.value.ages.filter((item) => item.value > 0).map((item, index) => ({ label: item.label === "__unknown__" ? t("statsUnknown") : item.label, value: item.value, color: palette[index % palette.length] })));
const sectorBars = computed(() => currentStatistics.value.sectors.slice(0, 8).map((item, index) => ({ label: hiringStatisticGroupLabel(item.label, professionLocale.value), value: item.value, color: palette[index % palette.length] })));
const professionBars = computed(() => currentStatistics.value.professions.slice(0, 8).map((item, index) => ({ label: hiringProfessionLabel(item.label, professionLocale.value), value: item.value, color: palette[index % palette.length] })));

const experienceSalaryBars = computed(() => {
  const labels = ["0–1", "2–3", "4–6", "7–10", "10+"];
  return currentStatistics.value.salaryByExperience.flatMap((value, index) => {
    if (value == null || !Number.isFinite(value)) return [];
    return [{ label: labels[index] || String(index + 1), value, color: "#e0679a" }];
  });
});
const professionSalaryRangeBars = computed(() => {
  const rows = currentStatistics.value.salaryByProfession ?? localStatistics.value.salaryByProfession;
  return (rows || []).slice(0, 8).map((item) => ({
    label: hiringProfessionLabel(item.profession, professionLocale.value),
    min: item.minUsd,
    max: item.maxUsd,
    color: "#e0679a",
  }));
});
const professionSalaryRangeTitle = computed(() => String(locale.value).toLowerCase().startsWith("ru")
  ? "Желаемая зарплата по профессиям · мин / макс"
  : "Desired salary by profession · min / max");

const activity = computed(() => {
  const count = activityDays.value === 7 ? 7 : activityDays.value === 30 ? 10 : 12;
  const end = Date.now(); const start = end - activityDays.value * 86_400_000; const bucket = (end - start) / count; const values = Array.from({ length: count }, () => 0);
  for (const point of currentStatistics.value.activity) { const at = new Date(`${point.date}T00:00:00.000Z`).getTime(); if (!Number.isFinite(at) || at < start || at > end) continue; values[Math.min(count - 1, Math.floor((at - start) / bucket))] += point.value; }
  const labels = Array.from({ length: count }, (_, index) => new Date(start + index * bucket).toLocaleDateString([], { day: "2-digit", month: "2-digit" }));
  return { labels, series: [{ label: t("statsCandidates"), color: "#24a7d6", values }] };
});
const salarySamples = computed(() => currentStatistics.value.salarySamples);
</script>

<template>
  <UiAnalyticsPanel v-if="profiles.length" class="hiring-stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <div class="hiring-stats__grid">
      <article class="analytics-card analytics-card_wide"><div class="analytics-card__head"><h3>{{ t("statsActivity") }}</h3><div class="segments" role="group" :aria-label="t('statsActivity')"><button v-for="days in activityOptions" :key="days" type="button" :class="{active:activityDays===days}" :aria-pressed="activityDays===days" @click="activityDays=days">{{ t("statsDays",{n:days}) }}</button></div></div><UiAnalyticsLine :series="activity.series" :labels="activity.labels" /></article>
      <article class="analytics-card"><h3>{{ t("statsGender") }}</h3><UiAnalyticsDonut :items="genderItems" :center-label="t('statsCandidates')" /></article>
      <article class="analytics-card"><h3>{{ t("statsPlatforms") }}</h3><UiAnalyticsBars :items="platformBars" /></article>
      <article class="analytics-card"><h3>{{ t("statsLocations") }}</h3><UiAnalyticsBars :items="locationBars" /></article>
      <article class="analytics-card"><h3>{{ t("statsAge") }}</h3><UiAnalyticsBars :items="ageBars" /></article>
      <article class="analytics-card"><h3>{{ t("statsSectors") }}</h3><UiAnalyticsBars :items="sectorBars" /></article>
      <article class="analytics-card"><h3>{{ t("statsProfessions") }}</h3><UiAnalyticsBars :items="professionBars" /></article>
      <article class="analytics-card analytics-card_salary"><div class="analytics-card__head"><h3>{{ t("statsSalaryExperience") }}</h3><small>{{ t("statsSalarySamples",{n:salarySamples}) }}</small></div><UiAnalyticsBars v-if="experienceSalaryBars.length" :items="experienceSalaryBars" :format="(value)=>`$${Math.round(value).toLocaleString()}`" /><p v-else class="analytics-card__empty">{{ t("statsNoSalaryData") }}</p></article>
      <article v-if="professionSalaryRangeBars.length" class="analytics-card analytics-card_salary-range"><h3>{{ professionSalaryRangeTitle }}</h3><UiAnalyticsBars :items="professionSalaryRangeBars" :format="(value)=>`$${Math.round(value).toLocaleString()}`" /></article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.hiring-stats__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.analytics-card{min-width:0;padding:14px;border:1px solid rgba(85,111,174,.3);border-radius:11px;background:rgba(12,18,48,.9)}.analytics-card_wide{grid-column:span 2}.analytics-card_salary,.analytics-card_salary-range{grid-column:span 2}.analytics-card h3{margin:0 0 12px;color:var(--ui-text-muted);font-size:11px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.analytics-card__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.analytics-card__head small{color:var(--ui-text-muted)}.analytics-card__empty{display:grid;min-height:190px;margin:0;place-items:center;color:var(--ui-text-muted);font-size:13px;text-align:center}.segments{display:flex;gap:4px;padding:3px;border:1px solid rgba(85,111,174,.3);border-radius:8px}.segments button{padding:4px 8px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-muted);font-size:10px;cursor:pointer}.segments button.active{background:rgba(224,103,154,.18);color:#f2a2c5}
@include bp-down(lg){.hiring-stats__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.analytics-card_wide,.analytics-card_salary,.analytics-card_salary-range{grid-column:1/-1}}@include bp-down(sm){.hiring-stats__grid{grid-template-columns:1fr;padding-inline:12px}.analytics-card_wide,.analytics-card_salary,.analytics-card_salary-range{grid-column:auto}.analytics-card__head{flex-direction:column}.segments{width:100%}.segments button{flex:1}}
</style>
