<script setup lang="ts">
import type { FlatFeedResult, FlatListing } from "~/types/flats";

/**
 * Real listings in the server-rendered HTML. The interactive feed above is
 * filled in the browser, so a crawler that does not run scripts used to receive
 * an empty search page. This block is fetched during SSR, shipped in the Nuxt
 * payload and never refetched on hydration; it is plain text and links, with no
 * state shared with the interactive feed, so it cannot cause a hydration
 * mismatch. A failed or empty fetch renders nothing.
 */
const MARKETS = ["UZ", "UA"] as const;
const LIMIT = 12;
const { t: translate } = useI18n();
const t = (key: string) => translate(`flats.${key}`);

const { data } = await useAsyncData("flat-finder-latest-listings", async () => {
  const entries = await Promise.all(MARKETS.map(async (country) => {
    try {
      const result = await $fetch<FlatFeedResult>("/flats-feed", {
        params: { countries: country, limit: String(LIMIT), sources: "olx,telegram,custom", sort: "newest" },
        timeout: 2500,
      });
      const items = (result?.listings || []).filter((l: FlatListing) => l.publicId && l.title).slice(0, LIMIT);
      return [country, items.map((l: FlatListing) => ({
        publicId: l.publicId as number,
        title: l.title,
        city: l.city,
        district: l.district || "",
        price: l.price,
        currency: l.currency,
        rooms: l.rooms,
        areaSqm: l.areaSqm,
      }))] as const;
    } catch {
      return [country, []] as const;
    }
  }));
  return Object.fromEntries(entries) as Record<string, Array<{ publicId: number; title: string; city: string; district: string; price: number | null; currency: string; rooms: number | null; areaSqm: number | null }>>;
}, { server: true, lazy: false });

const groups = computed(() => MARKETS
  .map((country) => ({ country, items: data.value?.[country] || [] }))
  .filter((group) => group.items.length));

function priceText(item: { price: number | null; currency: string }): string {
  if (item.price == null) return "";
  return `${new Intl.NumberFormat("en-US").format(Math.round(item.price))} ${item.currency}`;
}
function meta(item: { city: string; district: string; areaSqm: number | null }): string {
  return [item.city, item.district, item.areaSqm ? `${item.areaSqm} m²` : ""].filter(Boolean).join(" · ");
}
</script>

<template>
  <section v-if="groups.length" class="flat-latest" aria-labelledby="flat-latest-title">
    <h2 id="flat-latest-title" class="flat-latest__title">{{ t("latestTitle") }}</h2>
    <div v-for="group in groups" :key="group.country" class="flat-latest__group">
      <h3>{{ t(`latestMarket${group.country}`) }}</h3>
      <ul>
        <li v-for="item in group.items" :key="item.publicId">
          <NuxtLink :to="{ path: '/flat-finder', query: { adv: String(item.publicId) } }">{{ item.title }}</NuxtLink>
          <span v-if="priceText(item)"> — {{ priceText(item) }}</span>
          <small>{{ meta(item) }}</small>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.flat-latest { margin-top: 2rem; }
.flat-latest__title { font-size: 1.25rem; margin-bottom: .75rem; }
.flat-latest__group { margin-bottom: 1.25rem; }
.flat-latest__group h3 { font-size: 1rem; margin-bottom: .5rem; }
.flat-latest ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
.flat-latest small { display: block; opacity: .7; }
</style>
