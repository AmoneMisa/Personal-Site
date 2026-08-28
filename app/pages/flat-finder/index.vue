<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { metroLabelWithAlias, locationLabel, type LocationKind } from "~/utils/locationLabels";
import FlatMap from "~/components/flats/FlatMap.client.vue";
import FlatCard from "~/components/flats/FlatCard.vue";
import SearchResultGrid from "~/components/search/SearchResultGrid.vue";
import FlatGallery from "~/components/flats/FlatGallery.vue";
import SearchDetailsModal from "~/components/search/SearchDetailsModal.vue";
import SearchPageShell from "~/components/search/SearchPageShell.vue";
import SearchSavedTabs from "~/components/search/SearchSavedTabs.vue";
import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";
import SearchAdvancedFilters from "~/components/search/SearchAdvancedFilters.vue";
import SearchPresetDialog from "~/components/search/SearchPresetDialog.vue";
import SearchShareDialog from "~/components/search/SearchShareDialog.vue";
import SearchSourceTabs from "~/components/search/SearchSourceTabs.vue";
import SearchEmptyState from "~/components/search/SearchEmptyState.vue";
import { queryString } from "~/utils/queryParams";
import { convertCurrency } from "~/utils/search/money";
import { regionalSearchCountry } from "~/utils/search/regionalCountry";
import { useFlatFilters } from "~/composables/flats/useFlatFilters";
import { useFlatFilterBlocks } from "~/composables/flats/useFlatFilterBlocks";
import { useFlatFeed } from "~/composables/flats/useFlatFeed";
import { useFlatPhotos } from "~/composables/flats/useFlatPhotos";
import { useFlatMap } from "~/composables/flats/useFlatMap";
import { useFlatRouteState } from "~/composables/flats/useFlatRouteState";
import { useFlatTranslation } from "~/composables/flats/useFlatTranslation";
import { useFlatPresentation } from "~/composables/flats/useFlatPresentation";
import { useFlatMeta } from "~/composables/flats/useFlatMeta";
import { useFlatAvailabilityCache } from "~/composables/flats/useFlatAvailabilityCache";
import { useSavedCollections } from "~/composables/search/useSavedCollections";
import { useInfiniteFeed } from "~/composables/search/useInfiniteFeed";
import { useSearchScroll } from "~/composables/search/useSearchScroll";
import { ANY_SELECT_VALUE, useNullableSelect } from "~/composables/search/useNullableSelect";
import { useShareLink } from "~/composables/search/useShareLink";
import type {
  FlatFeedResult as FeedResult,
  FlatListing as Listing,
  FlatView,
} from "~/types/flats";

// Flat Finder. Auto-routed at /flat-finder. Reuses the flat-finder backend
// (same one the desktop app uses) via the /flats-* proxy routes, so listings,
// filters and the map all work over HTTPS same-origin.

const PAGE_SIZE = 20;
const STORAGE = {
  presets: "flats:presets:v1",
};

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);
const route = useRoute();
const router = useRouter();
const toast = useToast();

useSeoMeta({
  title: () => t("seoTitle"),
  description: () => t("seoDescription"),
  robots: () => "index, follow",
  ogType: () => "website",
  ogTitle: () => t("seoTitle"),
  ogDescription: () => t("seoDescription"),
});

// ---- filters ----
// What "Reset filters" selects. An empty list means every country, so a cleared
// form needs a real choice rather than the absence of one.
const defaultCountry = ref("UA");
const flatFilters = useFlatFilters();
const {
  countries, city, district, propertyType, dealType, agency, petFriendly, roomOnlyFilter,
  onlyWithPhotos, childrenRequired, newBuildingOnly, dishwasherOnly, airConditionerOnly,
  parkingOnly, internetOnly, gasOnly, balconyOnly, terraceOnly, privateYardOnly, sort,
  audience, metro, priceMin, priceMax, roomsMin, roomsMax, bedroomsMin, bedroomsMax,
  areaMin, areaMax, pricePerSqmMin, pricePerSqmMax, metroMaxM, nearbyKind, nearbyMaxM,
  floorMin, floorMax, totalFloorsMin, totalFloorsMax, yearMin, yearMax, maxAgeDays,
  displayCurrency, query, source, showAdvanced, buildFeedParams, resetValues: resetFilterValues,
} = flatFilters;
const rates = ref<Record<string, number>>({ USD: 1 });
const { isFresh: isAvailabilityFresh, markFresh: markAvailabilityFresh, forget: forgetAvailability } = useFlatAvailabilityCache();

const {
  listings, total, loading, loadingMore, warming, failed, sourceErrors, statistics,
  nextCursor, loadMoreSentinel, loadFeed,
} = useFlatFeed({ onAvailabilityChecked: markAvailabilityFresh });
const { listingPhoto, visiblePhotos, markPhotoFailedFromEvent } = useFlatPhotos();
const view = ref<FlatView>("active");
const {
  presentCard,
  displayListingTitle,
  priceLabel,
  convertedLabel,
  nearbyItemLabel,
  dealLabel,
  ptLabel,
} = useFlatPresentation({
  t,
  getLocale: () => String(locale.value),
  getDisplayCurrency: () => displayCurrency.value,
  getView: () => view.value,
  getDealType: () => dealType.value,
  getRoomOnly: () => roomOnlyFilter.value,
  getAgency: () => agency.value,
  convert,
});
const {
  favorites,
  hidden,
  recent,
  hiddenIds,
  favoriteIds,
  isHidden,
  isFavorite,
  toggleFavorite,
  toggleHidden,
  addRecent,
  removeWhere: removeSavedWhere,
  load: loadSavedCollections,
} = useSavedCollections<Listing>({
  namespace: "flats",
  getId: (item) => item.id,
  favoritesLimit: 200,
  hiddenLimit: 200,
  recentLimit: 30,
});
const presetModalOpen = ref(false);
const shareModalOpen = ref(false);
const sharedLinkOpened = ref(false);
const { drawnArea, applyDrawnArea } = useFlatMap(listings);
const {
  filtersEl,
  showBackToFilters: showBackToTop,
  scrollToFilters,
} = useSearchScroll(600);
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let sharedListingTimer: ReturnType<typeof setTimeout> | undefined;
let lastPaginationScrollY = 0;
const pageRestoring = ref(true);

const { copyText } = useClipboard();
const {
  presets,
  presetName,
  loadPresets,
  savePreset: saveSearchPreset,
  applyPreset,
  removePreset,
} = useSearchPresets({
  storageKey: STORAGE.presets,
  getQuery: currentFilterQuery,
  applyQuery: applyQueryParams,
  afterApply: () => scheduleLoad(0),
});
const viewTabs = computed(() => [
  { value: "active", label: t("allListings") },
  { value: "favorites", label: t("favorites"), count: favorites.value.length },
  { value: "recent", label: t("recent"), count: recent.value.length },
  { value: "hidden", label: t("hidden"), count: hidden.value.length },
]);

const locName = (value: string | null | undefined, kind: LocationKind = "any") => locationLabel(value, locale.value, kind);
const {
  districtOptions,
  metroOptions,
  countryItems,
  cityItems,
  districtItems,
  metroItems,
  loadMeta,
} = useFlatMeta({
  countries,
  city,
  t,
  locationLabel: (value, kind) => locName(value, kind),
  preferredCountry: () => defaultCountry.value,
});

const SOURCES = ["olx", "telegram"];
const NEARBY_KINDS = [
  "supermarket", "mall", "market", "pharmacy", "clinic",
  "school", "kindergarten", "park", "transport", "historic", "cinema", "landmark",
] as const;
const sourceOptions = computed(() => [{ value: "", label: t("all") }, ...SOURCES.map((s) => ({ value: s, label: s }))]);
type Item = { label: string; value: string };
const citySel = useNullableSelect(city);
const nearbyKindItems = computed<Item[]>(() => [
  { label: t("nearbyKindAny"), value: ANY_SELECT_VALUE },
  ...NEARBY_KINDS.map((kind) => ({ value: kind, label: t(`nearbyKind_${kind}`) })),
]);
const nearbyKindSel = useNullableSelect(nearbyKind);
const CURRENCY_PRIORITY = ["USD", "EUR", "UZS", "KZT", "UAH", "RON", "GBP", "KGS", "TJS", "TMT", "PLN"];
const currencyItems = computed<Item[]>(() => {
  const keys = Object.keys(rates.value).filter((c) => /^[A-Z]{3}$/.test(c) && rates.value[c]! > 0);
  const preferred = CURRENCY_PRIORITY.filter((c) => keys.includes(c));
  const rest = keys.filter((c) => !CURRENCY_PRIORITY.includes(c)).sort();
  return [...preferred, ...rest].map((c) => ({ label: c, value: c }));
});
const extraLabels = computed(() => ({
  amenities: t("amenities"), dishwasher: t("dishwasher"), ac: t("airConditioner"),
  parking: t("parking"), internet: t("internet"), gas: t("gas"), balcony: t("balcony"),
  terrace: t("terrace"), yard: t("privateYard"), sort: t("sort"), newest: t("sortNewest"),
  oldest: t("sortOldest"), priceAsc: t("sortPriceAsc"), priceDesc: t("sortPriceDesc"),
  titleAsc: t("sortTitleAsc"), titleDesc: t("sortTitleDesc"),
}));
const sortItems = computed<Item[]>(() => [
  { value: "newest", label: extraLabels.value.newest },
  { value: "oldest", label: extraLabels.value.oldest },
  { value: "priceAsc", label: extraLabels.value.priceAsc },
  { value: "priceDesc", label: extraLabels.value.priceDesc },
  { value: "titleAsc", label: extraLabels.value.titleAsc },
  { value: "titleDesc", label: extraLabels.value.titleDesc },
]);
const districtSel = useNullableSelect(district);
const metroSel = useNullableSelect(metro);
const audienceItems = computed<Item[]>(() => [
  { label: t('audienceAny'), value: "any" },
  { label: t('audienceWomen'), value: "women" },
  { label: t('audienceMen'), value: "men" },
  { label: t('audienceFamily'), value: "family" },
]);
const propertyTypeItems = computed<Item[]>(() => [
  { label: t("ptAny"), value: "any" }, { label: t("ptFlat"), value: "flat" }, { label: t("ptHouse"), value: "house" },
]);
const dealTypeItems = computed<Item[]>(() => [
  { label: t("dtAny"), value: "any" }, { label: t("dtSale"), value: "sale" },
  { label: t("dtLongRent"), value: "longRent" }, { label: t("dtRoomRent"), value: "roomRent" },
  { label: t("dtShortRent"), value: "shortRent" },
]);
const agencyItems = computed<Item[]>(() => [
  { label: t("agAny"), value: "any" }, { label: t("agOwner"), value: "owner" }, { label: t("agAgency"), value: "agency" },
]);

const flatAdvancedFilterBlocks = useFlatFilterBlocks({
  t,
  filters: flatFilters,
  districtSelect: districtSel,
  metroSelect: metroSel,
  nearbyKindSelect: nearbyKindSel,
  districtItems,
  metroItems,
  nearbyKindItems,
  audienceItems,
  propertyTypeItems,
  hasDistricts: () => districtOptions.value.length > 0,
  hasMetro: () => metroOptions.value.length > 0,
  scheduleLoad,
});

function loadPersonalState() {
  loadSavedCollections();
  loadPresets();
  try { showAdvanced.value = localStorage.getItem("flats:showAdvanced") === "1"; } catch { /* noop */ }
}
watch(showAdvanced, (value) => {
  if (!import.meta.client) return;
  try { localStorage.setItem("flats:showAdvanced", value ? "1" : "0"); } catch { /* noop */ }
});

const activeListings = computed(() => applyDrawnArea(listings.value.filter((item) => !hiddenIds.value.has(item.id))));
const displayedListings = computed(() => {
  if (view.value === "favorites") return applyDrawnArea(favorites.value);
  if (view.value === "recent") return applyDrawnArea(recent.value);
  if (view.value === "hidden") return applyDrawnArea(hidden.value);
  return activeListings.value;
});
const hasMore = computed(() => view.value === "active" && listings.value.length < total.value);
function loadMoreListings() {
  const currentScrollY = window.scrollY;
  if (currentScrollY <= lastPaginationScrollY + 40) return;
  lastPaginationScrollY = currentScrollY;
  void load(true, false);
}
useInfiniteFeed({
  sentinel: loadMoreSentinel,
  hasMore,
  loading: computed(() => loading.value || loadingMore.value),
  loadMore: loadMoreListings,
  rootMargin: "0px",
  threshold: 0.01,
});

const flatRouteState = useFlatRouteState({ router, route, filters: flatFilters, sources: SOURCES });
function currentFilterQuery(): Record<string, string> { return flatRouteState.serialize(); }
function applyQueryParams(params: Record<string, unknown>) { flatRouteState.deserialize(params); }
// The address bar follows the filters directly instead of waiting for a request
// to come back. It used to be written only at the end of a successful load, so
// a failed or still-running request left the URL describing filters that were no
// longer applied: resetting did not clear it, and removing one of the chips
// above the results did not take that filter out of the query string either.
const { schedule: scheduleQuerySync, sync: syncQueryParams } = flatRouteState;
const shareUrl = computed(() => {
  const resolved = router.resolve({ path: route.path, query: { ...currentFilterQuery(), shared: "1" } });
  return import.meta.client ? new URL(resolved.href, window.location.origin).toString() : resolved.href;
});
async function copyShareLink() { await copyText(shareUrl.value); }
function savePreset() {
  if (saveSearchPreset()) presetModalOpen.value = false;
}
async function loadRates() { const { data } = await safeFetch<{ rates?: Record<string, number> }>("/flats-rates"); if (data?.rates && data.rates.USD) rates.value = data.rates; }
// The listing feed itself is offset/cursor-based infinite scroll, not paged —
// "page" here is purely a URL bookmark of how many PAGE_SIZE batches are
// loaded, so a shared link can restore roughly where the visitor left off.
function currentPageNumber(): number { return Math.max(1, Math.ceil(listings.value.length / PAGE_SIZE)); }
function syncPageInUrl(page: number) {
  if (import.meta.server) return;
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const text = queryString(value);
    if (text) query[key] = text;
  }
  if (page > 1) query.page = String(page);
  else delete query.page;
  void router.replace({ query });
}
async function load(append = false, background = false) {
  const params = buildFeedParams({
    limit: PAGE_SIZE,
    append,
    loadedCount: listings.value.length,
    nextCursor: nextCursor.value,
    sources: SOURCES,
  });
  const data = await loadFeed(params, { append, background });
  if (!data || background) return;
  if (!append && import.meta.client) lastPaginationScrollY = window.scrollY;
  if (!append) void syncQueryParams();
  // Skip while the mount sequence is still restoring a deep-linked `?page=n`:
  // the first (non-append) load only fills page 1, and syncing right then would
  // strip the requested page before restoreToPage gets a chance to catch up.
  if (import.meta.client && !pageRestoring.value && view.value === "active") syncPageInUrl(currentPageNumber());
}
async function restoreToPage(targetPage: number) {
  let guard = 0;
  while (hasMore.value && listings.value.length < targetPage * PAGE_SIZE && guard < 50) {
    await load(true, false);
    guard += 1;
  }
}
// One debounce for every filter interaction. Picking a country, then a city,
// then a district used to fire a request per click at 80ms apart, and each
// combination the server has not answered before is an uncached query that costs
// seconds — so the earlier ones were paid for and thrown away. Long enough to
// swallow a burst of clicks, short enough not to feel unresponsive.
const FILTER_DEBOUNCE_MS = 350;
function scheduleLoad(delay = FILTER_DEBOUNCE_MS) { if (loadTimer) clearTimeout(loadTimer); loadTimer = setTimeout(() => { loadTimer = undefined; void load(false); }, delay); }
function clearSearch() { query.value = ""; scheduleLoad(0); }
function selectSource(v: string) { if (source.value === v) return; source.value = v; scheduleLoad(); }
function resetFilters() {
  // Empty means "every country", so reset keeps the regional starting country.
  resetFilterValues(defaultCountry.value);
  drawnArea.value = [];
  view.value = "active";
  scheduleLoad();
}
function setView(next: string) { view.value = next as FlatView; }
function mapCoordinateLooksSane(listing: Listing): boolean {
  if (listing.lat == null || listing.lng == null) return false;
  const lat = Number(listing.lat);
  const lng = Number(listing.lng);
  // City/locality bounds are validated by the Flat Finder backend. The browser
  // only rejects malformed global coordinates so newly-supported metropolitan
  // areas and suburbs are not silently dropped from the map.
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
const mapPoints = computed(() => displayedListings.value.filter(mapCoordinateLooksSane).map((l) => ({ id: l.id, lat: l.lat as number, lng: l.lng as number, title: displayListingTitle(l), priceLabel: priceLabel(l), photo: listingPhoto(l) || undefined, source: l.source })));

const active = ref<Listing | null>(null);
const modalOpen = ref(false);
const checkingListingKey = ref("");
const listingKey = (listing: Listing) => `${listing.source}:${listing.country}:${listing.id}`;
const lightboxOpen = ref(false);
const {
  translatedDescription,
  translatingDescription,
  translationFailed,
  descriptionNeedsTranslation,
  prepareTranslation,
  cancelTranslation,
  translateActiveDescription,
} = useFlatTranslation(active, locale);
/**
 * Mirrors the open listing in the address bar, using the same parameters the
 * share button produces, so copying the URL shares exactly what is on screen.
 * Replaces rather than pushes: opening listing after listing should not fill
 * the history with entries the back button has to walk through.
 */
function syncListingInUrl(listing: Listing | null) {
  if (import.meta.server) return;
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const text = queryString(value);
    if (text) query[key] = text;
  }

  if (listing) {
    // The publicId is a stable, source-independent key (backed by the flat-finder
    // Postgres row id), so it alone identifies the advert — no source/country
    // pair needed. Older shared links still carry the triple; keep writing it
    // only as a fallback for listings without a publicId yet.
    if (listing.publicId != null) {
      query.adv = String(listing.publicId);
      delete query.flat;
      delete query.flatSource;
      delete query.flatCountry;
    } else {
      query.flat = listing.id;
      query.flatSource = listing.source;
      query.flatCountry = listing.country;
      delete query.adv;
    }
  } else {
    delete query.adv;
    delete query.flat;
    delete query.flatSource;
    delete query.flatCountry;
    // "shared" only marks how the visitor arrived; it means nothing once the
    // listing it referred to is closed.
    delete query.shared;
  }

  void router.replace({ query });
}

function listingIdentityMatches(item: Listing, id: string, sourceName = "", countryCode = ""): boolean {
  if (item.id !== id) return false;
  if (sourceName && item.source !== sourceName) return false;
  if (countryCode && item.country !== countryCode.toUpperCase()) return false;
  return true;
}
function removeUnavailableListing(id: string, sourceName = "olx", countryCode = "") {
  const before = listings.value.length;
  listings.value = listings.value.filter((item) => !listingIdentityMatches(item, id, sourceName, countryCode));
  const removed = before - listings.value.length;
  if (removed > 0) total.value = Math.max(0, total.value - removed);
  removeSavedWhere((item) => listingIdentityMatches(item, id, sourceName, countryCode));
  if (active.value && listingIdentityMatches(active.value, id, sourceName, countryCode)) {
    modalOpen.value = false;
    active.value = null;
  }
}
function showListingUnavailableToast() {
  toast.add({
    title: t("listingUnavailableTitle"),
    description: t("listingUnavailableDescription"),
    color: "warning",
    icon: "i-lucide-circle-alert",
  });
}
async function verifyOlxListing(l: Listing): Promise<Listing | null | undefined> {
  const params: Record<string, string> = { listingId: l.id, limit: "1", offset: "0", sources: "olx", verifyLive: "1" };
  if (/^[A-Za-z]{2}$/.test(l.country)) params.countries = l.country.toUpperCase();
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params });
  if (error || !data) return undefined;
  const exact = data.listings?.find((listing) => listing.id === l.id && listing.source === "olx");
  if (exact) return exact;
  if (data.exactListingFallback === "source-inactive") return null;
  return undefined;
}
async function verifyOpenOlxListing(l: Listing, key: string) {
  if (checkingListingKey.value === key) return;
  checkingListingKey.value = key;
  try {
    const verified = await verifyOlxListing(l);
    if (verified === null) {
      forgetAvailability(key);
      removeUnavailableListing(l.id, l.source, l.country);
      showListingUnavailableToast();
      if (queryString(route.query.flat) === l.id) syncListingInUrl(null);
      return;
    }
    if (verified) {
      markAvailabilityFresh(key);
      if (active.value && listingIdentityMatches(active.value, l.id, l.source, l.country)) {
        // The live-verification lookup is a lighter query than the bulk feed
        // and omits fields the feed computes separately (marketComparison's
        // median comparison, at least) — spreading the old listing first
        // keeps that enrichment instead of silently losing it, while verified
        // still overrides everything it does carry (price, availability, ...).
        const refreshed = {
          ...active.value,
          ...verified,
          publicId: verified.publicId ?? active.value.publicId,
        };
        active.value = refreshed;
        prepareTranslation(refreshed);
      }
    }
  } finally {
    if (checkingListingKey.value === key) checkingListingKey.value = "";
  }
}
async function openListing(l: Listing) {
  const key = listingKey(l);
  lightboxOpen.value = false; active.value = l;
  prepareTranslation(l); modalOpen.value = true;
  addRecent(l);
  syncListingInUrl(l);
  if (l.source === "olx" && !isAvailabilityFresh(key)) void verifyOpenOlxListing(l, key);
}
function modalTitle(listing: Listing | null): string {
  if (!listing) return "";
  const normalized = displayListingTitle(listing).replace(/\s+/g, " ").trim();
  const humanTitle = normalized.split(/\s*[•·]\s*/)[0]?.trim() || normalized;
  return humanTitle.length > 140 ? `${humanTitle.slice(0, 137).trimEnd()}…` : humanTitle;
}
function releaseStuckScrollLock() {
  if (import.meta.server || modalOpen.value || lightboxOpen.value) return;
  const body = document.body;
  if (body.style.overflow === "hidden") body.style.removeProperty("overflow");
  if (body.style.position === "fixed") { const top = body.style.top; body.style.removeProperty("position"); body.style.removeProperty("top"); body.style.removeProperty("width"); const offset = Math.abs(parseInt(top || "0", 10)) || 0; if (offset) window.scrollTo(0, offset); }
  body.style.removeProperty("padding-right"); document.documentElement.style.removeProperty("overflow");
}
function openById(id: string) { const found = displayedListings.value.find((l) => l.id === id); if (found) void openListing(found); }
function convert(amount: number, from: string, to: string): number | undefined {
  return convertCurrency(amount, from || "USD", to || "USD", rates.value);
}
// SearchDetailsModal colors the popup ID by price-vs-median, the same signal
// FlatCard colors the price with. It only has the listing itself (no rates),
// so the USD figure is converted here and passed down rather than teaching
// the modal currency conversion too.
const activePriceUsd = computed(() => {
  if (!active.value || active.value.price == null) return null;
  const usd = convert(active.value.price, active.value.currency, "USD");
  return usd ?? null;
});
const fmtBool = (v?: boolean | null) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const numOr = (v?: number | null, unit = "") => (v != null ? `${v}${unit ? " " + unit : ""}` : t("notSpecified"));
const strOr = (v?: string | null) => (v ? v : t("notSpecified"));
const listOr = (v?: string[] | null) => (v && v.length ? v.join(", ") : t("notSpecified"));
const nearbyListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(", ") : t("notSpecified");
const amenitiesListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(", ") : t("notSpecified");
const audienceLabel = (a?: Listing["audience"]) => a === "women" ? t("audWomen") : a === "men" ? t("audMen") : a === "family" ? t("audFamily") : t("audAny");
const conditionLabel = (c?: Listing["condition"]) => c === "needs_renovation" ? t("condNeeds") : c === "basic" ? t("condBasic") : c === "good" ? t("condGood") : c === "modern" ? t("condModern") : c === "luxury" ? t("condLuxury") : t("notSpecified");
const sourceLabel = (s?: string) => (s === "olx" ? "OLX" : s === "telegram" ? "Telegram" : strOr(s));
function floorLabel(l: Listing) { if (l.floor != null && l.totalFloors != null) return `${l.floor} / ${l.totalFloors}`; return l.floor != null || l.totalFloors != null ? String(l.floor ?? l.totalFloors) : t("nd"); }
function depositLabel(l: Listing) { if (l.depositAmount != null) return `${l.depositAmount.toLocaleString()} ${l.depositCurrency || l.currency}`; return fmtBool(l.deposit); }
function commissionLabel(l: Listing) { if (l.commissionPercent != null) return `${l.commissionPercent}%`; return fmtBool(l.commission); }
function communalLabel(l: Listing) { if (l.communalSeparated === true) return t("communalSeparate"); if (l.communalSeparated === false) return t("communalIncluded"); return t("notSpecified"); }
type FlatSpecGroup = "advert" | "property" | "location" | "amenities" | "terms" | "costs";
type FlatSpecRow = { label: string; value: string; group: FlatSpecGroup; groupLabel: string; column: 1 | 2 | 3 };
const specRows = computed<FlatSpecRow[]>(() => {
  const l = active.value; if (!l) return [];
  const groupColumn: Record<FlatSpecGroup, 1 | 2 | 3> = {
    advert: 1,
    property: 1,
    location: 2,
    amenities: 2,
    terms: 3,
    costs: 3,
  };
  const row = (group: FlatSpecGroup, label: string, value: string): FlatSpecRow => ({
    group,
    groupLabel: t(`specGroup${group.charAt(0).toUpperCase()}${group.slice(1)}`),
    column: groupColumn[group],
    label,
    value,
  });
  return [
    row("advert", t("specDeal"), dealLabel(l.dealType) || t("notSpecified")),
    row("advert", t("specType"), ptLabel(l.propertyType)),
    row("advert", t("specListedBy"), l.byAgency ? t("agAgency") : t("agOwner")),
    row("advert", t("specSource"), sourceLabel(l.source)),

    row("property", t("specRooms"), numOr(l.rooms)),
    row("property", t("specBedrooms"), numOr(l.bedrooms)),
    row("property", t("specBathrooms"), numOr(l.bathrooms)),
    row("property", t("specArea"), l.areaSqm != null ? `${l.areaSqm} ${t("sqm")}` : t("notSpecified")),
    row("property", t("specFloor"), floorLabel(l)),
    row("property", t("specYear"), numOr(l.buildingYear)),
    row("property", t("specNewBuilding"), fmtBool(l.newBuilding)),
    row("property", t("specCondition"), conditionLabel(l.condition)),
    row("property", t("specComplex"), strOr(l.residenceComplex)),

    row("location", t("specCity"), strOr(locName(l.city, "city"))),
    row("location", t("specDistrict"), strOr(locName(l.district, "district"))),
    row("location", t("specKvartal"), strOr(l.area || l.kvartal)),
    row("location", t("specMetro"), strOr(metroLabelWithAlias(l.metro, locale.value))),
    row("location", t("specAddress"), strOr(l.address)),
    row("location", t("specShops"), listOr(l.nearbyShops)),
    row("location", t("specNearby"), nearbyListOr(l.nearby)),

    row("amenities", t("specParking"), fmtBool(l.parking)),
    row("amenities", t("specElevator"), fmtBool(l.elevator)),
    row("amenities", t("specFurnished"), fmtBool(l.furnished)),
    row("amenities", t("specBalcony"), fmtBool(l.balcony)),
    row("amenities", t("specAC"), fmtBool(l.airConditioner)),
    row("amenities", t("specGas"), fmtBool(l.gas)),
    row("amenities", t("specHeating"), fmtBool(l.heating)),
    row("amenities", t("specHotWater"), fmtBool(l.hotWater)),
    row("amenities", t("specInternet"), fmtBool(l.internet)),
    row("amenities", t("specAmenities"), amenitiesListOr(l.amenities)),

    row("terms", t("specPets"), fmtBool(l.petsAllowed)),
    row("terms", t("specChildren"), fmtBool(l.childrenAllowed)),
    row("terms", t("specSmoking"), fmtBool(l.smokingAllowed)),
    row("terms", t("specAudience"), audienceLabel(l.audience)),
    row("terms", t("specRoomShare"), fmtBool(l.roomOnly)),
    row("terms", t("specMinLease"), strOr(l.minLeaseTerm)),
    row("terms", t("specAvailable"), strOr(l.availableFrom)),

    row("costs", t("specNegotiable"), fmtBool(l.negotiable)),
    row("costs", t("specDeposit"), depositLabel(l)),
    row("costs", t("specCommission"), commissionLabel(l)),
    row("costs", t("specCommunal"), communalLabel(l)),
    row("costs", t("specUtilAmount"), l.utilitiesAmount != null ? `${l.utilitiesAmount.toLocaleString()} ${l.currency}` : t("notSpecified")),
  ];
});
const {
  copied: shareCopied,
  fallbackOpen: listingShareModalOpen,
  fallbackUrl: listingShareUrl,
  fallbackCopied: listingShareCopied,
  share: shareLink,
  copyFallback: copyListingShareLink,
} = useShareLink();
function makeListingShareLink(l: Listing): string {
  const query = l.publicId != null
    ? { adv: String(l.publicId) }
    : { flat: l.id, flatSource: l.source, flatCountry: l.country };
  const resolved = router.resolve({ path: route.path, query });
  return new URL(resolved.href, window.location.origin).toString();
}
async function shareFlat(l: Listing) {
  const link = makeListingShareLink(l); const title = displayListingTitle(l);
  await shareLink({ title, text: title, url: link, key: l.id });
}
async function openSharedListing(id: string, sourceName = "", countryCode = "", attempt = 0) {
  const local = listings.value.find((listing) => listing.id === id); if (local) { await openListing(local); return; }
  const params: Record<string, string> = { listingId: id, limit: "1", offset: "0" }; if (SOURCES.includes(sourceName)) params.sources = sourceName; if (/^[A-Za-z]{2}$/.test(countryCode)) params.countries = countryCode.toUpperCase();
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params }); const exact = data?.listings?.find((listing) => listing.id === id); if (exact) { await openListing(exact); return; }
  if (!error && sourceName === "olx" && data?.exactListingFallback === "source-inactive") {
    removeUnavailableListing(id, sourceName, countryCode);
    showListingUnavailableToast();
    if (queryString(route.query.flat) === id) syncListingInUrl(null);
    return;
  }
  if (data?.warming && attempt < 20) { if (sharedListingTimer) clearTimeout(sharedListingTimer); sharedListingTimer = setTimeout(() => { sharedListingTimer = undefined; void openSharedListing(id, sourceName, countryCode, attempt + 1); }, 1800); }
}
async function openSharedListingByPublicId(publicId: string, attempt = 0) {
  const local = listings.value.find((listing) => String(listing.publicId ?? "") === publicId);
  if (local) { await openListing(local); return; }
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params: { publicId } });
  const exact = data?.listings?.find((listing) => String(listing.publicId ?? "") === publicId);
  if (exact) { await openListing(exact); return; }
  if (!error) {
    // A clean advert link that no longer resolves (listing removed/deactivated)
    // shouldn't linger in the address bar pointing at nothing.
    if (queryString(route.query.adv) === publicId) syncListingInUrl(null);
    return;
  }
  // A lookup failure here is a transient network/upstream hiccup, not a
  // "still warming" state (this endpoint is a direct DB read) — a short,
  // bounded retry is enough.
  if (attempt < 5) { if (sharedListingTimer) clearTimeout(sharedListingTimer); sharedListingTimer = setTimeout(() => { sharedListingTimer = undefined; void openSharedListingByPublicId(publicId, attempt + 1); }, 1500); }
}
onMounted(async () => {
  const sharedAdvId = queryString(route.query.adv);
  const sharedFlatId = queryString(route.query.flat); const sharedFlatSource = queryString(route.query.flatSource); const sharedFlatCountry = queryString(route.query.flatCountry);
  const requestedPage = Math.max(1, Math.trunc(Number(queryString(route.query.page))) || 1);
  defaultCountry.value = regionalSearchCountry();
  if (!queryString(route.query.countries)) countries.value = [defaultCountry.value];
  loadPersonalState(); applyQueryParams(route.query); void loadRates(); await loadMeta(); await nextTick(); restoring.value = false;
  if (queryString(route.query.shared) === "1") { showAdvanced.value = true; sharedLinkOpened.value = true; shareModalOpen.value = true; }
  await load(false);
  if (requestedPage > 1) await restoreToPage(requestedPage);
  pageRestoring.value = false;
  if (sharedAdvId) await openSharedListingByPublicId(sharedAdvId);
  else if (sharedFlatId) await openSharedListing(sharedFlatId, sharedFlatSource, sharedFlatCountry);
  await nextTick(); lastPaginationScrollY = window.scrollY;
});
watch(modalOpen, (open) => { if (open) return; syncListingInUrl(null); lightboxOpen.value = false; cancelTranslation(); nextTick(() => setTimeout(releaseStuckScrollLock, 350)); });
watch(lightboxOpen, (open) => { if (!open) nextTick(() => setTimeout(releaseStuckScrollLock, 350)); });
// A link that names a listing should open it, whether the page is mounting for
// the first time or the query changed underneath one that is already up. The
// mount-time read covers only the first case; this covers both, and cannot
// loop, because opening a listing sets modalOpen before it writes the query.
watch(() => queryString(route.query.adv), (publicId, previous) => {
  if (!import.meta.client || !publicId || publicId === previous || modalOpen.value) return;
  void openSharedListingByPublicId(publicId);
});
watch(() => queryString(route.query.flat), (id, previous) => {
  if (!import.meta.client || !id || id === previous || modalOpen.value) return;
  void openSharedListing(id, queryString(route.query.flatSource), queryString(route.query.flatCountry));
});
const restoring = ref(true);

// Keyed off the query the filters produce, so every filter is covered without
// listing them all again here and forgetting one.
watch(
    () => JSON.stringify(currentFilterQuery()),
    () => { if (!restoring.value) scheduleQuerySync(); },
);
watch(city, () => { if (restoring.value) return; district.value = ""; metro.value = ""; query.value = ""; });
watch(countries, () => { if (restoring.value) return; district.value = ""; metro.value = ""; city.value = ""; query.value = ""; });
onBeforeUnmount(() => { modalOpen.value = false; lightboxOpen.value = false; releaseStuckScrollLock(); if (loadTimer) clearTimeout(loadTimer); if (sharedListingTimer) clearTimeout(sharedListingTimer); cancelTranslation(); });
</script>

<template>
  <SearchPageShell
    class-name="flats"
    :title="t('title')"
  >
    <template #backdrop><ocean-page-backdrop variant="home" /></template>
    <template #header>
      <div class="flats__header text-center space-y-3">
        <h1 class="flats__title">{{ t("title") }}</h1>
        <p class="flats__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
      </div>
    </template>

    <UiResultsLoader :loading="loading" :label="t('searching')" min-height="420px">
    <form ref="filtersEl" class="flats__controls flats__controls_redesign" @submit.prevent="load()">
      <div class="flats__searchbar">
        <u-input v-model="query" clearable icon="i-lucide-search" :label="t('search')" :placeholder="t('searchPlaceholder')" @clear="clearSearch" />
        <u-button type="submit" icon="i-lucide-search">{{ t("search") }}</u-button>
      </div>

      <div class="flats__row flats__secondary-nav">
        <SearchSourceTabs :model-value="source" :items="sourceOptions" @update:model-value="selectSource" />
        <SearchSavedTabs
          :model-value="view"
          :items="viewTabs"
          :aria-label="t('personalTabs')"
          @update:model-value="setView"
        />
      </div>

      <div class="filter-surface">
      <section class="filter-card">
        <UiSearchPresets
          :presets="presets"
          :label="t('presets')"
          :delete-label="t('deletePreset')"
          :save-label="t('savePreset')"
          :share-label="t('shareSearch')"
          @apply="applyPreset"
          @remove="removePreset"
          @save="presetModalOpen = true"
          @share="sharedLinkOpened = false; shareModalOpen = true"
        />

        <div class="filter-primary-grid">
          <div class="flats__field"><u-select-menu :label="t('country')" v-model="countries" :items="countryItems" value-key="value" label-key="label" multiple :placeholder="t('countryAny')" class="flats__select" @update:model-value="scheduleLoad()" /></div>
          <div class="flats__field"><u-select-menu :label="t('city')" v-model="citySel" :items="cityItems" value-key="value" label-key="label" class="flats__select" @update:model-value="scheduleLoad()" /></div>
          <div class="flats__field"><u-select-menu :label="t('dealType')" v-model="dealType" :items="dealTypeItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
          <div class="flats__field"><u-select-menu :label="t('agency')" v-model="agency" :items="agencyItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
        </div>

        <div class="filter-price-row">
          <span class="flats__field-label filter-price-row__label">{{ t('price') }}</span>
          <u-input v-model.number="priceMin" class="price-input" type="number" inputmode="numeric" min="1" max="1000000000" :label="t('rangeFrom')" @change="scheduleLoad()" />
          <span class="price-separator">—</span>
          <u-input v-model.number="priceMax" class="price-input" type="number" inputmode="numeric" min="1" max="1000000000" :label="t('rangeTo')" @change="scheduleLoad()" />
          <label class="currency-select"><span class="sr-only">{{ t("currency") }}</span><u-select-menu v-model="displayCurrency" :items="currencyItems" value-key="value" label-key="label" class="flats__select currency-select__control" @update:model-value="(priceMin != null || priceMax != null) && scheduleLoad()" /></label>
        </div>

        <div class="filter-amenities-row">
          <span class="flats__field-label filter-amenities-row__label">{{ extraLabels.amenities }}</span>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-sparkles" :variant="dishwasherOnly ? 'solid' : 'outline'" @click="dishwasherOnly = !dishwasherOnly; scheduleLoad()">{{ extraLabels.dishwasher }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-snowflake" :variant="airConditionerOnly ? 'solid' : 'outline'" @click="airConditionerOnly = !airConditionerOnly; scheduleLoad()">{{ extraLabels.ac }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-square-parking" :variant="parkingOnly ? 'solid' : 'outline'" @click="parkingOnly = !parkingOnly; scheduleLoad()">{{ extraLabels.parking }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-wifi" :variant="internetOnly ? 'solid' : 'outline'" @click="internetOnly = !internetOnly; scheduleLoad()">{{ extraLabels.internet }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-flame" :variant="gasOnly ? 'solid' : 'outline'" @click="gasOnly = !gasOnly; scheduleLoad()">{{ extraLabels.gas }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-panel-top" :variant="balconyOnly ? 'solid' : 'outline'" @click="balconyOnly = !balconyOnly; scheduleLoad()">{{ extraLabels.balcony }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-sun" :variant="terraceOnly ? 'solid' : 'outline'" @click="terraceOnly = !terraceOnly; scheduleLoad()">{{ extraLabels.terrace }}</u-button>
          <u-button type="button" size="xs" color="neutral" icon="i-lucide-tree-pine" :variant="privateYardOnly ? 'solid' : 'outline'" @click="privateYardOnly = !privateYardOnly; scheduleLoad()">{{ extraLabels.yard }}</u-button>
        </div>

        <UiFilterFooter class="filter-actions-row" :reset-label="t('reset')" @reset="resetFilters">
          <div class="active-filter-chips">
            <button v-if="district" type="button" class="filter-chip" @click="district = ''; scheduleLoad()">{{ t("district") }}: {{ locName(district, 'district') }} <span>×</span></button>
            <button v-if="roomsMin != null" type="button" class="filter-chip" @click="roomsMin = undefined; scheduleLoad()">{{ roomsMin }}+ {{ t('roomsChip') }} <span>×</span></button>
            <button v-if="petFriendly" type="button" class="filter-chip" @click="petFriendly = false; scheduleLoad()"><u-icon name="i-lucide-paw-print" /> {{ t('pets') }} <span>×</span></button>
          </div>
        </UiFilterFooter>
      </section>

      <SearchAdvancedFilters v-model="showAdvanced" :label="t('moreFilters')" :hide-label="t('hideFilters')">
        <SearchFilterBlocks :blocks="flatAdvancedFilterBlocks" class="flats__filter-blocks">
          <template #field-quick-options>
            <div class="quick-options">
              <u-button type="button" :variant="petFriendly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-paw-print" @click="petFriendly = !petFriendly; scheduleLoad()">{{ t('pets') }}</u-button>
              <u-button type="button" :variant="childrenRequired ? 'solid' : 'outline'" color="neutral" icon="i-lucide-baby" @click="childrenRequired = !childrenRequired; scheduleLoad()">{{ t('children') }}</u-button>
              <u-button type="button" :variant="onlyWithPhotos ? 'solid' : 'outline'" color="neutral" icon="i-lucide-images" @click="onlyWithPhotos = !onlyWithPhotos; scheduleLoad()">{{ t('onlyWithPhotos') }}</u-button>
              <u-button type="button" :variant="newBuildingOnly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-building-2" @click="newBuildingOnly = !newBuildingOnly; scheduleLoad()">{{ t('newBuilding') }}</u-button>
            </div>
          </template>
        </SearchFilterBlocks>
      </SearchAdvancedFilters>
      </div>
    </form>

    <p v-if="failed" class="flats__error">{{ t("error") }}</p>
    <p v-else-if="source === 'telegram' && !loading && !listings.length && sourceErrors?.some((item) => item.source === 'telegram')" class="flats__source-warning">{{ t("telegramUnavailable") }}</p>
    <div v-else class="flats__results-toolbar">
      <p class="flats__count text-muted">{{ t("found", { n: view === 'active' ? total : displayedListings.length }) }}</p>
      <UiSortSelect class="flats__sort" v-model="sort" :items="sortItems" :label="extraLabels.sort" @update:model-value="scheduleLoad(0)" />
    </div>
    <FlatsStatsPanel v-if="view === 'active' && statistics" :statistics="statistics" :display-currency="displayCurrency" :convert="convert" />
<section v-if="listings.length" class="flats__map-wrap"><flat-map :points="mapPoints" :draw-label="t('drawArea')" :done-label="t('done')" :clear-label="t('clearArea')" :draw-hint="t('drawHint')" :expand-label="t('mapExpand')" :collapse-label="t('mapCollapse')" @select="openById" @area-change="drawnArea = $event" /></section>

    <SearchResultGrid>
      <FlatCard
        v-for="l in displayedListings"
        :key="listingKey(l)"
        :listing="l"
        :photo="listingPhoto(l)"
        :presentation="presentCard(l)"
        :favorite="isFavorite(l.id)"
        :hidden="isHidden(l.id)"
        :checking="checkingListingKey === listingKey(l)"
        :no-photo-label="t('noPhoto')"
        :checking-label="t('checkingListing')"
        :favorite-label="isFavorite(l.id) ? t('removeFavorite') : t('addFavorite')"
        :hide-label="isHidden(l.id) ? t('restoreListing') : t('hideListing')"
        @open="openListing(l)"
        @toggle-favorite="toggleFavorite(l)"
        @toggle-hidden="toggleHidden(l)"
        @photo-error="markPhotoFailedFromEvent"
      />
    </SearchResultGrid>
<div ref="loadMoreSentinel" v-if="hasMore" class="flats__sentinel"><span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span></div>
    <SearchEmptyState v-if="!loading && !displayedListings.length && !failed" :message="t('empty')"><div v-if="drawnArea.length >= 3 && listings.length" class="text-muted">{{ t("emptyArea") }}</div></SearchEmptyState>

    </UiResultsLoader>

    <SearchDetailsModal v-model:open="modalOpen" :title="modalTitle(active)" :flat-listing="active" :flat-price-usd="activePriceUsd" :dismissible="!lightboxOpen">
      <template #title><h2 class="flat-modal__title">{{ modalTitle(active) }}</h2></template>
      <template #body><div v-if="active" class="flat-modal"><FlatGallery v-model:lightbox-open="lightboxOpen" :photos="visiblePhotos(active)" :title="modalTitle(active)" :viewer-label="t('photoViewer')" :previous-label="t('previousPhoto')" :next-label="t('nextPhoto')" :close-label="t('closePhoto')" @photo-error="markPhotoFailedFromEvent" /><div v-if="checkingListingKey === listingKey(active)" class="flat-modal__verification" role="status" aria-live="polite"><u-icon name="i-lucide-loader-circle" class="flat-modal__verification-icon" /><span>{{ t("checkingListing") }}</span></div><UiSpecTable :rows="specRows" :hide-empty-label="t('hideEmpty')" :empty-value="t('notSpecified')"><template #header><div class="flat-modal__price">{{ priceLabel(active) }}<span v-if="convertedLabel(active)" class="flat-modal__price-conv"> ({{ convertedLabel(active) }})</span><span v-if="dealLabel(active.dealType)" class="flat-modal__deal"> · {{ dealLabel(active.dealType) }}</span><span v-if="active.roomOnly" class="flat-modal__deal"> · {{ t("roomShare") }}</span></div></template></UiSpecTable><div v-if="active.description && descriptionNeedsTranslation" class="flat-modal__translation"><u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-languages" :loading="translatingDescription" @click="translateActiveDescription">{{ translatingDescription ? t("translatingDescription") : t("translateDescription") }}</u-button><span v-if="translationFailed" class="flat-modal__translation-error">{{ t("translationFailed") }}</span></div><section v-if="translatedDescription" class="flat-modal__translated"><h4 class="flat-modal__translated-title">{{ t("translatedDescription") }}</h4><p class="flat-modal__desc">{{ translatedDescription }}</p></section><details v-if="active.description" class="flat-modal__descbox"><summary>{{ t("origDescription") }}</summary><p class="flat-modal__desc">{{ active.description }}</p></details><div v-if="active.tags && active.tags.length" class="flat-modal__tags"><span v-for="tag in active.tags" :key="tag" class="flat-modal__tag">{{ nearbyItemLabel(tag) }}</span></div></div></template>
      <template #footer><UiModalFooter v-if="active"><u-button variant="outline" color="neutral" icon="i-lucide-heart" @click="toggleFavorite(active)">{{ isFavorite(active.id) ? t("removeFavorite") : t("addFavorite") }}</u-button><u-button variant="outline" color="neutral" :icon="isHidden(active.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" @click="toggleHidden(active)">{{ isHidden(active.id) ? t("restoreListing") : t("hideListing") }}</u-button><u-button variant="outline" color="neutral" :icon="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'" @click="shareFlat(active)">{{ shareCopied ? t("shareCopied") : t("share") }}</u-button><a class="modal-footer__primary" :href="active.url" target="_blank" rel="noopener noreferrer">{{ t("open") }} →</a></UiModalFooter></template>
    </SearchDetailsModal>

    <SearchPresetDialog v-model:open="presetModalOpen" v-model:name="presetName" :title="t('savePreset')" :name-label="t('presetName')" :cancel-label="t('cancel')" :save-label="t('save')" @save="savePreset" />
    <SearchShareDialog v-model:open="shareModalOpen" :title="sharedLinkOpened ? t('sharedSearchApplied') : t('shareSearch')" :hint="sharedLinkOpened ? t('sharedSearchHint') : t('shareSearchHint')" :url="shareUrl" :copy-label="t('copyLink')" @copy="copyShareLink" />
    <button v-if="showBackToTop" type="button" class="flats__back-top" :aria-label="t('backToTop')" @click="scrollToFilters"><u-icon name="i-lucide-arrow-up" /><span>{{ t('backToTop') }}</span></button>
    <SearchShareDialog v-model:open="listingShareModalOpen" :title="t('shareListing')" :hint="t('shareListingHint')" :url="listingShareUrl" :copy-label="t('copyLink')" :copied="listingShareCopied" :copied-label="t('shareCopied')" @copy="copyListingShareLink" />
  </SearchPageShell>
</template>

<style scoped>
.flats { position: relative; isolation: isolate; padding-top: 24px; padding-bottom: 96px; }
.flats__header { position: relative; z-index: 1; }
.flats__title { font-size: 32px; font-weight: 600; }
.flats__subtitle { max-width: 720px; font-size: 14px; }
.flats__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: start; }
.flats__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
/* Control height is owned by .ui-control (assets/css/ui.css), which every input
   and select composes. Forcing a min-height on the NATIVE element inside them
   stacked a second height on top of the wrapper's, which is what made the range
   fields and the price row taller than the plain selects. */

/* A multi-select with several countries used to wrap onto extra lines and grow
   the whole row, so keep the VALUE to one line and ellipsize it. Scoped to the
   first span only: a blanket `button > span` also caught the chevron wrapper,
   and forcing display:block + overflow:hidden on it deformed the arrow. */
.flats__field :deep(button > span:first-child),
.flats__select :deep(button > span:first-child) {
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}

.flats__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.flats__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; line-height: 1.25; overflow-wrap: anywhere; }
.flats__select { width: 100%; min-width: 0; }
.flats__select :deep(button) { width: 100%; min-width: 0; }
.flats__back-top { position: fixed; right: 22px; bottom: 24px; z-index: 60; display: inline-flex; align-items: center; gap: 7px; min-height: 42px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--bg-panel); color: var(--text-primary); box-shadow: 0 8px 26px rgba(0,0,0,.28); cursor: pointer; }
.flats__back-top:hover { color: var(--accent-pink); border-color: rgba(224,103,154,.48); }
.flats__error { color: var(--ui-error, #f87171); }
.flats__source-warning { color: #f6c177; font-size: 13px; margin-bottom: 12px; }
.flats__count { font-size: 13px; margin: 0; }
.flats__results-toolbar { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.flats__sort { width: min(310px, 100%); }
.flats__map-wrap { position: relative; z-index: 0; isolation: isolate; margin-bottom: 18px; scroll-margin-top: 90px; }
.flat-modal__verification { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; margin-top: -2px; padding: 6px 10px; border: 1px solid rgba(224,103,154,.36); border-radius: 999px; background: rgba(224,103,154,.1); color: var(--text-secondary); font-size: 13px; }
.flat-modal__verification-icon { width: 16px; height: 16px; color: var(--accent-pink); animation: flat-card-spin .8s linear infinite; }
.flats__sentinel { min-height: 44px; display: grid; place-items: center; }
.flat-modal { display: flex; flex-direction: column; gap: 12px; }
.flat-modal__title { display: -webkit-box; overflow: hidden; margin: 0; padding-right: 36px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; font-size: 18px; font-weight: 700; line-height: 1.35; }
.flat-modal__price { min-width: 0; font-weight: 700; font-size: 20px; line-height: 1.25; } .flat-modal__price-conv { font-weight: 500; font-size: 14px; color: var(--text-muted); } .flat-modal__deal { color: #e0679a; font-weight: 500; }
/* The modal body is a flex column with its own gap, so this table must not add
   margins of its own — stacked margins were what made the spacing between blocks
   uneven. The label column shrinks to its widest label (width:1% + nowrap)
   instead of a fixed 44%, which removes the large empty stripe between label and
   value; on narrow screens it wraps and takes a share of the width instead. */
/* No own margins on flex children: .flat-modal already spaces them with gap. */
.flat-modal__translation { display: flex; align-items: center; gap: 10px; margin-top: 14px; } .flat-modal__translation-error { color: #f29ab6; font-size: 12px; }
.flat-modal__translated { margin-top: 0; padding: 12px; border: 1px solid var(--line, #252a4a); border-radius: var(--radius, 10px); background: var(--bg-panel-2, #171c3a); } .flat-modal__translated-title { margin: 0 0 8px; color: var(--text-primary, #e4e5f0); font-size: 13px; font-weight: 600; }
.flat-modal__descbox { margin-top: 0; } .flat-modal__descbox summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.7; user-select: none; } .flat-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); margin-top: 8px; }
.flat-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; } .flat-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
/* auto-fit rather than a fixed four columns: at narrower widths four tracks squeezed the longest label onto two lines, so that one button stood taller and looked unlike the rest. They now reflow to two rows and every label stays on one line. */
/* Footer action layout now lives in components/ui/ModalFooter.vue, shared with
   the vacancy and candidate popups. */

/* Redesigned compact filters */
.flats__controls_redesign { display: block; margin: 20px 0; }
.flats__searchbar { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-bottom: 12px; }
.flats__secondary-nav { margin-bottom: 12px; }
.filter-surface {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}
.filter-card { padding: 16px; }
.filter-primary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
/* Scoped to the value span (not every span, which included the chevron) and
   kept on one line. This rule sits after the one above and previously won with
   `white-space: normal`, which is what still let a multi-country value wrap. */
.filter-primary-grid :deep(button > span:first-child), .flats__filter-blocks :deep(button > span:first-child) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25; text-align: left; }
/* justify-content:start is what keeps this row sane: the first track is `auto`,
   so without it every pixel of leftover width inflated the label column and
   threw the label to the far left with the inputs stranded on the right.
   column-gap does the spacing now instead of a per-element margin. */
.filter-price-row { display: grid; grid-template-columns: auto minmax(130px,190px) auto minmax(130px,190px) minmax(120px,145px); justify-content: start; align-items: center; column-gap: 8px; row-gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.filter-price-row__label { margin: 0; }
/* "от" / "до" are floating labels on the fields themselves now. The wrapper that
   used to draw a box around a caption plus a de-bordered input — and all the
   !important needed to stop that drawing two borders — is gone with it. */
.price-input :deep(input) { font-variant-numeric: tabular-nums; }
.price-separator { text-align: center; color: var(--ui-text-muted); }
.currency-select { min-width: 0; }
.currency-select__control :deep(button) { min-height: var(--ui-control-h-md); height: var(--ui-control-h-md); background: var(--bg-panel-2) !important; border-color: rgba(224,103,154,.78) !important; color: var(--text-white); font-weight: 800; letter-spacing: .04em; box-shadow: inset 0 0 0 1px rgba(224,103,154,.08); }
.filter-amenities-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.filter-amenities-row__label { margin-right: 4px; white-space: nowrap; }
.filter-amenities-row :deep(button) { min-height: 30px; height: auto; padding-inline: 9px; white-space: nowrap; }
.filter-actions-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.active-filter-chips { display: flex; flex: 1 1 300px; gap: 8px; flex-wrap: wrap; min-width: 0; }
.filter-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; min-height: 34px; padding: 6px 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-panel-2); color: var(--text-primary); white-space: normal; text-align: left; line-height: 1.25; }
.filter-chip span { color: var(--ui-text-muted); flex: 0 0 auto; }
.flats__filter-blocks { grid-template-columns: 1.15fr .95fr 1.1fr 1.1fr 1fr; gap: 0; padding: 16px; }
.flats__filter-blocks :deep(.filter-section) { min-width: 0; padding: 0 16px; border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; }
.flats__filter-blocks :deep(.filter-section:first-child) { padding-left: 0; border-left: 0; }
.flats__filter-blocks :deep(.filter-section:last-child) { padding-right: 0; }
.flats__filter-blocks :deep(.flat-filter-grid_single) { grid-template-columns: 1fr; }
.quick-options { display: grid; gap: 8px; }
.quick-options :deep(button) { width: 100%; min-height: var(--ui-control-h-md); justify-content: flex-start; height: auto; padding-block: 8px; white-space: normal; text-align: left; line-height: 1.25; }
.flats__controls_redesign :deep(input), .flats__controls_redesign :deep(button[role="combobox"]) { background-color: var(--bg-panel-2) !important; }

@media (max-width: 1100px) {
  .flats__filter-blocks { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20px 0; }
  .flats__filter-blocks :deep(.filter-section), .flats__filter-blocks :deep(.filter-section:first-child) { padding: 0 16px; border-left: 1px solid var(--line); }
  .flats__filter-blocks :deep(.filter-section:nth-child(odd)) { border-left: 0; padding-left: 0; }
  .flats__filter-blocks :deep(.filter-section:nth-child(even)) { padding-right: 0; }
}
@media (max-width: 760px) {
  .flats__controls_redesign { margin-inline: -4px; }
  .flats__searchbar { grid-template-columns: 1fr; }
  .flats__secondary-nav { gap: 8px; }
  .filter-card { padding: 14px 12px; }
  .filter-primary-grid { grid-template-columns: 1fr; gap: 12px; }
  .filter-price-row { grid-template-columns: minmax(0,1fr) 10px minmax(0,1fr); column-gap: 4px; row-gap: 8px; }
  .filter-price-row__label { grid-column: 1 / -1; }
  .currency-select { grid-column: 1 / -1; }
  .price-input { min-width: 0; padding-left: 7px; gap: 3px; }
  .price-input :deep(.price-number-input) { font-size: 12px; }
  .filter-amenities-row__label { flex: 0 0 100%; }
  .filter-amenities-row :deep(button) { flex: 1 1 auto; justify-content: center; }
  .filter-actions-row { align-items: stretch; }
  .active-filter-chips { flex: 1 1 100%; }
  .flats__filter-blocks { grid-template-columns: 1fr; padding: 14px 12px; gap: 0; }
  .flats__filter-blocks :deep(.filter-section), .flats__filter-blocks :deep(.filter-section:first-child), .flats__filter-blocks :deep(.filter-section:nth-child(odd)), .flats__filter-blocks :deep(.filter-section:nth-child(even)) { padding: 16px 0; border-left: 0; border-top: 1px solid var(--line); }
  .flats__filter-blocks :deep(.filter-section:first-child) { padding-top: 0; border-top: 0; }
  .flats__filter-blocks :deep(.filter-section:last-child) { padding-bottom: 0; }
  .flats__results-toolbar { align-items: stretch; flex-direction: column; }
  .flats__sort { width: 100%; }
  .flats__back-top span { display: none; }
  .flats__back-top { right: 14px; bottom: 18px; width: 44px; padding: 0; justify-content: center; }
}
@media (max-width: 390px) {
  .filter-price-row { column-gap: 3px; row-gap: 6px; }
  .price-input :deep(.price-number-input) { font-size: 11px; }
}
</style>
