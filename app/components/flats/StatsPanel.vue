<script setup lang="ts">
import { locationLabel, type LocationKind } from "~/utils/locationLabels";
import type { FlatPriceBandKey, FlatStatistics, FlatStatsDealKey, FlatStatsGeoDimension, FlatStatsGeoRow } from "~/types/flats";

const props = defineProps<{
  statistics: FlatStatistics;
  displayCurrency: string;
  convert: (amount: number, from: string, to: string) => number | undefined;
}>();
const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);
const activityDays = ref<7 | 14 | 21>(14);
const geoDimension = ref<FlatStatsGeoDimension>("city");
const dealScope = ref<Exclude<FlatStatsDealKey, "unknown">>("sale");
const activityOptions: Array<7 | 14 | 21> = [7, 14, 21];
const geoOptions: FlatStatsGeoDimension[] = ["country", "city", "district", "microdistrict", "metro"];
const dealOrder = ["sale", "longRent", "shortRent", "roomRent"] as const;

const deals = computed(() => dealOrder.map((key) => {
  const row = props.statistics.dealTypes.find((item) => item.key === key);
  return { key, label: dealLabel(key), count: row?.count || 0, median: row?.medianUsd == null ? null : convertUsd(row.medianUsd) };
}));
const dealScopeOptions = computed(() => deals.value.map((deal) => ({ value: deal.key, label: deal.label, count: deal.count })));
const geoDimensionOptions = computed(() => geoOptions.map((dimension) => ({ value: dimension, label: geoLabel(dimension) })));

const activity = computed(() => {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const byDate = new Map(props.statistics.activity.map((item) => [String(item.date).slice(0, 10), item.count]));
  const dates = Array.from({ length: activityDays.value }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (activityDays.value - index - 1));
    return date;
  });
  return {
    labels: dates.map((date) => date.toLocaleDateString(locale.value, { day: "2-digit", month: "2-digit" })),
    series: [{ label: t("statsListings"), color: "#24a7d6", values: dates.map((date) => byDate.get(localDateKey(date)) || 0) }],
  };
});

const geography = computed(() => {
  const scoped = props.statistics.geographiesByDeal?.[dealScope.value]?.[geoDimension.value];
  const rows = scoped?.length ? scoped : (props.statistics.geographies[geoDimension.value] ?? []);
  const merged = new Map<string, FlatStatsGeoRow>();
  for (const row of rows) {
    const label = displayGeoLabel(row.label, geoDimension.value);
    const current = merged.get(label);
    if (!current) { merged.set(label, { ...row, label }); continue; }
    const priceCount = current.priceCount + row.priceCount;
    const minValues = [current.minUsd, row.minUsd].filter((value): value is number => value != null && Number.isFinite(value));
    const maxValues = [current.maxUsd, row.maxUsd].filter((value): value is number => value != null && Number.isFinite(value));
    merged.set(label, {
      label,
      count: current.count + row.count,
      priceCount,
      medianUsd: priceCount ? (((current.medianUsd || 0) * current.priceCount) + ((row.medianUsd || 0) * row.priceCount)) / priceCount : null,
      minUsd: minValues.length ? Math.min(...minValues) : null,
      maxUsd: maxValues.length ? Math.max(...maxValues) : null,
    });
  }
  return [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 8);
});
const geographyPriceRanges = computed(() => geography.value.flatMap((row) => {
  if (row.minUsd == null || row.maxUsd == null) return [];
  const min = convertUsd(row.minUsd);
  const max = convertUsd(row.maxUsd);
  if (min == null || max == null || !Number.isFinite(min) || !Number.isFinite(max)) return [];
  return [{ label: row.label, min, max, color: "#24a7d6" }];
}));
const priceRangeTitle = computed(() => String(locale.value).toLowerCase().startsWith("ru")
  ? "Стоимость жилья · мин / макс"
  : "Housing price · min / max");
const priceLegendTitle = computed(() => String(locale.value).toLowerCase().startsWith("ru") ? "Цвет цены относительно медианы" : "Price color vs median");
const priceLegend = computed(() => String(locale.value).toLowerCase().startsWith("ru") ? [
  { key: "red" as FlatPriceBandKey, label: "Красный: +45% и выше", color: "#ef4444" },
  { key: "yellow" as FlatPriceBandKey, label: "Жёлтый: +31–44%", color: "#facc15" },
  { key: "orange" as FlatPriceBandKey, label: "Оранжевый: +16–30%", color: "#fb923c" },
  { key: "pink" as FlatPriceBandKey, label: "Розовый: медиана ±15%", color: "#e0679a" },
  { key: "blue" as FlatPriceBandKey, label: "Голубой: −16–30%", color: "#67e8f9" },
  { key: "green" as FlatPriceBandKey, label: "Зелёный: −31% и ниже", color: "#4ade80" },
] : [
  { key: "red" as FlatPriceBandKey, label: "Red: +45% or more", color: "#ef4444" },
  { key: "yellow" as FlatPriceBandKey, label: "Yellow: +31–44%", color: "#facc15" },
  { key: "orange" as FlatPriceBandKey, label: "Orange: +16–30%", color: "#fb923c" },
  { key: "pink" as FlatPriceBandKey, label: "Pink: median ±15%", color: "#e0679a" },
  { key: "blue" as FlatPriceBandKey, label: "Blue: −16–30%", color: "#67e8f9" },
  { key: "green" as FlatPriceBandKey, label: "Green: −31% or less", color: "#4ade80" },
]);
const priceBandTitle = computed(() => String(locale.value).toLowerCase().startsWith("ru")
  ? "Распределение цен относительно медианы"
  : "Price distribution vs median");
const priceBandHint = computed(() => String(locale.value).toLowerCase().startsWith("ru")
  ? "По всей текущей фильтрованной выборке PostgreSQL"
  : "Entire current filtered PostgreSQL result set");
const priceBandBars = computed(() => {
  const rows = props.statistics.priceBandsByDeal?.[dealScope.value] || [];
  const byKey = new Map(rows.map((row) => [row.key, row.count]));
  return priceLegend.value.slice().reverse().map((item) => ({
    label: item.label.split(":")[0] || item.label,
    value: byKey.get(item.key) || 0,
    color: item.color,
  }));
});
const priceBandSamples = computed(() => props.statistics.priceBandSamplesByDeal?.[dealScope.value] || 0);
const maxGeoCount = computed(() => Math.max(1, ...geography.value.map((row) => row.count)));
const total = computed(() => Math.max(1, props.statistics.total));
const ownership = computed(() => [
  { key: "owners", label: t("statsOwners"), value: props.statistics.ownership.owners },
  { key: "agencies", label: t("statsAgencies"), value: props.statistics.ownership.agencies },
  { key: "noCommission", label: t("statsNoCommission"), value: props.statistics.ownership.noCommission },
  { key: "commission", label: t("statsCommission"), value: props.statistics.ownership.commission },
]);

watch(deals, (rows) => {
  if (rows.some((row) => row.key === dealScope.value && row.count > 0)) return;
  const firstAvailable = rows.find((row) => row.count > 0);
  if (firstAvailable) dealScope.value = firstAvailable.key;
}, { immediate: true });

function localDateKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function convertUsd(value: number): number | null { const converted = props.convert(value, "USD", props.displayCurrency); return converted != null && Number.isFinite(converted) ? converted : null; }
function number(value: number): string { return Math.round(value).toLocaleString(locale.value); }
function money(value: number | null): string { return value == null ? t("statsNoPrice") : `${number(value)} ${props.displayCurrency}`; }
function percent(value: number): string { return `${Math.round(value / total.value * 100)}%`; }
function dealLabel(key: string): string { if (key === "sale") return t("dtSale"); if (key === "shortRent") return t("dtShortRent"); if (key === "roomRent") return t("dtRoomRent"); return t("dtLongRent"); }
function geoLabel(key: FlatStatsGeoDimension): string { return t(`statsGeo${key.charAt(0).toUpperCase()}${key.slice(1)}`); }
function displayGeoLabel(value: string, dimension: FlatStatsGeoDimension): string {
  const kind: LocationKind = dimension === "country" ? "country" : dimension === "city" ? "city" : dimension === "metro" ? "metro" : "district";
  return locationLabel(value, locale.value, kind);
}
</script>

<template>
  <UiAnalyticsPanel class="flat-stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <div class="flat-stats__body">
      <article class="flat-stats__card flat-stats__card_wide">
        <div class="flat-stats__head"><h3>{{ t("statsActivity") }}</h3><div class="flat-stats__segments"><button v-for="days in activityOptions" :key="days" type="button" :class="{ active: activityDays === days }" @click="activityDays = days">{{ t("statsDays", { n: days }) }}</button></div></div>
        <UiAnalyticsLine :series="activity.series" :labels="activity.labels" />
      </article>
      <article class="flat-stats__card flat-stats__card_wide">
        <h3>{{ t("statsDeals") }}</h3>
        <div class="flat-stats__deal-grid"><div v-for="deal in deals" :key="deal.key" class="flat-stats__deal"><span>{{ deal.label }}</span><strong>{{ number(deal.count) }}</strong><small>{{ t("statsMedian") }}: {{ money(deal.median) }}</small></div></div>
      </article>
      <article v-if="priceBandSamples" class="flat-stats__card flat-stats__card_wide">
        <div class="flat-stats__head"><div><h3>{{ priceBandTitle }}</h3><small class="flat-stats__hint">{{ priceBandHint }} · {{ number(priceBandSamples) }}</small></div><SearchSourceTabs v-model="dealScope" :items="dealScopeOptions" /></div>
        <UiAnalyticsBars :items="priceBandBars" />
        <div class="flat-stats__legend" :aria-label="priceLegendTitle">
          <span class="flat-stats__legend-title">{{ priceLegendTitle }}:</span>
          <span v-for="item in priceLegend" :key="item.key" class="flat-stats__legend-item"><i :style="{ background: item.color }" />{{ item.label }}</span>
        </div>
      </article>
      <article class="flat-stats__card flat-stats__card_wide">
        <div class="flat-stats__geo-head">
          <h3>{{ t("statsGeography") }}</h3>
          <SearchSourceTabs v-model="dealScope" :items="dealScopeOptions" />
          <SearchSourceTabs v-model="geoDimension" :items="geoDimensionOptions" />
        </div>
        <div v-if="geography.length" class="flat-stats__geo-list"><div v-for="row in geography" :key="row.label" class="flat-stats__geo-row"><div class="flat-stats__geo-title"><span>{{ row.label }}</span><strong>{{ number(row.count) }}</strong></div><div class="flat-stats__geo-track"><i :style="{ width: `${row.count / maxGeoCount * 100}%` }" /></div><small>{{ t("statsMedian") }}: {{ money(row.medianUsd == null ? null : convertUsd(row.medianUsd)) }}</small></div></div>
        <p v-else class="flat-stats__empty">{{ t("statsNoGeo") }}</p>
        <div v-if="geographyPriceRanges.length" class="flat-stats__range">
          <h3>{{ priceRangeTitle }}</h3>
          <UiAnalyticsBars :items="geographyPriceRanges" :format="(value) => money(value)" />
        </div>
      </article>
      <article class="flat-stats__card"><h3>{{ t("statsOwnership") }}</h3><div class="flat-stats__metrics"><div v-for="item in ownership" :key="item.key"><span>{{ item.label }}</span><strong>{{ percent(item.value) }}</strong><small>{{ number(item.value) }}</small></div></div></article>
      <article class="flat-stats__card"><h3>{{ t("statsDataQuality") }}</h3><div class="flat-stats__metrics flat-stats__metrics_quality"><div><span>{{ t("statsVisible") }}</span><strong>{{ number(statistics.total) }}</strong></div><div><span>{{ t("statsDuplicatesRejected") }}</span><strong>{{ number(statistics.quality.duplicatesRejected) }}</strong></div><div><span>{{ t("statsSuspectedFake") }}</span><strong>{{ number(statistics.quality.suspectedFake) }}</strong></div></div></article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.flat-stats__body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.flat-stats__card{min-width:0;padding:14px;border:1px solid rgba(85,111,174,.3);border-radius:11px;background:rgba(12,18,48,.9)}.flat-stats__card_wide{grid-column:1/-1}.flat-stats__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.flat-stats__card h3{margin:0 0 12px;color:var(--ui-text-muted);font-size:11px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.flat-stats__hint{display:block;margin-top:-7px;margin-bottom:10px;color:var(--ui-text-muted);font-size:10.5px}.flat-stats__segments{display:flex;gap:4px;padding:3px;border:1px solid rgba(85,111,174,.3);border-radius:8px}.flat-stats__segments button{padding:4px 8px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-muted);font-size:10px;cursor:pointer}.flat-stats__segments button.active{background:rgba(224,103,154,.18);color:#f2a2c5}.flat-stats__deal-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.flat-stats__deal{display:grid;gap:5px;padding:12px;border:1px solid rgba(85,111,174,.25);border-radius:9px;background:rgba(7,12,35,.62)}.flat-stats__deal span,.flat-stats__metrics span{color:var(--ui-text-muted);font-size:12px}.flat-stats__deal strong,.flat-stats__metrics strong{color:#f08ab8;font-size:20px}.flat-stats__deal small,.flat-stats__geo-row small,.flat-stats__metrics small{color:var(--ui-text-muted);font-size:11px}.flat-stats__geo-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px 14px;align-items:center;margin-bottom:12px}.flat-stats__geo-head h3{margin:0}.flat-stats__geo-head> :deep(.search-source-tabs:first-of-type){justify-self:end}.flat-stats__geo-head> :deep(.search-source-tabs:last-of-type){grid-column:1/-1;justify-self:end}.flat-stats__geo-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}.flat-stats__geo-row{display:grid;gap:5px}.flat-stats__geo-title{display:flex;justify-content:space-between;gap:12px;font-size:12px}.flat-stats__geo-title span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.flat-stats__geo-track{height:6px;overflow:hidden;border-radius:999px;background:rgba(85,111,174,.17)}.flat-stats__geo-track i{display:block;height:100%;border-radius:inherit;background:#24a7d6}.flat-stats__range{margin-top:18px;padding-top:16px;border-top:1px solid rgba(85,111,174,.22)}.flat-stats__legend{display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(85,111,174,.16);color:var(--ui-text-muted);font-size:10.5px}.flat-stats__legend-title{font-weight:700}.flat-stats__legend-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.flat-stats__legend-item i{width:8px;height:8px;border-radius:50%;flex:0 0 auto}.flat-stats__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.flat-stats__metrics>div{display:grid;gap:4px;align-content:start}.flat-stats__metrics_quality{grid-template-columns:repeat(3,minmax(0,1fr))}.flat-stats__empty{margin:0;color:var(--ui-text-muted);font-size:12px}
@media(max-width:900px){.flat-stats__deal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.flat-stats__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.flat-stats__geo-head{grid-template-columns:1fr}.flat-stats__geo-head> :deep(.search-source-tabs:first-of-type),.flat-stats__geo-head> :deep(.search-source-tabs:last-of-type){grid-column:auto;justify-self:stretch}.flat-stats__head{flex-wrap:wrap}}@include bp-down(sm){.flat-stats__body{grid-template-columns:1fr}.flat-stats__card_wide{grid-column:auto}.flat-stats__head{flex-direction:column}.flat-stats__segments{width:100%;overflow:auto}.flat-stats__segments button{flex:1;white-space:nowrap}.flat-stats__deal-grid,.flat-stats__geo-list,.flat-stats__metrics,.flat-stats__metrics_quality{grid-template-columns:1fr}.flat-stats__legend{align-items:flex-start;flex-direction:column}}
</style>