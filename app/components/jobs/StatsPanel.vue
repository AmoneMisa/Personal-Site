<script setup lang="ts">
import type { Job, JobProfessionGeographyStat, JobSalaryTrendPoint, JobStats } from "~/types/jobs";
import USelectMenu from "~/components/U/SelectMenu.vue";
import { locationLabel } from "~/utils/locationLabels";
import { canonicalCityValue } from "~~/shared/locationCatalog";

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
const trendDays = ref<1 | 3 | 7 | 60>(7);
const trendScope = ref<"world" | "country" | "city" | "position" | "positions">("world");
const colors = ["#e0679a", "#45c8ff", "#a78bfa", "#34d399"];

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
const professionStats = computed(() => props.stats.byProfession ?? []);
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

function geographyLabel(geo: JobProfessionGeographyStat): string {
  return geo.kind === "country"
    ? props.countryLabel(geo.key)
    : locationLabel(canonicalCityValue(geo.key), locale.value, "city");
}

type SalaryPoint = { at: number; salary: number; group: string };

function groupKey(point: JobSalaryTrendPoint): string {
  if (trendScope.value === "country") return point.country || t("trendUnknown");
  if (trendScope.value === "city") return canonicalCityValue(point.city || t("trendUnknown"));
  if (trendScope.value === "position") return point.profession || point.title || t("trendUnknown");
  if (trendScope.value === "positions") return t("trendPositionSet");
  return t("trendWorld");
}

const chart = computed(() => {
  const end = Date.now();
  const start = end - trendDays.value * 86_400_000;
  const bucketCount = trendDays.value === 1 ? 6 : trendDays.value === 3 ? 6 : trendDays.value === 7 ? 7 : 8;
  const bucketMs = (end - start) / bucketCount;
  const points: SalaryPoint[] = (props.stats.salaryTrend ?? []).flatMap((point) => {
    const at = new Date(point.postedAt).getTime();
    return !Number.isFinite(point.salaryUsd) || point.salaryUsd <= 0 || !Number.isFinite(at) || at < start || at > end
      ? []
      : [{ at, salary: point.salaryUsd, group: groupKey(point) }];
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
    return {
      group,
      values: buckets.map((bucket) => bucket.length ? bucket.sort((a, b) => a - b)[Math.floor(bucket.length / 2)] : null),
    };
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

const tabOptions = computed(() => [
  { value: "overview", label: t("statsOverview") },
  { value: "trends", label: t("statsTrends") },
]);
const periodOptions = computed(() => [
  { value: "1", label: t("trendDay") },
  { value: "3", label: t("trendThreeDays") },
  { value: "7", label: t("trendWeek") },
  { value: "60", label: t("trendTwoMonths") },
]);
const scopeOptions = computed(() => [
  { value: "world", label: t("trendWorld") },
  { value: "country", label: t("trendCountries") },
  { value: "city", label: t("trendCities") },
  { value: "position", label: t("trendPositions") },
  { value: "positions", label: t("trendPositionSet") },
]);

function selectTab(value: string) {
  if (value === "overview" || value === "trends") activeTab.value = value;
}
function selectTrendDays(value: unknown) {
  const next = Number(value);
  if (next === 1 || next === 3 || next === 7 || next === 60) trendDays.value = next;
}
function selectTrendScope(value: unknown) {
  if (typeof value === "string" && ["world", "country", "city", "position", "positions"].includes(value)) {
    trendScope.value = value as typeof trendScope.value;
  }
}
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
        <div class="stats__label">{{ t("statsSalary") }} ({{ displayCurrency }}/{{ compactDisplayPeriodLabel }})</div>
        <template v-if="stats.salary.count">
          <div class="stats__big">{{ money(stats.salary.medianUsd) }}</div>
          <div class="stats__sub">{{ t("statAvg") }} {{ money(stats.salary.avgUsd) }} · {{ t("statRange") }} {{ money(stats.salary.minUsd) }}–{{ money(stats.salary.maxUsd) }}</div>
          <div class="stats__sub">{{ t("statSamples", { n: stats.salary.count }) }}</div>
        </template>
        <div v-else class="stats__sub">{{ t("statNone") }}</div>
      </article>

      <article v-if="sourceStats.length" class="stats__card">
        <div class="stats__label">{{ t("statBySource") }}</div>
        <div v-for="[source, value] in sourceStats.slice(0, 8)" :key="source" class="stats__row">
          <span>{{ source }}</span>
          <strong><template v-if="value.salaryCount">{{ money(value.medianUsd) }} · </template><em>{{ value.count }}</em></strong>
        </div>
      </article>

      <article v-if="countryStats.length" class="stats__card">
        <div class="stats__label">{{ t("statByCountry") }}</div>
        <div v-for="[code, value] in countryStats.slice(0, 8)" :key="code" class="stats__row">
          <span>{{ countryLabel(code) }}</span>
          <strong><template v-if="value.salaryCount">{{ money(value.medianUsd) }} · </template><em>{{ value.count }}</em></strong>
        </div>
      </article>

      <article v-if="workModeStats.length" class="stats__card">
        <div class="stats__label">{{ t("workMode") }}</div>
        <div v-for="mode in workModeStats" :key="mode.key" class="stats__row">
          <span>{{ mode.key === "unknown" ? t("notSpecified") : t("wm" + mode.key.charAt(0).toUpperCase() + mode.key.slice(1)) }}</span><strong>{{ mode.n }}</strong>
        </div>
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

      <article v-if="experienceStats.length" class="stats__card">
        <div class="stats__label">{{ t("vExperience") }}</div>
        <div v-if="stats.experience?.medianYears != null" class="stats__sub stats__sub_lead">{{ t("vExperience") }}: {{ t("experienceYears", { n: stats.experience.medianYears }) }}</div>
        <div v-for="item in experienceStats" :key="item.key" class="stats__row"><span>{{ item.label }}</span><strong>{{ item.n }}</strong></div>
      </article>

      <article v-if="languageStats.length" class="stats__card">
        <div class="stats__label">{{ t("statLanguages") }}</div>
        <div class="stats__chips"><span v-for="[language, count] in languageStats" :key="language">{{ language }} · {{ count }}</span></div>
      </article>

      <article v-if="professionStats.length" class="stats__card stats__card_wide">
        <div class="stats__label">{{ t("trendPositions") }} · {{ t("statsSalary") }} · {{ t("vExperience") }}</div>
        <div class="stats__professions">
          <div v-for="profession in professionStats.slice(0, 12)" :key="profession.profession" class="stats__profession">
            <div class="stats__profession-head">
              <span>{{ profession.profession }}</span>
              <strong>{{ profession.salaryCount ? money(profession.medianUsd) : "—" }} <em>({{ profession.count }})</em></strong>
            </div>
            <div v-if="profession.medianExperienceYears != null" class="stats__sub">{{ t("vExperience") }}: {{ t("experienceYears", { n: profession.medianExperienceYears }) }}</div>
            <div v-if="profession.geographies.length" class="stats__chips stats__chips_geo">
              <span v-for="geo in profession.geographies" :key="`${geo.kind}:${geo.key}`">{{ geographyLabel(geo) }} · {{ money(geo.medianUsd) }} <em>({{ geo.salaryCount }})</em></span>
            </div>
          </div>
        </div>
      </article>

      <article v-if="stats.topSkills.length" class="stats__card stats__card_wide">
        <div class="stats__label">{{ t("statTopSkills") }}</div>
        <div class="stats__chips stats__chips_accent"><span v-for="skill in stats.topSkills" :key="skill.skill">{{ skill.skill }} · {{ skill.count }}</span></div>
      </article>
    </div>

    <div v-else class="trends">
      <article class="stats__card stats__card_wide trends__card">
        <div class="trends__filters">
          <USelectMenu
            class="trends__filter trends__filter_period"
            :model-value="String(trendDays)"
            :items="periodOptions"
            value-key="value"
            label-key="label"
            :search-input="false"
            @update:model-value="selectTrendDays"
          />
          <USelectMenu
            class="trends__filter trends__filter_scope"
            :model-value="trendScope"
            :items="scopeOptions"
            value-key="value"
            label-key="label"
            :search-input="false"
            @update:model-value="selectTrendScope"
          />
        </div>
        <div v-if="chart.sampleCount && chart.lines.some((line) => line.values.some((value) => value != null))" class="trends__chart-wrap">
          <div class="trends__chart-head">
            <div>
              <div class="stats__label trends__chart-label">{{ t("trendChartLabel") }}</div>
              <div class="trends__chart-unit">{{ displayCurrency }}/{{ compactDisplayPeriodLabel }}</div>
            </div>
            <span class="trends__sample-pill">{{ t("trendSamples", { n: chart.sampleCount }) }}</span>
          </div>
          <UiAnalyticsLine surface :series="chart.lines" :labels="chart.labels" :format="money" />
        </div>
        <div v-else class="trends__empty"><u-icon name="i-lucide-chart-spline" /><span>{{ t("trendNotEnough") }}</span></div>
      </article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped>
.stats__grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.stats__card { min-width: 0; padding: 14px; border: 1px solid rgba(85,111,174,.3); border-radius: 11px; background: rgba(12,18,48,.9); }
.stats__card_wide { grid-column: 1/-1; }
.stats__label { margin-bottom: 9px; color: var(--ui-text-muted); font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.stats__big { color: #f08ab8; font-size: 28px; font-weight: 750; overflow-wrap: anywhere; }
.stats__sub { margin-top: 4px; color: var(--ui-text-muted); font-size: 12px; }
.stats__sub_lead { margin: -2px 0 6px; }
.stats__row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 13px; }
.stats__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats__row strong { flex: 0 0 auto; }
.stats__row em,.stats__profession em,.stats__chips em { color: var(--ui-text-muted); font-size: 11px; font-style: normal; }
.stats__row_divider { margin-top: 5px; padding-top: 7px; border-top: 1px solid var(--line); }
.stats__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stats__chips span { padding: 3px 9px; border: 1px solid rgba(85,111,174,.34); border-radius: 999px; color: var(--ui-text-muted); font-size: 12px; }
.stats__chips_accent span { border-color: rgba(224,103,154,.38); color: #ee9bc0; }
.stats__professions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.stats__profession { min-width: 0; padding: 10px; border: 1px solid rgba(85,111,174,.2); border-radius: 9px; background: rgba(5,10,31,.32); }
.stats__profession-head { display: flex; min-width: 0; align-items: baseline; justify-content: space-between; gap: 10px; font-size: 13px; }
.stats__profession-head > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stats__profession-head strong { flex: 0 0 auto; color: #f08ab8; }
.stats__chips_geo { margin-top: 7px; }
.stats__chips_geo span { padding: 2px 7px; font-size: 11px; }
.trends__card { padding: 14px; background: rgba(8, 13, 39, 0.82); }
.trends__filters { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid rgba(85,111,174,.2); }
.trends__filter { width: 210px; max-width: 100%; }
.trends__filter_period { width: 150px; }
.trends__chart-wrap { min-width: 0; display: grid; gap: 10px; }
.trends__chart-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 0 2px; }
.trends__chart-label { margin-bottom: 3px; }
.trends__chart-unit { color: var(--text-primary); font-size: 12px; font-weight: 700; }
.trends__sample-pill { flex: 0 0 auto; padding: 5px 9px; border: 1px solid rgba(85,111,174,.3); border-radius: 999px; background: rgba(5,10,31,.48); color: var(--ui-text-muted); font-size: 10.5px; line-height: 1.2; }
.trends__empty { min-height: 248px; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--ui-text-muted); text-align: center; }
.trends__empty :deep(svg) { font-size: 35px; color: rgba(224,103,154,.7); }
@media(max-width:900px){
  .stats__grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .stats__card_wide{grid-column:1/-1}
  .stats__professions{grid-template-columns:1fr}
}
@media(max-width:620px){
  .stats__switch{width:100%}
  .stats__grid{grid-template-columns:1fr}
  .stats__card_wide{grid-column:auto}
  .trends__filters{align-items:stretch;flex-direction:column}
  .trends__filter,.trends__filter_period{width:100%}
  .trends__chart-head{align-items:flex-start;flex-direction:column}
  .trends__sample-pill{align-self:flex-start}
}
</style>
