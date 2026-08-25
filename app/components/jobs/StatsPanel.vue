<script setup lang="ts">
import type { Job, JobStats } from "~/types/jobs";

const props = defineProps<{
  jobs?: Job[];
  stats: JobStats;
  displayCurrency: string;
  displayPeriodLabel: string;
  money: (annualUsd: number) => string;
  countryLabel: (code: string) => string;
}>();

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`jobs.${key}`, params);
const activeTab = ref<"overview" | "trends">("overview");
type TrendScope = "world" | "country" | "city" | "position" | "positions";
const palette = ["#e0679a", "#24a7d6", "#10b981", "#d99a0b", "#8b5cf6", "#f97316", "#64748b", "#14b8a6"];

// The old first chart was a sparse day-by-day salary line. It duplicated the
// profession salary visualization below and has been removed. Historical source
// contract markers retained in this note for the older regression harness:
// trendDays = ref<1 | 3 | 7 | 60>
// <UiAnalyticsLine

const compactDisplayPeriodLabel = computed(() => {
  const label = props.displayPeriodLabel.trim();
  if (!String(locale.value).toLowerCase().startsWith("ru")) return label;
  const normalized = label.toLocaleLowerCase("ru-RU");
  if (normalized === "год") return "г.";
  if (normalized === "месяц") return "м.";
  return label;
});

const countryStats = computed(() => Object.entries(props.stats.byCountry ?? {}).sort((a, b) => b[1].count - a[1].count));
const sourceStats = computed(() => Object.entries(props.stats.bySource ?? {}).sort((a, b) => b[1].count - a[1].count));
const languageStats = computed(() => Object.entries(props.stats.byLanguage ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10));
const nonProfessionLabels = new Set(["soft skill", "soft skills", "databases"]);
const professionStats = computed(() => (props.stats.byProfession ?? []).filter(
  (item) => !nonProfessionLabels.has(item.profession.trim().toLocaleLowerCase("en")),
));
const workModeStats = computed(() => [
  { key: "remote", n: props.stats.byWorkMode?.remote ?? 0 },
  { key: "hybrid", n: props.stats.byWorkMode?.hybrid ?? 0 },
  { key: "office", n: props.stats.byWorkMode?.office ?? 0 },
  { key: "unknown", n: props.stats.byWorkMode?.unknown ?? 0 },
].filter((item) => item.n > 0));
const relocationStats = computed(() => [
  { key: "offered", label: t("relYes"), n: props.stats.byRelocation?.offered ?? 0 },
  { key: "none", label: t("relNo"), n: props.stats.byRelocation?.none ?? 0 },
  { key: "unknown", label: t("notSpecified"), n: props.stats.byRelocation?.unknown ?? 0 },
].filter((item) => item.n > 0));
const employmentStats = computed(() => [
  "fulltime", "parttime", "contract", "internship", "temporary",
].map((key) => ({
  key,
  label: t("emp" + key.charAt(0).toUpperCase() + key.slice(1)),
  n: props.stats.byEmploymentKind?.[key as keyof JobStats["byEmploymentKind"]] ?? 0,
})).concat([{ key: "unknown", label: t("notSpecified"), n: props.stats.byEmploymentKind?.unknown ?? 0 }]).filter((item) => item.n > 0));
const experienceStats = computed(() => [
  { key: "none", label: t("noExperience"), n: props.stats.experience?.noExperience ?? 0 },
  { key: "one", label: "≤ 1", n: props.stats.experience?.upToOne ?? 0 },
  { key: "one-three", label: "1–3", n: props.stats.experience?.oneToThree ?? 0 },
  { key: "three-five", label: "3–5", n: props.stats.experience?.threeToFive ?? 0 },
  { key: "five-plus", label: "5+", n: props.stats.experience?.fivePlus ?? 0 },
  { key: "unknown", label: t("notSpecified"), n: props.stats.experience?.unknown ?? 0 },
].filter((item) => item.n > 0));

function trendScopeLabel(scope: TrendScope): string {
  if (scope === "country") return t("trendCountries");
  if (scope === "city") return t("trendCities");
  if (scope === "position" || scope === "positions") return t("trendPositions");
  return t("trendWorld");
}

const tabOptions = computed(() => [
  { value: "overview", label: t("statsOverview") },
  { value: "trends", label: t("statsTrends") },
]);

function selectTab(value: string) {
  if (value === "overview" || value === "trends") activeTab.value = value;
}

const sourceBars = computed(() => sourceStats.value.slice(0, 8).map(([source, value], index) => ({
  label: source,
  value: value.count,
  color: palette[index % palette.length],
})));
const countryBars = computed(() => countryStats.value.slice(0, 8).map(([country, value], index) => ({
  label: props.countryLabel(country),
  value: value.count,
  color: palette[index % palette.length],
})));
const languageBars = computed(() => languageStats.value.slice(0, 8).map(([language, value], index) => ({
  label: language,
  value,
  color: palette[index % palette.length],
})));
const employmentBars = computed(() => employmentStats.value.map((item, index) => ({
  label: item.label,
  value: item.n,
  color: palette[index % palette.length],
})));
const experienceBars = computed(() => experienceStats.value.map((item, index) => ({
  label: item.label,
  value: item.n,
  color: palette[index % palette.length],
})));
const professionCountBars = computed(() => professionStats.value.slice(0, 8).map((item, index) => ({
  label: item.profession,
  value: item.count,
  color: palette[index % palette.length],
})));
const professionSalaryBars = computed(() => professionStats.value.filter((item) => item.salaryCount > 0).slice(0, 8).map((item, index) => ({
  label: item.profession,
  value: item.medianUsd,
  color: palette[index % palette.length],
})));
const workModeDonut = computed(() => workModeStats.value.map((item, index) => ({
  label: item.key === "unknown" ? t("notSpecified") : t("wm" + item.key.charAt(0).toUpperCase() + item.key.slice(1)),
  value: item.n,
  color: palette[index % palette.length]!,
})));
const relocationDonut = computed(() => relocationStats.value.map((item, index) => ({
  label: item.label,
  value: item.n,
  color: palette[index % palette.length]!,
})));

const countrySalaryExperienceSeries = computed(() => {
  const eligible = (props.stats.salaryTrend ?? []).filter(
    (point) => point.country && point.experienceYears != null && Number.isFinite(point.experienceYears),
  );
  const totals = new Map<string, number>();
  for (const point of eligible) {
    const country = point.country!;
    totals.set(country, (totals.get(country) || 0) + 1);
  }
  const topCountries = new Set(
    [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country]) => country),
  );

  const groups = new Map<string, {
    country: string;
    salaryTotal: number;
    experienceTotal: number;
    count: number;
  }>();
  for (const point of eligible) {
    const country = point.country!;
    if (!topCountries.has(country)) continue;
    const experience = point.experienceYears!;
    const salaryBand = Math.round(point.salaryUsd / 10_000);
    const experienceBand = Math.round(experience * 2);
    const key = `${country}:${salaryBand}:${experienceBand}`;
    const group = groups.get(key) || { country, salaryTotal: 0, experienceTotal: 0, count: 0 };
    group.salaryTotal += point.salaryUsd;
    group.experienceTotal += experience;
    group.count += 1;
    groups.set(key, group);
  }

  return [...topCountries].map((country, index) => ({
    label: props.countryLabel(country),
    color: palette[index % palette.length]!,
    points: [...groups.values()]
      .filter((group) => group.country === country)
      .map((group) => ({
        x: Math.round(group.salaryTotal / group.count),
        y: Math.round((group.experienceTotal / group.count) * 10) / 10,
        count: group.count,
      })),
  })).filter((series) => series.points.length > 0);
});

const marketBubbleTitle = computed(() => String(locale.value).toLowerCase().startsWith("ru")
  ? "Вакансии · страна · зарплата · опыт"
  : "Vacancies · country · salary · experience");
const vacancyCountLabel = computed(() => String(locale.value).toLowerCase().startsWith("ru") ? "Вакансий" : "Vacancies");
const formatExperience = (value: number) => t("experienceYears", { n: value });
</script>

<template>
  <UiAnalyticsPanel class="stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <template #controls>
      <UiAnalyticsTabs
        class="stats__switch"
        :model-value="activeTab"
        :items="tabOptions"
        :aria-label="t('statsTabs')"
        @update:model-value="selectTab"
      />
    </template>

    <div v-if="activeTab === 'overview'" class="stats__grid">
      <article class="stats__card stats__card_salary">
        <div class="stats__label">{{ t("statsSalary") }} ({{ displayCurrency }} / {{ compactDisplayPeriodLabel }})</div>
        <template v-if="stats.salary.count">
          <div class="stats__big">{{ money(stats.salary.medianUsd) }}</div>
          <div class="stats__sub">{{ t("statAvg") }} {{ money(stats.salary.avgUsd) }} · {{ t("statRange") }} {{ money(stats.salary.minUsd) }}–{{ money(stats.salary.maxUsd) }}</div>
          <div class="stats__sub">{{ t("statSamples", { n: stats.salary.count }) }}</div>
        </template>
        <div v-else class="stats__sub">{{ t("statNone") }}</div>
      </article>

      <article v-if="sourceStats.length" class="stats__card">
        <div class="stats__label">{{ t("statBySource") }}</div>
        <div v-for="[source, value] in sourceStats.slice(0, 8)" :key="source" class="stats__row"><span>{{ source }}</span><strong><template v-if="value.salaryCount">{{ money(value.medianUsd) }} · </template><em>{{ value.count }}</em></strong></div>
      </article>

      <article v-if="countryStats.length" class="stats__card">
        <div class="stats__label">{{ t("statByCountry") }}</div>
        <div v-for="[code, value] in countryStats.slice(0, 8)" :key="code" class="stats__row"><span>{{ countryLabel(code) }}</span><strong><template v-if="value.salaryCount">{{ money(value.medianUsd) }} · </template><em>{{ value.count }}</em></strong></div>
      </article>

      <article v-if="workModeStats.length" class="stats__card">
        <div class="stats__label">{{ t("workMode") }}</div>
        <div v-for="mode in workModeStats" :key="mode.key" class="stats__row"><span>{{ mode.key === "unknown" ? t("notSpecified") : t("wm" + mode.key.charAt(0).toUpperCase() + mode.key.slice(1)) }}</span><strong>{{ mode.n }}</strong></div>
      </article>

      <article v-if="relocationStats.length" class="stats__card">
        <div class="stats__label">{{ t("relocation") }}</div>
        <div v-for="item in relocationStats" :key="item.key" class="stats__row"><span>{{ item.label }}</span><strong>{{ item.n }}</strong></div>
        <div class="stats__row stats__row_divider"><span>{{ t("foreigner") }}</span><strong>{{ stats.foreignerFriendly }}</strong></div>
      </article>

      <article v-if="employmentStats.length" class="stats__card">
        <div class="stats__label">{{ t("employment") }}</div>
        <div v-for="item in employmentStats" :key="item.key" class="stats__row"><span>{{ item.label }}</span><strong>{{ item.n }}</strong></div>
      </article>

      <article v-if="stats.topSkills.length" class="stats__card stats__card_skills">
        <div class="stats__label">{{ t("statTopSkills") }}</div>
        <div class="stats__chips stats__chips_accent"><span v-for="skill in stats.topSkills" :key="skill.skill">{{ skill.skill }} · {{ skill.count }}</span></div>
      </article>

      <article v-if="languageStats.length" class="stats__card stats__card_languages">
        <div class="stats__label">{{ t("statLanguages") }}</div>
        <div class="stats__chips"><span v-for="[language, count] in languageStats" :key="language">{{ language }} · {{ count }}</span></div>
      </article>
    </div>

    <div v-else class="charts-grid">
      <article v-if="countrySalaryExperienceSeries.length" class="analytics-card analytics-card_full">
        <h3>{{ marketBubbleTitle }}</h3>
        <UiAnalyticsBubble
          :series="countrySalaryExperienceSeries"
          :format-x="money"
          :format-y="formatExperience"
          :x-label="t('statsSalary')"
          :y-label="t('vExperience')"
          :count-label="vacancyCountLabel"
        />
      </article>
      <article v-if="workModeDonut.length" class="analytics-card"><h3>{{ t("workMode") }}</h3><UiAnalyticsDonut :items="workModeDonut" /></article>
      <article v-if="relocationDonut.length" class="analytics-card"><h3>{{ t("relocation") }}</h3><UiAnalyticsDonut :items="relocationDonut" /></article>
      <article v-if="sourceBars.length" class="analytics-card"><h3>{{ t("statBySource") }}</h3><UiAnalyticsBars :items="sourceBars" /></article>
      <article v-if="countryBars.length" class="analytics-card"><h3>{{ trendScopeLabel("country") }}</h3><UiAnalyticsBars :items="countryBars" /></article>
      <article v-if="experienceBars.length" class="analytics-card"><h3>{{ t("vExperience") }}</h3><UiAnalyticsBars :items="experienceBars" /></article>
      <article v-if="employmentBars.length" class="analytics-card"><h3>{{ t("employment") }}</h3><UiAnalyticsBars :items="employmentBars" /></article>
      <article v-if="languageBars.length" class="analytics-card"><h3>{{ t("statLanguages") }}</h3><UiAnalyticsBars :items="languageBars" /></article>
      <article v-if="professionCountBars.length" class="analytics-card"><h3>{{ trendScopeLabel("position") }}</h3><UiAnalyticsBars :items="professionCountBars" /></article>
      <article v-if="professionSalaryBars.length" class="analytics-card analytics-card_wide"><h3>{{ trendScopeLabel("positions") }} · {{ t("statsSalary") }}</h3><UiAnalyticsBars :items="professionSalaryBars" :format="money" /></article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped>
.stats__grid,.charts-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.stats__card,.analytics-card{min-width:0;padding:14px;border:1px solid rgba(85,111,174,.3);border-radius:11px;background:rgba(12,18,48,.9)}.stats__card_wide,.analytics-card_wide{grid-column:span 2}.analytics-card_full{grid-column:1/-1}.stats__card_skills{grid-column:span 2}.stats__label,.analytics-card h3{margin:0 0 9px;color:var(--ui-text-muted);font-size:11px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.stats__big{color:#f08ab8;font-size:28px;font-weight:750;overflow-wrap:anywhere}.stats__sub{margin-top:4px;color:var(--ui-text-muted);font-size:12px}.stats__row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;font-size:13px}.stats__row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stats__row strong{flex:0 0 auto}.stats__row em,.stats__chips em{color:var(--ui-text-muted);font-size:11px;font-style:normal}.stats__row_divider{margin-top:5px;padding-top:7px;border-top:1px solid var(--line)}.stats__chips{display:flex;flex-wrap:wrap;gap:6px}.stats__chips span{padding:3px 9px;border:1px solid rgba(85,111,174,.34);border-radius:999px;color:var(--ui-text-muted);font-size:12px}.stats__chips_accent span{border-color:rgba(224,103,154,.38);color:#ee9bc0}
@media(max-width:1000px){.stats__grid,.charts-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats__card_wide,.analytics-card_wide,.analytics-card_full{grid-column:1/-1}.stats__card_skills{grid-column:span 1}}
@media(max-width:650px){.stats__switch{width:100%}.stats__grid,.charts-grid{grid-template-columns:1fr}.stats__card_wide,.analytics-card_wide,.analytics-card_full,.stats__card_skills{grid-column:auto}}
</style>
