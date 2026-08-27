<script setup lang="ts">
import type { FlatListing } from "~/types/flats";
import { locationLabel } from "~/utils/locationLabels";

const props = withDefaults(defineProps<{
  title: string;
  ui?: Record<string, string>;
  dismissible?: boolean;
}>(), {
  dismissible: true,
});

const open = defineModel<boolean>("open", { required: true });
const route = useRoute();
const { locale } = useI18n();
const isFlatFinder = computed(() => route.path.endsWith("/flat-finder"));
const latestFlatListing = useState<FlatListing | null>("flats:latest-recent:v1", () => null);

type PriceTone = "green" | "blue" | "pink" | "orange" | "yellow" | "red";

function flatPriceTone(listing: FlatListing | null): PriceTone | null {
  if (!listing) return null;
  const comparison = listing.marketComparison;
  let ratio = Number(comparison?.priceRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    const median = Number(comparison?.medianUsd);
    let priceUsd = Number(comparison?.priceUsd);
    if ((!Number.isFinite(priceUsd) || priceUsd <= 0) && String(listing.currency || "").toUpperCase() === "USD") {
      priceUsd = Number(listing.price);
    }
    ratio = Number.isFinite(median) && median > 0 && Number.isFinite(priceUsd) && priceUsd > 0
      ? priceUsd / median
      : NaN;
  }
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  if (ratio >= 1.45) return "red";
  if (ratio >= 1.31) return "yellow";
  if (ratio >= 1.16) return "orange";
  if (ratio >= 0.85) return "pink";
  if (ratio >= 0.70) return "blue";
  return "green";
}

const flatListing = computed(() => isFlatFinder.value ? latestFlatListing.value : null);
const flatPublicId = computed(() => {
  const value = Number(flatListing.value?.publicId);
  return Number.isInteger(value) && value > 0 ? value : null;
});
const flatDealLabel = computed(() => {
  const listing = flatListing.value;
  if (!listing) return "";
  const english = String(locale.value).toLowerCase().startsWith("en");
  if (listing.roomOnly) return english ? "Room rent" : "Аренда комнаты";
  if (listing.dealType === "sale") return english ? "Sale" : "Продажа";
  if (listing.dealType === "shortRent") return english ? "Short-term rent" : "Краткосрочная аренда";
  if (listing.dealType === "longRent") return english ? "Long-term rent" : "Долгосрочная аренда";
  return english ? "Listing" : "Объявление";
});
const flatCityLabel = computed(() => locationLabel(flatListing.value?.city, String(locale.value), "city"));
const flatPublicTitle = computed(() => {
  if (!flatPublicId.value) return "";
  const tail = [flatDealLabel.value, flatCityLabel.value].filter(Boolean).join(", ");
  return `#${flatPublicId.value}${tail ? ` ${tail}` : ""}`;
});
const flatTone = computed(() => flatPriceTone(flatListing.value));
const effectiveTitle = computed(() => flatPublicTitle.value || props.title);

// Detail dialogs must sit above page-level fullscreen surfaces (the Flat Finder
// map uses z-index 3000, and its cluster browser uses 9000). Keep this ownership
// in the shared modal instead of adding page-specific z-index overrides.
const modalUi = computed(() => {
  const requestedContent = String(props.ui?.content || "");
  const content = isFlatFinder.value
    ? requestedContent.replace(/\bmax-w-[^\s]+/g, "").trim()
    : requestedContent;

  return {
    ...props.ui,
    overlay: ["z-[12000]", props.ui?.overlay].filter(Boolean).join(" "),
    content: [
      "z-[12001]",
      content,
      isFlatFinder.value ? "flat-finder-details w-[calc(100vw-24px)] max-w-[960px]" : "",
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
  >
    <template #title>
      <h2 v-if="flatPublicTitle" class="flat-details-public-title">
        <span
          class="flat-details-public-title__id"
          :class="flatTone ? `flat-details-public-title__id_${flatTone}` : undefined"
        >#{{ flatPublicId }}</span>
        <span class="flat-details-public-title__text">{{ [flatDealLabel, flatCityLabel].filter(Boolean).join(", ") }}</span>
      </h2>
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

.flat-details-public-title {
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

.flat-details-public-title__id {
  flex: 0 0 auto;
  color: var(--text-white, #fff);
  font-variant-numeric: tabular-nums;
}

.flat-details-public-title__id_green { color: #4ade80; }
.flat-details-public-title__id_blue { color: #67e8f9; }
.flat-details-public-title__id_pink { color: #e0679a; }
.flat-details-public-title__id_orange { color: #fb923c; }
.flat-details-public-title__id_yellow { color: #facc15; }
.flat-details-public-title__id_red { color: #ef4444; }

.flat-details-public-title__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
