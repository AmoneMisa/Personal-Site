<script setup lang="ts">
import type { FlatListing } from "~/types/flats";
import { locationLabel } from "~/utils/locationLabels";

const props = withDefaults(defineProps<{
  title: string;
  flatListing?: FlatListing | null;
  publicId?: number | string | null;
  ui?: Record<string, string>;
  dismissible?: boolean;
}>(), {
  dismissible: true,
});

const open = defineModel<boolean>("open", { required: true });
const route = useRoute();
const { locale } = useI18n();
const isFlatFinder = computed(() => route.path.endsWith("/flat-finder"));
const isSearchBoard = computed(() => ["/flat-finder", "/jobs", "/hiring"].some((path) => route.path.endsWith(path)));

const activeFlatListing = computed(() => isFlatFinder.value ? props.flatListing || null : null);
const displayPublicId = computed(() => {
  const raw = activeFlatListing.value?.publicId ?? props.publicId;
  const value = String(raw ?? "").trim();
  return value && value !== "0" ? value : "";
});
const flatDealLabel = computed(() => {
  const listing = activeFlatListing.value;
  if (!listing) return "";
  const english = String(locale.value).toLowerCase().startsWith("en");
  if (listing.roomOnly) return english ? "Room rent" : "Аренда комнаты";
  if (listing.dealType === "sale") return english ? "Sale" : "Продажа";
  if (listing.dealType === "shortRent") return english ? "Short-term rent" : "Краткосрочная аренда";
  if (listing.dealType === "longRent") return english ? "Long-term rent" : "Долгосрочная аренда";
  return english ? "Listing" : "Объявление";
});
const flatCityLabel = computed(() => locationLabel(activeFlatListing.value?.city, String(locale.value), "city"));
const publicTitleText = computed(() => isFlatFinder.value
  ? [flatDealLabel.value, flatCityLabel.value].filter(Boolean).join(", ")
  : props.title);
const publicTitle = computed(() => {
  if (!displayPublicId.value) return "";
  return `#${displayPublicId.value}${publicTitleText.value ? ` ${publicTitleText.value}` : ""}`;
});
const effectiveTitle = computed(() => publicTitle.value || props.title);

// Detail dialogs must sit above page-level fullscreen surfaces (the Flat Finder
// map uses z-index 3000, and its cluster browser uses 9000). Keep this ownership
// in the shared modal instead of adding page-specific z-index overrides.
const modalUi = computed(() => {
  const requestedContent = String(props.ui?.content || "");
  const content = isSearchBoard.value
    ? requestedContent.replace(/\bmax-w-[^\s]+/g, "").trim()
    : requestedContent;

  return {
    ...props.ui,
    content: [
      content,
      isSearchBoard.value ? "search-details-modal" : "",
      isFlatFinder.value ? "flat-finder-details" : "",
    ].filter(Boolean).join(" "),
  };
});
</script>

<template>
  <u-modal
    v-model:open="open"
    :title="effectiveTitle"
    :ui="modalUi"
    :dismissible="dismissible"
    :max-width="isSearchBoard ? '960px' : undefined"
    :z-index="isFlatFinder ? 12000 : undefined"
  >
    <template #title>
      <div v-if="publicTitle" class="search-details-public-title">
        <span class="search-details-public-title__id">#{{ displayPublicId }}</span>
        <div class="search-details-public-title__content">
          <span v-if="isFlatFinder" class="search-details-public-title__text">{{ publicTitleText }}</span>
          <slot v-else-if="$slots.title" name="title" />
          <span v-else class="search-details-public-title__text">{{ publicTitleText }}</span>
        </div>
      </div>
      <slot v-else-if="$slots.title" name="title" />
      <span v-else>{{ effectiveTitle }}</span>
    </template>
    <template #body>
      <slot name="body" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </u-modal>
</template>

<style>
/* Flat Finder deliberately keeps every fact in one place: the specification
   grid. Deal/room badges beside the price and generated tag chips duplicated
   the same data, so the compact dialog does not render them visually. */
.flat-finder-details .flat-modal__deal,
.flat-finder-details .flat-modal__tags {
  display: none !important;
}

.flat-finder-details [data-slot="header"] {
  padding-bottom: 10px;
}

.flat-finder-details [data-slot="body"] {
  padding-top: 8px;
  padding-bottom: 10px;
}

.flat-finder-details [data-slot="footer"] {
  padding-top: 10px;
}

.search-details-public-title {
  min-width: 0;
  margin: 0;
  padding-right: 36px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

.search-details-public-title__id {
  flex: 0 0 auto;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.search-details-public-title__content { min-width: 0; }

.search-details-public-title__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
