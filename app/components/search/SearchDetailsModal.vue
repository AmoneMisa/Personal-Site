<script setup lang="ts">
import type { FlatListing } from "~/types/flats";
import type { FlatLocationLabeler } from "~/utils/flats/locationLabels";
import { useFlatDetailsTitle } from "~/composables/flats/useFlatDetailsTitle";

const props = withDefaults(defineProps<{
  title: string;
  flatListing?: FlatListing | null;
  flatLocationLabel?: FlatLocationLabeler;
  /** USD-converted price of flatListing. The modal has no exchange rates of its own. */
  flatPriceUsd?: number | null;
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
const { text: flatTitleText, idTone: flatIdTone } = useFlatDetailsTitle({
  listing: activeFlatListing,
  priceUsd: computed(() => props.flatPriceUsd),
  locationLabel: (...args) => props.flatLocationLabel?.(...args) ?? String(args[0] ?? ""),
});
const flatGoodPrice = computed(() => activeFlatListing.value?.marketComparison?.goodPrice === true);
const flatGoodPriceLabel = computed(() => String(locale.value).toLowerCase().startsWith("en") ? "Good price" : "Хорошая цена");

// "#12345 <text>" applies to any search-board detail (a job vacancy or
// candidate carries its own publicId too), not just flats — flatTitleText
// is simply empty outside Flat Finder, leaving props.title as the text.
const displayPublicId = computed(() => {
  const raw = activeFlatListing.value?.publicId ?? props.publicId;
  const value = String(raw ?? "").trim();
  return value && value !== "0" ? value : "";
});
const publicTitleText = computed(() => isFlatFinder.value ? flatTitleText.value : props.title);
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
        <span class="search-details-public-title__id" :class="flatIdTone ? `search-details-public-title__id_${flatIdTone}` : ''">#{{ displayPublicId }}</span>
        <div class="search-details-public-title__content">
          <span v-if="isFlatFinder" class="search-details-public-title__text">{{ publicTitleText }}</span>
          <slot v-else-if="$slots.title" name="title" />
          <span v-else class="search-details-public-title__text">{{ publicTitleText }}</span>
        </div>
        <span v-if="flatGoodPrice" class="search-details-public-title__good-price">
          <u-icon name="i-lucide-trending-down" aria-hidden="true" />
          {{ flatGoodPriceLabel }}
        </span>
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

<style lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
@use "../../assets/css/mixins/flat-tone" as *;

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
  width: 100%;
  min-width: 0;
  margin: 0;
  padding-right: 36px;
  display: flex;
  align-items: center;
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
@include flat-tone-modifiers(".search-details-public-title__id");

.search-details-public-title__content {
  flex: 1 1 auto;
  min-width: 0;
}

.search-details-public-title__text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-details-public-title__good-price {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid rgb(74 222 128 / 36%);
  border-radius: 999px;
  background: rgb(34 197 94 / 13%);
  color: #86efac;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

@include bp-down(sm) {
  .search-details-public-title__good-price {
    padding-inline: 7px;
    font-size: 11px;
  }
}
</style>
