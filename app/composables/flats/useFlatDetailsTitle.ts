import type { ComputedRef } from "vue";
import type { FlatListing } from "~/types/flats";
import { locationLabel } from "~/utils/locationLabels";
import { flatPriceTone, type FlatPriceTone } from "~/utils/flats/priceTone";

/**
 * Turns a flat listing into the two flat-specific things SearchDetailsModal's
 * public title needs: "Long-term rent, Kyiv" descriptive text, and the
 * price-vs-median tone the popup ID is colored with. Kept out of
 * SearchDetailsModal.vue so that generic modal component stays a shell —
 * composing "#12345 <text>" out of an id and this text is a generic modal-
 * title concern shared with jobs/hiring, not something that belongs here.
 */
export function useFlatDetailsTitle(options: {
  listing: ComputedRef<FlatListing | null>;
  priceUsd: ComputedRef<number | null | undefined>;
}) {
  const { locale } = useI18n();

  const dealLabel = computed(() => {
    const listing = options.listing.value;
    if (!listing) return "";
    const english = String(locale.value).toLowerCase().startsWith("en");
    if (listing.roomOnly) return english ? "Room rent" : "Аренда комнаты";
    if (listing.dealType === "sale") return english ? "Sale" : "Продажа";
    if (listing.dealType === "shortRent") return english ? "Short-term rent" : "Краткосрочная аренда";
    if (listing.dealType === "longRent") return english ? "Long-term rent" : "Долгосрочная аренда";
    return english ? "Listing" : "Объявление";
  });

  const cityLabel = computed(() => locationLabel(options.listing.value?.city, String(locale.value), "city"));

  const text = computed(() => [dealLabel.value, cityLabel.value].filter(Boolean).join(", "));

  // The price itself is deliberately left uncolored (it already sits right
  // next to the median comparison text); the ID carries the price-vs-median
  // signal instead, since it is the one thing on screen in every state.
  const idTone = computed<FlatPriceTone | null>(() => (
    flatPriceTone(options.priceUsd.value, options.listing.value?.marketComparison?.medianUsd)
  ));

  return { text, idTone };
}
