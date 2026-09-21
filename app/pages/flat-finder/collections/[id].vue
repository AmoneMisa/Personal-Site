<script setup lang="ts">
// One collection on its own page. Deliberately light: the listings were saved
// with their full payload, so this renders them straight from storage without
// hitting the feed. Opening a card hands off to the search page's existing
// deep-link (?flat=&flatSource=&flatCountry=), which owns the details modal.
import type { FlatListing as Listing } from "~/types/flats";
import { useFlatCollections } from "~/composables/flats/useFlatCollections";
import { useFlatPresentation } from "~/composables/flats/useFlatPresentation";
import { useFlatPhotos } from "~/composables/flats/useFlatPhotos";
import { convertCurrency } from "~/utils/search/money";
import { safeFetch } from "~/utils/safeFetch";
import FlatCard from "~/components/flats/FlatCard.vue";

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);
const route = useRoute();
const localePath = useLocalePath();

const { collections, loaded, load, rename, removeItem } = useFlatCollections();
const collectionId = computed(() => String(route.params.id ?? ""));
const collection = computed(() => collections.value.find((item) => item.id === collectionId.value));

const { listingPhoto, markPhotoFailedFromEvent } = useFlatPhotos();
// Prices are stored in the listing's own currency; USD is the safe default
// until /flats-rates answers. A failed rates call just leaves prices native.
const displayCurrency = ref("USD");
const rates = ref<Record<string, number>>({ USD: 1 });
function convert(amount: number, from: string, to: string): number | undefined {
  return convertCurrency(amount, from || "USD", to || "USD", rates.value);
}
const { presentCard } = useFlatPresentation({
  t,
  getLocale: () => String(locale.value),
  // Saved listings carry their own city/district strings, and this page has no
  // country metadata loaded, so the raw value is the label.
  getLocationLabel: (value) => String(value ?? ""),
  getDisplayCurrency: () => displayCurrency.value,
  getView: () => "collections",
  getDealType: () => "",
  getRoomOnly: () => false,
  getAgency: () => "",
  convert,
});

// Personal content: never index it, and give each collection its own title.
useSeoMeta({
  title: () => collection.value?.title || t("collectionsTab"),
  robots: () => "noindex, nofollow",
});

const renaming = ref(false);
const draftTitle = ref("");
function startRename() {
  draftTitle.value = collection.value?.title ?? "";
  renaming.value = true;
}
function commitRename() {
  rename(collectionId.value, draftTitle.value, t("collectionUntitled"));
  renaming.value = false;
}

function openListing(listing: Listing) {
  return localePath({
    path: "/flat-finder",
    query: { flat: listing.id, flatSource: listing.source, flatCountry: listing.country },
  });
}

onMounted(async () => {
  load();
  const { data } = await safeFetch<{ rates?: Record<string, number> }>("/flats-rates");
  if (data?.rates?.USD) rates.value = data.rates;
});
</script>

<template>
  <SearchPageShell :title="collection?.title ?? t('collectionsTab')" class-name="flat-collection">
    <!-- Own header: the shell's default renders just a centred h1, and this
         page needs the back link, the rename field and the count beside it. -->
    <template #header>
    <header class="flat-collection__head">
      <NuxtLink :to="localePath('/flat-finder/collections')" class="flat-collection__back">
        <u-icon name="i-lucide-arrow-left" />{{ t("collectionsTab") }}
      </NuxtLink>

      <template v-if="collection">
        <form v-if="renaming" class="flat-collection__rename" @submit.prevent="commitRename">
          <u-input v-model="draftTitle" autofocus class="flat-collection__rename-input" />
          <u-button type="submit" icon="i-lucide-check">{{ t("collectionRenameSave") }}</u-button>
        </form>
        <div v-else class="flat-collection__title-row">
          <h1 class="flat-collection__title">{{ collection.title }}</h1>
          <u-button variant="outline" color="neutral" icon="i-lucide-pencil" @click="startRename">
            {{ t("collectionRename") }}
          </u-button>
        </div>
        <p class="flat-collection__count text-muted">{{ t("collectionCount", { n: collection.items.length }) }}</p>
      </template>
    </header>
    </template>

    <!-- `loaded` guards the gap before localStorage is read on the client:
         without it every collection looks missing for one tick. -->
    <p v-if="loaded && !collection" class="flat-collection__missing text-muted">{{ t("collectionMissing") }}</p>
    <p v-else-if="loaded && collection && !collection.items.length" class="flat-collection__missing text-muted">{{ t("collectionEmpty") }}</p>

    <SearchResultGrid v-if="collection && collection.items.length">
      <div v-for="listing in collection.items" :key="`${listing.source}:${listing.id}`" class="flat-collection__cell">
        <NuxtLink :to="openListing(listing)" class="flat-collection__card-link">
          <FlatCard
            :listing="listing"
            :photo="listingPhoto(listing)"
            :presentation="presentCard(listing)"
            :no-photo-label="t('noPhoto')"
            :checking-label="t('checkingListing')"
            :favorite-label="t('addFavorite')"
            :hide-label="t('hideListing')"
            @photo-error="markPhotoFailedFromEvent"
          />
        </NuxtLink>
        <u-button
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-x"
          class="flat-collection__remove"
          @click="removeItem(collectionId, listing.id)"
        >
          {{ t("collectionRemoveItem") }}
        </u-button>
      </div>
    </SearchResultGrid>
  </SearchPageShell>
</template>

<style scoped lang="scss">
.flat-collection__head { display: grid; gap: 8px; padding: 24px 0 16px; }
.flat-collection__back { display: inline-flex; align-items: center; gap: 6px; width: fit-content; color: var(--text-muted); font-size: 13px; text-decoration: none; }
.flat-collection__back:hover { color: var(--accent-pink); }
.flat-collection__title-row, .flat-collection__rename { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.flat-collection__rename-input { flex: 1 1 260px; min-width: 0; }
.flat-collection__title { margin: 0; font-size: 26px; font-weight: 700; overflow-wrap: anywhere; }
.flat-collection__count, .flat-collection__missing { margin: 0; font-size: 13px; }
.flat-collection__cell { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.flat-collection__card-link { display: block; color: inherit; text-decoration: none; }
.flat-collection__remove { align-self: flex-start; }
</style>
