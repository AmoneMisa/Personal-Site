<script setup lang="ts">
// "More from this contact" tab in the listing popup: the same contact's other
// listings, one per property, loaded when the tab is opened. Selecting one
// opens it in the same popup.
import type { FlatListing } from "~/types/flats";
import { listingLineOf } from "~/utils/flats/listingLine";

const props = defineProps<{ publicId: number | null | undefined }>();
const emit = defineEmits<{ open: [listing: FlatListing] }>();

const { t } = useI18n();
const listings = ref<FlatListing[]>([]);
const loading = ref(false);
const failed = ref(false);

async function load(publicId: number) {
  loading.value = true;
  failed.value = false;
  try {
    const data = await $fetch<{ listings: FlatListing[] }>("/flats-contact-listings", { params: { publicId } });
    // Guard against a slower response for a listing the user already left.
    if (props.publicId === publicId) listings.value = data.listings ?? [];
  } catch {
    if (props.publicId === publicId) failed.value = true;
  } finally {
    if (props.publicId === publicId) loading.value = false;
  }
}

watch(() => props.publicId, (publicId) => {
  listings.value = [];
  if (publicId) void load(publicId);
}, { immediate: true });

const price = (listing: FlatListing) => (listing.price == null ? "" : `${Math.round(listing.price).toLocaleString()} ${listing.currency || ""}`.trim());
const place = (listing: FlatListing) => [listing.city, listing.district].filter(Boolean).join(", ");
const photo = (listing: FlatListing) => listing.photo || listing.photos?.[0] || null;
</script>

<template>
  <section class="contact-listings" aria-live="polite">
    <p v-if="loading" class="contact-listings__state text-muted">{{ t("flats.loadingMore") }}</p>
    <p v-else-if="failed" class="contact-listings__state text-muted">{{ t("flats.contactListingsFailed") }}</p>
    <p v-else-if="!listings.length" class="contact-listings__state text-muted">{{ t("flats.contactListingsEmpty") }}</p>
    <ul v-else class="contact-listings__list">
      <li v-for="listing in listings" :key="`${listing.source}:${listing.id}`">
        <button
          type="button"
          class="contact-listings__item"
          :class="listingLineOf(listing.listingLine) ? `contact-listings__item_line_${listing.listingLine}` : ''"
          @click="emit('open', listing)"
        >
          <img v-if="photo(listing)" :src="photo(listing)!" alt="" class="contact-listings__photo" loading="lazy" decoding="async" referrerpolicy="no-referrer">
          <span v-else class="contact-listings__photo contact-listings__photo_empty" aria-hidden="true"><u-icon name="i-lucide-image-off" /></span>
          <span class="contact-listings__text">
            <span class="contact-listings__price">{{ price(listing) }}</span>
            <span class="contact-listings__title">{{ listing.title }}</span>
            <span class="contact-listings__place text-muted">{{ place(listing) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.contact-listings__state { padding: 18px 4px; font-size: 14px; }
.contact-listings__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.contact-listings__item {
  width: 100%;
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg-panel);
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s;
}
.contact-listings__item:hover,
.contact-listings__item:focus-visible { border-color: var(--accent-pink); }
.contact-listings__item_line_steady { border-color: var(--flat-line-steady); }
.contact-listings__item_line_phantom_risk { border-color: var(--flat-line-phantom); }
.contact-listings__item_line_multi_listing { border-color: var(--flat-line-multi); }
.contact-listings__photo { width: 88px; height: 64px; object-fit: cover; border-radius: 7px; background: var(--bg-panel-2); }
.contact-listings__photo_empty { display: grid; place-items: center; color: var(--text-muted); }
.contact-listings__text { min-width: 0; display: grid; gap: 2px; }
.contact-listings__price { font-weight: 700; font-size: 15px; }
.contact-listings__title,
.contact-listings__place { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.contact-listings__place { font-size: 12px; }
</style>
