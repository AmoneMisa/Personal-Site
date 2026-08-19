<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";

// Hiring board — CV/resume profiles from candidates looking for work.
// Auto-routed at /hiring. UI follows /flat-finder; data from /hiring-feed.

interface CvProfile {
  id: string;
  source: string;
  country: string;
  name: string;
  role: string;
  experienceYears?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  city?: string | null;
  remote?: boolean | null;
  photo?: string | null;
  photos?: string[];
  url: string;
  createdAt: string | null;
  description: string;
  skills?: string[];
  languages?: string[];
  education?: string | null;
  tags?: string[];
  contact?: string | null;
  employmentType?: string | null;
}
interface FeedResult {
  count: number;
  profiles: CvProfile[];
  warming?: boolean;
  sourceCounts?: Record<string, number>;
  sourceErrors?: Array<{ source?: string; country?: string; error?: string }>;
  error?: string;
}
interface CountryMeta { code: string; name: string; currency: string; cities?: string[] }
type HiringView = "active" | "favorites" | "recent" | "hidden";
type SearchPreset = { name: string; query: Record<string, string> };

const PAGE_SIZE = 20;
const MAX_SAVED = 200;
const MAX_RECENT = 30;
const STORAGE = {
  favorites: "hiring:favorites:v1",
  hidden: "hiring:hidden:v1",
  recent: "hiring:recent:v1",
  presets: "hiring:presets:v1",
};

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`hiring.${key}`, params);
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

const countries = ref<string[]>([]);
const city = ref("");
const remote = ref("any");
const experienceMin = ref<number | undefined>(undefined);
const query = ref("");
// Canonical seniority + comma-separated canonical skills, mirroring the Job
// Finder's filter model so both halves of the site behave the same way.
const seniority = ref("");
const skills = ref("");
const source = ref("");
const showAdvanced = ref(true);

const profiles = ref<CvProfile[]>([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const warming = ref(false);
const failed = ref(false);
const sourceErrors = ref<FeedResult["sourceErrors"]>([]);
const view = ref<HiringView>("active");
const favorites = ref<CvProfile[]>([]);
const hidden = ref<CvProfile[]>([]);
const recent = ref<CvProfile[]>([]);
const presets = ref<SearchPreset[]>([]);
const presetName = ref("");
const presetModalOpen = ref(false);
const shareModalOpen = ref(false);
const sharedLinkOpened = ref(false);
const listingShareModalOpen = ref(false);
const listingShareUrl = ref("");
const listingShareCopied = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
let loadSeq = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let sharedPostTimer: ReturnType<typeof setTimeout> | undefined;
let infiniteObserver: IntersectionObserver | undefined;

const meta = ref<CountryMeta[]>([]);
const cityOptions = computed(() => {
  const picked = countries.value.length ? meta.value.filter((c) => countries.value.includes(c.code)) : meta.value;
  return [...new Set(picked.flatMap((c) => c.cities ?? []))].sort();
});

const SOURCES = ["telegram"];
const sourceOptions = computed(() => [{ value: "", label: t("all") }, { value: "telegram", label: "Telegram" }]);

const ANY = "__any__";
type Item = { label: string; value: string };
const countryItems = computed<Item[]>(() => meta.value.map((c) => ({ value: c.code, label: c.name })));
const cityItems = computed<Item[]>(() => [{ label: t("cityAny"), value: ANY }, ...cityOptions.value.map((c) => ({ label: c, value: c }))]);
const citySel = computed<string>({ get: () => city.value || ANY, set: (v) => (city.value = v === ANY ? "" : v) });
const remoteItems = computed<Item[]>(() => [
  { label: t("remoteAny"), value: "any" },
  { label: t("remoteYes"), value: "yes" },
  { label: t("remoteNo"), value: "no" },
]);
const remoteSel = computed<string>({ get: () => remote.value, set: (v) => (remote.value = v) });
const SENIORITY_ANY = "__any__";
const seniorityItems = computed<Item[]>(() => [
  { label: t("seniorityAny"), value: SENIORITY_ANY },
  { label: t("seniorityJunior"), value: "junior" },
  { label: t("seniorityMiddle"), value: "middle" },
  { label: t("senioritySenior"), value: "senior" },
  { label: t("seniorityLead"), value: "lead" },
]);
const senioritySel = computed<string>({
  get: () => seniority.value || SENIORITY_ANY,
  set: (v) => (seniority.value = v === SENIORITY_ANY ? "" : v),
});

function readSavedList(key: string, limit = MAX_SAVED): CvProfile[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function persistList(key: string, value: CvProfile[], limit = MAX_SAVED) {
  localStorage.setItem(key, JSON.stringify(value.slice(0, limit)));
}

function loadPersonalState() {
  favorites.value = readSavedList(STORAGE.favorites);
  hidden.value = readSavedList(STORAGE.hidden);
  recent.value = readSavedList(STORAGE.recent, MAX_RECENT);
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

const activeProfiles = computed(() => profiles.value.filter((item) => !hiddenIds.value.has(item.id)));
const displayedProfiles = computed(() => {
  if (view.value === "favorites") return favorites.value;
  if (view.value === "recent") return recent.value;
  if (view.value === "hidden") return hidden.value;
  return activeProfiles.value;
});
const hasMore = computed(() => view.value === "active" && profiles.value.length < total.value);

function currentFilterQuery(): Record<string, string> {
  const queryParams: Record<string, string> = {};
  if (countries.value.length) queryParams.countries = countries.value.join(",");
  if (city.value) queryParams.city = city.value;
  if (remote.value === "yes") queryParams.remote = "1";
  if (remote.value === "no") queryParams.remote = "0";
  if (experienceMin.value != null) queryParams.experienceMin = String(experienceMin.value);
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
  remote.value = params.remote === "1" ? "yes" : params.remote === "0" ? "no" : "any";
  experienceMin.value = Number(queryString(params.experienceMin)) || undefined;
  query.value = queryString(params.query);
  const sourceParam = queryString(params.sources);
  source.value = SOURCES.includes(sourceParam) ? sourceParam : "";
}

async function syncQueryParams() {
  const preserved: Record<string, string> = {};
  for (const key of ["cv", "cvSource", "cvCountry"] as const) {
    const value = queryString(route.query[key]);
    if (value) preserved[key] = value;
  }
  await router.replace({ query: { ...currentFilterQuery(), ...preserved } });
}

const shareUrl = computed(() => {
  const resolved = router.resolve({ path: route.path, query: { ...currentFilterQuery(), shared: "1" } });
  return import.meta.client ? new URL(resolved.href, window.location.origin).toString() : resolved.href;
});

async function copyText(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch { /* fallback below */ }
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  let copied = false;
  try { copied = document.execCommand("copy"); } finally { field.remove(); }
  return copied;
}

async function copyShareLink() { await copyText(shareUrl.value); }

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
  const { data } = await safeFetch<CountryMeta[]>("/hiring-meta");
  if (Array.isArray(data)) {
    meta.value = data;
    if (!countries.value.length) countries.value = data.map((c) => c.code);
  }
}

function scheduleWarmPoll() {
  if (warmTimer) clearTimeout(warmTimer);
  if (!warming.value) return;
  warmTimer = setTimeout(() => { warmTimer = undefined; void load(false, true); }, 1800);
}

async function load(append = false, background = false) {
  const seq = ++loadSeq;
  if (!background) {
    if (append) loadingMore.value = true;
    else loading.value = true;
    failed.value = false;
  }
  const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: append ? String(profiles.value.length) : "0" };
  if (countries.value.length) params.countries = countries.value.join(",");
  if (city.value) params.city = city.value;
  if (remote.value === "yes") params.remote = "1";
  if (remote.value === "no") params.remote = "0";
  if (experienceMin.value != null) params.experienceMin = String(experienceMin.value);
  if (query.value.trim()) params.query = query.value.trim();
  if (seniority.value) params.seniority = seniority.value;
  const skillList = skills.value.split(",").map((s) => s.trim()).filter(Boolean);
  if (skillList.length) params.skills = skillList.join(",");
  params.sources = source.value || SOURCES.join(",");

  const { data, error } = await safeFetch<FeedResult>("/hiring-feed", { params });
  if (seq !== loadSeq) {
    if (append) loadingMore.value = false;
    return;
  }
  if (error || !data || data.error) {
    if (!background) {
      failed.value = true;
      if (!append) { profiles.value = []; total.value = 0; }
      sourceErrors.value = [];
    }
  } else {
    const next = data.profiles || [];
    profiles.value = append
      ? [...new Map([...profiles.value, ...next].map((item) => [item.id, item])).values()]
      : next;
    total.value = data.count ?? profiles.value.length;
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
  city.value = "";
  remote.value = "any";
  experienceMin.value = undefined;
  query.value = "";
  seniority.value = "";
  skills.value = "";
  scheduleLoad(80);
}
function setView(next: HiringView) { view.value = next; }

function toggleFavorite(item: CvProfile) {
  favorites.value = isFavorite(item.id)
    ? favorites.value.filter((saved) => saved.id !== item.id)
    : [item, ...favorites.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED);
  if (isHidden(item.id)) {
    hidden.value = hidden.value.filter((saved) => saved.id !== item.id);
    persistList(STORAGE.hidden, hidden.value);
  }
  persistList(STORAGE.favorites, favorites.value);
}

function toggleHidden(item: CvProfile) {
  hidden.value = isHidden(item.id)
    ? hidden.value.filter((saved) => saved.id !== item.id)
    : [item, ...hidden.value.filter((saved) => saved.id !== item.id)].slice(0, MAX_SAVED);
  if (isFavorite(item.id)) {
    favorites.value = favorites.value.filter((saved) => saved.id !== item.id);
    persistList(STORAGE.favorites, favorites.value);
  }
  persistList(STORAGE.hidden, hidden.value);
}

const active = ref<CvProfile | null>(null);
const modalOpen = ref(false);

function openCv(profile: CvProfile) {
  active.value = profile;
  modalOpen.value = true;
  recent.value = [profile, ...recent.value.filter((item) => item.id !== profile.id)].slice(0, MAX_RECENT);
  persistList(STORAGE.recent, recent.value, MAX_RECENT);
}

function salaryLabel(profile: CvProfile): string | null {
  if (profile.salaryMin == null && profile.salaryMax == null) return null;
  const cur = profile.currency || "";
  if (profile.salaryMin != null && profile.salaryMax != null) {
    return `${profile.salaryMin.toLocaleString()}–${profile.salaryMax.toLocaleString()} ${cur}`.trim();
  }
  const value = profile.salaryMin ?? profile.salaryMax;
  return value != null ? `${value.toLocaleString()} ${cur}`.trim() : null;
}

function specLine(profile: CvProfile): string {
  const parts: string[] = [];
  if (profile.experienceYears != null) parts.push(t("experienceN", { n: profile.experienceYears }));
  if (profile.city) parts.push(profile.city);
  if (profile.remote) parts.push(t("remoteBadge"));
  return parts.join(" · ");
}

const fmtBool = (v?: boolean | null) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const strOr = (v?: string | null) => (v ? v : t("notSpecified"));
const listOr = (v?: string[] | null) => (v?.length ? v.join(", ") : t("notSpecified"));

const specRows = computed(() => {
  const profile = active.value;
  if (!profile) return [];
  return [
    { label: t("specName"), value: strOr(profile.name) },
    { label: t("specRole"), value: strOr(profile.role) },
    { label: t("specExperience"), value: profile.experienceYears != null ? t("experienceN", { n: profile.experienceYears }) : t("notSpecified") },
    { label: t("specSalary"), value: salaryLabel(profile) || t("notSpecified") },
    { label: t("specCity"), value: strOr(profile.city) },
    { label: t("specCountry"), value: strOr(meta.value.find((c) => c.code === profile.country)?.name || profile.country) },
    { label: t("specRemote"), value: fmtBool(profile.remote) },
    { label: t("specEmployment"), value: strOr(profile.employmentType) },
    { label: t("specEducation"), value: strOr(profile.education) },
    { label: t("specLanguages"), value: listOr(profile.languages) },
    { label: t("specSkills"), value: listOr(profile.skills) },
    { label: t("specContact"), value: strOr(profile.contact) },
    { label: t("specSource"), value: profile.source === "telegram" ? "Telegram" : profile.source },
  ];
});

const shareCopied = ref(false);
function makeCvShareLink(profile: CvProfile): string {
  const resolved = router.resolve({
    path: route.path,
    query: { cv: profile.id, cvSource: profile.source, cvCountry: profile.country },
  });
  return new URL(resolved.href, window.location.origin).toString();
}
function showShareSuccess() {
  shareCopied.value = true;
  window.setTimeout(() => { shareCopied.value = false; }, 2000);
}
async function shareCv(profile: CvProfile) {
  const link = makeCvShareLink(profile);
  listingShareUrl.value = link;
  listingShareCopied.value = false;
  const title = `${profile.name} — ${profile.role}`;
  const payload = { title, text: title, url: link };
  if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
    try {
      await navigator.share(payload);
      showShareSuccess();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  listingShareCopied.value = await copyText(link);
  if (listingShareCopied.value) showShareSuccess();
  else listingShareModalOpen.value = true;
}
async function copyListingShareLink() {
  listingShareCopied.value = await copyText(listingShareUrl.value);
  if (listingShareCopied.value) showShareSuccess();
}

async function openSharedCv(id: string, sourceName = "", countryCode = "", attempt = 0) {
  const local = profiles.value.find((profile) => profile.id === id);
  if (local) { openCv(local); return; }
  const params: Record<string, string> = { profileId: id, limit: "1", offset: "0" };
  if (SOURCES.includes(sourceName)) params.sources = sourceName;
  if (/^[A-Za-z]{2}$/.test(countryCode)) params.countries = countryCode.toUpperCase();
  const { data } = await safeFetch<FeedResult>("/hiring-feed", { params });
  const exact = data?.profiles?.find((profile) => profile.id === id);
  if (exact) { openCv(exact); return; }
  if (data?.warming && attempt < 20) {
    if (sharedPostTimer) clearTimeout(sharedPostTimer);
    sharedPostTimer = setTimeout(() => {
      sharedPostTimer = undefined;
      void openSharedCv(id, sourceName, countryCode, attempt + 1);
    }, 1800);
  }
}

function cardBadges(profile: CvProfile): string[] {
  const badges: string[] = [];
  if (profile.remote) badges.push(t("remoteBadge"));
  if (profile.experienceYears != null) badges.push(t("experienceN", { n: profile.experienceYears }));
  for (const skill of (profile.skills || []).slice(0, 4)) badges.push(skill);
  return badges;
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
  const sharedCvId = queryString(route.query.cv);
  const sharedCvSource = queryString(route.query.cvSource);
  const sharedCvCountry = queryString(route.query.cvCountry);
  loadPersonalState();
  applyQueryParams(route.query);
  await loadMeta();
  if (queryString(route.query.shared) === "1") {
    showAdvanced.value = true;
    sharedLinkOpened.value = true;
    shareModalOpen.value = true;
  }
  await load(false);
  if (sharedCvId) await openSharedCv(sharedCvId, sharedCvSource, sharedCvCountry);
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

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  if (warmTimer) clearTimeout(warmTimer);
  if (sharedPostTimer) clearTimeout(sharedPostTimer);
  infiniteObserver?.disconnect();
});
</script>

<template>
  <u-container class="hiring">
    <div class="hiring__header text-center space-y-3">
      <h1 class="hiring__title">{{ t("title") }}</h1>
      <p class="hiring__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
    </div>

    <form class="hiring__controls" @submit.prevent="load()">
      <u-input v-model="query" clearable icon="i-lucide-search" :placeholder="t('searchPlaceholder')" />
      <u-button type="submit" :loading="loading" icon="i-lucide-search">
        {{ loading ? t("searching") : t("search") }}
      </u-button>

      <div class="hiring__row">
        <div class="hiring__filters">
          <button
              v-for="opt in sourceOptions" :key="opt.value" type="button"
              class="hiring__pill" :class="{ 'hiring__pill_active': source === opt.value }"
              @click="selectSource(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <div class="hiring__views" :aria-label="t('personalTabs')">
          <button type="button" class="hiring__pill" :class="{ 'hiring__pill_active': view === 'active' }" @click="setView('active')">
            {{ t("allListings") }}
          </button>
          <button type="button" class="hiring__pill" :class="{ 'hiring__pill_active': view === 'favorites' }" @click="setView('favorites')">
            {{ t("favorites") }} · {{ favorites.length }}
          </button>
          <button type="button" class="hiring__pill" :class="{ 'hiring__pill_active': view === 'recent' }" @click="setView('recent')">
            {{ t("recent") }} · {{ recent.length }}
          </button>
          <button type="button" class="hiring__pill" :class="{ 'hiring__pill_active': view === 'hidden' }" @click="setView('hidden')">
            {{ t("hidden") }} · {{ hidden.length }}
          </button>
        </div>
      </div>

      <div v-if="showAdvanced" class="hiring__advanced">
        <div class="hiring__presets">
          <span class="hiring__field-label">{{ t("presets") }}</span>
          <button v-for="preset in presets" :key="preset.name" type="button" class="hiring__preset" @click="applyPreset(preset)">
            <span>{{ preset.name }}</span>
            <span class="hiring__preset-remove" role="button" :aria-label="t('deletePreset')" @click.stop="removePreset(preset.name)">×</span>
          </button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-bookmark-plus" @click="presetModalOpen = true">
            {{ t("savePreset") }}
          </u-button>
          <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-share-2" @click="sharedLinkOpened = false; shareModalOpen = true">
            {{ t("shareSearch") }}
          </u-button>
        </div>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("country") }}</span>
          <u-select-menu v-model="countries" :items="countryItems" value-key="value" label-key="label"
              multiple :placeholder="t('countryAny')" class="hiring__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("city") }}</span>
          <u-select-menu v-model="citySel" :items="cityItems" value-key="value" label-key="label"
              class="hiring__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("remote") }}</span>
          <u-select-menu v-model="remoteSel" :items="remoteItems" value-key="value" label-key="label"
              :search-input="false" class="hiring__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("experienceMin") }}</span>
          <u-input v-model.number="experienceMin" type="number" min="0" icon="i-lucide-briefcase" @change="scheduleLoad()" />
        </label>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("seniority") }}</span>
          <u-select-menu v-model="senioritySel" :items="seniorityItems" value-key="value" label-key="label"
              :search-input="false" class="hiring__select" @update:model-value="scheduleLoad()" />
        </label>
        <label class="hiring__field">
          <span class="hiring__field-label">{{ t("skills") }}</span>
          <u-input v-model="skills" icon="i-lucide-code" :placeholder="t('skillsPlaceholder')" @change="scheduleLoad()" />
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">
          {{ t("reset") }}
        </u-button>
      </div>
    </form>

    <p v-if="failed" class="hiring__error">{{ t("error") }}</p>
    <p
        v-else-if="source === 'telegram' && !loading && !profiles.length && sourceErrors?.some((item) => item.source === 'telegram')"
        class="hiring__source-warning"
    >{{ t("telegramUnavailable") }}</p>
    <p v-else-if="warming && !loading" class="hiring__warming text-muted">{{ t("warming") }}</p>
    <p v-else class="hiring__count text-muted">{{ t("found", { n: view === 'active' ? total : displayedProfiles.length }) }}</p>

    <div class="hiring__grid" :class="{ 'hiring__grid_loading': loading }">
      <article
          v-for="profile in displayedProfiles" :key="profile.id" class="hiring-card"
          :class="{ 'hiring-card_favorite': isFavorite(profile.id), 'hiring-card_hidden': isHidden(profile.id) }"
          @click="openCv(profile)"
      >
        <div class="hiring-card__avatar">
          <u-icon name="i-lucide-file-user" class="hiring-card__avatar-icon" aria-hidden="true" />
          <span v-if="profile.remote" class="hiring-card__remote">{{ t("remoteBadge") }}</span>
        </div>
        <div class="hiring-card__body">
          <div class="hiring-card__actions">
            <button type="button" class="hiring-card__action" :class="{ 'hiring-card__action_active': isFavorite(profile.id) }" :aria-label="isFavorite(profile.id) ? t('removeFavorite') : t('addFavorite')" @click.stop="toggleFavorite(profile)">
              <u-icon name="i-lucide-heart" />
            </button>
            <button type="button" class="hiring-card__action" :class="{ 'hiring-card__action_active': isHidden(profile.id) }" :aria-label="isHidden(profile.id) ? t('restoreListing') : t('hideListing')" @click.stop="toggleHidden(profile)">
              <u-icon :name="isHidden(profile.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" />
            </button>
          </div>
          <h3 class="hiring-card__title">{{ profile.name }}</h3>
          <div class="hiring-card__role text-muted">{{ profile.role }}</div>
          <div v-if="salaryLabel(profile)" class="hiring-card__salary">{{ salaryLabel(profile) }}</div>
          <div v-if="specLine(profile)" class="hiring-card__spec text-muted">{{ specLine(profile) }}</div>
          <div v-if="cardBadges(profile).length" class="hiring-card__badges">
            <span v-for="badge in cardBadges(profile)" :key="badge" class="hiring-card__badge">{{ badge }}</span>
          </div>
          <div class="hiring-card__meta text-muted">
            <span>{{ profile.source }}</span>
            <span v-if="timeAgo(profile.createdAt)">· {{ timeAgo(profile.createdAt) }}</span>
          </div>
        </div>
      </article>
    </div>

    <div ref="loadMoreSentinel" v-if="hasMore" class="hiring__sentinel">
      <span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span>
    </div>

    <div v-if="!loading && !displayedProfiles.length && !failed" class="hiring__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    <u-modal v-model:open="modalOpen" :title="active?.name || ''" :ui="{ content: 'max-w-3xl' }">
      <template #title>
        <h2 class="hiring-modal__title">{{ active?.name || "" }}</h2>
        <p v-if="active" class="hiring-modal__role">{{ active.role }}</p>
      </template>
      <template #body>
        <div v-if="active" class="hiring-modal">
          <UiSpecTable :rows="specRows" :hide-empty-label="t('hideEmpty')" :empty-value="t('notSpecified')" />
          <details v-if="active.description" class="hiring-modal__descbox" open>
            <summary>{{ t("cvBody") }}</summary>
            <p class="hiring-modal__desc">{{ active.description }}</p>
          </details>
          <div v-if="active.tags?.length" class="hiring-modal__tags">
            <span v-for="tag in active.tags" :key="tag" class="hiring-modal__tag">{{ tag }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <UiModalFooter v-if="active" class="hiring-modal-footer">
          <u-button variant="outline" color="neutral" icon="i-lucide-heart" @click="toggleFavorite(active)">
            {{ isFavorite(active.id) ? t("removeFavorite") : t("addFavorite") }}
          </u-button>
          <u-button variant="outline" color="neutral" :icon="isHidden(active.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" @click="toggleHidden(active)">
            {{ isHidden(active.id) ? t("restoreListing") : t("hideListing") }}
          </u-button>
          <u-button variant="outline" color="neutral" :icon="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'" @click="shareCv(active)">
            {{ shareCopied ? t("shareCopied") : t("share") }}
          </u-button>
          <a class="modal-footer__primary" :href="active.url" target="_blank" rel="noopener noreferrer">{{ t("open") }} →</a>
        </UiModalFooter>
      </template>
    </u-modal>

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
        <p class="hiring-share__hint">{{ sharedLinkOpened ? t("sharedSearchHint") : t("shareSearchHint") }}</p>
        <u-input :model-value="shareUrl" readonly />
      </template>
      <template #footer>
        <u-button icon="i-lucide-copy" @click="copyShareLink">{{ t("copyLink") }}</u-button>
      </template>
    </u-modal>

    <u-modal v-model:open="listingShareModalOpen" :title="t('shareListing')">
      <template #body>
        <p class="hiring-share__hint">{{ t("shareListingHint") }}</p>
        <u-input :model-value="listingShareUrl" readonly />
      </template>
      <template #footer>
        <u-button :icon="listingShareCopied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyListingShareLink">
          {{ listingShareCopied ? t("shareCopied") : t("copyLink") }}
        </u-button>
      </template>
    </u-modal>
  </u-container>
</template>

<style scoped>
.hiring { padding-top: 24px; padding-bottom: 96px; }
.hiring__title { font-size: 32px; font-weight: 600; }
.hiring__subtitle { max-width: 720px; font-size: 14px; }
.hiring__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: 1fr auto; align-items: start; }
.hiring__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.hiring__filters, .hiring__views { display: flex; flex-wrap: wrap; gap: 8px; }
.hiring__views { padding-left: 12px; border-left: 1px solid var(--line); }
.hiring__pill {
  height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px;
  text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease;
}
.hiring__pill:hover { color: var(--text-white); }
.hiring__pill_active { color: var(--text-white); border-color: rgba(113,137,217,0.45); background: rgba(113,137,217,0.18); }
.hiring__advanced {
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end; grid-template-columns: 1fr;
  padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.hiring__presets {
  grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
}
.hiring__preset {
  display: inline-flex; align-items: center; gap: 8px; min-height: 32px; padding: 0 8px 0 11px;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-primary); cursor: pointer;
}
.hiring__preset-remove { color: var(--text-muted); font-size: 18px; line-height: 1; }
.hiring__preset-remove:hover { color: var(--accent-pink); }
@media (min-width: 700px) { .hiring__advanced { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1000px) { .hiring__advanced { grid-template-columns: repeat(4, 1fr); } }
.hiring__field { display: flex; flex-direction: column; gap: 5px; }
.hiring__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.hiring__select { width: 100%; }
.hiring__select :deep(button) { width: 100%; }
.hiring__error { color: var(--ui-error, #f87171); }
.hiring__source-warning { color: #f6c177; font-size: 13px; margin-bottom: 12px; }
.hiring__warming { font-size: 13px; margin-bottom: 12px; }
.hiring__count { font-size: 13px; margin-bottom: 12px; }
.hiring__grid { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: stretch; }
@media (min-width: 640px) { .hiring__grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .hiring__grid { grid-template-columns: repeat(3, 1fr); } }
.hiring__grid_loading { opacity: 0.4; pointer-events: none; }
.hiring-card {
  border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.03);
  cursor: pointer; transition: transform 140ms ease, border-color 180ms ease; display: flex; gap: 0;
}
.hiring-card:hover { transform: translateY(-2px); border-color: rgba(113,137,217,0.45); }
.hiring-card__avatar {
  width: 88px; flex: 0 0 88px; display: grid; place-items: center; position: relative;
  background: rgba(113,137,217,0.08); border-right: 1px solid var(--line);
}
.hiring-card__avatar-icon { width: 36px; height: 36px; opacity: 0.55; color: #7189d9; }
.hiring-card__remote {
  position: absolute; top: 8px; left: 8px; font-size: 10px; padding: 2px 6px; border-radius: 6px;
  background: rgba(13,17,40,0.85); color: #7189d9;
}
.hiring-card__body { position: relative; flex: 1; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
.hiring-card__actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 5px; }
.hiring-card__action {
  width: 29px; height: 29px; display: inline-grid; place-items: center; padding: 0;
  border: 1px solid var(--line); border-radius: 6px; background: var(--bg-panel); color: var(--text-muted); cursor: pointer;
}
.hiring-card__action:hover, .hiring-card__action_active { color: #7189d9; border-color: rgba(113,137,217,0.48); }
.hiring-card__title { font-size: 14px; font-weight: 600; line-height: 1.35; padding-right: 70px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hiring-card__role { font-size: 12.5px; line-height: 1.35; padding-right: 70px; }
.hiring-card__salary { font-weight: 700; font-size: 14px; color: var(--text-white, inherit); }
.hiring-card__spec { font-size: 12px; }
.hiring-card__badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
.hiring-card__badge {
  font-size: 10.5px; font-weight: 600; padding: 4px 7px; border-radius: 999px;
  border: 1px solid var(--line); background: rgba(255,255,255,0.05); color: var(--text-primary); white-space: nowrap;
}
.hiring-card__meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11.5px; margin-top: 2px; text-transform: capitalize; }
.hiring__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }
.hiring__sentinel { min-height: 44px; display: grid; place-items: center; }
.hiring-card_favorite { border-color: rgba(113,137,217,0.5); }
.hiring-card_hidden { opacity: 0.64; border-style: dashed; }
.hiring-modal { display: flex; flex-direction: column; gap: 12px; }
.hiring-modal__title { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.35; padding-right: 36px; }
.hiring-modal__name { font-size: 14px; color: var(--text-muted); }
.hiring-modal__salary { font-weight: 700; font-size: 18px; }
.hiring-modal__descbox summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.8; user-select: none; }
.hiring-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); margin-top: 8px; }
.hiring-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.hiring-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
/* Footer action layout now lives in components/ui/ModalFooter.vue, shared with
   the flat and vacancy popups. */
/* Only the accent differs from the other popups; the layout is shared. */
.hiring-modal-footer { --modal-footer-accent: #7189d9; --modal-footer-accent-text: #101428; }
.hiring-share__hint { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
@media (max-width: 700px) {
  .hiring__controls { grid-template-columns: 1fr; }
  .hiring__controls > :deep(button) { width: 100%; }
  .hiring__views { padding-left: 0; border-left: 0; }
}
</style>
