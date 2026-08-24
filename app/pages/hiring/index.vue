<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { locationLabel } from "~/utils/locationLabels";
import CandidateCard from "~/components/hiring/CandidateCard.vue";
import CandidateGrid from "~/components/hiring/CandidateGrid.vue";
import SearchDetailsModal from "~/components/search/SearchDetailsModal.vue";
import SearchPageShell from "~/components/search/SearchPageShell.vue";
import SearchSavedTabs from "~/components/search/SearchSavedTabs.vue";
import SearchFilterPanel from "~/components/search/SearchFilterPanel.vue";
import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";
import { useHiringFilters } from "~/composables/hiring/useHiringFilters";
import { useHiringFilterBlocks } from "~/composables/hiring/useHiringFilterBlocks";
import { useHiringFeed } from "~/composables/hiring/useHiringFeed";
import { useHiringMatch } from "~/composables/hiring/useHiringMatch";
import { useHiringRouteState } from "~/composables/hiring/useHiringRouteState";
import { useHiringMeta } from "~/composables/hiring/useHiringMeta";
import { useSavedCollections } from "~/composables/search/useSavedCollections";
import { useLatestRequest } from "~/composables/search/useLatestRequest";
import { useInfiniteFeed } from "~/composables/search/useInfiniteFeed";
import { ANY_SELECT_VALUE, useNullableSelect } from "~/composables/search/useNullableSelect";
import {
  type HiringCvProfile as CvProfile,
  type HiringFeedResult as FeedResult,
  type HiringSourceOption as SourceOption,
  type HiringView,
} from "~/types/hiring";
import { queryString } from "~/utils/queryParams";
import { hiringProfessionLocale } from "~~/shared/hiringProfessionLabels";
import {
  hiringProfessionFilterLabel,
} from "~~/shared/hiringProfessionGroups";

// Hiring board — CV/resume profiles from candidates looking for work.
// Auto-routed at /hiring. UI follows /flat-finder; data from /hiring-feed.

const PAGE_SIZE = 20;
const STORAGE = {
  presets: "hiring:presets:v1",
};

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) => translate(`hiring.${key}`, params);
const route = useRoute();
const router = useRouter();
const professionLocale = computed(() => hiringProfessionLocale(locale.value));
const cityLabel = (value?: string | null) => locationLabel(value, String(locale.value), "city");

useSeoMeta({
  title: () => t("seoTitle"),
  description: () => t("seoDescription"),
  robots: () => "index, follow",
  ogType: () => "website",
  ogTitle: () => t("seoTitle"),
  ogDescription: () => t("seoDescription"),
});

const hiringFilters = useHiringFilters();
const {
  countries, city, remote, experienceMin, salaryFrom, salaryTo, salaryCurrency, sort,
  ageMin, ageMax, gender, professions, professionValues, query, seniority, skills, source,
  showAdvanced, buildFeedParams, resetValues: resetFilterValues,
} = hiringFilters;

const {
  profiles, total, loading, loadingMore, filtersPending, warming, failed,
  sourceErrors, usdRates, fetchFeed,
} = useHiringFeed();
const view = ref<HiringView>("active");
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
  load: loadSavedCollections,
} = useSavedCollections<CvProfile>({
  namespace: "hiring",
  getId: (item) => item.id,
  favoritesLimit: 200,
  hiddenLimit: 200,
  recentLimit: 30,
});
const presetModalOpen = ref(false);
const shareModalOpen = ref(false);
const sharedLinkOpened = ref(false);
const listingShareModalOpen = ref(false);
const listingShareUrl = ref("");
const listingShareCopied = ref(false);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const { next: nextLoadRequest, isLatest: isLatestLoadRequest } = useLatestRequest();
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let sharedPostTimer: ReturnType<typeof setTimeout> | undefined;

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

const relevantSourceErrors = computed(() => (sourceErrors.value || []).filter((item) => {
  if (countries.value.length && item.country && !countries.value.includes(item.country.toUpperCase())) return false;

  const selected = source.value.toLowerCase();
  const failedSource = String(item.source || "").toLowerCase();
  const isWeb = failedSource !== "telegram" || /^web:/i.test(item.handle || "");
  if (!selected) return true;
  if (selected === "web") return isWeb;
  if (selected === "telegram") return !isWeb;
  return failedSource === selected;
}));
const hasSourceWarning = computed(() =>
  !loading.value && !profiles.value.length && relevantSourceErrors.value.length > 0
);
const sourceWarningKey = computed(() => {
  if (source.value === "telegram") return "telegramUnavailable";
  if (source.value === "web") return "webUnavailable";
  if (source.value) return "sourceUnavailable";
  return "sourcesUnavailable";
});

const { meta, countryItems, cityItems, salaryCurrencyItems, loadMeta } = useHiringMeta({
  countries,
  city,
  locale,
  t,
  cityLabel,
});

const availableSources = ref<SourceOption[]>([]);
const sourceOptions = computed<SourceOption[]>(() => [
  { value: "", label: t("all") },
  ...availableSources.value,
]);

type Item = { label: string; value: string };
const citySel = useNullableSelect(city);
const remoteItems = computed<Item[]>(() => [
  { label: t("remoteAny"), value: "any" },
  { label: t("remoteYes"), value: "yes" },
  { label: t("remoteNo"), value: "no" },
]);
const genderItems = computed<Item[]>(() => [
  { label: t("genderAny"), value: ANY_SELECT_VALUE },
  { label: t("genderMale"), value: "male" },
  { label: t("genderFemale"), value: "female" },
  { label: t("genderUnknown"), value: "unknown" },
]);
const genderSel = useNullableSelect(gender);
const professionItems = computed<Item[]>(() => professionValues.value
  .map((value) => ({ value, label: hiringProfessionFilterLabel(value, professionLocale.value) }))
  .sort((a, b) => a.label.localeCompare(b.label, professionLocale.value)));
const seniorityItems = computed<Item[]>(() => [
  { label: t("seniorityAny"), value: ANY_SELECT_VALUE },
  { label: t("seniorityJunior"), value: "junior" },
  { label: t("seniorityMiddle"), value: "middle" },
  { label: t("senioritySenior"), value: "senior" },
  { label: t("seniorityLead"), value: "lead" },
]);
const senioritySel = useNullableSelect(seniority);
const sortItems = computed<Item[]>(() => [
  { value: "recent", label: t("sortRecent") },
  { value: "name_asc", label: t("sortNameAsc") },
  { value: "name_desc", label: t("sortNameDesc") },
  { value: "experience_desc", label: t("sortExperienceDesc") },
  { value: "experience_asc", label: t("sortExperienceAsc") },
  { value: "age_asc", label: t("sortAgeAsc") },
  { value: "age_desc", label: t("sortAgeDesc") },
  { value: "salary_desc", label: t("sortSalaryDesc") },
  { value: "salary_asc", label: t("sortSalaryAsc") },
]);

const hiringFilterBlocks = useHiringFilterBlocks({
  t,
  filters: hiringFilters,
  citySelect: citySel,
  genderSelect: genderSel,
  senioritySelect: senioritySel,
  countryItems,
  cityItems,
  remoteItems,
  salaryCurrencyItems,
  genderItems,
  seniorityItems,
  scheduleLoad,
});

function loadPersonalState() {
  loadSavedCollections();
  loadPresets();
}

const activeProfiles = computed(() => profiles.value.filter((item) => !hiddenIds.value.has(item.id)));
const {
  canonicalSkillValues,
  canonicalSkillQuery,
  candidateMatchFilters,
  matchesLocally,
} = useHiringMatch({
  countries, city, remote, experienceMin, ageMin, ageMax, gender, professions, seniority, skills, source,
});

/**
 * The same filters the server applies, over what is already on screen.
 *
 * Changing a filter used to blank the grid until the round trip came back.
 * The loaded page can answer most of it immediately — everything except full
 * text search, which stays the server's job — so the visible list narrows on
 * the keystroke and is replaced by the authoritative result when it lands.
 */
const displayedProfiles = computed(() => {
  if (view.value === "favorites") return favorites.value;
  if (view.value === "recent") return recent.value;
  if (view.value === "hidden") return hidden.value;
  // While a filter change is on its way to the server, show the subset that
  // already satisfies it rather than a dimmed copy of the previous result.
  return filtersPending.value ? activeProfiles.value.filter(matchesLocally) : activeProfiles.value;
});
const hasMore = computed(() => view.value === "active" && profiles.value.length < total.value);
useInfiniteFeed({
  sentinel: loadMoreSentinel,
  hasMore,
  loading: computed(() => loading.value || loadingMore.value),
  loadMore: () => load(true),
  rootMargin: "500px 0px",
});

const hiringRouteState = useHiringRouteState({ router, route, filters: hiringFilters, skillQuery: canonicalSkillQuery });
function currentFilterQuery(): Record<string, string> { return hiringRouteState.serialize(); }
function applyQueryParams(params: Record<string, unknown>) { hiringRouteState.deserialize(params); }

function activeCvSource(profile: CvProfile): string {
  return profile.sourceKey || profile.origin || profile.source;
}

function activeCvQuery(profile: CvProfile): Record<string, string> {
  return {
    cv: profile.id,
    cvSource: activeCvSource(profile),
    ...(profile.country ? { cvCountry: profile.country } : {}),
  };
}

const { schedule: scheduleQuerySync } = hiringRouteState;

async function syncActiveCvQuery(profile: CvProfile | null) {
  await router.replace({
    query: profile
      ? { ...currentFilterQuery(), ...activeCvQuery(profile) }
      : currentFilterQuery(),
  });
}

const shareUrl = computed(() => {
  const resolved = router.resolve({ path: route.path, query: { ...currentFilterQuery(), shared: "1" } });
  return import.meta.client ? new URL(resolved.href, window.location.origin).toString() : resolved.href;
});

async function copyShareLink() { await copyText(shareUrl.value); }

function savePreset() {
  if (saveSearchPreset()) presetModalOpen.value = false;
}

function scheduleWarmPoll() {
  if (warmTimer) clearTimeout(warmTimer);
  if (!warming.value) return;
  warmTimer = setTimeout(() => { warmTimer = undefined; void load(false, true); }, 1800);
}

async function load(append = false, background = false) {
  const requestId = nextLoadRequest();
  if (!background) {
    if (append) loadingMore.value = true;
    // A filter change already has something to show; dimming the grid for it
    // is what made filtering feel slow even when the answer was quick.
    else loading.value = !profiles.value.length;
    failed.value = false;
  }
  const params = buildFeedParams({
    limit: PAGE_SIZE,
    offset: append ? profiles.value.length : 0,
    skillQuery: canonicalSkillQuery(),
  });

  const { data, error } = await fetchFeed(params);
  if (!isLatestLoadRequest(requestId)) {
    if (append) loadingMore.value = false;
    return;
  }
  if (error || !data || data.error) {
    if (!background) {
      // A failed request is usually a redeploy restarting the server. Throwing
      // away the board for it turns a blip into an empty page; keep what is on
      // screen and only admit failure when there is nothing to keep.
      failed.value = !profiles.value.length;
      sourceErrors.value = [];
    }
  } else {
    const next = data.profiles || [];
    profiles.value = append
      ? [...new Map([...profiles.value, ...next].map((item) => [item.id, item])).values()]
      : next;
    total.value = data.count ?? profiles.value.length;
    sourceErrors.value = data.sourceErrors || [];
    if (data.rates && typeof data.rates === "object") usdRates.value = data.rates;
    warming.value = !!data.warming;
    if (data.meta?.professions?.length) professionValues.value = data.meta.professions;
    if (data.meta?.sources?.length) availableSources.value = data.meta.sources;
  }
  if (!background) {
    loading.value = false;
    loadingMore.value = false;
    filtersPending.value = false;
  }
  if (!append && !background) void syncQueryParams();
  scheduleWarmPoll();
}

function scheduleLoad(delay = 250) {
  if (loadTimer) clearTimeout(loadTimer);
  // Narrow what is on screen straight away; the request only confirms it and
  // brings in whatever else matches beyond the loaded page.
  filtersPending.value = true;
  loadTimer = setTimeout(() => { loadTimer = undefined; void load(false); }, delay);
  scheduleQuerySync(Math.min(delay, 160));
}
function clearSearch() {
  query.value = "";
  scheduleLoad(0);
}
function selectSource(v: string) {
  if (source.value === v) return;
  source.value = v;
  scheduleLoad(80);
}
function resetFilters() {
  resetFilterValues();
  scheduleLoad(80);
}
function clearProfessions() {
  if (!professions.value.length) return;
  professions.value = [];
  scheduleLoad(0);
}
function setView(next: string) { view.value = next as HiringView; }

const active = ref<CvProfile | null>(null);
const modalOpen = ref(false);

function openCv(profile: CvProfile) {
  active.value = profile;
  modalOpen.value = true;
  addRecent(profile);
  void syncActiveCvQuery(profile);
}

function salaryLabel(profile: CvProfile): string | null {
  if (profile.salaryMin == null && profile.salaryMax == null) return null;
  const cur = profile.currency || "";
  if (profile.salaryMin != null && profile.salaryMax != null) {
    if (profile.salaryMin === profile.salaryMax) {
      return `${profile.salaryMin.toLocaleString()} ${cur}`.trim();
    }
    return `${profile.salaryMin.toLocaleString()}–${profile.salaryMax.toLocaleString()} ${cur}`.trim();
  }
  const value = profile.salaryMin ?? profile.salaryMax;
  return value != null ? `${value.toLocaleString()} ${cur}`.trim() : null;
}

function genderLabel(value?: CvProfile["gender"]): string {
  if (value === "male") return t("genderMale");
  if (value === "female") return t("genderFemale");
  return t("notSpecified");
}

function experienceLabel(years: number): string {
  if (years === 0) return t("experienceNone");
  const value = new Intl.NumberFormat(String(locale.value), { maximumFractionDigits: 1 }).format(years);
  return t("experienceN", { n: value });
}

function specLine(profile: CvProfile): string {
  const parts: string[] = [];
  if (profile.age != null) parts.push(`${profile.age}`);
  if (profile.experienceYears != null) parts.push(experienceLabel(profile.experienceYears));
  if (profile.city) parts.push(cityLabel(profile.city));
  if (profile.remote) parts.push(t("remoteBadge"));
  return parts.join(" · ");
}

const fmtBool = (v?: boolean | null) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const strOr = (v?: string | null) => (v ? v : t("notSpecified"));
const listOr = (v?: string[] | null) => (v?.length ? v.join(", ") : t("notSpecified"));
const employmentLabel = (value?: string | null) => value
  ? value.split(",").map((item) => {
      const key = item.trim();
      if (key === "full_time") return t("employmentFull");
      if (key === "part_time") return t("employmentPart");
      return key;
    }).join(", ")
  : t("notSpecified");

const specRows = computed(() => {
  const profile = active.value;
  if (!profile) return [];
  return [
    { label: t("specName"), value: strOr(profile.name), empty: !profile.name },
    { label: t("specRole"), value: strOr(profile.role), empty: !profile.role },
    { label: t("age"), value: profile.age != null ? String(profile.age) : t("notSpecified"), empty: profile.age == null },
    { label: t("gender"), value: genderLabel(profile.gender), empty: !profile.gender },
    { label: t("specExperience"), value: profile.experienceYears != null ? experienceLabel(profile.experienceYears) : t("notSpecified"), empty: profile.experienceYears == null },
    { label: t("specSalary"), value: salaryLabel(profile) || t("notSpecified"), empty: profile.salaryMin == null && profile.salaryMax == null },
    { label: t("specCity"), value: profile.city ? cityLabel(profile.city) : t("notSpecified"), empty: !profile.city },
    { label: t("specCountry"), value: strOr(meta.value.find((c) => c.code === profile.country)?.name || profile.country) },
    { label: t("specRemote"), value: fmtBool(profile.remote), empty: profile.remote == null },
    { label: t("specContactHours"), value: strOr(profile.contactHours), empty: !profile.contactHours },
    { label: t("specEmployment"), value: employmentLabel(profile.employmentType), empty: !profile.employmentType },
    { label: t("specEducation"), value: strOr(profile.education), empty: !profile.education },
    { label: t("specLanguages"), value: listOr(profile.languages), empty: !profile.languages?.length },
    { label: t("specSkills"), value: listOr(profile.skills), empty: !profile.skills?.length },
    { label: t("specContact"), value: strOr(profile.contact), empty: !profile.contact },
    { label: t("specSource"), value: profile.sourceLabel || (profile.source === "telegram" ? "Telegram" : profile.source) },
  ];
});

const shareCopied = ref(false);
function makeCvShareLink(profile: CvProfile): string {
  const resolved = router.resolve({
    path: route.path,
    query: { ...currentFilterQuery(), ...activeCvQuery(profile) },
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
  if (sourceName) params.sources = sourceName;
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

/**
 * Cards from the CV boards are often only a role, a city and an age: at three
 * columns that leaves most of each card empty. When the page is mostly such
 * cards, a fourth column fits without crowding anything.
 */
const denseGrid = computed(() => {
  const cards = displayedProfiles.value;
  if (cards.length < 4) return false;
  const rich = cards.filter((profile) => {
    let filled = 0;
    if (profile.name && profile.role) filled += 1;
    if (salaryLabel(profile)) filled += 1;
    if (specLine(profile)) filled += 1;
    if (new Set([...(profile.skills || []), ...(profile.tags || [])]).size >= 3) filled += 1;
    // All four, not most of them: a card without a salary line already leaves
    // a third of its height empty at three columns.
    return filled === 4;
  }).length;
  return rich / cards.length < 0.5;
});

function profileCountryCurrency(profile: CvProfile): string {
  return meta.value.find((country) => country.code === profile.country)?.currency || "";
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
});

watch(modalOpen, (isOpen) => {
  if (isOpen) return;
  active.value = null;
  void syncActiveCvQuery(null);
});

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  if (warmTimer) clearTimeout(warmTimer);
  if (sharedPostTimer) clearTimeout(sharedPostTimer);
});
</script>

<template>
  <SearchPageShell
    class-name="hiring"
    :title="t('title')"
  >
    <template #header>
      <div class="hiring__header text-center space-y-3">
        <h1 class="hiring__title">{{ t("title") }}</h1>
        <p class="hiring__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
      </div>
    </template>

    <UiResultsLoader :loading="loading" :label="t('searching')" min-height="420px">
    <SearchFilterPanel tag="form" class="hiring__controls" @submit="load()">
      <u-input v-model="query" clearable icon="i-lucide-search" :label="t('search')" :placeholder="t('searchPlaceholder')" @clear="clearSearch" />
      <UiSortSelect v-model="sort" :items="sortItems" :label="t('sort')" @update:model-value="scheduleLoad(0)" />
      <u-button type="submit" icon="i-lucide-search">
        {{ t("search") }}
      </u-button>

      <div class="hiring__row">
        <div class="hiring__filters">
          <button
              v-for="opt in sourceOptions" :key="opt.value" type="button"
              class="hiring__pill" :class="{ 'hiring__pill_active': source === opt.value }"
              @click="selectSource(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <SearchSavedTabs
          :model-value="view"
          :items="viewTabs"
          :aria-label="t('personalTabs')"
          @update:model-value="setView"
        />
      </div>

      <div v-if="showAdvanced" class="hiring__advanced">
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

        <SearchFilterBlocks :blocks="hiringFilterBlocks" class="hiring__filter-blocks">
          <template #field-professions>
            <div class="hiring__profession-field">
              <u-select-menu :label="t('desiredPositions')" v-model="professions" :items="professionItems" value-key="value" label-key="label" multiple searchable :placeholder="t('anyPositions')" class="hiring__select" @update:model-value="scheduleLoad()" />
              <button v-if="professions.length" type="button" class="hiring__profession-clear" @click="clearProfessions"><u-icon name="i-lucide-x" /> {{ t("clearPositions") }} · {{ professions.length }}</button>
            </div>
          </template>
        </SearchFilterBlocks>

        <UiFilterFooter
          class="hiring-filter-actions"
          :summary="t('found', { n: view === 'active' ? total : displayedProfiles.length })"
          :reset-label="t('reset')"
          @reset="resetFilters"
        />
      </div>
    </SearchFilterPanel>

    <p v-if="failed" class="hiring__error">{{ t("error") }}</p>
    <p v-else-if="hasSourceWarning" class="hiring__source-warning">
      {{ t(sourceWarningKey, { n: relevantSourceErrors.length }) }}
    </p>
    <p v-else-if="warming && !loading" class="hiring__warming text-muted">{{ t("warming") }}</p>
    <HiringStatsPanel
      v-if="displayedProfiles.length"
      :profiles="displayedProfiles"
      :rates="usdRates"
    />
    <CandidateGrid :profiles="displayedProfiles" :dense="denseGrid">
      <template #default="{ profile }">
      <CandidateCard
        :key="profile.id"
        :profile="profile"
        :favorite="isFavorite(profile.id)"
        :hidden="isHidden(profile.id)"
        :rates="usdRates"
        :country-currency="profileCountryCurrency(profile)"
        :match-filters="candidateMatchFilters"
        @open="openCv(profile)"
        @toggle-favorite="toggleFavorite(profile)"
        @toggle-hidden="toggleHidden(profile)"
      />
      </template>
    </CandidateGrid>
<div ref="loadMoreSentinel" v-if="hasMore" class="hiring__sentinel">
      <span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span>
    </div>

    <div v-if="!loading && !displayedProfiles.length && !failed" class="hiring__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    </UiResultsLoader>

    <SearchDetailsModal v-model:open="modalOpen" :title="active?.name || active?.role || t('notSpecified')" :ui="{ content: 'max-w-3xl' }">
      <template #title>
        <h2 class="hiring-modal__title">{{ active?.name || active?.role || t("notSpecified") }}</h2>
        <p v-if="active?.name && active?.role" class="hiring-modal__role">{{ active.role }}</p>
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
    </SearchDetailsModal>

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
  </SearchPageShell>
</template>

<style scoped>
.hiring { position: relative; isolation: isolate; padding-top: 24px; padding-bottom: 96px; }
.hiring__header { position: relative; z-index: 1; }
.hiring__title { font-size: 32px; font-weight: 600; }
.hiring__subtitle { max-width: 720px; font-size: 14px; }
.hiring__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr) minmax(220px, 280px) auto; align-items: start; }
.hiring__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.hiring__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.hiring__pill {
  height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px;
  text-transform: capitalize; cursor: pointer; transition: filter 180ms ease, color 180ms ease;
}
.hiring__pill:hover { color: var(--text-white); }
.hiring__pill_active { color: var(--text-white); border-color: rgba(113,137,217,0.45); background: rgba(113,137,217,0.18); }
.hiring__advanced {
  position: relative; isolation: isolate; overflow: hidden;
  grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; gap: 12px;
  padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}
.hiring__advanced::before,
.hiring__advanced::after {
  content: "";
  position: absolute;
  z-index: 2;
  border-radius: 999px;
  border: 1px solid rgba(75, 145, 255, 0.12);
  pointer-events: none;
}
.hiring__advanced::before {
  width: 8px; height: 8px; left: calc(50% - 4px); top: 49%;
  box-shadow: 0 -142px 0 -2px rgba(67, 119, 221, 0.08);
}
.hiring__advanced::after {
  width: 6px; height: 6px; right: 1.4%; top: 24%;
  border-color: rgba(207, 92, 220, 0.11);
  box-shadow: 0 250px 0 -1px rgba(118, 83, 226, 0.07);
}
.hiring__advanced > * { position: relative; z-index: 1; }
.hiring__filter-blocks { grid-column: 1 / -1; }
.hiring__filter-blocks :deep(.search-filter-blocks__grid) { align-items: end; }
.hiring-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
@media (min-width: 700px) {
  .hiring__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hiring-filter-group__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hiring-filter-group__grid_salary { grid-template-columns: minmax(0, 1.5fr) minmax(110px, .6fr); }
  .hiring__field_wide { grid-column: span 2; }
  .hiring-filter-actions { grid-column: 1 / -1; }
}
.hiring__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.hiring__age-range, .hiring__salary-range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.hiring__profession-clear {
  align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 2px 0; border: 0;
  background: transparent; color: var(--accent-pink); font-size: 11px; font-weight: 700; cursor: pointer;
}
.hiring__profession-clear:hover { text-decoration: underline; }
.hiring__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.hiring__select { width: 100%; min-width: 0; }
.hiring__select :deep(button) { width: 100%; min-width: 0; }
.hiring__error { color: var(--ui-error, #f87171); }
.hiring__source-warning { color: #f6c177; font-size: 13px; margin-bottom: 12px; }
.hiring__warming { font-size: 13px; margin-bottom: 12px; }
.hiring__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-panel); }
.hiring__sentinel { min-height: 44px; display: grid; place-items: center; }
.hiring-modal { display: flex; flex-direction: column; gap: 12px; }
.hiring-modal__title { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.35; padding-right: 36px; }
.hiring-modal__name { font-size: 14px; color: var(--text-muted); }
.hiring-modal__salary { font-weight: 700; font-size: 18px; }
.hiring-modal__descbox summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.8; user-select: none; }
.hiring-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); margin-top: 8px; }
.hiring-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.hiring-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.hiring-share__hint { margin: 0 0 12px; color: var(--text-muted); font-size: 13px; line-height: 1.5; }
@media (max-width: 700px) {
  .hiring__controls { grid-template-columns: 1fr; }
  .hiring__controls > :deep(button) { width: 100%; }
  .hiring__age-range, .hiring__salary-range { grid-template-columns: 1fr 1fr; }
}
</style>
