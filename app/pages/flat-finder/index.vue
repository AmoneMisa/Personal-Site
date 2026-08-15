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
  tags?: string[];
}
interface FeedResult {
  count: number;
  listings: Listing[];
  sourceCounts?: Record<string, number>;
  error?: string;
}
interface CountryMeta { code: string; name: string; currency: string; cities?: string[] }

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`flats.${key}`, params);

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
const propertyType = ref("any"); // any | flat | house
const dealType = ref("any"); // any | sale | longRent | shortRent
const agency = ref("any"); // any | owner | agency
const priceMin = ref<number | undefined>(undefined);
const priceMax = ref<number | undefined>(undefined);
const roomsMin = ref<number | undefined>(undefined);
const query = ref("");
const source = ref(""); // "" = all
const showAdvanced = ref(true);

const listings = ref<Listing[]>([]);
const total = ref(0);
const loading = ref(false);
const failed = ref(false);
let loadSeq = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;

// ---- country/city metadata ----
const meta = ref<CountryMeta[]>([]);
const cityOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  return [...new Set(picked.flatMap((c) => c.cities ?? []))].sort();
});

const SOURCES = ["olx", "reddit", "telegram", "threads"];
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

async function loadMeta() {
  const { data } = await safeFetch<CountryMeta[]>("/flats-meta");
  if (Array.isArray(data)) {
    meta.value = data;
    if (!countries.value.length) countries.value = data.map((c) => c.code); // default: all countries
  }
}

async function load() {
  const seq = ++loadSeq;
  loading.value = true;
  failed.value = false;
  const params: Record<string, string> = { limit: "60" };
  if (countries.value.length) params.countries = countries.value.join(",");
  if (city.value) params.city = city.value;
  if (propertyType.value !== "any") params.propertyType = propertyType.value;
  if (dealType.value !== "any") params.dealType = dealType.value;
  if (agency.value !== "any") params.agency = agency.value;
  if (priceMin.value != null) params.priceMin = String(priceMin.value);
  if (priceMax.value != null) params.priceMax = String(priceMax.value);
  if (roomsMin.value != null) params.roomsMin = String(roomsMin.value);
  if (query.value.trim()) params.query = query.value.trim();
  if (source.value) params.sources = source.value;

  const { data, error } = await safeFetch<FeedResult>("/flats-feed", { params });
  if (seq !== loadSeq) return;
  if (error || !data || data.error) {
    failed.value = true;
    listings.value = [];
    total.value = 0;
  } else {
    listings.value = data.listings || [];
    total.value = data.count ?? listings.value.length;
  }
  loading.value = false;
}

function scheduleLoad(delay = 250) {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => { loadTimer = undefined; void load(); }, delay);
}
function selectSource(v: string) {
  if (source.value === v) return;
  source.value = v;
  scheduleLoad(80);
}
function resetFilters() {
  city.value = ""; propertyType.value = "any"; dealType.value = "any"; agency.value = "any";
  priceMin.value = undefined; priceMax.value = undefined; roomsMin.value = undefined; query.value = "";
  scheduleLoad(80);
}

// ---- map points ----
const mapPoints = computed(() =>
  listings.value
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => ({ id: l.id, lat: l.lat as number, lng: l.lng as number, title: l.title, priceLabel: priceLabel(l) })),
);

// ---- details modal ----
const active = ref<Listing | null>(null);
const modalOpen = ref(false);
function openListing(l: Listing) { active.value = l; modalOpen.value = true; }
function openById(id: string) {
  const found = listings.value.find((l) => l.id === id);
  if (found) openListing(found);
}

// ---- display helpers ----
function priceLabel(l: Listing): string {
  if (l.price == null) return t("priceNA");
  return `${l.price.toLocaleString()} ${l.currency}`.trim();
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
  return [l.city, l.district].filter(Boolean).join(", ");
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
  await loadMeta();
  await load();
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
      </div>

      <div v-if="showAdvanced" class="flats__advanced">
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
          <span class="flats__field-label">{{ t("roomsMin") }}</span>
          <u-input v-model.number="roomsMin" type="number" icon="i-lucide-bed-double" @change="scheduleLoad()" />
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">
          {{ t("reset") }}
        </u-button>
      </div>
    </form>

    <p v-if="failed" class="flats__error">{{ t("error") }}</p>
    <p v-else class="flats__count text-muted">{{ t("found", { n: total }) }}</p>

    <!-- Map -->
    <section v-if="mapPoints.length" class="flats__map-wrap">
      <flat-map :points="mapPoints" @select="openById" />
    </section>

    <!-- Results -->
    <div class="flats__grid" :class="{ 'flats__grid_loading': loading }">
      <article v-for="l in listings" :key="l.id" class="flat-card" @click="openListing(l)">
        <div class="flat-card__photo">
          <img v-if="l.photo" :src="l.photo" :alt="l.title" loading="lazy" />
          <div v-else class="flat-card__no-photo">{{ t("noPhoto") }}</div>
          <span v-if="dealLabel(l.dealType)" class="flat-card__deal">{{ dealLabel(l.dealType) }}</span>
        </div>
        <div class="flat-card__body">
          <div class="flat-card__price">{{ priceLabel(l) }}</div>
          <h3 class="flat-card__title">{{ l.title }}</h3>
          <div v-if="specLine(l)" class="flat-card__spec text-muted">{{ specLine(l) }}</div>
          <div class="flat-card__meta text-muted">
            <span v-if="locLine(l)">{{ locLine(l) }}</span>
            <span class="flat-card__src">{{ l.source }}</span>
            <span v-if="timeAgo(l.createdAt)">· {{ timeAgo(l.createdAt) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div v-if="!loading && !listings.length && !failed" class="flats__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    <!-- Details popup -->
    <u-modal v-model:open="modalOpen" :title="active?.title || ''" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div v-if="active" class="flat-modal">
          <img v-if="active.photo" :src="active.photo" :alt="active.title" class="flat-modal__photo" />
          <div class="flat-modal__price">{{ priceLabel(active) }}<span v-if="dealLabel(active.dealType)" class="flat-modal__deal"> · {{ dealLabel(active.dealType) }}</span></div>
          <div class="flat-modal__meta text-muted">
            <span v-if="specLine(active)">{{ specLine(active) }}</span>
            <span v-if="locLine(active)"> · {{ locLine(active) }}</span>
            <span v-if="active.buildingYear"> · {{ t("built") }} {{ active.buildingYear }}</span>
          </div>
          <p v-if="active.description" class="flat-modal__desc">{{ active.description }}</p>
          <div v-if="active.tags && active.tags.length" class="flat-modal__tags">
            <span v-for="tag in active.tags" :key="tag" class="flat-modal__tag">{{ tag }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <a v-if="active" class="flat-modal__open" :href="active.url" target="_blank" rel="noopener noreferrer">{{ t("open") }} →</a>
      </template>
    </u-modal>
  </u-container>
</template>

<style scoped>
.flats { padding-top: 24px; padding-bottom: 96px; }
.flats__title { font-size: 32px; font-weight: 600; }
.flats__subtitle { max-width: 720px; font-size: 14px; }
.flats__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: start; }
.flats__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
.flats__filters { display: flex; flex-wrap: wrap; gap: 8px; }
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
@media (min-width: 700px) { .flats__advanced { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .flats__advanced { grid-template-columns: repeat(4, 1fr); } }
.flats__field { display: flex; flex-direction: column; gap: 5px; }
.flats__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.flats__select { width: 100%; }
.flats__select :deep(button) { width: 100%; }
.flats__error { color: var(--ui-error, #f87171); }
.flats__count { font-size: 13px; margin-bottom: 12px; }
.flats__map-wrap { margin-bottom: 18px; }
.flats__grid { display: grid; gap: 14px; grid-template-columns: 1fr; }
@media (min-width: 640px) { .flats__grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .flats__grid { grid-template-columns: repeat(3, 1fr); } }
.flats__grid_loading { opacity: 0.4; pointer-events: none; }
.flat-card {
  border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.03);
  cursor: pointer; transition: transform 140ms ease, border-color 180ms ease; display: flex; flex-direction: column;
}
.flat-card:hover { transform: translateY(-2px); border-color: rgba(224,103,154,0.4); }
.flat-card__photo { position: relative; aspect-ratio: 4 / 3; background: var(--bg-panel); }
.flat-card__photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.flat-card__no-photo { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 12px; }
.flat-card__deal { position: absolute; top: 8px; left: 8px; font-size: 11px; padding: 2px 8px; border-radius: 6px; background: rgba(13,17,40,0.8); color: #e0679a; }
.flat-card__body { padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.flat-card__price { font-weight: 700; font-size: 16px; color: var(--text-white, inherit); }
.flat-card__title { font-size: 13.5px; font-weight: 500; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.flat-card__spec { font-size: 12.5px; }
.flat-card__meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11.5px; margin-top: 2px; }
.flat-card__src { text-transform: capitalize; opacity: 0.7; }
.flats__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }
.flat-modal { display: flex; flex-direction: column; gap: 12px; }
.flat-modal__photo { width: 100%; max-height: 320px; object-fit: cover; border-radius: 10px; }
.flat-modal__price { font-weight: 700; font-size: 20px; }
.flat-modal__deal { color: #e0679a; font-weight: 500; }
.flat-modal__meta { font-size: 13px; }
.flat-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); max-height: 40vh; overflow-y: auto; }
.flat-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.flat-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.flat-modal__open {
  display: inline-flex; align-items: center; height: 36px; padding: 0 16px; border-radius: 8px;
  background: var(--accent-pink, #e0679a); color: #1a0e14; font-weight: 600; font-size: 13.5px;
}
</style>
