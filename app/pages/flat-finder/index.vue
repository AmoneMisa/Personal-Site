<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import FlatMap from "~/components/flats/FlatMap.client.vue";

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
  airConditioner?: boolean | null;
  gas?: boolean | null;
  newBuilding?: boolean | null;
  communalSeparated?: boolean | null;
  kvartal?: string | null;
  nearbyShops?: string[];
  nearby?: string[];
  residenceComplex?: string | null;
  petsAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  audience?: "women" | "men" | "family" | null;
  deposit?: boolean | null;
  depositAmount?: number | null;
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
  error?: string;
}
interface TranslationResult {
  status: "pending" | "completed" | "failed" | "disabled" | "not_found";
  key?: string;
  data?: { translatedText?: string; sourceLanguage?: string | null };
  confidence?: number;
}
interface CountryMeta { code: string; name: string; currency: string; cities?: string[]; locations?: Record<string, { districts?: string[]; metro?: string[] }> }
type FlatView = "active" | "favorites" | "recent" | "hidden";
type SearchPreset = { name: string; query: Record<string, string> };

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

useSeoMeta({
  title: () => t("seoTitle"),
  description: () => t("seoDescription"),
  robots: () => "index, follow",
  ogType: () => "website",
  ogTitle: () => t("seoTitle"),
  ogDescription: () => t("seoDescription"),
});

// ---- filters ----
const countries = ref<string[]>([]);
const city = ref("");
const district = ref("");
const propertyType = ref("any"); // any | flat | house
const dealType = ref("any"); // any | sale | longRent | shortRent
const agency = ref("any"); // any | owner | agency
const priceMin = ref<number | undefined>(undefined);
const priceMax = ref<number | undefined>(undefined);
const roomsMin = ref<number | undefined>(undefined);
const displayCurrency = ref("USD"); // currency for price display + the min/max filter
const rates = ref<Record<string, number>>({ USD: 1 }); // units per 1 USD, from /flats-rates
const query = ref("");
const source = ref(""); // "" = all
const showAdvanced = ref(true);

const listings = ref<Listing[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const warming = ref(false);
const failed = ref(false);
const sourceErrors = ref<FeedResult["sourceErrors"]>([]);
const failedPhotoUrls = ref<Set<string>>(new Set());
const view = ref<FlatView>("active");
const favorites = ref<Listing[]>([]);
const hidden = ref<Listing[]>([]);
const recent = ref<Listing[]>([]);
const presets = ref<SearchPreset[]>([]);
const presetName = ref("");
const presetModalOpen = ref(false);
const shareModalOpen = ref(false);
const sharedLinkOpened = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const drawnArea = ref<Array<{ lat: number; lng: number }>>([]);
let loadSeq = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let infiniteObserver: IntersectionObserver | undefined;

function photoCandidates(listing: Listing): string[] {
  return [...new Set([listing.photo, ...(listing.photos || [])].filter((value): value is string => !!value))];
}

function listingPhoto(listing: Listing): string | null {
  return photoCandidates(listing).find((url) => !failedPhotoUrls.value.has(url)) || null;
}

// All still-loadable photos (for the modal gallery); failed ones drop out reactively.
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

// ---- country/city metadata ----
const meta = ref<CountryMeta[]>([]);
const cityOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  return [...new Set(picked.flatMap((c) => c.cities ?? []))].sort();
});
// Districts for the chosen city (or all cities in the selected countries).
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

const SOURCES = ["olx", "telegram"];
const sourceOptions = computed(() => [{ value: "", label: t("all") }, ...SOURCES.map((s) => ({ value: s, label: s }))]);

// Reka UI can't take value="" — use a sentinel for the single-selects.
const ANY = "__any__";
type Item = { label: string; value: string };
function anyModel(model: { value: string }) {
  return computed<string>({
    get: () => model.value || ANY,
    set: (v) => { model.value = v === ANY ? "any" : v; },
  });
}
// propertyType/dealType/agency default to the string "any", not "" — wrap so the
// menu shows a non-empty value while we send "any" (or omit) to the API.
const propertyTypeSel = computed<string>({ get: () => propertyType.value, set: (v) => (propertyType.value = v) });
const dealTypeSel = computed<string>({ get: () => dealType.value, set: (v) => (dealType.value = v) });
const agencySel = computed<string>({ get: () => agency.value, set: (v) => (agency.value = v) });

const countryItems = computed<Item[]>(() => meta.value.map((c) => ({ value: c.code, label: c.name })));
const cityItems = computed<Item[]>(() => [{ label: t("cityAny"), value: ANY }, ...cityOptions.value.map((c) => ({ label: c, value: c }))]);
const citySel = computed<string>({ get: () => city.value || ANY, set: (v) => (city.value = v === ANY ? "" : v) });
const districtItems = computed<Item[]>(() => [{ label: t("districtAny"), value: ANY }, ...districtOptions.value.map((d) => ({ label: d, value: d }))]);
const CURRENCY_PRIORITY = ["USD", "EUR", "UZS", "KZT", "UAH", "RON", "GBP", "KGS", "TJS", "TMT", "PLN"];
const currencyItems = computed<Item[]>(() => {
  const keys = Object.keys(rates.value).filter((c) => /^[A-Z]{3}$/.test(c) && rates.value[c]! > 0);
  const preferred = CURRENCY_PRIORITY.filter((c) => keys.includes(c));
  const rest = keys.filter((c) => !CURRENCY_PRIORITY.includes(c)).sort();
  return [...preferred, ...rest].map((c) => ({ label: c, value: c }));
});
const districtSel = computed<string>({ get: () => district.value || ANY, set: (v) => (district.value = v === ANY ? "" : v) });
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

function readSavedList(key: string, limit = MAX_SAVED_FLATS): Listing[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function persistList(key: string, value: Listing[], limit = MAX_SAVED_FLATS) {
  localStorage.setItem(key, JSON.stringify(value.slice(0, limit)));
}

function loadPersonalState() {
  favorites.value = readSavedList(STORAGE.favorites);
  hidden.value = readSavedList(STORAGE.hidden);
  recent.value = readSavedList(STORAGE.recent, MAX_RECENT_FLATS);
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE.presets) || "[]");
    presets.value = Array.isArray(value) ? value : [];
  } catch {
    presets.value = [];
  }
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
    const intersects = ((yi > point.lat) !== (yj > point.lat))
      && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function applyDrawnArea(items: Listing[]) {
  if (drawnArea.value.length < 3) return items;
  // An area can only filter geocoded listings. If nothing in the set has
  // coordinates (e.g. geocoding not yet available), the polygon can't apply —
  // treat it as a no-op instead of silently hiding every result.
  if (!items.some((item) => item.lat != null && item.lng != null)) return items;
  return items.filter((item) => item.lat != null && item.lng != null
    && pointInPolygon({ lat: item.lat, lng: item.lng }, drawnArea.value));
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
  const queryParams: Record<string, string> = {};
  if (countries.value.length) queryParams.countries = countries.value.join(",");
  if (city.value) queryParams.city = city.value;
  if (propertyType.value !== "any") queryParams.propertyType = propertyType.value;
  if (dealType.value !== "any") queryParams.dealType = dealType.value;
  if (agency.value !== "any") queryParams.agency = agency.value;
  if (priceMin.value != null) queryParams.priceMin = String(priceMin.value);
  if (priceMax.value != null) queryParams.priceMax = String(priceMax.value);
  if (displayCurrency.value !== "USD") queryParams.currency = displayCurrency.value;
  if (roomsMin.value != null) queryParams.roomsMin = String(roomsMin.value);
  if (query.value.trim()) queryParams.query = query.value.trim();
  if (source.value) queryParams.sources = source.value;
  return queryParams;
}

function queryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function applyQueryParams(params: Record<string, unknown>) {
  const countryParam = queryString(params.countries);
  if (countryParam) countries.value = countryParam.split(",").filter(Boolean);
  city.value = queryString(params.city);
  district.value = queryString(params.district);
  propertyType.value = ["flat", "house"].includes(queryString(params.propertyType)) ? queryString(params.propertyType) : "any";
  dealType.value = ["sale", "longRent", "shortRent"].includes(queryString(params.dealType)) ? queryString(params.dealType) : "any";
  agency.value = ["owner", "agency"].includes(queryString(params.agency)) ? queryString(params.agency) : "any";
  priceMin.value = Number(queryString(params.priceMin)) || undefined;
  priceMax.value = Number(queryString(params.priceMax)) || undefined;
  if (queryString(params.currency)) displayCurrency.value = queryString(params.currency);
  roomsMin.value = Number(queryString(params.roomsMin)) || undefined;
  query.value = queryString(params.query);
  const sourceParam = queryString(params.sources);
  source.value = SOURCES.includes(sourceParam) ? sourceParam : "";
}

async function syncQueryParams() {
  await router.replace({ query: currentFilterQuery() });
}

const shareUrl = computed(() => {
  const resolved = router.resolve({ path: route.path, query: { ...currentFilterQuery(), shared: "1" } });
  return import.meta.client ? new URL(resolved.href, window.location.origin).toString() : resolved.href;
});

async function copyShareLink() {
  await navigator.clipboard.writeText(shareUrl.value);
}

function savePreset() {
  const name = presetName.value.trim();
  if (!name) return;
  presets.value = [...presets.value.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), { name, query: currentFilterQuery() }];
  localStorage.setItem(STORAGE.presets, JSON.stringify(presets.value));
  presetName.value = "";
  presetModalOpen.value = false;
}

function applyPreset(preset: SearchPreset) {
  applyQueryParams(preset.query);
  scheduleLoad(0);
}

function removePreset(name: string) {
  presets.value = presets.value.filter((item) => item.name !== name);
  localStorage.setItem(STORAGE.presets, JSON.stringify(presets.value));
}

async function loadMeta() {
  const { data } = await safeFetch<CountryMeta[]>("/flats-meta");
  if (Array.isArray(data)) {
    meta.value = data;
    if (!countries.value.length) countries.value = data.map((c) => c.code); // default: all countries
  }
}

async function loadRates() {
  const { data } = await safeFetch<{ rates?: Record<string, number> }>("/flats-rates");
  if (data?.rates && data.rates.USD) rates.value = data.rates;
}

function scheduleWarmPoll() {
  if (warmTimer) clearTimeout(warmTimer);
  if (!warming.value) return;
  warmTimer = setTimeout(() => {
    warmTimer = undefined;
    void load(false, true);
  }, 1800);
}

async function load(append = false, background = false) {
  const seq = ++loadSeq;
  if (!background) {
    if (append) loadingMore.value = true;
    else loading.value = true;
    failed.value = false;
  }
  const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: append ? String(listings.value.length) : "0" };
  if (countries.value.length) params.countries = countries.value.join(",");
  if (city.value) params.city = city.value;
  if (district.value) params.district = district.value;
  if (propertyType.value !== "any") params.propertyType = propertyType.value;
  if (dealType.value !== "any") params.dealType = dealType.value;
  if (agency.value !== "any") params.agency = agency.value;
  if (priceMin.value != null) params.priceMin = String(priceMin.value);
  if (priceMax.value != null) params.priceMax = String(priceMax.value);
  // The min/max are entered in the display currency; tell the backend so it can
  // compare across listings priced in other currencies (USD-normalized).
  if (priceMin.value != null || priceMax.value != null) params.priceCurrency = displayCurrency.value;
  if (roomsMin.value != null) params.roomsMin = String(roomsMin.value);
  if (query.value.trim()) params.query = query.value.trim();
  params.sources = source.value || SOURCES.join(",");

  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params });
  if (seq !== loadSeq) {
    if (append) loadingMore.value = false;
    return;
  }
  if (error || !data || data.error) {
    if (!background) {
      failed.value = true;
      if (!append) {
        listings.value = [];
        total.value = 0;
      }
      sourceErrors.value = [];
    }
  } else {
    const next = data.listings || [];
    listings.value = append
      ? [...new Map([...listings.value, ...next].map((item) => [item.id, item])).values()]
      : next;
    total.value = data.count ?? listings.value.length;
    sourceErrors.value = data.sourceErrors || [];
    warming.value = !!data.warming;
  }
  if (!background) {
    loading.value = false;
    loadingMore.value = false;
  }
  if (!append && !background) void syncQueryParams();
  scheduleWarmPoll();
}

function scheduleLoad(delay = 250) {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => { loadTimer = undefined; void load(false); }, delay);
}
function selectSource(v: string) {
  if (source.value === v) return;
  source.value = v;
  scheduleLoad(80);
}
function resetFilters() {
  city.value = ""; district.value = ""; propertyType.value = "any"; dealType.value = "any"; agency.value = "any";
  priceMin.value = undefined; priceMax.value = undefined; roomsMin.value = undefined; query.value = "";
  scheduleLoad(80);
}

function setView(next: FlatView) {
  view.value = next;
}

function toggleFavorite(item: Listing) {
  favorites.value = isFavorite(item.id)
    ? favorites.value.filter((saved) => saved.id !== item.id)
    : [item, ...favorites.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED_FLATS);
  if (isHidden(item.id)) {
    hidden.value = hidden.value.filter((saved) => saved.id !== item.id);
    persistList(STORAGE.hidden, hidden.value);
  }
  persistList(STORAGE.favorites, favorites.value);
}

function toggleHidden(item: Listing) {
  hidden.value = isHidden(item.id)
    ? hidden.value.filter((saved) => saved.id !== item.id)
    : [item, ...hidden.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED_FLATS);
  if (isFavorite(item.id)) {
    favorites.value = favorites.value.filter((saved) => saved.id !== item.id);
    persistList(STORAGE.favorites, favorites.value);
  }
  persistList(STORAGE.hidden, hidden.value);
}

// ---- map points ----
const mapPoints = computed(() =>
  displayedListings.value
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({
      id: l.id,
      lat: l.lat as number,
      lng: l.lng as number,
      title: l.title,
      priceLabel: priceLabel(l),
      photo: listingPhoto(l) || undefined,
      source: l.source,
    })),
);

// ---- details modal ----
const active = ref<Listing | null>(null);
const modalOpen = ref(false);
const lightbox = ref<string | null>(null); // full-screen photo, or null
const translatedDescription = ref("");
const translatingDescription = ref(false);
const translationFailed = ref(false);
const translationCache = new Map<string, string>();
let translationPollTimer: ReturnType<typeof setTimeout> | undefined;
let translationRequestId = 0;
// Ollama may legitimately need up to two minutes for one CPU inference. Keep
// polling beyond that worker timeout, including a little queue/retry margin.
const TRANSLATION_MAX_POLL_ATTEMPTS = 159;

function translationCacheKey(listing: Listing, targetLanguage = locale.value.startsWith("en") ? "en" : "ru"): string {
  return `${listing.id}:${targetLanguage}`;
}

function stopTranslationPoll() {
  if (translationPollTimer) clearTimeout(translationPollTimer);
  translationPollTimer = undefined;
}

function openListing(l: Listing) {
  stopTranslationPoll();
  translationRequestId += 1;
  active.value = l;
  translatedDescription.value = translationCache.get(translationCacheKey(l)) || "";
  translatingDescription.value = false;
  translationFailed.value = false;
  modalOpen.value = true;
  recent.value = [l, ...recent.value.filter((item) => item.id !== l.id)].slice(0, MAX_RECENT_FLATS);
  persistList(STORAGE.recent, recent.value, MAX_RECENT_FLATS);
}

function acceptTranslation(result: TranslationResult, listing: Listing, requestId: number, cacheKey: string): boolean {
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return true;
  if (result.status !== "completed") return false;
  const text = result.data?.translatedText?.trim() || "";
  if (!text) {
    translatingDescription.value = false;
    translationFailed.value = true;
    return true;
  }
  translationCache.set(cacheKey, text);
  translatedDescription.value = text;
  translatingDescription.value = false;
  translationFailed.value = false;
  return true;
}

async function pollTranslation(key: string, listing: Listing, requestId: number, cacheKey: string, attempt = 0) {
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  const { data, error } = await safeFetch<TranslationResult>("/flats-translate", { params: { key } });
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  if (!error && data && acceptTranslation(data, listing, requestId, cacheKey)) return;
  if (error || data?.status === "failed" || data?.status === "disabled" || data?.status === "not_found" || attempt >= TRANSLATION_MAX_POLL_ATTEMPTS) {
    translatingDescription.value = false;
    translationFailed.value = true;
    return;
  }
  translationPollTimer = setTimeout(() => void pollTranslation(key, listing, requestId, cacheKey, attempt + 1), 1500);
}

async function translateActiveDescription() {
  const listing = active.value;
  if (!listing?.description || translatingDescription.value) return;
  const targetLanguage = locale.value.startsWith("en") ? "en" : "ru";
  const cacheKey = translationCacheKey(listing, targetLanguage);
  const cached = translationCache.get(cacheKey);
  if (cached) {
    translatedDescription.value = cached;
    return;
  }

  stopTranslationPoll();
  const requestId = ++translationRequestId;
  translatingDescription.value = true;
  translationFailed.value = false;
  const { data, error } = await safeFetch<TranslationResult>("/flats-translate", {
    method: "POST",
    body: { text: listing.description, targetLanguage },
  });
  if (requestId !== translationRequestId || active.value?.id !== listing.id) return;
  if (error || !data) {
    translatingDescription.value = false;
    translationFailed.value = true;
    return;
  }
  if (acceptTranslation(data, listing, requestId, cacheKey)) return;
  if (data.status === "pending" && data.key) {
    translationPollTimer = setTimeout(() => void pollTranslation(data.key!, listing, requestId, cacheKey), 1000);
    return;
  }
  translatingDescription.value = false;
  translationFailed.value = true;
}
function openById(id: string) {
  const found = displayedListings.value.find((l) => l.id === id);
  if (found) openListing(found);
}

// ---- display helpers ----
function priceLabel(l: Listing): string {
  if (l.price == null) return t("priceNA");
  return `${l.price.toLocaleString()} ${l.currency}`.trim();
}
// Convert an amount between two currencies via the USD-based rates table.
function convert(amount: number, from: string, to: string): number | undefined {
  const rf = rates.value[(from || "USD").toUpperCase()];
  const rt = rates.value[(to || "USD").toUpperCase()];
  if (!rf || !rt) return undefined;
  return (amount * rt) / rf;
}
// "≈ 5,700,000 UZS" — shown only when the listing's currency differs from the
// chosen display currency and both rates are known.
function convertedLabel(l: Listing): string | null {
  if (l.price == null || !l.currency) return null;
  if (l.currency.toUpperCase() === displayCurrency.value.toUpperCase()) return null;
  const v = convert(l.price, l.currency, displayCurrency.value);
  if (v === undefined) return null;
  return `≈ ${Math.round(v).toLocaleString()} ${displayCurrency.value}`;
}
const dealLabel = (d: Listing["dealType"]) =>
  d === "sale" ? t("dtSale") : d === "longRent" ? t("dtLongRent") : d === "shortRent" ? t("dtShortRent") : "";
function specLine(l: Listing): string {
  const parts: string[] = [];
  if (l.rooms != null) parts.push(t("roomsN", { n: l.rooms }));
  if (l.areaSqm != null) parts.push(`${l.areaSqm} ${t("sqm")}`);
  if (l.floor != null) parts.push(l.totalFloors != null ? `${l.floor}/${l.totalFloors} ${t("floorAbbr")}` : `${l.floor} ${t("floorAbbr")}`);
  return parts.join(" · ");
}
function locLine(l: Listing): string {
  // Broad -> specific: city, district, metro station (when known).
  return [l.city, l.district, l.metro].filter(Boolean).join(", ");
}

// ---- normalized spec table (popup) ----
// Every field rendered with a consistent style; missing data shows "n/d".
// Missing data on the details table reads "Not specified" (never a bare "No").
const fmtBool = (v?: boolean | null) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const numOr = (v?: number | null, unit = "") => (v != null ? `${v}${unit ? " " + unit : ""}` : t("notSpecified"));
const strOr = (v?: string | null) => (v ? v : t("notSpecified"));
const listOr = (v?: string[] | null) => (v && v.length ? v.join(", ") : t("notSpecified"));
const nearbyTranslationKeys: Record<string, string> = {
  "Bobur Park": "nearbyBoburPark",
  Park: "nearbyPark",
  "Bus stop": "nearbyBusStop",
  Clinic: "nearbyClinic",
  School: "nearbySchool",
  Kindergarten: "nearbyKindergarten",
};
const nearbyItemLabel = (value: string) => nearbyTranslationKeys[value] ? t(nearbyTranslationKeys[value]) : value;
const nearbyListOr = (values?: string[] | null) =>
  values?.length ? values.map(nearbyItemLabel).join(", ") : t("notSpecified");
const ptLabel = (p: Listing["propertyType"]) => (p === "house" ? t("ptHouse") : t("ptFlat"));
const audienceLabel = (a?: Listing["audience"]) =>
  a === "women" ? t("audWomen") : a === "men" ? t("audMen") : a === "family" ? t("audFamily") : t("audAny");
const conditionLabel = (c?: Listing["condition"]) =>
  c === "needs_renovation" ? t("condNeeds") : c === "basic" ? t("condBasic") : c === "good" ? t("condGood")
    : c === "modern" ? t("condModern") : c === "luxury" ? t("condLuxury") : t("notSpecified");
const sourceLabel = (s?: string) => (s === "olx" ? "OLX" : s === "telegram" ? "Telegram" : strOr(s));
// Compact card badges: positive/important facts only. Missing/false data never
// shows a badge (unlike the details table). "Pet-friendly" here vs "Pets allowed:
// Yes/No" in the table, per the canonical spec.
function cardBadges(l: Listing): string[] {
  const b: string[] = [];
  b.push(l.byAgency ? t("badgeAgency") : t("badgeOwner"));
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
  if (l.commission === false) b.push(t("badgeNoCommission"));
  if (l.deposit === true) b.push(t("badgeDeposit"));
  if (l.roomOnly) b.push(t("badgeRoomOnly"));
  if (l.audience === "family") b.push(t("badgeFamily"));
  if (l.audience === "women") b.push(t("badgeWomen"));
  if (l.audience === "men") b.push(t("badgeMen"));
  return b;
}
function floorLabel(l: Listing) {
  if (l.floor != null && l.totalFloors != null) return `${l.floor} / ${l.totalFloors}`;
  return l.floor != null || l.totalFloors != null ? String(l.floor ?? l.totalFloors) : t("nd");
}
function depositLabel(l: Listing) {
  if (l.depositAmount != null) return `${l.depositAmount.toLocaleString()} ${l.currency}`;
  return fmtBool(l.deposit);
}
function commissionLabel(l: Listing) {
  if (l.commissionPercent != null) return `${l.commissionPercent}%`;
  return fmtBool(l.commission);
}
// UZ convention: utilities are usually included when the post says nothing.
function communalLabel(l: Listing) {
  if (l.communalSeparated === true) return t("communalSeparate");
  if (l.communalSeparated === false) return t("communalIncluded");
  return t("notSpecified");
}
const specRows = computed<Array<{ label: string; value: string }>>(() => {
  const l = active.value;
  if (!l) return [];
  return [
    { label: t("specDeal"), value: dealLabel(l.dealType) || t("notSpecified") },
    { label: t("specType"), value: ptLabel(l.propertyType) },
    { label: t("specListedBy"), value: l.byAgency ? t("agAgency") : t("agOwner") },
    { label: t("specSource"), value: sourceLabel(l.source) },
    { label: t("specRooms"), value: numOr(l.rooms) },
    { label: t("specBedrooms"), value: numOr(l.bedrooms) },
    { label: t("specBathrooms"), value: numOr(l.bathrooms) },
    { label: t("specArea"), value: l.areaSqm != null ? `${l.areaSqm} ${t("sqm")}` : t("notSpecified") },
    { label: t("specFloor"), value: floorLabel(l) },
    { label: t("specYear"), value: numOr(l.buildingYear) },
    { label: t("specNewBuilding"), value: fmtBool(l.newBuilding) },
    { label: t("specCondition"), value: conditionLabel(l.condition) },
    { label: t("specComplex"), value: strOr(l.residenceComplex) },
    { label: t("specCity"), value: strOr(l.city) },
    { label: t("specDistrict"), value: strOr(l.district) },
    { label: t("specKvartal"), value: strOr(l.kvartal) },
    { label: t("specMetro"), value: strOr(l.metro) },
    { label: t("specAddress"), value: strOr(l.address) },
    { label: t("specParking"), value: fmtBool(l.parking) },
    { label: t("specElevator"), value: fmtBool(l.elevator) },
    { label: t("specFurnished"), value: fmtBool(l.furnished) },
    { label: t("specBalcony"), value: fmtBool(l.balcony) },
    { label: t("specAC"), value: fmtBool(l.airConditioner) },
    { label: t("specGas"), value: fmtBool(l.gas) },
    { label: t("specHeating"), value: fmtBool(l.heating) },
    { label: t("specHotWater"), value: fmtBool(l.hotWater) },
    { label: t("specInternet"), value: fmtBool(l.internet) },
    { label: t("specPets"), value: fmtBool(l.petsAllowed) },
    { label: t("specChildren"), value: fmtBool(l.childrenAllowed) },
    { label: t("specSmoking"), value: fmtBool(l.smokingAllowed) },
    { label: t("specAudience"), value: audienceLabel(l.audience) },
    { label: t("specRoomShare"), value: fmtBool(l.roomOnly) },
    { label: t("specNegotiable"), value: fmtBool(l.negotiable) },
    { label: t("specDeposit"), value: depositLabel(l) },
    { label: t("specCommission"), value: commissionLabel(l) },
    { label: t("specCommunal"), value: communalLabel(l) },
    { label: t("specUtilAmount"), value: l.utilitiesAmount != null ? `${l.utilitiesAmount.toLocaleString()} ${l.currency}` : t("notSpecified") },
    { label: t("specMinLease"), value: strOr(l.minLeaseTerm) },
    { label: t("specAvailable"), value: strOr(l.availableFrom) },
    { label: t("specShops"), value: listOr(l.nearbyShops) },
    { label: t("specNearby"), value: nearbyListOr(l.nearby) },
    { label: t("specAmenities"), value: listOr(l.amenities) },
  ];
});
// "Hide empty fields" toggle for the details table.
const hideEmptySpecs = ref(false);
const visibleSpecRows = computed(() =>
  hideEmptySpecs.value ? specRows.value.filter((r) => r.value !== t("notSpecified")) : specRows.value,
);
// Share the open listing: native share sheet on mobile, clipboard fallback on
// desktop. The link deep-opens the listing popup on our page (?flat=<id>).
const shareCopied = ref(false);
async function shareFlat(l: Listing) {
  const link = `${location.origin}${location.pathname}?flat=${encodeURIComponent(l.id)}`;
  try {
    if (navigator.share) { await navigator.share({ title: l.title, text: l.title, url: link }); return; }
    await navigator.clipboard.writeText(link);
    shareCopied.value = true;
    setTimeout(() => { shareCopied.value = false; }, 2000);
  } catch { /* user cancelled or clipboard blocked */ }
}
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
}

onMounted(async () => {
  loadPersonalState();
  applyQueryParams(route.query);
  void loadRates(); // FX rates for price display + conversion (non-blocking)
  await loadMeta();
  if (queryString(route.query.shared) === "1") {
    showAdvanced.value = true;
    sharedLinkOpened.value = true;
    shareModalOpen.value = true;
  }
  await load(false);
  // Deep link: ?flat=<id> opens that listing's popup if it's in the loaded feed.
  const flatId = queryString(route.query.flat);
  if (flatId) {
    const found = listings.value.find((x) => x.id === flatId);
    if (found) openListing(found);
  }
  await nextTick();
  infiniteObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting) && hasMore.value && !loading.value && !loadingMore.value) {
      void load(true);
    }
  }, { rootMargin: "500px 0px" });
  if (loadMoreSentinel.value) infiniteObserver.observe(loadMoreSentinel.value);
});

watch(loadMoreSentinel, (current, previous) => {
  if (previous) infiniteObserver?.unobserve(previous);
  if (current) infiniteObserver?.observe(current);
});

watch(modalOpen, (open) => {
  if (open) return;
  stopTranslationPoll();
  translationRequestId += 1;
  translatingDescription.value = false;
});

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  if (warmTimer) clearTimeout(warmTimer);
  infiniteObserver?.disconnect();
  stopTranslationPoll();
});
</script>

<template>
  <u-container class="flats">
    <div class="flats__header text-center space-y-3">
      <h1 class="flats__title">{{ t("title") }}</h1>
      <p class="flats__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
    </div>

    <!-- Filters -->
    <form class="flats__controls" @submit.prevent="load()">
      <u-input v-model="query" icon="i-lucide-search" :placeholder="t('searchPlaceholder')" />
      <u-button type="submit" :loading="loading" icon="i-lucide-search">
        {{ loading ? t("searching") : t("search") }}
      </u-button>

      <div class="flats__row">
        <div class="flats__filters">
          <button
              v-for="opt in sourceOptions" :key="opt.value" type="button"
              class="flats__pill" :class="{ 'flats__pill_active': source === opt.value }"
              @click="selectSource(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <div class="flats__views" :aria-label="t('personalTabs')">
          <button type="button" class="flats__pill" :class="{ 'flats__pill_active': view === 'active' }" @click="setView('active')">
            {{ t("allListings") }}
          </button>
          <button type="button" class="flats__pill" :class="{ 'flats__pill_active': view === 'favorites' }" @click="setView('favorites')">
            {{ t("favorites") }} · {{ favorites.length }}
          </button>
          <button type="button" class="flats__pill" :class="{ 'flats__pill_active': view === 'recent' }" @click="setView('recent')">
            {{ t("recent") }} · {{ recent.length }}
          </button>
          <button type="button" class="flats__pill" :class="{ 'flats__pill_active': view === 'hidden' }" @click="setView('hidden')">
            {{ t("hidden") }} · {{ hidden.length }}
          </button>
        </div>
      </div>

      <div v-if="showAdvanced" class="flats__advanced">
        <div class="flats__presets">
          <span class="flats__field-label">{{ t("presets") }}</span>
          <button v-for="preset in presets" :key="preset.name" type="button" class="flats__preset" @click="applyPreset(preset)">
            <span>{{ preset.name }}</span>
            <span class="flats__preset-remove" role="button" :aria-label="t('deletePreset')" @click.stop="removePreset(preset.name)">×</span>
          </button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-bookmark-plus" @click="presetModalOpen = true">
            {{ t("savePreset") }}
          </u-button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-share-2" @click="sharedLinkOpened = false; shareModalOpen = true">
            {{ t("shareSearch") }}
          </u-button>
        </div>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("country") }}</span>
          <u-select-menu v-model="countries" :items="countryItems" value-key="value" label-key="label"
              multiple :placeholder="t('countryAny')" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("city") }}</span>
          <u-select-menu v-model="citySel" :items="cityItems" value-key="value" label-key="label"
              class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label v-if="districtOptions.length" class="flats__field">
          <span class="flats__field-label">{{ t("district") }}</span>
          <u-select-menu v-model="districtSel" :items="districtItems" value-key="value" label-key="label"
              class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("propertyType") }}</span>
          <u-select-menu v-model="propertyTypeSel" :items="propertyTypeItems" value-key="value" label-key="label"
              :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("dealType") }}</span>
          <u-select-menu v-model="dealTypeSel" :items="dealTypeItems" value-key="value" label-key="label"
              :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("agency") }}</span>
          <u-select-menu v-model="agencySel" :items="agencyItems" value-key="value" label-key="label"
              :search-input="false" class="flats__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("priceMin") }}</span>
          <u-input v-model.number="priceMin" type="number" icon="i-lucide-banknote" @change="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("priceMax") }}</span>
          <u-input v-model.number="priceMax" type="number" icon="i-lucide-banknote" @change="scheduleLoad()" />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("currency") }}</span>
          <u-select-menu
              v-model="displayCurrency" :items="currencyItems" value-key="value" label-key="label"
              class="flats__select"
              @update:model-value="(priceMin != null || priceMax != null) && scheduleLoad()"
          />
        </label>
        <label class="flats__field">
          <span class="flats__field-label">{{ t("roomsMin") }}</span>
          <u-input v-model.number="roomsMin" type="number" icon="i-lucide-bed-double" @change="scheduleLoad()" />
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">
          {{ t("reset") }}
        </u-button>
      </div>
    </form>

    <p v-if="failed" class="flats__error">{{ t("error") }}</p>
    <p
        v-else-if="source === 'telegram' && !loading && !listings.length && sourceErrors?.some((item) => item.source === 'telegram')"
        class="flats__source-warning"
    >{{ t("telegramUnavailable") }}</p>
    <p v-else class="flats__count text-muted">{{ t("found", { n: view === 'active' ? total : displayedListings.length }) }}</p>

    <!-- Map -->
    <section v-if="listings.length" class="flats__map-wrap">
      <flat-map
          :points="mapPoints"
          :draw-label="t('drawArea')"
          :done-label="t('done')"
          :clear-label="t('clearArea')"
          :draw-hint="t('drawHint')"
          @select="openById"
          @area-change="drawnArea = $event"
      />
    </section>

    <!-- Results -->
    <div class="flats__grid" :class="{ 'flats__grid_loading': loading }">
      <article v-for="l in displayedListings" :key="l.id" class="flat-card" :class="{ 'flat-card_favorite': isFavorite(l.id), 'flat-card_hidden': isHidden(l.id) }" @click="openListing(l)">
        <div class="flat-card__photo">
          <img
              v-if="listingPhoto(l)"
              :src="listingPhoto(l) || ''"
              :alt="l.title"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              @error="markPhotoFailedFromEvent"
          />
          <div v-else class="flat-card__no-photo">
            <u-icon name="i-lucide-image-off" class="flat-card__no-photo-icon" aria-hidden="true" />
            <span>{{ t("noPhoto") }}</span>
          </div>
          <span v-if="dealLabel(l.dealType)" class="flat-card__deal">{{ dealLabel(l.dealType) }}</span>
          <span v-if="l.roomOnly" class="flat-card__room">{{ t("roomShare") }}</span>
        </div>
        <div class="flat-card__body">
          <div class="flat-card__actions">
            <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': isFavorite(l.id) }" :aria-label="isFavorite(l.id) ? t('removeFavorite') : t('addFavorite')" @click.stop="toggleFavorite(l)">
              <u-icon name="i-lucide-heart" />
            </button>
            <button type="button" class="flat-card__action" :class="{ 'flat-card__action_active': isHidden(l.id) }" :aria-label="isHidden(l.id) ? t('restoreListing') : t('hideListing')" @click.stop="toggleHidden(l)">
              <u-icon :name="isHidden(l.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" />
            </button>
          </div>
          <div class="flat-card__price">{{ priceLabel(l) }}</div>
          <div v-if="convertedLabel(l)" class="flat-card__price-conv text-muted">{{ convertedLabel(l) }}</div>
          <h3 class="flat-card__title">{{ l.title }}</h3>
          <div v-if="specLine(l)" class="flat-card__spec text-muted">{{ specLine(l) }}</div>
          <div v-if="cardBadges(l).length" class="flat-card__badges">
            <span v-for="b in cardBadges(l)" :key="b" class="flat-card__badge">{{ b }}</span>
          </div>
          <div class="flat-card__meta text-muted">
            <span v-if="locLine(l)">{{ locLine(l) }}</span>
            <span class="flat-card__src">{{ l.source }}</span>
            <span v-if="timeAgo(l.createdAt)">· {{ timeAgo(l.createdAt) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div ref="loadMoreSentinel" v-if="hasMore" class="flats__sentinel">
      <span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span>
    </div>

    <div v-if="!loading && !displayedListings.length && !failed" class="flats__empty">
      <div class="text-muted">{{ t("empty") }}</div>
      <div v-if="drawnArea.length >= 3 && listings.length" class="text-muted">{{ t("emptyArea") }}</div>
    </div>

    <!-- Details popup -->
    <u-modal v-model:open="modalOpen" :title="active?.title || ''" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div v-if="active" class="flat-modal">
          <div v-if="visiblePhotos(active).length" class="flat-modal__gallery">
            <img
                v-for="(p, i) in visiblePhotos(active)"
                :key="p"
                :src="p"
                :alt="`${active.title} (${i + 1})`"
                class="flat-modal__thumb"
                loading="lazy"
                decoding="async"
                referrerpolicy="no-referrer"
                @error="markPhotoFailedFromEvent"
                @click="lightbox = p"
            />
          </div>
          <div class="flat-modal__price">{{ priceLabel(active) }}<span v-if="convertedLabel(active)" class="flat-modal__price-conv"> ({{ convertedLabel(active) }})</span><span v-if="dealLabel(active.dealType)" class="flat-modal__deal"> · {{ dealLabel(active.dealType) }}</span><span v-if="active.roomOnly" class="flat-modal__deal"> · {{ t("roomShare") }}</span></div>
          <label class="flat-modal__hide-empty">
            <input type="checkbox" v-model="hideEmptySpecs" />
            <span>{{ t("hideEmpty") }}</span>
          </label>
          <table class="flat-modal__spec">
            <tbody>
              <tr v-for="row in visibleSpecRows" :key="row.label">
                <th>{{ row.label }}</th>
                <td>{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="active.description" class="flat-modal__translation">
            <u-button
                type="button"
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-languages"
                :loading="translatingDescription"
                @click="translateActiveDescription"
            >{{ translatingDescription ? t("translatingDescription") : t("translateDescription") }}</u-button>
            <span v-if="translationFailed" class="flat-modal__translation-error">{{ t("translationFailed") }}</span>
          </div>
          <section v-if="translatedDescription" class="flat-modal__translated">
            <h4 class="flat-modal__translated-title">{{ t("translatedDescription") }}</h4>
            <p class="flat-modal__desc">{{ translatedDescription }}</p>
          </section>
          <details v-if="active.description" class="flat-modal__descbox">
            <summary>{{ t("origDescription") }}</summary>
            <p class="flat-modal__desc">{{ active.description }}</p>
          </details>
          <div v-if="active.tags && active.tags.length" class="flat-modal__tags">
            <span v-for="tag in active.tags" :key="tag" class="flat-modal__tag">{{ nearbyItemLabel(tag) }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <div v-if="active" class="flat-modal__footer-actions">
          <u-button class="flat-modal__footer-button" variant="outline" color="neutral" icon="i-lucide-heart" @click="toggleFavorite(active)">
            {{ isFavorite(active.id) ? t("removeFavorite") : t("addFavorite") }}
          </u-button>
          <u-button class="flat-modal__footer-button" variant="outline" color="neutral" :icon="isHidden(active.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" @click="toggleHidden(active)">
            {{ isHidden(active.id) ? t("restoreListing") : t("hideListing") }}
          </u-button>
          <u-button class="flat-modal__footer-button" variant="outline" color="neutral" :icon="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'" @click="shareFlat(active)">
            {{ shareCopied ? t("shareCopied") : t("share") }}
          </u-button>
          <a class="flat-modal__footer-button flat-modal__footer-button_primary" :href="active.url" target="_blank" rel="noopener noreferrer">{{ t("open") }} →</a>
        </div>
      </template>
    </u-modal>

    <!-- Full-screen photo viewer (click any gallery thumbnail) -->
    <teleport to="body">
      <div v-if="lightbox" class="flat-lightbox" @click="lightbox = null">
        <img :src="lightbox" alt="" referrerpolicy="no-referrer" @click.stop @error="lightbox = null" />
        <button type="button" class="flat-lightbox__close" aria-label="Close" @click="lightbox = null">×</button>
      </div>
    </teleport>

    <u-modal v-model:open="presetModalOpen" :title="t('savePreset')">
      <template #body>
        <u-input v-model="presetName" autofocus :placeholder="t('presetName')" @keyup.enter="savePreset" />
      </template>
      <template #footer>
        <u-button color="neutral" variant="ghost" @click="presetModalOpen = false">{{ t("cancel") }}</u-button>
        <u-button @click="savePreset">{{ t("save") }}</u-button>
      </template>
    </u-modal>

    <u-modal v-model:open="shareModalOpen" :title="sharedLinkOpened ? t('sharedSearchApplied') : t('shareSearch')">
      <template #body>
        <p class="flat-share__hint">{{ sharedLinkOpened ? t("sharedSearchHint") : t("shareSearchHint") }}</p>
        <u-input :model-value="shareUrl" readonly />
      </template>
      <template #footer>
        <u-button icon="i-lucide-copy" @click="copyShareLink">{{ t("copyLink") }}</u-button>
      </template>
    </u-modal>
  </u-container>
</template>

<style scoped>
.flats { padding-top: 24px; padding-bottom: 96px; }
.flats__title { font-size: 32px; font-weight: 600; }
.flats__subtitle { max-width: 720px; font-size: 14px; }
.flats__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: start; }
.flats__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.flats__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.flats__views { display: flex; flex-wrap: wrap; gap: 8px; padding-left: 12px; border-left: 1px solid var(--line); }
.flats__pill {
  height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px;
  text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease;
}
.flats__pill:hover { color: var(--text-white); }
.flats__pill_active { color: var(--text-white); border-color: rgba(224,103,154,0.4); background: rgba(224,103,154,0.18); }
.flats__advanced {
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end; grid-template-columns: 1fr;
  padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.flats__presets {
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
}
.flats__preset {
  display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px 0 11px;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-primary);
  cursor: pointer;
}
.flats__preset-remove { color: var(--text-muted); font-size: 18px; line-height: 1; }
.flats__preset-remove:hover { color: var(--accent-pink); }
@media (min-width: 700px) { .flats__advanced { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .flats__advanced { grid-template-columns: repeat(4, 1fr); } }
.flats__field { display: flex; flex-direction: column; gap: 5px; }
.flats__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.flats__select { width: 100%; }
.flats__select :deep(button) { width: 100%; }
.flats__error { color: var(--ui-error, #f87171); }
.flats__source-warning { color: #f6c177; font-size: 13px; margin-bottom: 12px; }
.flats__count { font-size: 13px; margin-bottom: 12px; }
.flats__map-wrap { position: relative; z-index: 0; isolation: isolate; margin-bottom: 18px; scroll-margin-top: 90px; }
.flats__grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; grid-auto-rows: 1fr; }
@media (min-width: 640px) { .flats__grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .flats__grid { grid-template-columns: repeat(3, 1fr); } }
.flats__grid_loading { opacity: 0.4; pointer-events: none; }
.flat-card {
  height: 100%; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.03);
  cursor: pointer; transition: transform 140ms ease, border-color 180ms ease; display: flex; flex-direction: column;
}
.flat-card__body { flex: 1 1 auto; }
.flat-card:hover { transform: translateY(-2px); border-color: rgba(224,103,154,0.4); }
.flat-card__photo {
  position: relative; width: 100%; height: clamp(220px, 25vw, 310px);
  flex: 0 0 auto; overflow: hidden; background: var(--bg-panel);
}
.flat-card__photo > img { width: 100%; height: 100%; object-fit: cover; display: block; }
.flat-card__no-photo {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; height: 100%;
  color: var(--text-muted); font-size: 12px; background: rgba(255,255,255,0.025);
}
.flat-card__no-photo-icon { width: 34px; height: 34px; opacity: 0.48; }
.flat-card__deal { position: absolute; top: 8px; left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(13,17,40,0.8); color: #e0679a; }
.flat-card__room { position: absolute; top: 8px; right: 8px; font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(13,17,40,0.8); color: #7189d9; }
.flat-modal__addr { font-size: 13px; }
.flat-card__body { position: relative; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.flat-card__actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; }
.flat-card__action {
  width: 29px; height: 29px; display: inline-grid; place-items: center; padding: 0;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-muted); cursor: pointer;
}
.flat-card__action:hover, .flat-card__action_active { color: var(--accent-pink); border-color: rgba(224,103,154,0.48); }
.flat-card__price { padding-right: 70px; }
.flat-card__price { font-weight: 700; font-size: 16px; color: var(--text-white, inherit); }
.flat-card__price-conv { font-size: 12px; font-weight: 500; margin-top: 1px; }
.flat-card__title { font-size: 13.5px; font-weight: 500; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.flat-card__spec { font-size: 12.5px; }
.flat-card__badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.flat-card__badge {
  font-size: 10.5px; font-weight: 600; line-height: 1; padding: 4px 7px; border-radius: 999px;
  border: 1px solid var(--line); background: rgba(255,255,255,0.05); color: var(--text-primary);
  white-space: nowrap;
}
.flat-card__meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11.5px; margin-top: 2px; }
.flat-card__src { text-transform: capitalize; opacity: 0.7; }
.flats__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }
.flats__sentinel { min-height: 44px; display: grid; place-items: center; }
.flat-card_favorite { border-color: rgba(224,103,154,0.5); }
.flat-card_hidden { opacity: 0.64; border-style: dashed; }
.flat-modal { display: flex; flex-direction: column; gap: 12px; }
.flat-modal__photo { width: 100%; max-height: 320px; object-fit: cover; border-radius: 10px; }
.flat-modal__gallery {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px;
  max-height: 46vh; overflow-y: auto;
}
.flat-modal__thumb {
  width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; cursor: zoom-in;
  border: 1px solid var(--line); transition: border-color 140ms ease;
}
.flat-modal__thumb:hover { border-color: var(--accent-pink); }
.flat-lightbox {
  position: fixed; inset: 0; z-index: 3000; display: grid; place-items: center;
  background: rgba(0,0,0,0.9); padding: 24px; cursor: zoom-out;
}
.flat-lightbox img { max-width: 96vw; max-height: 92vh; object-fit: contain; border-radius: 8px; cursor: default; }
.flat-lightbox__close {
  position: fixed; top: 16px; right: 20px; width: 40px; height: 40px; border-radius: 8px;
  background: rgba(13,17,40,0.9); color: #fff; border: 1px solid var(--line); font-size: 22px; cursor: pointer;
}
.flat-modal__price { font-weight: 700; font-size: 20px; }
.flat-modal__price-conv { font-weight: 500; font-size: 14px; color: var(--text-muted); }
.flat-modal__deal { color: #e0679a; font-weight: 500; }
.flat-modal__meta { font-size: 13px; }
.flat-modal__spec { width: 100%; border-collapse: collapse; font-size: 13px; margin: 4px 0 10px; }
.flat-modal__spec tr { border-bottom: 1px solid var(--line); }
.flat-modal__spec tr:last-child { border-bottom: none; }
.flat-modal__spec th {
  text-align: left; font-weight: 600; padding: 6px 12px 6px 0; white-space: nowrap;
  color: var(--text-muted, inherit); opacity: 0.75; width: 44%; vertical-align: top;
}
.flat-modal__spec td { padding: 6px 0; vertical-align: top; }
.flat-modal__hide-empty { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted, inherit); cursor: pointer; margin: 2px 0 6px; user-select: none; }
.flat-modal__translation { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.flat-modal__translation-error { color: #f29ab6; font-size: 12px; }
.flat-modal__translated { margin-top: 12px; padding: 12px; border: 1px solid var(--line, #252a4a); border-radius: var(--radius, 10px); background: var(--bg-panel-2, #171c3a); }
.flat-modal__translated-title { margin: 0 0 8px; color: var(--text-primary, #e4e5f0); font-size: 13px; font-weight: 600; }
.flat-modal__descbox { margin-top: 6px; }
.flat-modal__descbox summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.7; user-select: none; }
.flat-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); max-height: 40vh; overflow-y: auto; margin-top: 8px; }
.flat-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.flat-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.flat-modal__footer-actions { width: 100%; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.flat-modal__footer-button {
  width: 100%; min-height: 44px; height: auto; padding: 8px 11px; justify-content: center;
  text-align: center; white-space: normal; line-height: 1.25;
}
.flat-modal__footer-button_primary {
  display: inline-flex; align-items: center; border: 1px solid var(--accent-pink, #e0679a); border-radius: 8px;
  background: var(--accent-pink, #e0679a); color: #1a0e14; font-weight: 600; font-size: 13.5px;
}
.flat-share__hint { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
@media (max-width: 700px) {
  .flats__controls { grid-template-columns: 1fr; }
  .flats__controls > :deep(button) { width: 100%; }
  .flats__views { padding-left: 0; border-left: 0; }
  .flat-card__photo { height: 250px; }
  .flat-modal__footer-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
