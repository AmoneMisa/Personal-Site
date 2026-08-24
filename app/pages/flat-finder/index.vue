<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { metroLabelWithAlias, locationLabel, type LocationKind } from "~/utils/locationLabels";
import FlatMap from "~/components/flats/FlatMap.client.vue";
import { readStoredList, writeStoredList } from "~/utils/browserStorage";
import { queryBoolean, queryString } from "~/utils/queryParams";

// Flat Finder. Auto-routed at /flat-finder. Reuses the flat-finder backend
// (same one the desktop app uses) via the /flats-* proxy routes, so listings,
// filters and the map all work over HTTPS same-origin.

interface Listing {
  id: string;
  source: string;
  country: string;
  title: string;
  propertyType: "flat" | "house";
  byAgency: boolean;
  price: number | null;
  currency: string;
  rooms: number | null;
  areaSqm: number | null;
  city: string;
  district?: string | null;
  metro?: string | null;
  address?: string | null;
  roomOnly?: boolean;
  lat: number | null;
  lng: number | null;
  photo: string | null;
  photos: string[];
  url: string;
  createdAt: string | null;
  description: string;
  dealType: "sale" | "longRent" | "shortRent" | null;
  floor?: number | null;
  totalFloors?: number | null;
  buildingYear?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balcony?: boolean | null;
  terrace?: boolean | null;
  privateYard?: boolean | null;
  dishwasher?: boolean | null;
  airConditioner?: boolean | null;
  gas?: boolean | null;
  newBuilding?: boolean | null;
  communalSeparated?: boolean | null;
  kvartal?: string | null;
  area?: string | null;
  areaAmbiguous?: boolean;
  locationConfidence?: number | null;
  requireExactAddress?: boolean;
  nearbyShops?: string[];
  nearby?: string[];
  residenceComplex?: string | null;
  petsAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  audience?: "women" | "men" | "family" | null;
  deposit?: boolean | null;
  depositAmount?: number | null;
  depositCurrency?: string | null;
  commission?: boolean | null;
  commissionPercent?: number | null;
  furnished?: boolean | null;
  condition?: "needs_renovation" | "basic" | "good" | "modern" | "luxury" | null;
  amenities?: string[];
  parking?: boolean | null;
  elevator?: boolean | null;
  heating?: boolean | null;
  hotWater?: boolean | null;
  internet?: boolean | null;
  smokingAllowed?: boolean | null;
  negotiable?: boolean | null;
  utilitiesAmount?: number | null;
  minLeaseTerm?: string | null;
  availableFrom?: string | null;
  tags?: string[];
}
interface FeedResult {
  count: number;
  listings: Listing[];
  warming?: boolean;
  sourceCounts?: Record<string, number>;
  sourceErrors?: Array<{ source?: string; country?: string; error?: string }>;
  nextCursor?: string | null;
  queryMs?: number;
  error?: string;
  exactListingFallback?: "source" | "source-inactive" | string;
}
interface TranslationResult {
  status: "pending" | "completed" | "failed" | "disabled" | "not_found";
  key?: string;
  data?: { translatedText?: string; sourceLanguage?: string | null };
  confidence?: number;
}
interface CountryMeta { code: string; name: string; currency: string; cities?: string[]; locations?: Record<string, { districts?: string[]; metro?: string[] }> }
type FlatView = "active" | "favorites" | "recent" | "hidden";
type FlatSort = "newest" | "oldest" | "priceAsc" | "priceDesc" | "titleAsc" | "titleDesc";
const PAGE_SIZE = 20;
const MAX_SAVED_FLATS = 200;
const MAX_RECENT_FLATS = 30;
const STORAGE = {
  favorites: "flats:favorites:v1",
  hidden: "flats:hidden:v1",
  recent: "flats:recent:v1",
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
function regionalDefaultCountry(): "UA" | "UZ" {
  if (!import.meta.client) return "UA";
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  return timeZone.startsWith("Asia/") ? "UZ" : "UA";
}
const countries = ref<string[]>([]);
const city = ref("");
const district = ref("");
const propertyType = ref("any");
const dealType = ref("any");
const agency = ref("any");
const petFriendly = ref(false);
const roomOnlyFilter = ref(false);
const childrenRequired = ref(false);
const newBuildingOnly = ref(false);
const dishwasherOnly = ref(false);
const airConditionerOnly = ref(false);
const parkingOnly = ref(false);
const internetOnly = ref(false);
const gasOnly = ref(false);
const balconyOnly = ref(false);
const terraceOnly = ref(false);
const privateYardOnly = ref(false);
const sort = ref<FlatSort>("newest");
const audience = ref("any");
const metro = ref("");
const priceMin = ref<number | undefined>(undefined);
const priceMax = ref<number | undefined>(undefined);
const roomsMin = ref<number | undefined>(undefined);
const roomsMax = ref<number | undefined>(undefined);
const bedroomsMin = ref<number | undefined>(undefined);
const bedroomsMax = ref<number | undefined>(undefined);
const areaMin = ref<number | undefined>(undefined);
const areaMax = ref<number | undefined>(undefined);
const pricePerSqmMin = ref<number | undefined>(undefined);
const pricePerSqmMax = ref<number | undefined>(undefined);
// Walking distance, in metres, from the coordinate-derived places data.
const metroMaxM = ref<number | undefined>(undefined);
const nearbyKind = ref("");
const nearbyMaxM = ref<number | undefined>(undefined);
const floorMin = ref<number | undefined>(undefined);
const floorMax = ref<number | undefined>(undefined);
const totalFloorsMin = ref<number | undefined>(undefined);
const totalFloorsMax = ref<number | undefined>(undefined);
const yearMin = ref<number | undefined>(undefined);
const yearMax = ref<number | undefined>(undefined);
const maxAgeDays = ref<number | undefined>(undefined);
const displayCurrency = ref("USD");
const rates = ref<Record<string, number>>({ USD: 1 });
const query = ref("");
const source = ref("");
const showAdvanced = ref(false);

const listings = ref<Listing[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const warming = ref(false);
const failed = ref(false);
const sourceErrors = ref<FeedResult["sourceErrors"]>([]);
const nextCursor = ref<string | null>(null);
const failedPhotoUrls = ref<Set<string>>(new Set());
const view = ref<FlatView>("active");
const favorites = ref<Listing[]>([]);
const hidden = ref<Listing[]>([]);
const recent = ref<Listing[]>([]);
const presetModalOpen = ref(false);
const shareModalOpen = ref(false);
const sharedLinkOpened = ref(false);
const listingShareModalOpen = ref(false);
const listingShareUrl = ref("");
const listingShareCopied = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const drawnArea = ref<Array<{ lat: number; lng: number }>>([]);
const filtersEl = ref<HTMLElement | null>(null);
const showBackToTop = ref(false);
let loadSeq = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let sharedListingTimer: ReturnType<typeof setTimeout> | undefined;
let infiniteObserver: IntersectionObserver | undefined;
let lastPaginationScrollY = 0;

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

function photoCandidates(listing: Listing): string[] {
  return [...new Set([listing.photo, ...(listing.photos || [])].filter((value): value is string => !!value))];
}
function listingPhoto(listing: Listing): string | null {
  return photoCandidates(listing).find((url) => !failedPhotoUrls.value.has(url)) || null;
}
function visiblePhotos(listing: Listing): string[] {
  return photoCandidates(listing).filter((url) => !failedPhotoUrls.value.has(url));
}
function markPhotoFailed(url: string | null) {
  if (!url) return;
  failedPhotoUrls.value = new Set([...failedPhotoUrls.value, url]);
}
function markPhotoFailedFromEvent(event: Event) {
  markPhotoFailed((event.currentTarget as HTMLImageElement | null)?.getAttribute("src") || null);
}

const meta = ref<CountryMeta[]>([]);
const cityOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  return [...new Set(picked.flatMap((c) => c.cities ?? []))].sort();
});
const districtOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  const set = new Set<string>();
  for (const c of picked) {
    for (const [cityName, loc] of Object.entries(c.locations ?? {})) {
      if (city.value && cityName !== city.value) continue;
      for (const d of loc?.districts ?? []) set.add(d);
    }
  }
  return [...set].sort();
});
const metroOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  const set = new Set<string>();
  for (const c of picked) {
    for (const [cityName, loc] of Object.entries(c.locations ?? {})) {
      if (city.value && cityName !== city.value) continue;
      for (const station of loc?.metro ?? []) set.add(station);
    }
  }
  return [...set].sort();
});

const SOURCES = ["olx", "telegram"];
const NEARBY_KINDS = [
  "supermarket", "mall", "market", "pharmacy", "clinic",
  "school", "kindergarten", "park", "transport", "historic", "cinema", "landmark",
] as const;
const sourceOptions = computed(() => [{ value: "", label: t("all") }, ...SOURCES.map((s) => ({ value: s, label: s }))]);
const ANY = "__any__";
type Item = { label: string; value: string };
const propertyTypeSel = computed<string>({ get: () => propertyType.value, set: (v) => (propertyType.value = v) });
const dealTypeSel = computed<string>({ get: () => dealType.value, set: (v) => (dealType.value = v) });
const agencySel = computed<string>({ get: () => agency.value, set: (v) => (agency.value = v) });
const countryItems = computed<Item[]>(() => meta.value.map((c) => ({ value: c.code, label: c.name })));
const locName = (v: string | null | undefined, kind: LocationKind = "any") => locationLabel(v, locale.value, kind);
const cityItems = computed<Item[]>(() => [{ label: t("cityAny"), value: ANY }, ...cityOptions.value.map((c) => ({ label: locName(c, "city"), value: c }))]);
const citySel = computed<string>({ get: () => city.value || ANY, set: (v) => (city.value = v === ANY ? "" : v) });
const districtItems = computed<Item[]>(() => [{ label: t("districtAny"), value: ANY }, ...districtOptions.value.map((d) => ({ label: locName(d, "district"), value: d }))]);
const nearbyKindItems = computed<Item[]>(() => [
  { label: t("nearbyKindAny"), value: ANY },
  ...NEARBY_KINDS.map((kind) => ({ value: kind, label: t(`nearbyKind_${kind}`) })),
]);
const nearbyKindSel = computed<string>({
  get: () => nearbyKind.value || ANY,
  set: (v) => (nearbyKind.value = v === ANY ? "" : v),
});
const metroItems = computed<Item[]>(() => [{ label: t('metroAny'), value: ANY }, ...metroOptions.value.map((m) => ({ label: locName(m, "metro"), value: m }))]);
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
const districtSel = computed<string>({ get: () => district.value || ANY, set: (v) => (district.value = v === ANY ? "" : v) });
const metroSel = computed<string>({ get: () => metro.value || ANY, set: (v) => (metro.value = v === ANY ? "" : v) });
const audienceItems = computed<Item[]>(() => [
  { label: t('audienceAny'), value: "any" },
  { label: t('audienceWomen'), value: "women" },
  { label: t('audienceMen'), value: "men" },
  { label: t('audienceFamily'), value: "family" },
]);
const audienceSel = computed<string>({ get: () => audience.value, set: (v) => (audience.value = v) });
const propertyTypeItems = computed<Item[]>(() => [
  { label: t("ptAny"), value: "any" }, { label: t("ptFlat"), value: "flat" }, { label: t("ptHouse"), value: "house" },
]);
const dealTypeItems = computed<Item[]>(() => [
  { label: t("dtAny"), value: "any" }, { label: t("dtSale"), value: "sale" },
  { label: t("dtLongRent"), value: "longRent" }, { label: t("dtShortRent"), value: "shortRent" },
]);
const agencyItems = computed<Item[]>(() => [
  { label: t("agAny"), value: "any" }, { label: t("agOwner"), value: "owner" }, { label: t("agAgency"), value: "agency" },
]);

function loadPersonalState() {
  favorites.value = readStoredList<Listing>(STORAGE.favorites, MAX_SAVED_FLATS);
  hidden.value = readStoredList<Listing>(STORAGE.hidden, MAX_SAVED_FLATS);
  recent.value = readStoredList<Listing>(STORAGE.recent, MAX_RECENT_FLATS);
  loadPresets();
  try { showAdvanced.value = localStorage.getItem("flats:showAdvanced") === "1"; } catch { /* noop */ }
}
function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value;
  try { localStorage.setItem("flats:showAdvanced", showAdvanced.value ? "1" : "0"); } catch { /* noop */ }
}

const hiddenIds = computed(() => new Set(hidden.value.map((item) => item.id)));
const favoriteIds = computed(() => new Set(favorites.value.map((item) => item.id)));
const isHidden = (id: string) => hiddenIds.value.has(id);
const isFavorite = (id: string) => favoriteIds.value.has(id);

function pointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lng, yi = polygon[i]!.lat;
    const xj = polygon[j]!.lng, yj = polygon[j]!.lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat)) && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
function applyDrawnArea(items: Listing[]) {
  if (drawnArea.value.length < 3) return items;
  if (!items.some((item) => item.lat != null && item.lng != null)) return items;
  return items.filter((item) => item.lat != null && item.lng != null && pointInPolygon({ lat: item.lat, lng: item.lng }, drawnArea.value));
}
const activeListings = computed(() => applyDrawnArea(listings.value.filter((item) => !hiddenIds.value.has(item.id))));
const displayedListings = computed(() => {
  if (view.value === "favorites") return applyDrawnArea(favorites.value);
  if (view.value === "recent") return applyDrawnArea(recent.value);
  if (view.value === "hidden") return applyDrawnArea(hidden.value);
  return activeListings.value;
});
const hasMore = computed(() => view.value === "active" && listings.value.length < total.value);

function currentFilterQuery(): Record<string, string> {
  const q: Record<string, string> = {};
  if (countries.value.length) q.countries = countries.value.join(",");
  if (city.value) q.city = city.value;
  if (district.value) q.district = district.value;
  if (metro.value) q.metro = metro.value;
  if (propertyType.value !== "any") q.propertyType = propertyType.value;
  if (dealType.value !== "any") q.dealType = dealType.value;
  if (agency.value !== "any") q.agency = agency.value;
  if (audience.value !== "any") q.audience = audience.value;
  if (petFriendly.value) q.pets = "1";
  if (roomOnlyFilter.value) q.roomOnly = "1";
  if (childrenRequired.value) q.children = "1";
  if (newBuildingOnly.value) q.newBuilding = "1";
  if (dishwasherOnly.value) q.dishwasher = "1";
  if (airConditionerOnly.value) q.airConditioner = "1";
  if (parkingOnly.value) q.parking = "1";
  if (internetOnly.value) q.internet = "1";
  if (gasOnly.value) q.gas = "1";
  if (balconyOnly.value) q.balcony = "1";
  if (terraceOnly.value) q.terrace = "1";
  if (privateYardOnly.value) q.privateYard = "1";
  if (sort.value !== "newest") q.sort = sort.value;
  if (priceMin.value != null) q.priceMin = String(priceMin.value);
  if (priceMax.value != null) q.priceMax = String(priceMax.value);
  if (displayCurrency.value !== "USD") q.currency = displayCurrency.value;
  if (roomsMin.value != null) q.roomsMin = String(roomsMin.value);
  if (roomsMax.value != null) q.roomsMax = String(roomsMax.value);
  if (bedroomsMin.value != null) q.bedroomsMin = String(bedroomsMin.value);
  if (bedroomsMax.value != null) q.bedroomsMax = String(bedroomsMax.value);
  if (areaMin.value != null) q.areaMin = String(areaMin.value);
  if (areaMax.value != null) q.areaMax = String(areaMax.value);
  if (pricePerSqmMin.value != null) q.pricePerSqmMin = String(pricePerSqmMin.value);
  if (pricePerSqmMax.value != null) q.pricePerSqmMax = String(pricePerSqmMax.value);
  if (metroMaxM.value != null) q.metroMaxM = String(metroMaxM.value);
  if (nearbyKind.value) q.nearbyKind = nearbyKind.value;
  if (nearbyMaxM.value != null) q.nearbyMaxM = String(nearbyMaxM.value);
  if (floorMin.value != null) q.floorMin = String(floorMin.value);
  if (floorMax.value != null) q.floorMax = String(floorMax.value);
  if (totalFloorsMin.value != null) q.totalFloorsMin = String(totalFloorsMin.value);
  if (totalFloorsMax.value != null) q.totalFloorsMax = String(totalFloorsMax.value);
  if (yearMin.value != null) q.yearMin = String(yearMin.value);
  if (yearMax.value != null) q.yearMax = String(yearMax.value);
  if (maxAgeDays.value != null) q.maxAgeDays = String(maxAgeDays.value);
  if (query.value.trim()) q.query = query.value.trim();
  if (source.value) q.sources = source.value;
  return q;
}
function applyQueryParams(params: Record<string, unknown>) {
  const countryParam = queryString(params.countries);
  if (countryParam) countries.value = countryParam.split(",").filter(Boolean);
  city.value = queryString(params.city);
  district.value = queryString(params.district);
  propertyType.value = ["flat", "house"].includes(queryString(params.propertyType)) ? queryString(params.propertyType) : "any";
  dealType.value = ["sale", "longRent", "shortRent"].includes(queryString(params.dealType)) ? queryString(params.dealType) : "any";
  agency.value = ["owner", "agency"].includes(queryString(params.agency)) ? queryString(params.agency) : "any";
  audience.value = ["women", "men", "family"].includes(queryString(params.audience)) ? queryString(params.audience) : "any";
  metro.value = queryString(params.metro);
  petFriendly.value = queryBoolean(params.pets);
  roomOnlyFilter.value = queryBoolean(params.roomOnly);
  childrenRequired.value = queryBoolean(params.children);
  newBuildingOnly.value = queryBoolean(params.newBuilding);
  dishwasherOnly.value = queryBoolean(params.dishwasher);
  airConditionerOnly.value = queryBoolean(params.airConditioner);
  parkingOnly.value = queryBoolean(params.parking);
  internetOnly.value = queryBoolean(params.internet);
  gasOnly.value = queryBoolean(params.gas);
  balconyOnly.value = queryBoolean(params.balcony);
  terraceOnly.value = queryBoolean(params.terrace);
  privateYardOnly.value = queryBoolean(params.privateYard);
  const sortParam = queryString(params.sort);
  sort.value = (["newest", "oldest", "priceAsc", "priceDesc", "titleAsc", "titleDesc"].includes(sortParam) ? sortParam : "newest") as FlatSort;
  priceMin.value = Number(queryString(params.priceMin)) || undefined;
  priceMax.value = Number(queryString(params.priceMax)) || undefined;
  if (queryString(params.currency)) displayCurrency.value = queryString(params.currency);
  roomsMin.value = Number(queryString(params.roomsMin)) || undefined;
  roomsMax.value = Number(queryString(params.roomsMax)) || undefined;
  bedroomsMin.value = Number(queryString(params.bedroomsMin)) || undefined;
  bedroomsMax.value = Number(queryString(params.bedroomsMax)) || undefined;
  areaMin.value = Number(queryString(params.areaMin)) || undefined;
  areaMax.value = Number(queryString(params.areaMax)) || undefined;
  pricePerSqmMin.value = Number(queryString(params.pricePerSqmMin)) || undefined;
  pricePerSqmMax.value = Number(queryString(params.pricePerSqmMax)) || undefined;
  metroMaxM.value = Number(queryString(params.metroMaxM)) || undefined;
  nearbyKind.value = queryString(params.nearbyKind);
  nearbyMaxM.value = Number(queryString(params.nearbyMaxM)) || undefined;
  floorMin.value = Number(queryString(params.floorMin)) || undefined;
  floorMax.value = Number(queryString(params.floorMax)) || undefined;
  totalFloorsMin.value = Number(queryString(params.totalFloorsMin)) || undefined;
  totalFloorsMax.value = Number(queryString(params.totalFloorsMax)) || undefined;
  yearMin.value = Number(queryString(params.yearMin)) || undefined;
  yearMax.value = Number(queryString(params.yearMax)) || undefined;
  maxAgeDays.value = Number(queryString(params.maxAgeDays)) || undefined;
  query.value = queryString(params.query);
  const sourceParam = queryString(params.sources);
  source.value = SOURCES.includes(sourceParam) ? sourceParam : "";
}
// The address bar follows the filters directly instead of waiting for a request
// to come back. It used to be written only at the end of a successful load, so
// a failed or still-running request left the URL describing filters that were no
// longer applied: resetting did not clear it, and removing one of the chips
// above the results did not take that filter out of the query string either.
let querySyncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleQuerySync(delay = 200) {
  if (querySyncTimer) clearTimeout(querySyncTimer);
  querySyncTimer = setTimeout(() => { querySyncTimer = undefined; void syncQueryParams(); }, delay);
}

async function syncQueryParams() {
  const preserved: Record<string, string> = {};
  for (const key of ["flat", "flatSource", "flatCountry"] as const) {
    const value = queryString(route.query[key]);
    if (value) preserved[key] = value;
  }
  await router.replace({ query: { ...currentFilterQuery(), ...preserved } });
}
const shareUrl = computed(() => {
  const resolved = router.resolve({ path: route.path, query: { ...currentFilterQuery(), shared: "1" } });
  return import.meta.client ? new URL(resolved.href, window.location.origin).toString() : resolved.href;
});
async function copyShareLink() { await copyText(shareUrl.value); }
function savePreset() {
  if (saveSearchPreset()) presetModalOpen.value = false;
}
async function loadMeta() {
  const { data } = await safeFetch<CountryMeta[]>("/flats-meta");
  if (!Array.isArray(data)) return;
  meta.value = data;
  if (!countries.value.length) {
    const preferred = data.some((country) => country.code === defaultCountry.value) ? defaultCountry.value : "UA";
    countries.value = [preferred];
  }
}
async function loadRates() { const { data } = await safeFetch<{ rates?: Record<string, number> }>("/flats-rates"); if (data?.rates && data.rates.USD) rates.value = data.rates; }
function scheduleWarmPoll() {
  if (warmTimer) clearTimeout(warmTimer);
  if (!warming.value) return;
  warmTimer = setTimeout(() => { warmTimer = undefined; void load(false, true); }, 1800);
}
async function load(append = false, background = false) {
  const seq = background ? loadSeq : ++loadSeq;
  if (!background) { append ? loadingMore.value = true : loading.value = true; failed.value = false; }
  const params: Record<string, string> = { limit: String(PAGE_SIZE) };
  const cursorSort = sort.value === "newest" || sort.value === "oldest";
  if (append && cursorSort && nextCursor.value) params.cursor = nextCursor.value;
  else params.offset = String(append ? listings.value.length : 0);
  if (countries.value.length) params.countries = countries.value.join(",");
  if (city.value) params.city = city.value;
  if (district.value) params.district = district.value;
  if (propertyType.value !== "any") params.propertyType = propertyType.value;
  if (dealType.value !== "any") params.dealType = dealType.value;
  if (agency.value !== "any") params.agency = agency.value;
  if (priceMin.value != null) params.priceMin = String(priceMin.value);
  if (priceMax.value != null) params.priceMax = String(priceMax.value);
  if (priceMin.value != null || priceMax.value != null) params.priceCurrency = displayCurrency.value;
  if (roomsMin.value != null) params.roomsMin = String(roomsMin.value);
  if (roomsMax.value != null) params.roomsMax = String(roomsMax.value);
  if (bedroomsMin.value != null) params.bedroomsMin = String(bedroomsMin.value);
  if (bedroomsMax.value != null) params.bedroomsMax = String(bedroomsMax.value);
  if (areaMin.value != null) params.areaMin = String(areaMin.value);
  if (areaMax.value != null) params.areaMax = String(areaMax.value);
  if (pricePerSqmMin.value != null) params.pricePerSqmMin = String(pricePerSqmMin.value);
  if (pricePerSqmMax.value != null) params.pricePerSqmMax = String(pricePerSqmMax.value);
  if (metroMaxM.value != null) params.metroMaxM = String(metroMaxM.value);
  if (nearbyKind.value) params.nearbyKind = nearbyKind.value;
  if (nearbyMaxM.value != null) params.nearbyMaxM = String(nearbyMaxM.value);
  if (floorMin.value != null) params.floorMin = String(floorMin.value);
  if (floorMax.value != null) params.floorMax = String(floorMax.value);
  if (totalFloorsMin.value != null) params.totalFloorsMin = String(totalFloorsMin.value);
  if (totalFloorsMax.value != null) params.totalFloorsMax = String(totalFloorsMax.value);
  if (yearMin.value != null) params.yearMin = String(yearMin.value);
  if (yearMax.value != null) params.yearMax = String(yearMax.value);
  if (maxAgeDays.value != null) params.maxAgeDays = String(maxAgeDays.value);
  if (metro.value) params.metro = metro.value;
  if (audience.value !== "any") params.audience = audience.value;
  if (petFriendly.value) params.pets = "1";
  if (roomOnlyFilter.value) params.roomOnly = "1";
  if (childrenRequired.value) params.children = "1";
  if (newBuildingOnly.value) params.newBuilding = "1";
  if (dishwasherOnly.value) params.dishwasher = "1";
  if (airConditionerOnly.value) params.airConditioner = "1";
  if (parkingOnly.value) params.parking = "1";
  if (internetOnly.value) params.internet = "1";
  if (gasOnly.value) params.gas = "1";
  if (balconyOnly.value) params.balcony = "1";
  if (terraceOnly.value) params.terrace = "1";
  if (privateYardOnly.value) params.privateYard = "1";
  params.sort = sort.value;
  if (query.value.trim()) params.query = query.value.trim();
  params.sources = source.value || SOURCES.join(",");
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params });
  if (seq !== loadSeq) { if (!background) { loading.value = false; loadingMore.value = false; } return; }
  if (error || !data || data.error) {
    if (!background) { failed.value = true; if (!append) { listings.value = []; total.value = 0; nextCursor.value = null; } sourceErrors.value = []; loading.value = false; loadingMore.value = false; }
    return;
  }
  if (background) { total.value = data.count ?? total.value; sourceErrors.value = data.sourceErrors || []; warming.value = !!data.warming; scheduleWarmPoll(); return; }
  nextCursor.value = data.nextCursor || null;
  const next = Array.isArray(data.listings) ? data.listings : [];
  if (append) {
    const existingKeys = new Set(listings.value.map((item) => `${item.source}:${item.country}:${item.id}`));
    const newListings = next.filter((item) => { const key = `${item.source}:${item.country}:${item.id}`; if (existingKeys.has(key)) return false; existingKeys.add(key); return true; });
    listings.value = [...listings.value, ...newListings];
  } else {
    listings.value = next;
    if (import.meta.client) lastPaginationScrollY = window.scrollY;
  }
  total.value = data.count ?? listings.value.length;
  sourceErrors.value = data.sourceErrors || [];
  warming.value = !!data.warming;
  loading.value = false; loadingMore.value = false;
  if (!append) void syncQueryParams();
  scheduleWarmPoll();
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
  countries.value = [defaultCountry.value];
  city.value = ""; district.value = ""; metro.value = ""; propertyType.value = "any"; dealType.value = "any"; agency.value = "any"; audience.value = "any";
  petFriendly.value = false; roomOnlyFilter.value = false; childrenRequired.value = false; newBuildingOnly.value = false;
  dishwasherOnly.value = false; airConditionerOnly.value = false; parkingOnly.value = false; internetOnly.value = false; gasOnly.value = false; balconyOnly.value = false; terraceOnly.value = false; privateYardOnly.value = false; sort.value = "newest";
  priceMin.value = undefined; priceMax.value = undefined; displayCurrency.value = "USD";
  roomsMin.value = undefined; roomsMax.value = undefined; bedroomsMin.value = undefined; bedroomsMax.value = undefined; areaMin.value = undefined; areaMax.value = undefined; pricePerSqmMin.value = undefined; pricePerSqmMax.value = undefined;
  metroMaxM.value = undefined; nearbyKind.value = ""; nearbyMaxM.value = undefined;
  floorMin.value = undefined; floorMax.value = undefined; totalFloorsMin.value = undefined; totalFloorsMax.value = undefined; yearMin.value = undefined; yearMax.value = undefined; maxAgeDays.value = undefined;
  query.value = ""; source.value = ""; drawnArea.value = []; view.value = "active";
  scheduleLoad();
}
function updateBackToTop() { showBackToTop.value = window.scrollY > 600; }
function scrollToFilters() { filtersEl.value?.scrollIntoView({ behavior: "smooth", block: "start" }); }
function setView(next: string) { view.value = next as FlatView; }
function toggleFavorite(item: Listing) {
  favorites.value = isFavorite(item.id) ? favorites.value.filter((saved) => saved.id !== item.id) : [item, ...favorites.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED_FLATS);
  if (isHidden(item.id)) { hidden.value = hidden.value.filter((saved) => saved.id !== item.id); writeStoredList(STORAGE.hidden, hidden.value, MAX_SAVED_FLATS); }
  writeStoredList(STORAGE.favorites, favorites.value, MAX_SAVED_FLATS);
}
function toggleHidden(item: Listing) {
  hidden.value = isHidden(item.id) ? hidden.value.filter((saved) => saved.id !== item.id) : [item, ...hidden.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED_FLATS);
  if (isFavorite(item.id)) { favorites.value = favorites.value.filter((saved) => saved.id !== item.id); writeStoredList(STORAGE.favorites, favorites.value, MAX_SAVED_FLATS); }
  writeStoredList(STORAGE.hidden, hidden.value, MAX_SAVED_FLATS);
}

function mapCoordinateLooksSane(listing: Listing): boolean {
  const lat = Number(listing.lat);
  const lng = Number(listing.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // Client-side guard for old cached Odesa rows while the backend repairs and
  // re-geocodes them. Prevents one offshore point from stretching the whole map.
  if (listing.country === "UA" && listing.city === "Odesa") {
    return lat >= 46.25 && lat <= 46.65 && lng >= 30.45 && lng <= 30.88;
  }
  return true;
}
const mapPoints = computed(() => displayedListings.value.filter(mapCoordinateLooksSane).map((l) => ({ id: l.id, lat: l.lat as number, lng: l.lng as number, title: displayListingTitle(l), priceLabel: priceLabel(l), photo: listingPhoto(l) || undefined, source: l.source })));

const active = ref<Listing | null>(null);
const modalOpen = ref(false);
const checkingListingKey = ref("");
const listingKey = (listing: Listing) => `${listing.source}:${listing.country}:${listing.id}`;
const lightboxIndex = ref<number | null>(null);
const lightboxPhotos = computed(() => active.value ? visiblePhotos(active.value) : []);
const lightboxPhoto = computed(() => lightboxIndex.value == null ? null : lightboxPhotos.value[lightboxIndex.value] || null);
const lightboxPosition = computed(() => (lightboxIndex.value ?? 0) + 1);
const translatedDescription = ref("");
const translatingDescription = ref(false);
const translationFailed = ref(false);
const translationCache = new Map<string, string>();
let translationPollTimer: ReturnType<typeof setTimeout> | undefined;
let translationRequestId = 0;
const TRANSLATION_MAX_POLL_ATTEMPTS = 159;
function translationCacheKey(listing: Listing, targetLanguage = locale.value.startsWith("en") ? "en" : "ru"): string { return `${listing.id}:${targetLanguage}`; }
function stopTranslationPoll() { if (translationPollTimer) clearTimeout(translationPollTimer); translationPollTimer = undefined; }
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
    query.flat = listing.id;
    query.flatSource = listing.source;
    query.flatCountry = listing.country;
  } else {
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
  favorites.value = favorites.value.filter((item) => !listingIdentityMatches(item, id, sourceName, countryCode));
  hidden.value = hidden.value.filter((item) => !listingIdentityMatches(item, id, sourceName, countryCode));
  recent.value = recent.value.filter((item) => !listingIdentityMatches(item, id, sourceName, countryCode));
  if (import.meta.client) {
    writeStoredList(STORAGE.favorites, favorites.value, MAX_SAVED_FLATS);
    writeStoredList(STORAGE.hidden, hidden.value, MAX_SAVED_FLATS);
    writeStoredList(STORAGE.recent, recent.value, MAX_RECENT_FLATS);
  }
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
  const params: Record<string, string> = { listingId: l.id, limit: "1", offset: "0", sources: "olx" };
  if (/^[A-Za-z]{2}$/.test(l.country)) params.countries = l.country.toUpperCase();
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params });
  if (error || !data) return undefined;
  const exact = data.listings?.find((listing) => listing.id === l.id && listing.source === "olx");
  if (exact) return exact;
  if (data.exactListingFallback === "source-inactive") return null;
  return undefined;
}
async function openListing(l: Listing, olxAlreadyVerified = false) {
  let listing = l;
  const key = listingKey(l);
  if (l.source === "olx" && !olxAlreadyVerified) {
    if (checkingListingKey.value) return;
    checkingListingKey.value = key;
    try {
      const verified = await verifyOlxListing(l);
      if (verified === null) {
        removeUnavailableListing(l.id, l.source, l.country);
        showListingUnavailableToast();
        if (queryString(route.query.flat) === l.id) syncListingInUrl(null);
        return;
      }
      if (verified) listing = verified;
    } finally {
      if (checkingListingKey.value === key) checkingListingKey.value = "";
    }
  }
  stopTranslationPoll(); translationRequestId += 1; lightboxIndex.value = null; active.value = listing;
  translatedDescription.value = translationCache.get(translationCacheKey(listing)) || ""; translatingDescription.value = false; translationFailed.value = false; modalOpen.value = true;
  recent.value = [listing, ...recent.value.filter((item) => item.id !== listing.id)].slice(0, MAX_RECENT_FLATS); writeStoredList(STORAGE.recent, recent.value, MAX_RECENT_FLATS);
  syncListingInUrl(listing);
}
function modalTitle(listing: Listing | null): string {
  if (!listing) return "";
  const normalized = displayListingTitle(listing).replace(/\s+/g, " ").trim();
  const humanTitle = normalized.split(/\s*[•·]\s*/)[0]?.trim() || normalized;
  return humanTitle.length > 140 ? `${humanTitle.slice(0, 137).trimEnd()}…` : humanTitle;
}
function hasMeaningfulTitle(value: string): boolean {
  const content = value.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Variation_Selector}\p{Join_Control}]/gu, "").replace(/[^\p{L}\p{N}]+/gu, "");
  return content.length >= 3;
}
function displayListingTitle(listing: Listing): string {
  const title = listing.title.replace(/\s+/g, " ").trim();
  if (hasMeaningfulTitle(title)) return title;
  const parts = [dealLabel(listing.dealType), listing.rooms != null ? t("roomsN", { n: listing.rooms }) : "", ptLabel(listing.propertyType), listing.district || listing.city || ""].filter(Boolean);
  return parts.join(" · ") || t("listingFallbackTitle");
}
function descriptionMatchesTargetLanguage(text: string, targetLanguage: "en" | "ru"): boolean {
  const normalized = text.toLocaleLowerCase();
  if (targetLanguage === "ru") {
    if (/[ўқғҳ]/iu.test(normalized)) return false;
    const russianSignals = normalized.match(/(?:квартир\p{L}*|комнат\p{L}*|этаж\p{L}*|дом\p{L}*|цен\p{L}*|сда[её]тся|прода[её]тся|аренд\p{L}*|рядом|метро|семейн\p{L}*|коммунальн\p{L}*)/giu) || [];
    return russianSignals.length >= 2;
  }
  const englishVocabulary = new Set(["apartment", "flat", "house", "room", "floor", "price", "rent", "sale", "family", "utilities", "near", "available", "bedroom"]);
  const englishSignals = (normalized.match(/[a-z]+/g) || []).filter((word) => englishVocabulary.has(word));
  return englishSignals.length >= 3;
}
const descriptionNeedsTranslation = computed(() => { const description = active.value?.description?.trim(); if (!description) return false; const targetLanguage = locale.value.startsWith("en") ? "en" : "ru"; return !descriptionMatchesTargetLanguage(description, targetLanguage); });
function openLightbox(index: number) { if (!lightboxPhotos.value.length) return; lightboxIndex.value = Math.max(0, Math.min(index, lightboxPhotos.value.length - 1)); }
function closeLightbox() { lightboxIndex.value = null; }
function moveLightbox(direction: -1 | 1) { const total = lightboxPhotos.value.length; if (!total || lightboxIndex.value == null) return; lightboxIndex.value = (lightboxIndex.value + direction + total) % total; }
function lightboxPhotoFailed(event: Event) { markPhotoFailedFromEvent(event); nextTick(() => { if (!lightboxPhotos.value.length) closeLightbox(); else if (lightboxIndex.value != null) lightboxIndex.value = Math.min(lightboxIndex.value, lightboxPhotos.value.length - 1); }); }
const SWIPE_MIN_PX = 50;
let swipeStart: { x: number; y: number; id: number } | null = null;
function onLightboxPointerDown(event: PointerEvent) { if (lightboxPhotos.value.length < 2) return; swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; }
function onLightboxPointerUp(event: PointerEvent) { if (!swipeStart || event.pointerId !== swipeStart.id) return; const dx = event.clientX - swipeStart.x; const dy = event.clientY - swipeStart.y; swipeStart = null; if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return; moveLightbox(dx < 0 ? 1 : -1); }
function onLightboxPointerCancel() { swipeStart = null; }
function releaseStuckScrollLock() {
  if (import.meta.server || modalOpen.value || lightboxIndex.value !== null) return;
  const body = document.body;
  if (body.style.overflow === "hidden") body.style.removeProperty("overflow");
  if (body.style.position === "fixed") { const top = body.style.top; body.style.removeProperty("position"); body.style.removeProperty("top"); body.style.removeProperty("width"); const offset = Math.abs(parseInt(top || "0", 10)) || 0; if (offset) window.scrollTo(0, offset); }
  body.style.removeProperty("padding-right"); document.documentElement.style.removeProperty("overflow");
}
function onLightboxKeydown(event: KeyboardEvent) { if (lightboxIndex.value == null) return; if (event.key === "Escape") closeLightbox(); else if (event.key === "ArrowLeft") moveLightbox(-1); else if (event.key === "ArrowRight") moveLightbox(1); else return; event.preventDefault(); }
function acceptTranslation(result: TranslationResult, listing: Listing, requestId: number, cacheKey: string): boolean {
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return true;
  if (result.status !== "completed") return false;
  const text = result.data?.translatedText?.trim() || "";
  if (!text) { translatingDescription.value = false; translationFailed.value = true; return true; }
  translationCache.set(cacheKey, text); translatedDescription.value = text; translatingDescription.value = false; translationFailed.value = false; return true;
}
async function pollTranslation(key: string, listing: Listing, requestId: number, cacheKey: string, attempt = 0) {
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  const { data, error } = await safeFetch<TranslationResult>("/flats-translate", { params: { key } });
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  if (!error && data && acceptTranslation(data, listing, requestId, cacheKey)) return;
  if (error || data?.status === "failed" || data?.status === "disabled" || data?.status === "not_found" || attempt >= TRANSLATION_MAX_POLL_ATTEMPTS) { translatingDescription.value = false; translationFailed.value = true; return; }
  translationPollTimer = setTimeout(() => void pollTranslation(key, listing, requestId, cacheKey, attempt + 1), 1500);
}
async function translateActiveDescription() {
  const listing = active.value;
  if (!listing?.description || translatingDescription.value || !descriptionNeedsTranslation.value) return;
  const targetLanguage = locale.value.startsWith("en") ? "en" : "ru";
  const cacheKey = translationCacheKey(listing, targetLanguage);
  const cached = translationCache.get(cacheKey); if (cached) { translatedDescription.value = cached; return; }
  stopTranslationPoll(); const requestId = ++translationRequestId; translatingDescription.value = true; translationFailed.value = false;
  const { data, error } = await safeFetch<TranslationResult>("/flats-translate", { method: "POST", body: { text: listing.description, targetLanguage } });
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  if (error || !data) { translatingDescription.value = false; translationFailed.value = true; return; }
  if (acceptTranslation(data, listing, requestId, cacheKey)) return;
  if (data.status === "pending" && data.key) { translationPollTimer = setTimeout(() => void pollTranslation(data.key!, listing, requestId, cacheKey), 1000); return; }
  translatingDescription.value = false; translationFailed.value = true;
}
function openById(id: string) { const found = displayedListings.value.find((l) => l.id === id); if (found) void openListing(found); }
function priceLabel(l: Listing): string { if (l.price == null) return t("priceNA"); return `${l.price.toLocaleString()} ${l.currency}`.trim(); }
function updateLightboxZoom(event: MouseEvent) { const image = event.currentTarget as HTMLImageElement; const rect = image.getBoundingClientRect(); image.style.setProperty("--zoom-x", `${((event.clientX - rect.left) / rect.width) * 100}%`); image.style.setProperty("--zoom-y", `${((event.clientY - rect.top) / rect.height) * 100}%`); }
function resetLightboxZoom(event: MouseEvent) { const image = event.currentTarget as HTMLImageElement; image.style.setProperty("--zoom-x", "50%"); image.style.setProperty("--zoom-y", "50%"); }
function convert(amount: number, from: string, to: string): number | undefined { const rf = rates.value[(from || "USD").toUpperCase()]; const rt = rates.value[(to || "USD").toUpperCase()]; if (!rf || !rt) return undefined; return (amount * rt) / rf; }
function convertedLabel(l: Listing): string | null { if (l.price == null || !l.currency || l.currency.toUpperCase() === displayCurrency.value.toUpperCase()) return null; const v = convert(l.price, l.currency, displayCurrency.value); return v === undefined ? null : `≈ ${Math.round(v).toLocaleString()} ${displayCurrency.value}`; }
const dealLabel = (d: Listing["dealType"]) => d === "sale" ? t("dtSale") : d === "longRent" ? t("dtLongRent") : d === "shortRent" ? t("dtShortRent") : "";
function specLine(l: Listing): string { const parts: string[] = []; if (l.rooms != null) parts.push(t("roomsN", { n: l.rooms })); if (l.areaSqm != null) parts.push(`${l.areaSqm} ${t("sqm")}`); if (l.floor != null) parts.push(l.totalFloors != null ? `${l.floor}/${l.totalFloors} ${t("floorAbbr")}` : `${l.floor} ${t("floorAbbr")}`); return parts.join(" · "); }
function locLine(l: Listing): string { return [locName(l.city, "city"), locName(l.district, "district"), locName(l.metro, "metro")].filter(Boolean).join(", "); }
const fmtBool = (v?: boolean | null) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const numOr = (v?: number | null, unit = "") => (v != null ? `${v}${unit ? " " + unit : ""}` : t("notSpecified"));
const strOr = (v?: string | null) => (v ? v : t("notSpecified"));
const listOr = (v?: string[] | null) => (v && v.length ? v.join(", ") : t("notSpecified"));
const nearbyTranslationKeys: Record<string, string> = { "Bobur Park": "nearbyBoburPark", "Alay Bazaar": "nearbyAlayBazaar", Darkhan: "nearbyDarkhan", Novomoskovskaya: "nearbyNovomoskovskaya", "Farhod Bazaar": "nearbyFarhodBazaar", "Nizami Pedagogical University": "nearbyNizamiUniversity", "World Languages University": "nearbyWorldLanguagesUniversity", "Yangi Choshtepa": "nearbyYangiChoshtepa", "Sergeli Car Bazaar": "nearbySergeliCarBazaar", Park: "nearbyPark", "Bus stop": "nearbyBusStop", Clinic: "nearbyClinic", School: "nearbySchool", Kindergarten: "nearbyKindergarten", "Shopping center": "nearbyShoppingCenter", Mosque: "nearbyMosque", Dishwasher: "amenityDishwasher", dishwasher: "amenityDishwasher", "Separate rooms": "amenitySeparateRooms", "Washing machine": "amenityWashingMachine", Television: "amenityTelevision", "Bed linen": "amenityBedLinen", Towels: "amenityTowels" };
const nearbyItemLabel = (value: string) => nearbyTranslationKeys[value] ? t(nearbyTranslationKeys[value]) : value;
const nearbyListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(", ") : t("notSpecified");
const amenitiesListOr = (values?: string[] | null) => values?.length ? values.map(nearbyItemLabel).join(", ") : t("notSpecified");
const ptLabel = (p: Listing["propertyType"]) => (p === "house" ? t("ptHouse") : t("ptFlat"));
const audienceLabel = (a?: Listing["audience"]) => a === "women" ? t("audWomen") : a === "men" ? t("audMen") : a === "family" ? t("audFamily") : t("audAny");
const conditionLabel = (c?: Listing["condition"]) => c === "needs_renovation" ? t("condNeeds") : c === "basic" ? t("condBasic") : c === "good" ? t("condGood") : c === "modern" ? t("condModern") : c === "luxury" ? t("condLuxury") : t("notSpecified");
const sourceLabel = (s?: string) => (s === "olx" ? "OLX" : s === "telegram" ? "Telegram" : strOr(s));
function cardDealTone(l: Listing): "sale" | "rent" | "room" | "short" | "" {
  if (l.dealType === "shortRent") return "short";
  if (l.roomOnly) return "room";
  if (l.dealType === "sale") return "sale";
  if (l.dealType === "longRent") return "rent";
  return "";
}
function cardDealLabel(l: Listing): string {
  const filterApplies = view.value === "active";
  if (l.dealType === "shortRent") return !filterApplies || dealType.value !== "shortRent" ? t("cardShortRent") : "";
  if (l.roomOnly) return !filterApplies || !roomOnlyFilter.value ? t("roomShare") : "";
  if (!filterApplies || dealType.value === "any") {
    if (l.dealType === "longRent") return t("cardRent");
    return dealLabel(l.dealType);
  }
  return "";
}
function cardBadges(l: Listing): string[] {
  const b: string[] = [];
  if (view.value !== "active" || agency.value === "any") b.push(l.byAgency ? t("badgeAgency") : t("badgeOwner"));
  if (l.commission === false) b.push(t("badgeNoCommission"));
  if (l.newBuilding) b.push(t("badgeNew"));
  if (l.furnished) b.push(t("badgeFurnished"));
  if (l.airConditioner) b.push(t("badgeAC"));
  if (l.balcony) b.push(t("badgeBalcony"));
  if (l.parking) b.push(t("badgeParking"));
  if (l.elevator) b.push(t("badgeElevator"));
  if (l.internet) b.push(t("badgeInternet"));
  if (l.negotiable) b.push(t("badgeNegotiable"));
  if (l.petsAllowed) b.push(t("badgePet"));
  if (l.childrenAllowed) b.push(t("badgeChildren"));
  if (l.communalSeparated === false) b.push(t("badgeUtilIncl"));
  if (l.deposit === true) b.push(t("badgeDeposit"));
  if (l.audience === "family") b.push(t("badgeFamily"));
  if (l.audience === "women") b.push(t("badgeWomen"));
  if (l.audience === "men") b.push(t("badgeMen"));
  for (const tag of l.tags || []) {
    const label = nearbyItemLabel(tag)?.trim();
    if (label) b.push(label);
  }
  return [...new Set(b)];
}
function floorLabel(l: Listing) { if (l.floor != null && l.totalFloors != null) return `${l.floor} / ${l.totalFloors}`; return l.floor != null || l.totalFloors != null ? String(l.floor ?? l.totalFloors) : t("nd"); }
function depositLabel(l: Listing) { if (l.depositAmount != null) return `${l.depositAmount.toLocaleString()} ${l.depositCurrency || l.currency}`; return fmtBool(l.deposit); }
function commissionLabel(l: Listing) { if (l.commissionPercent != null) return `${l.commissionPercent}%`; return fmtBool(l.commission); }
function communalLabel(l: Listing) { if (l.communalSeparated === true) return t("communalSeparate"); if (l.communalSeparated === false) return t("communalIncluded"); return t("notSpecified"); }
const specRows = computed<Array<{ label: string; value: string }>>(() => {
  const l = active.value; if (!l) return [];
  return [
    { label: t("specDeal"), value: dealLabel(l.dealType) || t("notSpecified") }, { label: t("specType"), value: ptLabel(l.propertyType) }, { label: t("specListedBy"), value: l.byAgency ? t("agAgency") : t("agOwner") }, { label: t("specSource"), value: sourceLabel(l.source) },
    { label: t("specRooms"), value: numOr(l.rooms) }, { label: t("specBedrooms"), value: numOr(l.bedrooms) }, { label: t("specBathrooms"), value: numOr(l.bathrooms) }, { label: t("specArea"), value: l.areaSqm != null ? `${l.areaSqm} ${t("sqm")}` : t("notSpecified") }, { label: t("specFloor"), value: floorLabel(l) }, { label: t("specYear"), value: numOr(l.buildingYear) }, { label: t("specNewBuilding"), value: fmtBool(l.newBuilding) }, { label: t("specCondition"), value: conditionLabel(l.condition) }, { label: t("specComplex"), value: strOr(l.residenceComplex) }, { label: t("specCity"), value: strOr(locName(l.city, "city")) }, { label: t("specDistrict"), value: strOr(locName(l.district, "district")) }, { label: t("specKvartal"), value: strOr(l.area || l.kvartal) }, { label: t("specMetro"), value: strOr(metroLabelWithAlias(l.metro, locale.value)) }, { label: t("specAddress"), value: strOr(l.address) },
    { label: t("specParking"), value: fmtBool(l.parking) }, { label: t("specElevator"), value: fmtBool(l.elevator) }, { label: t("specFurnished"), value: fmtBool(l.furnished) }, { label: t("specBalcony"), value: fmtBool(l.balcony) }, { label: t("specAC"), value: fmtBool(l.airConditioner) }, { label: t("specGas"), value: fmtBool(l.gas) }, { label: t("specHeating"), value: fmtBool(l.heating) }, { label: t("specHotWater"), value: fmtBool(l.hotWater) }, { label: t("specInternet"), value: fmtBool(l.internet) }, { label: t("specPets"), value: fmtBool(l.petsAllowed) }, { label: t("specChildren"), value: fmtBool(l.childrenAllowed) }, { label: t("specSmoking"), value: fmtBool(l.smokingAllowed) }, { label: t("specAudience"), value: audienceLabel(l.audience) }, { label: t("specRoomShare"), value: fmtBool(l.roomOnly) }, { label: t("specNegotiable"), value: fmtBool(l.negotiable) }, { label: t("specDeposit"), value: depositLabel(l) }, { label: t("specCommission"), value: commissionLabel(l) }, { label: t("specCommunal"), value: communalLabel(l) }, { label: t("specUtilAmount"), value: l.utilitiesAmount != null ? `${l.utilitiesAmount.toLocaleString()} ${l.currency}` : t("notSpecified") }, { label: t("specMinLease"), value: strOr(l.minLeaseTerm) }, { label: t("specAvailable"), value: strOr(l.availableFrom) }, { label: t("specShops"), value: listOr(l.nearbyShops) }, { label: t("specNearby"), value: nearbyListOr(l.nearby) }, { label: t("specAmenities"), value: amenitiesListOr(l.amenities) },
  ];
});
const shareCopied = ref(false);
function makeListingShareLink(l: Listing): string { const resolved = router.resolve({ path: route.path, query: { flat: l.id, flatSource: l.source, flatCountry: l.country } }); return new URL(resolved.href, window.location.origin).toString(); }
function showShareSuccess() { shareCopied.value = true; window.setTimeout(() => { shareCopied.value = false; }, 2000); }
async function shareFlat(l: Listing) {
  const link = makeListingShareLink(l); listingShareUrl.value = link; listingShareCopied.value = false; const title = displayListingTitle(l); const payload = { title, text: title, url: link };
  if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) { try { await navigator.share(payload); showShareSuccess(); return; } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; } }
  listingShareCopied.value = await copyText(link); if (listingShareCopied.value) showShareSuccess(); else listingShareModalOpen.value = true;
}
async function copyListingShareLink() { listingShareCopied.value = await copyText(listingShareUrl.value); if (listingShareCopied.value) showShareSuccess(); }
async function openSharedListing(id: string, sourceName = "", countryCode = "", attempt = 0) {
  const local = listings.value.find((listing) => listing.id === id); if (local) { await openListing(local); return; }
  const params: Record<string, string> = { listingId: id, limit: "1", offset: "0" }; if (SOURCES.includes(sourceName)) params.sources = sourceName; if (/^[A-Za-z]{2}$/.test(countryCode)) params.countries = countryCode.toUpperCase();
  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params }); const exact = data?.listings?.find((listing) => listing.id === id); if (exact) { await openListing(exact, sourceName === "olx" && exact.source === "olx"); return; }
  if (!error && sourceName === "olx" && data?.exactListingFallback === "source-inactive") {
    removeUnavailableListing(id, sourceName, countryCode);
    showListingUnavailableToast();
    if (queryString(route.query.flat) === id) syncListingInUrl(null);
    return;
  }
  if (data?.warming && attempt < 20) { if (sharedListingTimer) clearTimeout(sharedListingTimer); sharedListingTimer = setTimeout(() => { sharedListingTimer = undefined; void openSharedListing(id, sourceName, countryCode, attempt + 1); }, 1800); }
}
function timeAgo(iso: string | null): string { if (!iso) return ""; const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); if (Number.isNaN(days)) return ""; if (days <= 0) return t("today"); if (days === 1) return t("yesterday"); if (days < 30) return t("daysAgo", { n: days }); return t("monthsAgo", { n: Math.floor(days / 30) }); }
function setupInfinitePagination() {
  infiniteObserver?.disconnect();
  infiniteObserver = new IntersectionObserver((entries) => { const reachedBottom = entries.some((entry) => entry.isIntersecting); if (!reachedBottom || !hasMore.value || loading.value || loadingMore.value) return; const currentScrollY = window.scrollY; if (currentScrollY <= lastPaginationScrollY + 40) return; lastPaginationScrollY = currentScrollY; void load(true, false); }, { rootMargin: "0px", threshold: 0.01 });
  if (loadMoreSentinel.value) infiniteObserver.observe(loadMoreSentinel.value);
}

onMounted(async () => {
  window.addEventListener("keydown", onLightboxKeydown); window.addEventListener("scroll", updateBackToTop, { passive: true }); updateBackToTop();
  const sharedFlatId = queryString(route.query.flat); const sharedFlatSource = queryString(route.query.flatSource); const sharedFlatCountry = queryString(route.query.flatCountry);
  defaultCountry.value = regionalDefaultCountry();
  if (!queryString(route.query.countries)) countries.value = [defaultCountry.value];
  loadPersonalState(); applyQueryParams(route.query); void loadRates(); await loadMeta(); await nextTick(); restoring.value = false;
  if (queryString(route.query.shared) === "1") { showAdvanced.value = true; sharedLinkOpened.value = true; shareModalOpen.value = true; }
  await load(false); if (sharedFlatId) await openSharedListing(sharedFlatId, sharedFlatSource, sharedFlatCountry); await nextTick(); lastPaginationScrollY = window.scrollY; setupInfinitePagination();
});
watch(loadMoreSentinel, (current, previous) => { if (previous) infiniteObserver?.unobserve(previous); if (current) infiniteObserver?.observe(current); });
watch(modalOpen, (open) => { if (open) return; syncListingInUrl(null); closeLightbox(); stopTranslationPoll(); translationRequestId += 1; translatingDescription.value = false; nextTick(() => setTimeout(releaseStuckScrollLock, 350)); });
watch(lightboxIndex, (index) => { if (index === null) nextTick(() => setTimeout(releaseStuckScrollLock, 350)); });
// A link that names a listing should open it, whether the page is mounting for
// the first time or the query changed underneath one that is already up. The
// mount-time read covers only the first case; this covers both, and cannot
// loop, because opening a listing sets modalOpen before it writes the query.
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
onBeforeUnmount(() => { modalOpen.value = false; lightboxIndex.value = null; releaseStuckScrollLock(); window.removeEventListener("keydown", onLightboxKeydown); window.removeEventListener("scroll", updateBackToTop); if (loadTimer) clearTimeout(loadTimer); if (warmTimer) clearTimeout(warmTimer); if (sharedListingTimer) clearTimeout(sharedListingTimer); infiniteObserver?.disconnect(); stopTranslationPoll(); });
</script>

<template>
  <u-container class="flats">
    <ocean-page-backdrop variant="home" />
    <div class="flats__header text-center space-y-3">
      <h1 class="flats__title">{{ t("title") }}</h1>
      <p class="flats__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
    </div>

    <UiResultsLoader :loading="loading" :label="t('searching')" min-height="420px">
    <form ref="filtersEl" class="flats__controls flats__controls_redesign" @submit.prevent="load()">
      <div class="flats__searchbar">
        <u-input v-model="query" clearable icon="i-lucide-search" :label="t('search')" :placeholder="t('searchPlaceholder')" @clear="clearSearch" />
        <u-button type="submit" icon="i-lucide-search">{{ t("search") }}</u-button>
      </div>

      <div class="flats__row flats__secondary-nav">
        <div class="flats__filters">
          <button v-for="opt in sourceOptions" :key="opt.value" type="button" class="flats__pill" :class="{ 'flats__pill_active': source === opt.value }" @click="selectSource(opt.value)">{{ opt.label }}</button>
        </div>
        <UiSearchViewTabs
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
          <div class="flats__field"><u-select-menu :label="t('dealType')" v-model="dealTypeSel" :items="dealTypeItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
          <div class="flats__field"><u-select-menu :label="t('agency')" v-model="agencySel" :items="agencyItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
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
          <u-button type="button" variant="outline" color="neutral" icon="i-lucide-sliders-horizontal" :trailing-icon="showAdvanced ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" :aria-expanded="showAdvanced" class="advanced-button" @click="toggleAdvanced">{{ showAdvanced ? t("hideFilters") : t("moreFilters") }}</u-button>
          <div class="active-filter-chips">
            <button v-if="district" type="button" class="filter-chip" @click="district = ''; scheduleLoad()">{{ t("district") }}: {{ locName(district, 'district') }} <span>×</span></button>
            <button v-if="roomsMin != null" type="button" class="filter-chip" @click="roomsMin = undefined; scheduleLoad()">{{ roomsMin }}+ {{ t('roomsChip') }} <span>×</span></button>
            <button v-if="petFriendly" type="button" class="filter-chip" @click="petFriendly = false; scheduleLoad()"><u-icon name="i-lucide-paw-print" /> {{ t('pets') }} <span>×</span></button>
          </div>
        </UiFilterFooter>
      </section>

      <section v-if="showAdvanced" class="advanced-card">
        <div class="advanced-card__header"><div><u-icon name="i-lucide-filter" /><strong>{{ t("moreFilters") }}</strong></div><button type="button" @click="toggleAdvanced">{{ t("hideFilters") }} <u-icon name="i-lucide-chevron-up" /></button></div>
        <div class="advanced-groups">
          <div class="filter-group filter-group_quick"><h3><u-icon name="i-lucide-sliders-horizontal" /> {{ t('quickOptions') }}</h3><div class="quick-options">
            <u-button type="button" :variant="petFriendly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-paw-print" @click="petFriendly = !petFriendly; scheduleLoad()">{{ t('pets') }}</u-button>
            <u-button type="button" :variant="childrenRequired ? 'solid' : 'outline'" color="neutral" icon="i-lucide-baby" @click="childrenRequired = !childrenRequired; scheduleLoad()">{{ t('children') }}</u-button>
            <u-button type="button" :variant="roomOnlyFilter ? 'solid' : 'outline'" color="neutral" icon="i-lucide-bed-single" @click="roomOnlyFilter = !roomOnlyFilter; scheduleLoad()">{{ t('roomOnly') }}</u-button>
            <u-button type="button" :variant="newBuildingOnly ? 'solid' : 'outline'" color="neutral" icon="i-lucide-building-2" @click="newBuildingOnly = !newBuildingOnly; scheduleLoad()">{{ t('newBuilding') }}</u-button>
          </div></div>
          <div class="filter-group"><h3><u-icon name="i-lucide-map-pin" /> {{ t('groupLocation') }}</h3>
            <div v-if="districtOptions.length" class="flats__field"><u-select-menu :label="t('district')" v-model="districtSel" :items="districtItems" value-key="value" label-key="label" class="flats__select" @update:model-value="scheduleLoad()" /></div>
            <div v-if="metroOptions.length" class="flats__field"><u-select-menu :label="t('metro')" v-model="metroSel" :items="metroItems" value-key="value" label-key="label" class="flats__select" @update:model-value="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('metroWithin') }}</span><u-input v-model.number="metroMaxM" :label="t('metres')" type="number" inputmode="numeric" min="0" step="100" @change="scheduleLoad()" /></div>
            <div class="flats__field"><u-select-menu :label="t('nearbyKind')" v-model="nearbyKindSel" :items="nearbyKindItems" value-key="value" label-key="label" class="flats__select" @update:model-value="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('nearbyWithin') }}</span><u-input v-model.number="nearbyMaxM" :label="t('metres')" type="number" inputmode="numeric" min="0" step="100" @change="scheduleLoad()" /></div>
          </div>
          <div class="filter-group"><h3><u-icon name="i-lucide-house" /> {{ t('groupApartment') }}</h3>
            <div class="range-field"><span>{{ t('rangeRooms') }}</span><u-input v-model.number="roomsMin" :label="t('rangeFrom')" type="number" min="0" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="roomsMax" :label="t('rangeTo')" type="number" min="0" @change="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('rangeBedrooms') }}</span><u-input v-model.number="bedroomsMin" :label="t('rangeFrom')" type="number" min="0" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="bedroomsMax" :label="t('rangeTo')" type="number" min="0" @change="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('rangeArea') }}</span><u-input v-model.number="areaMin" :label="t('rangeFrom')" type="number" min="0" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="areaMax" :label="t('rangeTo')" type="number" min="0" @change="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('rangePricePerSqm') }}</span><u-input v-model.number="pricePerSqmMin" :label="t('rangeFrom')" type="number" inputmode="numeric" min="0" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="pricePerSqmMax" :label="t('rangeTo')" type="number" inputmode="numeric" min="0" @change="scheduleLoad()" /></div>
          </div>
          <div class="filter-group"><h3><u-icon name="i-lucide-building-2" /> {{ t('groupBuilding') }}</h3>
            <div class="range-field"><span>{{ t('rangeFloor') }}</span><u-input v-model.number="floorMin" :label="t('rangeFrom')" type="number" min="0" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="floorMax" :label="t('rangeTo')" type="number" min="0" @change="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('rangeTotalFloors') }}</span><u-input v-model.number="totalFloorsMin" :label="t('rangeFrom')" type="number" min="1" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="totalFloorsMax" :label="t('rangeTo')" type="number" min="1" @change="scheduleLoad()" /></div>
            <div class="range-field"><span>{{ t('rangeYear') }}</span><u-input v-model.number="yearMin" :label="t('rangeFrom')" type="number" min="1800" :max="new Date().getFullYear() + 2" @change="scheduleLoad()" /><span>—</span><u-input v-model.number="yearMax" :label="t('rangeTo')" type="number" min="1800" :max="new Date().getFullYear() + 2" @change="scheduleLoad()" /></div>
          </div>
          <div class="filter-group"><h3><u-icon name="i-lucide-megaphone" /> {{ t('groupListing') }}</h3>
            <div class="flats__field"><u-select-menu :label="t('audience')" v-model="audienceSel" :items="audienceItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
            <div class="flats__field"><u-select-menu :label="t('propertyType')" v-model="propertyTypeSel" :items="propertyTypeItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" /></div>
            <div class="flats__field"><u-input v-model.number="maxAgeDays" type="number" min="1" max="21" :label="t('freshDays')" @change="scheduleLoad()" /></div>
          </div>
        </div>
      </section>
      </div>
    </form>

    <p v-if="failed" class="flats__error">{{ t("error") }}</p>
    <p v-else-if="source === 'telegram' && !loading && !listings.length && sourceErrors?.some((item) => item.source === 'telegram')" class="flats__source-warning">{{ t("telegramUnavailable") }}</p>
    <div v-else class="flats__results-toolbar">
      <p class="flats__count text-muted">{{ t("found", { n: view === 'active' ? total : displayedListings.length }) }}</p>
      <label class="flats__sort"><span class="flats__field-label">{{ extraLabels.sort }}</span><u-select-menu v-model="sort" :items="sortItems" value-key="value" label-key="label" :search-input="false" class="flats__select" @update:model-value="scheduleLoad(0)" /></label>
    </div>
<section v-if="listings.length" class="flats__map-wrap"><flat-map :points="mapPoints" :draw-label="t('drawArea')" :done-label="t('done')" :clear-label="t('clearArea')" :draw-hint="t('drawHint')" :expand-label="t('mapExpand')" :collapse-label="t('mapCollapse')" @select="openById" @area-change="drawnArea = $event" /></section>

    <div class="flats__grid">
      <article v-for="l in displayedListings" :key="listingKey(l)" class="flat-card" :class="{ 'flat-card_favorite': isFavorite(l.id), 'flat-card_hidden': isHidden(l.id), 'flat-card_checking': checkingListingKey === listingKey(l) }" :aria-busy="checkingListingKey === listingKey(l)" @click="openListing(l)">
        <div class="flat-card__photo">
          <img v-if="listingPhoto(l)" :src="listingPhoto(l) || ''" :alt="displayListingTitle(l)" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="markPhotoFailedFromEvent" />
          <div v-else class="flat-card__no-photo"><u-icon name="i-lucide-image-off" class="flat-card__no-photo-icon" aria-hidden="true" /><span>{{ t("noPhoto") }}</span></div>
          <span v-if="cardDealLabel(l)" class="flat-card__deal" :class="`flat-card__deal_${cardDealTone(l)}`">{{ cardDealLabel(l) }}</span>
          <div class="flat-card__actions">
            <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': isFavorite(l.id) }" :aria-label="isFavorite(l.id) ? t('removeFavorite') : t('addFavorite')" @click.stop="toggleFavorite(l)"><u-icon name="i-lucide-heart" /></button>
            <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': isHidden(l.id) }" :aria-label="isHidden(l.id) ? t('restoreListing') : t('hideListing')" @click.stop="toggleHidden(l)"><u-icon :name="isHidden(l.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" /></button>
          </div>
        </div>
        <div class="flat-card__body">
          <div class="flat-card__price">{{ priceLabel(l) }}</div>
          <div v-if="convertedLabel(l)" class="flat-card__price-conv text-muted">{{ convertedLabel(l) }}</div>
          <h3 class="flat-card__title">{{ displayListingTitle(l) }}</h3>
          <div v-if="specLine(l)" class="flat-card__spec text-muted">{{ specLine(l) }}</div>
          <div v-if="cardBadges(l).length" class="flat-card__badges"><span v-for="b in cardBadges(l)" :key="b" class="flat-card__badge">{{ b }}</span></div>
          <div class="flat-card__meta text-muted">
            <span v-if="locLine(l)" class="flat-card__location"><u-icon name="i-lucide-map-pin" />{{ locLine(l) }}</span>
            <span class="flat-card__meta-tail"><span class="flat-card__src">{{ l.source }}</span><span v-if="timeAgo(l.createdAt)">· {{ timeAgo(l.createdAt) }}</span></span>
          </div>
        </div>
        <div v-if="checkingListingKey === listingKey(l)" class="flat-card__checking" role="status" aria-live="polite"><u-icon name="i-lucide-loader-circle" class="flat-card__checking-icon" /><span>{{ t("checkingListing") }}</span></div>
      </article>
    </div>
<div ref="loadMoreSentinel" v-if="hasMore" class="flats__sentinel"><span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span></div>
    <div v-if="!loading && !displayedListings.length && !failed" class="flats__empty"><div class="text-muted">{{ t("empty") }}</div><div v-if="drawnArea.length >= 3 && listings.length" class="text-muted">{{ t("emptyArea") }}</div></div>

    </UiResultsLoader>

    <u-modal v-model:open="modalOpen" :title="modalTitle(active)" :ui="{ content: 'max-w-4xl' }" :dismissible="lightboxIndex === null">
      <template #title><h2 class="flat-modal__title">{{ modalTitle(active) }}</h2></template>
      <template #body><div v-if="active" class="flat-modal"><div v-if="visiblePhotos(active).length" class="flat-modal__gallery"><img v-for="(p, i) in visiblePhotos(active)" :key="p" :src="p" :alt="`${modalTitle(active)} (${i + 1})`" class="flat-modal__thumb" loading="lazy" decoding="async" referrerpolicy="no-referrer" @error="markPhotoFailedFromEvent" @click="openLightbox(i)" /></div><div class="flat-modal__price">{{ priceLabel(active) }}<span v-if="convertedLabel(active)" class="flat-modal__price-conv"> ({{ convertedLabel(active) }})</span><span v-if="dealLabel(active.dealType)" class="flat-modal__deal"> · {{ dealLabel(active.dealType) }}</span><span v-if="active.roomOnly" class="flat-modal__deal"> · {{ t("roomShare") }}</span></div><UiSpecTable :rows="specRows" :hide-empty-label="t('hideEmpty')" :empty-value="t('notSpecified')" /><div v-if="active.description && descriptionNeedsTranslation" class="flat-modal__translation"><u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-languages" :loading="translatingDescription" @click="translateActiveDescription">{{ translatingDescription ? t("translatingDescription") : t("translateDescription") }}</u-button><span v-if="translationFailed" class="flat-modal__translation-error">{{ t("translationFailed") }}</span></div><section v-if="translatedDescription" class="flat-modal__translated"><h4 class="flat-modal__translated-title">{{ t("translatedDescription") }}</h4><p class="flat-modal__desc">{{ translatedDescription }}</p></section><details v-if="active.description" class="flat-modal__descbox"><summary>{{ t("origDescription") }}</summary><p class="flat-modal__desc">{{ active.description }}</p></details><div v-if="active.tags && active.tags.length" class="flat-modal__tags"><span v-for="tag in active.tags" :key="tag" class="flat-modal__tag">{{ nearbyItemLabel(tag) }}</span></div></div></template>
      <template #footer><UiModalFooter v-if="active"><u-button variant="outline" color="neutral" icon="i-lucide-heart" @click="toggleFavorite(active)">{{ isFavorite(active.id) ? t("removeFavorite") : t("addFavorite") }}</u-button><u-button variant="outline" color="neutral" :icon="isHidden(active.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" @click="toggleHidden(active)">{{ isHidden(active.id) ? t("restoreListing") : t("hideListing") }}</u-button><u-button variant="outline" color="neutral" :icon="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'" @click="shareFlat(active)">{{ shareCopied ? t("shareCopied") : t("share") }}</u-button><a class="modal-footer__primary" :href="active.url" target="_blank" rel="noopener noreferrer">{{ t("open") }} →</a></UiModalFooter></template>
    </u-modal>

    <teleport to="body"><div v-if="lightboxPhoto" class="flat-lightbox" role="dialog" aria-modal="true" :aria-label="t('photoViewer')" @click="closeLightbox"><div class="flat-lightbox__stage" @click.stop @pointerdown="onLightboxPointerDown" @pointerup="onLightboxPointerUp" @pointercancel="onLightboxPointerCancel"><img :src="lightboxPhoto" :alt="`${modalTitle(active)} (${lightboxPosition}/${lightboxPhotos.length})`" referrerpolicy="no-referrer" draggable="false" @error="lightboxPhotoFailed" @mousemove="updateLightboxZoom" @mouseleave="resetLightboxZoom" /></div><button v-if="lightboxPhotos.length > 1" type="button" class="flat-lightbox__nav flat-lightbox__nav_left" :aria-label="t('previousPhoto')" @click.stop="moveLightbox(-1)"><u-icon name="i-lucide-chevron-left" /></button><button v-if="lightboxPhotos.length > 1" type="button" class="flat-lightbox__nav flat-lightbox__nav_right" :aria-label="t('nextPhoto')" @click.stop="moveLightbox(1)"><u-icon name="i-lucide-chevron-right" /></button><span v-if="lightboxPhotos.length > 1" class="flat-lightbox__counter">{{ lightboxPosition }} / {{ lightboxPhotos.length }}</span><button type="button" class="flat-lightbox__close" :aria-label="t('closePhoto')" @click.stop="closeLightbox"><u-icon name="i-lucide-x" /></button></div></teleport>

    <u-modal v-model:open="presetModalOpen" :title="t('savePreset')"><template #body><u-input v-model="presetName" autofocus :label="t('presetName')" @keyup.enter="savePreset" /></template><template #footer><u-button color="neutral" variant="ghost" @click="presetModalOpen = false">{{ t("cancel") }}</u-button><u-button @click="savePreset">{{ t("save") }}</u-button></template></u-modal>
    <u-modal v-model:open="shareModalOpen" :title="sharedLinkOpened ? t('sharedSearchApplied') : t('shareSearch')"><template #body><p class="flat-share__hint">{{ sharedLinkOpened ? t("sharedSearchHint") : t("shareSearchHint") }}</p><u-input :model-value="shareUrl" readonly /></template><template #footer><u-button icon="i-lucide-copy" @click="copyShareLink">{{ t("copyLink") }}</u-button></template></u-modal>
    <button v-if="showBackToTop" type="button" class="flats__back-top" :aria-label="t('backToTop')" @click="scrollToFilters"><u-icon name="i-lucide-arrow-up" /><span>{{ t('backToTop') }}</span></button>
    <u-modal v-model:open="listingShareModalOpen" :title="t('shareListing')"><template #body><p class="flat-share__hint">{{ t("shareListingHint") }}</p><u-input :model-value="listingShareUrl" readonly /></template><template #footer><u-button :icon="listingShareCopied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyListingShareLink">{{ listingShareCopied ? t("shareCopied") : t("copyLink") }}</u-button></template></u-modal>
  </u-container>
</template>

<style scoped>
.flats { position: relative; isolation: isolate; padding-top: 24px; padding-bottom: 96px; }
.flats__header { position: relative; z-index: 1; }
.flats__title { font-size: 32px; font-weight: 600; }
.flats__subtitle { max-width: 720px; font-size: 14px; }
.flats__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: start; }
.flats__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.flats__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.flats__pill { height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px; text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease; }
.flats__pill:hover { color: var(--text-white); }
.flats__pill_active { color: var(--text-white); border-color: rgba(224,103,154,0.4); background: rgba(224,103,154,0.18); }
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
.flats__sort { display: flex; align-items: center; gap: 8px; width: min(310px, 100%); }
.flats__sort > .flats__field-label { flex: 0 0 auto; }
.flats__sort .flats__select { flex: 1 1 auto; }
.flats__map-wrap { position: relative; z-index: 0; isolation: isolate; margin-bottom: 18px; scroll-margin-top: 90px; }
.flats__grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: start; }
@media (min-width: 640px) { .flats__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1024px) { .flats__grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (min-width: 1440px) { .flats__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.flat-card { position: relative; min-width: 0; height: 100%; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg-panel); cursor: pointer; transition: transform 140ms ease, border-color 180ms ease, box-shadow 180ms ease; display: flex; flex-direction: column; }
.flat-card:hover { transform: translateY(-2px); border-color: rgba(224,103,154,0.4); box-shadow: 0 12px 30px rgba(0,0,0,.16); }
.flat-card_checking { pointer-events: none; }
.flat-card__checking { position: absolute; z-index: 5; inset: 0; display: grid; place-content: center; justify-items: center; gap: 9px; padding: 18px; background: rgba(7,12,34,.92); color: var(--text-primary); font-size: 12.5px; font-weight: 700; text-align: center; }
.flat-card__checking-icon { width: 26px; height: 26px; color: var(--accent-pink); animation: flat-card-spin .8s linear infinite; }
@keyframes flat-card-spin { to { transform: rotate(360deg); } }
.flat-card__photo { position: relative; width: 100%; aspect-ratio: 4 / 3; flex: 0 0 auto; overflow: hidden; background: var(--bg-panel); }
.flat-card__photo::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(8,11,26,.16) 0%, transparent 28%, transparent 76%, rgba(8,11,26,.18) 100%); }
.flat-card__photo > img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 260ms ease; }
.flat-card:hover .flat-card__photo > img { transform: scale(1.015); }
.flat-card__no-photo { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; height: 100%; color: var(--text-muted); font-size: 12px; background: var(--bg-panel-2); }
.flat-card__no-photo-icon { width: 34px; height: 34px; opacity: 0.48; }
.flat-card__deal { position: absolute; z-index: 2; top: 9px; left: 9px; max-width: calc(100% - 92px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 700; line-height: 1; padding: 6px 9px; border: 1px solid rgba(224,103,154,.42); border-radius: 7px; background: #0d1128; color: var(--accent-pink); box-shadow: 0 3px 12px rgba(0,0,0,.2); }
.flat-card__deal_sale { color: #f58ab5; border-color: rgba(245,138,181,.45); }
.flat-card__deal_rent { color: #b79cff; border-color: rgba(183,156,255,.42); }
.flat-card__deal_room { color: #77d9e8; border-color: rgba(119,217,232,.42); }
.flat-card__deal_short { color: #f4c86a; border-color: rgba(244,200,106,.45); }
.flat-card__actions { position: absolute; z-index: 3; top: 8px; right: 8px; display: flex; gap: 5px; }
.flat-card__action { width: 32px; height: 32px; display: inline-grid; place-items: center; padding: 0; border: 1px solid rgba(66,73,116,.86); border-radius: 7px; background: #0d1128; color: #c8cbdb; cursor: pointer; box-shadow: 0 3px 12px rgba(0,0,0,.18); transition: color 150ms ease, border-color 150ms ease, background-color 150ms ease; }
.flat-card__action :deep(svg) { display: block; margin: auto; }
.flat-card__action:hover, .flat-card__action_active { color: var(--accent-pink); border-color: rgba(224,103,154,.58); background: rgba(26,29,57,.94); }
.flat-card__body { min-height: 0; flex: 1 1 auto; padding: 13px 14px 14px; display: flex; flex-direction: column; gap: 5px; }
.flat-card__price { font-weight: 750; font-size: 18px; line-height: 1.2; color: var(--text-white, inherit); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.flat-card__price-conv { font-size: 12px; font-weight: 500; line-height: 1.35; }
.flat-card__title { margin-top: 2px; font-size: 14.5px; font-weight: 650; line-height: 1.38; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.flat-card__spec { font-size: 12.5px; line-height: 1.4; }
.flat-card__badges { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 5px; margin-top: 5px; max-height: 78px; overflow: hidden; }
.flat-card__badge { max-width: 100%; font-size: 10.5px; font-weight: 600; line-height: 1.15; padding: 4px 7px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,0.05); color: var(--text-primary); white-space: normal; overflow-wrap: anywhere; }
.flat-card__meta { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 6px 10px; margin-top: auto; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.055); font-size: 11.5px; line-height: 1.35; }
.flat-card__location { min-width: 0; display: inline-flex; align-items: flex-start; gap: 5px; flex: 1 1 150px; }
.flat-card__location svg { flex: 0 0 auto; margin-top: 1px; }
.flat-card__meta-tail { display: inline-flex; gap: 5px; white-space: nowrap; margin-left: auto; }
.flat-card__src { text-transform: capitalize; opacity: 0.72; }
.flats__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-panel); }
.flats__sentinel { min-height: 44px; display: grid; place-items: center; }
.flat-card_favorite { border-color: rgba(224,103,154,0.52); }
.flat-card_hidden { opacity: 0.64; border-style: dashed; }
.flat-modal { display: flex; flex-direction: column; gap: 12px; }
.flat-modal__title { display: -webkit-box; overflow: hidden; margin: 0; padding-right: 36px; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; font-size: 18px; font-weight: 700; line-height: 1.35; }
.flat-modal__gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; max-height: 46vh; overflow-y: auto; }
.flat-modal__thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; cursor: zoom-in; border: 1px solid var(--line); transition: border-color 140ms ease; }
.flat-modal__thumb:hover { border-color: var(--accent-pink); }
.flat-lightbox { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center; isolation: isolate; background: #080b1a; padding: clamp(12px, 2vw, 28px); cursor: zoom-out; pointer-events: auto; }
.flat-lightbox__stage { width: min(82vw, 1200px); height: min(76dvh, 720px); display: flex; align-items: center; justify-content: center; cursor: default; pointer-events: auto; touch-action: pan-y pinch-zoom; user-select: none; -webkit-user-select: none; }
.flat-lightbox__stage img { -webkit-user-drag: none; display: block; width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; transform-origin: var(--zoom-x, 50%) var(--zoom-y, 50%); transition: transform 180ms ease; }
@media (hover: hover) and (pointer: fine) { .flat-lightbox__stage img { cursor: zoom-in; } .flat-lightbox__stage img:hover { transform: scale(1.7); cursor: zoom-out; } }
.flat-lightbox__nav, .flat-lightbox__close { position: fixed; z-index: 1; display: grid; place-items: center; border: 1px solid #343a62; border-radius: 8px; background: #131730; color: #fff; cursor: pointer; pointer-events: auto; }
.flat-lightbox__nav { top: 50%; width: 52px; height: 72px; transform: translateY(-50%); font-size: 28px; }
.flat-lightbox__nav:hover, .flat-lightbox__nav:focus-visible, .flat-lightbox__close:hover, .flat-lightbox__close:focus-visible { border-color: var(--accent-pink); color: var(--accent-pink); }
.flat-lightbox__nav_left { left: 16px; } .flat-lightbox__nav_right { right: 16px; } .flat-lightbox__close { top: 16px; right: 20px; width: 44px; height: 44px; font-size: 24px; }
.flat-lightbox__counter { position: fixed; bottom: 18px; left: 50%; z-index: 1; transform: translateX(-50%); padding: 6px 10px; border: 1px solid #343a62; border-radius: 6px; background: #131730; color: var(--text-primary); font: 500 12px/1.2 "JetBrains Mono", monospace; pointer-events: auto; }
.flat-modal__price { font-weight: 700; font-size: 20px; } .flat-modal__price-conv { font-weight: 500; font-size: 14px; color: var(--text-muted); } .flat-modal__deal { color: #e0679a; font-weight: 500; }
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
.flat-share__hint { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }

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
.filter-card, .advanced-card {
  position: relative;
  z-index: 1;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.filter-card { padding: 16px; }
.filter-primary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
/* Scoped to the value span (not every span, which included the chevron) and
   kept on one line. This rule sits after the one above and previously won with
   `white-space: normal`, which is what still let a multi-country value wrap. */
.filter-primary-grid :deep(button > span:first-child), .advanced-groups :deep(button > span:first-child) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25; text-align: left; }
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
.advanced-button { flex: 0 0 auto; }
.active-filter-chips { display: flex; flex: 1 1 300px; gap: 8px; flex-wrap: wrap; min-width: 0; }
.filter-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; min-height: 34px; padding: 6px 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--bg-panel-2); color: var(--text-primary); white-space: normal; text-align: left; line-height: 1.25; }
.filter-chip span { color: var(--ui-text-muted); flex: 0 0 auto; }
.advanced-card { margin-top: 0; overflow: hidden; border-top: 1px solid var(--line); }
.advanced-card__header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.advanced-card__header > div, .advanced-card__header button { display: inline-flex; align-items: center; gap: 8px; }
.advanced-card__header button { color: var(--accent-pink); }
.advanced-groups { display: grid; grid-template-columns: 1.15fr .95fr 1.1fr 1.1fr 1fr; padding: 16px; }
.filter-group { min-width: 0; padding: 0 16px; border-left: 1px solid var(--line); }
.filter-group:first-child { padding-left: 0; border-left: 0; }
.filter-group:last-child { padding-right: 0; }
.filter-group h3 { display: flex; align-items: center; gap: 7px; margin: 0 0 14px; color: var(--ui-text-muted); font-size: 11px; line-height: 1.3; text-transform: uppercase; letter-spacing: .04em; }
.filter-group h3 svg { color: var(--accent-pink); flex: 0 0 auto; }
/* One vertical rhythm for every stacked filter, whatever kind it is, so the
   Location / Flat / House / Listing columns keep the same row spacing. */
.filter-group .flats__field + .flats__field,
.filter-group .flats__field + .range-field,
.filter-group .range-field + .flats__field,
.range-field + .range-field { margin-top: 12px; }
.quick-options { display: grid; gap: 8px; }
.quick-options :deep(button) { width: 100%; min-height: var(--ui-control-h-md); justify-content: flex-start; height: auto; padding-block: 8px; white-space: normal; text-align: left; line-height: 1.25; }
/* Every range row is the same height regardless of how many lines its label
   needs: "Год постройки от" wrapped to three lines while "Этаж от" stayed on
   one, so the Flat and House columns no longer lined up with each other. A
   fixed row height plus a balanced label column keeps the two columns in step. */
/* Range rows follow the same shape as every other filter: label ABOVE the
   control, in the shared uppercase label style. They used to put the label
   inline to the left, which both looked unlike the rest of the panel and made
   the Flat and House columns drift apart whenever one label wrapped to more
   lines than its neighbour. The label spans the full width, so the two inputs
   and their separator flow onto the next row automatically. */
/* No muted colour on the container: the label sets `opacity: .7` like every
   other filter label, and inheriting a muted colour on top of that made these
   labels visibly dimmer than "РАЙОН" and friends. The separator keeps it. */
.range-field { display: grid; grid-template-columns: minmax(0,1fr) 10px minmax(0,1fr); align-items: center; column-gap: 8px; row-gap: 5px; font-size: 11px; }
.range-field > span:first-child {
  grid-column: 1 / -1;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  opacity: 0.7; line-height: 1.25; overflow-wrap: anywhere;
}
.range-field > span:not(:first-child) { color: var(--ui-text-muted); text-align: center; }
/* Left-aligned now that each field carries its own from/to floating label
   anchored to the left edge; a centred value belonged to neither of them. */
.range-field :deep(input) { text-align: left; }
.flats__controls_redesign :deep(input), .flats__controls_redesign :deep(button[role="combobox"]) { background-color: var(--bg-panel-2) !important; }

@media (max-width: 1100px) {
  .advanced-groups { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20px 0; }
  .filter-group, .filter-group:first-child { padding: 0 16px; border-left: 1px solid var(--line); }
  .filter-group:nth-child(odd) { border-left: 0; padding-left: 0; }
  .filter-group:nth-child(even) { padding-right: 0; }
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
  .advanced-button { flex: 1 1 100%; justify-content: center; }
  .active-filter-chips { flex: 1 1 100%; }
  .advanced-card__header { padding: 13px 12px; }
  .advanced-card__header strong { line-height: 1.25; }
  .advanced-groups { grid-template-columns: 1fr; padding: 14px 12px; gap: 0; }
  .filter-group, .filter-group:first-child, .filter-group:nth-child(odd), .filter-group:nth-child(even) { padding: 16px 0; border-left: 0; border-top: 1px solid var(--line); }
  .filter-group:first-child { padding-top: 0; border-top: 0; }
  .filter-group:last-child { padding-bottom: 0; }
  .range-field { grid-template-columns: minmax(0,1fr) 10px minmax(0,1fr); }
  .flats__results-toolbar { align-items: stretch; flex-direction: column; }
  .flats__sort { width: 100%; }
  .flat-card__photo { aspect-ratio: 16 / 10; }
  .flat-lightbox__stage { width: 92vw; height: 76vh; }
  .flat-lightbox__nav { width: 42px; height: 56px; font-size: 22px; }
  .flat-lightbox__nav_left { left: 8px; } .flat-lightbox__nav_right { right: 8px; } .flat-lightbox__close { top: 10px; right: 10px; }
  .flats__back-top span { display: none; }
  .flats__back-top { right: 14px; bottom: 18px; width: 44px; padding: 0; justify-content: center; }
}
@media (max-width: 390px) {
  .filter-price-row { column-gap: 3px; row-gap: 6px; }
  .price-input :deep(.price-number-input) { font-size: 11px; }
  .range-field { grid-template-columns: minmax(0,1fr) 8px minmax(0,1fr); }
}
</style>
