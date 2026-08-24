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
}

const props = defineProps<{
  listings: FlatStatListing[];
  displayCurrency: string;
  convert: (amount: number, from: string, to: string) => number | undefined;
}>();

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);
const expanded = ref(true);

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
  <section v-if="listings.length" class="flat-stats">
    <button type="button" class="flat-stats__head" :aria-expanded="expanded" @click="expanded = !expanded">
      <span class="flat-stats__heading"><u-icon name="i-lucide-chart-no-axes-combined" />{{ t("statsTitle") }}</span>
      <span class="flat-stats__toggle">{{ expanded ? t("statsCollapse") : t("statsExpand") }}<u-icon :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" /></span>
    </button>
    <div v-if="expanded" class="flat-stats__body">
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
      <article class="flat-stats__card"><h3>{{ t("statsDeals") }}</h3><div v-for="[deal, count] in dealStats" :key="deal" class="flat-stats__row"><span>{{ dealLabel(deal) }}</span><strong>{{ count }}</strong></div></article>
      <article class="flat-stats__card"><h3>{{ t("statsCities") }}</h3><div v-for="[city, count] in cityStats" :key="city" class="flat-stats__row"><span>{{ city }}</span><strong>{{ count }}</strong></div></article>
      <article class="flat-stats__card"><h3>{{ t("statsSources") }}</h3><div v-for="[source, count] in sourceStats" :key="source" class="flat-stats__row"><span>{{ source }}</span><strong>{{ count }}</strong></div></article>
      <article class="flat-stats__card">
        <h3>{{ t("statsQuality") }}</h3>
        <div class="flat-stats__row"><span>{{ t("statsWithPhotos") }}</span><strong>{{ withPhotos }}</strong></div>
        <div class="flat-stats__row"><span>{{ t("agAgency") }}</span><strong>{{ listings.filter((item) => item.byAgency).length }}</strong></div>
        <div class="flat-stats__row"><span>{{ t("agOwner") }}</span><strong>{{ listings.filter((item) => !item.byAgency).length }}</strong></div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.flat-stats { margin: 8px 0 22px; overflow: hidden; border: 1px solid rgba(85, 111, 174, .38); border-radius: 14px; background: linear-gradient(135deg, rgba(5, 10, 31, .97), rgba(12, 18, 48, .95) 56%, rgba(39, 15, 53, .94)); box-shadow: 0 18px 45px rgba(0, 0, 0, .22); }
.flat-stats__head { width: 100%; min-height: 56px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 16px; color: var(--ui-text); background: transparent; border: 0; cursor: pointer; }
.flat-stats__heading, .flat-stats__toggle { display: flex; align-items: center; gap: 9px; }
.flat-stats__heading { font-size: 17px; font-weight: 750; }
.flat-stats__heading :deep(svg) { color: #e0679a; font-size: 21px; }
.flat-stats__toggle { color: var(--ui-text-muted); font-size: 13px; }
.flat-stats__body { padding: 0 16px 16px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.flat-stats__card { min-width: 0; padding: 14px; border: 1px solid rgba(85, 111, 174, .3); border-radius: 11px; background: rgba(12, 18, 48, .9); }
.flat-stats__card h3 { margin: 0 0 10px; color: var(--ui-text-muted); font-size: 11px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.flat-stats__card_price > strong { display: block; color: #f08ab8; font-size: 23px; line-height: 1.1; overflow-wrap: anywhere; }
.flat-stats__card p, .flat-stats__card small { margin: 5px 0 0; color: var(--ui-text-muted); font-size: 12px; }
.flat-stats__row { padding: 4px 0; display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.flat-stats__row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flat-stats__row strong { flex: 0 0 auto; }
@media (max-width: 1100px) { .flat-stats__body { grid-template-columns: repeat(2, minmax(0, 1fr)); } .flat-stats__card_price { grid-column: 1 / -1; } }
@media (max-width: 640px) { .flat-stats__head { align-items: flex-start; } .flat-stats__toggle { font-size: 0; } .flat-stats__toggle :deep(svg) { font-size: 18px; } .flat-stats__body { grid-template-columns: 1fr; padding-inline: 12px; } .flat-stats__card_price { grid-column: auto; } }
</style>
