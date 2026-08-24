<script setup lang="ts">
interface FlatStatListing {
  price: number | null;
  currency: string;
  dealType: "sale" | "longRent" | "shortRent" | null;
  roomOnly?: boolean;
  city: string;
  source: string;
  byAgency: boolean;
  photo: string | null;
  photos: string[];
  createdAt?: string | null;
}

const props = defineProps<{
  listings: FlatStatListing[];
  displayCurrency: string;
  convert: (amount: number, from: string, to: string) => number | undefined;
}>();

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);
const activityDays = ref<7 | 30 | 60>(30);
const activityOptions: Array<7 | 30 | 60> = [7, 30, 60];
const palette = ["#e0679a", "#24a7d6", "#10b981", "#d99a0b", "#8b5cf6"];

function countBy(getKey: (listing: FlatStatListing) => string) {
  const counts = new Map<string, number>();
  for (const listing of props.listings) {
    const key = getKey(listing).trim();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const prices = computed(() => props.listings.flatMap((listing) => {
  if (listing.price == null || listing.price <= 0) return [];
  const converted = props.convert(listing.price, listing.currency, props.displayCurrency);
  return converted == null || !Number.isFinite(converted) ? [] : [converted];
}).sort((a, b) => a - b));

const priceStats = computed(() => {
  const values = prices.value;
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return { median, average: values.reduce((sum, value) => sum + value, 0) / values.length, min: values[0], max: values[values.length - 1], count: values.length };
});

const dealStats = computed(() => countBy((listing) => listing.roomOnly ? "room" : listing.dealType || "unknown"));
const cityStats = computed(() => countBy((listing) => listing.city).slice(0, 5));
const sourceStats = computed(() => countBy((listing) => listing.source).slice(0, 5));
const withPhotos = computed(() => props.listings.filter((listing) => !!listing.photo || listing.photos.length > 0).length);
const dealDonut = computed(() => dealStats.value.map(([key, value], index) => ({ label: dealLabel(key), value, color: palette[index % palette.length] })));
const cityBars = computed(() => cityStats.value.map(([label, value], index) => ({ label, value, color: palette[index % palette.length] })));
const sourceBars = computed(() => sourceStats.value.map(([label, value], index) => ({ label, value, color: palette[(index + 1) % palette.length] })));
const qualityBars = computed(() => [
  { label: t("statsWithPhotos"), value: withPhotos.value, color: "#24a7d6" },
  { label: t("agAgency"), value: props.listings.filter((item) => item.byAgency).length, color: "#e0679a" },
  { label: t("agOwner"), value: props.listings.filter((item) => !item.byAgency).length, color: "#10b981" },
]);
const activity = computed(() => {
  const bucketCount = activityDays.value === 7 ? 7 : activityDays.value === 30 ? 10 : 12;
  const end = Date.now();
  const start = end - activityDays.value * 86_400_000;
  const bucketSize = (end - start) / bucketCount;
  const values = Array.from({ length: bucketCount }, () => 0);
  for (const listing of props.listings) {
    const at = new Date(listing.createdAt || "").getTime();
    if (!Number.isFinite(at) || at < start || at > end) continue;
    values[Math.min(bucketCount - 1, Math.floor((at - start) / bucketSize))] += 1;
  }
  const labels = Array.from({ length: bucketCount }, (_, index) => new Date(start + index * bucketSize).toLocaleDateString([], { day: "2-digit", month: "2-digit" }));
  return { labels, series: [{ label: t("statsListings"), color: "#24a7d6", values }] };
});

function number(value: number) { return Math.round(value).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function money(value: number) { return `${number(value)} ${props.displayCurrency}`; }
function dealLabel(key: string) {
  if (key === "sale") return t("dtSale");
  if (key === "shortRent") return t("dtShortRent");
  if (key === "room") return t("dtRoomRent");
  if (key === "longRent") return t("dtLongRent");
  return t("notSpecified");
}
</script>

<template>
  <UiAnalyticsPanel v-if="listings.length" class="flat-stats" :title="t('statsTitle')" :collapse-label="t('statsCollapse')" :expand-label="t('statsExpand')">
    <div class="flat-stats__body">
      <article class="flat-stats__card flat-stats__card_activity">
        <div class="flat-stats__card-head"><h3>{{ t("statsActivity") }}</h3><div class="flat-stats__segments"><button v-for="days in activityOptions" :key="days" type="button" :class="{ active: activityDays === days }" @click="activityDays = days">{{ t("statsDays", { n: days }) }}</button></div></div>
        <UiAnalyticsLine :series="activity.series" :labels="activity.labels" />
      </article>
      <article class="flat-stats__card flat-stats__card_price">
        <h3>{{ t("statsPrice") }} ({{ displayCurrency }})</h3>
        <template v-if="priceStats">
          <strong>{{ money(priceStats.median) }}</strong>
          <p>{{ t("statsAverage") }} {{ money(priceStats.average) }}</p>
          <p>{{ t("statsRange") }} {{ money(priceStats.min) }}–{{ money(priceStats.max) }}</p>
          <small>{{ t("statsSamples", { n: priceStats.count }) }}</small>
        </template>
        <p v-else>{{ t("statsNoPrices") }}</p>
      </article>
      <article class="flat-stats__card"><h3>{{ t("statsDeals") }}</h3><UiAnalyticsDonut :items="dealDonut" :center-label="t('statsListings')" /></article>
      <article class="flat-stats__card"><h3>{{ t("statsCities") }}</h3><UiAnalyticsBars :items="cityBars" /></article>
      <article class="flat-stats__card"><h3>{{ t("statsSources") }}</h3><UiAnalyticsBars :items="sourceBars" /></article>
      <article class="flat-stats__card"><h3>{{ t("statsQuality") }}</h3><UiAnalyticsBars :items="qualityBars" /></article>
    </div>
  </UiAnalyticsPanel>
</template>

<style scoped>
.flat-stats__body { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.flat-stats__card { min-width: 0; padding: 14px; border: 1px solid rgba(85, 111, 174, .3); border-radius: 11px; background: rgba(12, 18, 48, .9); }
.flat-stats__card_activity { grid-column: span 2; }
.flat-stats__card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.flat-stats__segments { display: flex; gap: 4px; padding: 3px; border: 1px solid rgba(85, 111, 174, .3); border-radius: 8px; }
.flat-stats__segments button { padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--ui-text-muted); font-size: 10px; cursor: pointer; }
.flat-stats__segments button.active { background: rgba(224, 103, 154, .18); color: #f2a2c5; }
.flat-stats__card h3 { margin: 0 0 10px; color: var(--ui-text-muted); font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.flat-stats__card_price > strong { display: block; color: #f08ab8; font-size: 23px; line-height: 1.1; overflow-wrap: anywhere; }
.flat-stats__card p, .flat-stats__card small { margin: 5px 0 0; color: var(--ui-text-muted); font-size: 12px; }
.flat-stats__row { padding: 4px 0; display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.flat-stats__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flat-stats__row strong { flex: 0 0 auto; }
@media (max-width: 1100px) { .flat-stats__body { grid-template-columns: repeat(2, minmax(0, 1fr)); } .flat-stats__card_activity { grid-column: 1 / -1; } }
@media (max-width: 640px) { .flat-stats__body { grid-template-columns: 1fr; } .flat-stats__card_activity { grid-column: auto; } .flat-stats__card-head { flex-direction: column; } .flat-stats__segments { width: 100%; } .flat-stats__segments button { flex: 1; } }
</style>
