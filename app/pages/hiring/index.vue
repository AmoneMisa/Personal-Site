<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { locationLabel } from "~/utils/locationLabels";
import { capitalizeFirst } from "~/utils/text";
import CandidateCard from "~/components/hiring/CandidateCard.vue";
import SearchResultGrid from "~/components/search/SearchResultGrid.vue";
import SearchDetailsModal from "~/components/search/SearchDetailsModal.vue";
import SearchPageShell from "~/components/search/SearchPageShell.vue";
import SearchSavedTabs from "~/components/search/SearchSavedTabs.vue";
import SearchFilterPanel from "~/components/search/SearchFilterPanel.vue";
import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";
import SearchAdvancedFilters from "~/components/search/SearchAdvancedFilters.vue";
import SearchPresetDialog from "~/components/search/SearchPresetDialog.vue";
import SearchShareDialog from "~/components/search/SearchShareDialog.vue";
import SearchSourceTabs from "~/components/search/SearchSourceTabs.vue";
import SearchEmptyState from "~/components/search/SearchEmptyState.vue";
import { useHiringFilters } from "~/composables/hiring/useHiringFilters";
import { useHiringFilterBlocks } from "~/composables/hiring/useHiringFilterBlocks";
import { useHiringFeed } from "~/composables/hiring/useHiringFeed";
import { useHiringMatch } from "~/composables/hiring/useHiringMatch";
import { useHiringRouteState } from "~/composables/hiring/useHiringRouteState";
import { useHiringMeta } from "~/composables/hiring/useHiringMeta";
import { useSavedCollections } from "~/composables/search/useSavedCollections";
import { useInfiniteFeed } from "~/composables/search/useInfiniteFeed";
import { ANY_SELECT_VALUE, useNullableSelect } from "~/composables/search/useNullableSelect";
import { useShareLink } from "~/composables/search/useShareLink";
import { regionalSearchCountry } from "~/utils/search/regionalCountry";
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
import { publicEntityId } from "~~/shared/publicEntityId";

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
const defaultCountry = ref("UA");
const professionLocale = computed(() => hiringProfessionLocale(locale.value));
const cityLabel = (value?: string | null) => locationLabel(value, String(locale.value), "city");
const candidatePublicId = (profile: CvProfile | null) => profile
  ? profile.publicId ?? publicEntityId("candidate", profile.sourceKey || profile.source, profile.country, profile.id)
  : null;

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
  profiles, total, statistics, loading, loadingMore, filtersPending, warming, failed,
  sourceErrors, usdRates, loadFeed,
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
const loadMoreSentinel = ref<HTMLElement | null>(null);
let loadTimer: ReturnType<typeof setTimeout> | undefined;
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
  preferredCountry: () => defaultCountry.value,
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

const hiringRouteState = useHiringRouteState({ router, route, filters: hiringFilters, skillQuery: canonicalSkillQuery, defaultCountry: () => defaultCountry.value });
function currentFilterQuery(): Record<string, string> { return hiringRouteState.serialize(); }
function applyQueryParams(params: Record<string, unknown>) { hiringRouteState.deserialize(params); }

// The publicId is a stable, source-independent key (an FNV hash of
// source+country+id, the same formula the server stamps on every profile),
// so it alone identifies a candidate — no cv/cvSource/cvCountry triple needed.
function activeCvQuery(profile: CvProfile): Record<string, string> {
  return { adv: String(candidatePublicId(profile)) };
}

const { schedule: scheduleQuerySync, sync: syncQueryParams } = hiringRouteState;

async function syncActiveCvQuery(profile: CvProfile | null) {
  // currentFilterQuery() only re-derives the filter keys, so the ?page= scroll
  // bookmark (not a filter) has to be carried over explicitly or opening/
  // closing a profile would silently drop it from the address bar.
  const pageParam = queryString(route.query.page);
  await router.replace({
    query: {
      ...currentFilterQuery(),
      ...(pageParam ? { page: pageParam } : {}),
      ...(profile ? activeCvQuery(profile) : {}),
    },
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

// A URL bookmark of how many PAGE_SIZE batches are loaded, mirroring flats:
// the feed itself stays offset-based infinite scroll under the hood, but a
// shared ?page=n link restores roughly how far a visitor had scrolled.
const pageRestoring = ref(true);
function currentPageNumber(): number { return Math.max(1, Math.ceil(profiles.value.length / PAGE_SIZE)); }
async function syncPageInUrl(pageNumber: number) {
  if (import.meta.server) return;
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(route.query)) {
    const text = queryString(value);
    if (text) query[key] = text;
  }
  if (pageNumber > 1) query.page = String(pageNumber);
  else delete query.page;
  await router.replace({ query });
}
async function load(append = false, background = false) {
  const params = buildFeedParams({
    limit: PAGE_SIZE,
    offset: append ? profiles.value.length : 0,
    skillQuery: canonicalSkillQuery(),
  });
  const data = await loadFeed(params, { append, background });
  if (!data) return;
  // Both syncs write route.query via router.replace. Sequencing them (page
  // first, filters last via syncQueryParams below) instead of firing both
  // unawaited makes the filter sync the one true final write, rather than
  // relying on Vue Router happening to settle them in call order.
  if (!background && !pageRestoring.value) await syncPageInUrl(currentPageNumber());
  if (data.meta?.professions?.length) professionValues.value = data.meta.professions;
  if (data.meta?.sources?.length) availableSources.value = data.meta.sources;
  if (!append && !background) await syncQueryParams();
}
async function restoreToPage(targetPage: number) {
  let guard = 0;
  while (hasMore.value && profiles.value.length < targetPage * PAGE_SIZE && guard < 50) {
    await load(true, false);
    guard += 1;
  }
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
  countries.value = [defaultCountry.value];
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

type CandidateSpecGroup = "identity" | "location" | "preferences" | "qualifications" | "contact";
type CandidateSpecRow = {
  label: string;
  value: string;
  empty?: boolean;
  group: CandidateSpecGroup;
  groupLabel: string;
  column: 1 | 2 | 3;
  icon: string;
};
const candidateSpecGroups: Record<CandidateSpecGroup, { column: 1 | 2 | 3; key: string }> = {
  identity: { column: 1, key: "specGroupIdentity" },
  location: { column: 2, key: "specGroupLocation" },
  preferences: { column: 2, key: "specGroupPreferences" },
  qualifications: { column: 3, key: "specGroupQualifications" },
  contact: { column: 3, key: "specGroupContact" },
};
const specRows = computed<CandidateSpecRow[]>(() => {
  const profile = active.value;
  if (!profile) return [];
  const row = (
    group: CandidateSpecGroup,
    label: string,
    value: string,
    empty: boolean,
    icon: string,
  ): CandidateSpecRow => ({
    group,
    groupLabel: t(candidateSpecGroups[group].key),
    column: candidateSpecGroups[group].column,
    label,
    value,
    empty,
    icon,
  });
  return [
    row("identity", t("specName"), strOr(profile.name), !profile.name, "i-lucide-user-round"),
    row("identity", t("specRole"), strOr(profile.role), !profile.role, "i-lucide-briefcase-business"),
    row("identity", t("age"), profile.age != null ? String(profile.age) : t("notSpecified"), profile.age == null, "i-lucide-calendar-days"),
    row("identity", t("gender"), genderLabel(profile.gender), !profile.gender, "i-lucide-users-round"),
    row("identity", t("specExperience"), profile.experienceYears != null ? experienceLabel(profile.experienceYears) : t("notSpecified"), profile.experienceYears == null, "i-lucide-history"),

    row("location", t("specCity"), profile.city ? cityLabel(profile.city) : t("notSpecified"), !profile.city, "i-lucide-map-pinned"),
    row("location", t("specCountry"), strOr(meta.value.find((c) => c.code === profile.country)?.name || profile.country), !profile.country, "i-lucide-map"),

    row("preferences", t("specSalary"), salaryLabel(profile) || t("notSpecified"), profile.salaryMin == null && profile.salaryMax == null, "i-lucide-banknote"),
    row("preferences", t("specRemote"), fmtBool(profile.remote), profile.remote == null, "i-lucide-laptop"),
    row("preferences", t("specEmployment"), employmentLabel(profile.employmentType), !profile.employmentType, "i-lucide-briefcase"),
    row("preferences", t("specContactHours"), strOr(profile.contactHours), !profile.contactHours, "i-lucide-clock-3"),

    row("qualifications", t("specEducation"), strOr(profile.education), !profile.education, "i-lucide-graduation-cap"),
    row("qualifications", t("specLanguages"), listOr(profile.languages), !profile.languages?.length, "i-lucide-languages"),
    row("qualifications", t("specSkills"), listOr(profile.skills), !profile.skills?.length, "i-lucide-wrench"),

    row("contact", t("specContact"), strOr(profile.contact), !profile.contact, "i-lucide-message-circle"),
    row("contact", t("specSource"), profile.sourceLabel || (profile.source === "telegram" ? "Telegram" : profile.source), false, "i-lucide-external-link"),
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
// Clean link: the publicId alone is enough to open the profile, so — like
// flats and jobs — this deliberately does not carry the current filters along.
function makeCvShareLink(profile: CvProfile): string {
  const resolved = router.resolve({ path: route.path, query: activeCvQuery(profile) });
  return new URL(resolved.href, window.location.origin).toString();
}
async function shareCv(profile: CvProfile) {
  const link = makeCvShareLink(profile);
  const title = `${profile.name} — ${profile.role}`;
  await shareLink({ title, text: title, url: link, key: profile.id });
}

// Legacy triple-param link (cv/cvSource/cvCountry), kept so old shared links
// keep working.
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
async function openSharedCvByPublicId(publicId: string, attempt = 0) {
  const local = profiles.value.find((profile) => String(candidatePublicId(profile)) === publicId);
  if (local) { openCv(local); return; }
  const { data } = await safeFetch<FeedResult>("/hiring-feed", { params: { publicId, limit: "1", offset: "0" } });
  const exact = data?.profiles?.find((profile) => String(candidatePublicId(profile)) === publicId);
  if (exact) { openCv(exact); return; }
  if (data?.warming && attempt < 20) {
    if (sharedPostTimer) clearTimeout(sharedPostTimer);
    sharedPostTimer = setTimeout(() => {
      sharedPostTimer = undefined;
      void openSharedCvByPublicId(publicId, attempt + 1);
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
  const sharedAdvId = queryString(route.query.adv);
  const sharedCvId = queryString(route.query.cv);
  const sharedCvSource = queryString(route.query.cvSource);
  const sharedCvCountry = queryString(route.query.cvCountry);
  const requestedPage = Math.max(1, Math.trunc(Number(queryString(route.query.page))) || 1);
  defaultCountry.value = regionalSearchCountry();
  loadPersonalState();
  applyQueryParams(route.query);
  await loadMeta();
  if (queryString(route.query.shared) === "1") {
    showAdvanced.value = true;
    sharedLinkOpened.value = true;
    shareModalOpen.value = true;
  }
  await load(false);
  if (requestedPage > 1) await restoreToPage(requestedPage);
  pageRestoring.value = false;
  if (sharedAdvId) await openSharedCvByPublicId(sharedAdvId);
  else if (sharedCvId) await openSharedCv(sharedCvId, sharedCvSource, sharedCvCountry);
});

watch(modalOpen, (isOpen) => {
  if (isOpen) return;
  active.value = null;
  void syncActiveCvQuery(null);
});
// A link that names a profile should open it, whether the page is mounting
// for the first time or the query changed underneath one that is already up.
watch(() => queryString(route.query.adv), (publicId, previous) => {
  if (!import.meta.client || !publicId || publicId === previous || modalOpen.value) return;
  void openSharedCvByPublicId(publicId);
});
watch(() => queryString(route.query.cv), (id, previous) => {
  if (!import.meta.client || !id || id === previous || modalOpen.value) return;
  void openSharedCv(id, queryString(route.query.cvSource), queryString(route.query.cvCountry));
});

onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
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
      <u-button type="submit" icon="i-lucide-search">
        {{ t("search") }}
      </u-button>

      <div class="hiring__row">
        <SearchSourceTabs :model-value="source" :items="sourceOptions" @update:model-value="selectSource" />
        <SearchSavedTabs
          :model-value="view"
          :items="viewTabs"
          :aria-label="t('personalTabs')"
          @update:model-value="setView"
        />
      </div>

      <SearchAdvancedFilters v-model="showAdvanced" :label="t('advanced')" :hide-label="t('hideFilters')">
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
      </SearchAdvancedFilters>
    </SearchFilterPanel>

    <div class="hiring__results-toolbar">
      <p v-if="failed" class="hiring__error">{{ t("error") }}</p>
      <p v-else-if="hasSourceWarning" class="hiring__source-warning">
        {{ t(sourceWarningKey, { n: relevantSourceErrors.length }) }}
      </p>
      <p v-else-if="warming && !loading" class="hiring__warming text-muted">{{ t("warming") }}</p>
      <p v-else class="hiring__count text-muted">{{ t("found", { n: view === 'active' ? total : displayedProfiles.length }) }}</p>
      <UiSortSelect class="hiring__sort" v-model="sort" :items="sortItems" :label="t('sort')" @update:model-value="scheduleLoad(0)" />
    </div>

    <HiringStatsPanel
      v-if="displayedProfiles.length"
      :profiles="displayedProfiles"
      :rates="usdRates"
      :statistics="view === 'active' ? statistics : null"
    />
    <SearchResultGrid :dense="denseGrid" equal-rows>
      <CandidateCard
        v-for="profile in displayedProfiles"
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
    </SearchResultGrid>
    <div ref="loadMoreSentinel" v-if="hasMore" class="hiring__sentinel">
      <span v-if="loadingMore" class="text-muted">{{ t("loadingMore") }}</span>
    </div>

    <SearchEmptyState v-if="!loading && !displayedProfiles.length && !failed" :message="t('empty')" />

    </UiResultsLoader>

    <SearchDetailsModal v-model:open="modalOpen" :title="active?.name || active?.role || t('notSpecified')" :public-id="candidatePublicId(active)">
      <template #title>
        <h2 class="hiring-modal__title">{{ active?.name || active?.role || t("notSpecified") }}</h2>
        <p v-if="active?.name && active?.role" class="hiring-modal__role">{{ active.role }}</p>
      </template>
      <template #body>
        <div v-if="active" class="hiring-modal">
          <UiSpecTable :rows="specRows" :hide-empty-label="t('hideEmpty')" :empty-value="t('notSpecified')" />
          <details v-if="active.description" class="hiring-modal__descbox" open>
            <summary>{{ t("cvBody") }}</summary>
            <p class="hiring-modal__desc">{{ capitalizeFirst(active.description) }}</p>
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

    <SearchPresetDialog v-model:open="presetModalOpen" v-model:name="presetName" :title="t('savePreset')" :name-label="t('presetName')" :cancel-label="t('cancel')" :save-label="t('save')" @save="savePreset" />
    <SearchShareDialog v-model:open="shareModalOpen" :title="sharedLinkOpened ? t('sharedSearchApplied') : t('shareSearch')" :hint="sharedLinkOpened ? t('sharedSearchHint') : t('shareSearchHint')" :url="shareUrl" :copy-label="t('copyLink')" @copy="copyShareLink" />
    <SearchShareDialog v-model:open="listingShareModalOpen" :title="t('shareListing')" :hint="t('shareListingHint')" :url="listingShareUrl" :copy-label="t('copyLink')" :copied="listingShareCopied" :copied-label="t('shareCopied')" @copy="copyListingShareLink" />
  </SearchPageShell>
</template>

<style scoped>
.hiring { position: relative; isolation: isolate; padding-top: 24px; padding-bottom: 96px; }
.hiring__header { position: relative; z-index: 1; }
.hiring__title { font-size: 32px; font-weight: 600; }
.hiring__subtitle { max-width: 720px; font-size: 14px; }
.hiring__controls { margin: 20px 0 20px; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr) auto; align-items: start; }
.hiring__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
.hiring__results-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.hiring__results-toolbar .hiring__error,
.hiring__results-toolbar .hiring__source-warning,
.hiring__results-toolbar .hiring__warming,
.hiring__results-toolbar .hiring__count { margin: 0; }
.hiring__sort { flex: 0 0 min(280px, 42vw); min-width: 200px; }
.hiring__count { font-size: 13px; }
.hiring__filter-blocks { grid-column: 1 / -1; }
.hiring__filter-blocks :deep(.search-filter-blocks__grid) { align-items: end; }
.hiring-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
@media (min-width: 700px) {
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
.hiring__source-warning { color: #f6c177; font-size: 13px; }
.hiring__warming { font-size: 13px; }
.hiring__sentinel { min-height: 44px; display: grid; place-items: center; }
.hiring-modal { display: flex; flex-direction: column; gap: 12px; }
.hiring-modal__title { margin: 0; font-size: 18px; font-weight: 700; line-height: 1.35; padding-right: 36px; }
.hiring-modal__name { font-size: 14px; color: var(--text-muted); }
.hiring-modal__salary { font-weight: 700; font-size: 18px; }
.hiring-modal__descbox summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.8; user-select: none; }
.hiring-modal__desc { font-size: 13.5px; line-height: 1.55; white-space: pre-wrap; color: var(--text-soft, inherit); margin-top: 8px; }
.hiring-modal__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.hiring-modal__tag { font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
@media (max-width: 700px) {
  .hiring__controls { grid-template-columns: 1fr; }
  .hiring__controls > :deep(button) { width: 100%; }
  .hiring__results-toolbar { align-items: stretch; flex-direction: column; }
  .hiring__sort { flex: 1 1 auto; width: 100%; min-width: 0; }
  .hiring__age-range, .hiring__salary-range { grid-template-columns: 1fr 1fr; }
}
</style>
