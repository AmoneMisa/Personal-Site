<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import JobCard from "~/components/jobs/JobCard.vue";
import JobGrid from "~/components/jobs/JobGrid.vue";
import SearchDetailsModal from "~/components/search/SearchDetailsModal.vue";
import SearchPageShell from "~/components/search/SearchPageShell.vue";
import SearchSavedTabs from "~/components/search/SearchSavedTabs.vue";
import SearchFilterPanel from "~/components/search/SearchFilterPanel.vue";
import SearchFilterBlocks from "~/components/search/SearchFilterBlocks.vue";
import AtsPanel from "~/components/jobs/AtsPanel.vue";
import RecentlyViewed from "~/components/jobs/RecentlyViewed.vue";
import StatsPanel from "~/components/jobs/StatsPanel.vue";
import type { Job, RecentJob } from "~/types/jobs";
import { convertCurrency as convertCurrencyValue, convertSalaryPeriod, currencySymbol } from "~/utils/search/money";
import { JOB_SALARY_PERIODS, useJobFilters } from "~/composables/jobs/useJobFilters";
import { useJobFilterBlocks } from "~/composables/jobs/useJobFilterBlocks";
import { useJobFeed } from "~/composables/jobs/useJobFeed";
import { useJobAts } from "~/composables/jobs/useJobAts";
import { useJobMeta } from "~/composables/jobs/useJobMeta";
import { useJobRouteState } from "~/composables/jobs/useJobRouteState";
import { useSavedCollections } from "~/composables/search/useSavedCollections";
import { useInfiniteFeed } from "~/composables/search/useInfiniteFeed";
import { ANY_SELECT_VALUE, useNullableSelect } from "~/composables/search/useNullableSelect";

// Job Finder service. Auto-routed at /jobs. Aggregates many boards, enforces a
// 14-day freshness cap server-side, offers full sort + advanced filters, shows
// aggregate statistics (salary/countries/sources/languages/skills), and computes
// an ATS match score for each vacancy from a CV that stays in the browser.

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) =>
  translate(`jobs.${key}`, params);
const localePath = useLocalePath();
const { copyText } = useClipboard();

useSeoMeta({
  title: () => t("seoTitle"), description: () => t("seoDescription"),
  robots: () => "index, follow", ogType: () => "website",
  ogTitle: () => t("seoTitle"), ogDescription: () => t("seoDescription"),
  twitterTitle: () => t("seoTitle"), twitterDescription: () => t("seoDescription"),
});

const { sourceOptions, countryOptions, languageOptions, levelOptions } = useJobMeta();

// Rates are supplied by /jobs-feed from the shared server FX cache. Keep USD as
// the cold/error fallback; the first successful response expands this to every
// three-letter currency returned by the live provider.
// Keep the controls useful before the first /jobs-feed response arrives. Live
// API rates replace these values as soon as the server answers.
const usdRates = ref<Record<string, number>>({
  USD: 1,
  EUR: 1.09,
  UZS: 0.000079,
  UAH: 0.024,
  KZT: 0.0019,
  PLN: 0.25,
  GBP: 1.27,
});
const preferredCurrencies = ["USD", "EUR", "UZS", "UAH", "KZT", "PLN", "GBP"];
const currencyOptions = computed(() => {
  const available = Object.keys(usdRates.value)
    .filter((code) => /^[A-Z]{3}$/.test(code) && usdRates.value[code]! > 0);
  const preferred = preferredCurrencies.filter((code) => available.includes(code));
  const rest = available.filter((code) => !preferred.includes(code)).sort();
  return [...preferred, ...rest];
});
// Convert between two currencies via USD. Returns undefined if a rate is unknown.
function convertCurrency(amount: number, from: string, to: string): number | undefined {
  const converted = convertCurrencyValue(amount, from || "USD", to || "USD", usdRates.value, "usdPerCurrency");
  return converted == null ? undefined : Math.round(converted);
}

function formatAmount(n: number, cur: string): string {
  const symbol = currencySymbol(cur);
  return symbol === cur.toUpperCase() ? `${n.toLocaleString()} ${symbol}` : `${symbol}${n.toLocaleString()}`;
}

// Pay-period conversion. PER_YEAR turns an amount at a period into a yearly amount
// (must match server enrich.ts: 160 work hours/month). To convert an amount from
// period A to B: multiply by PER_YEAR[A] / PER_YEAR[B].
type Period = (typeof JOB_SALARY_PERIODS)[number];

function convertPeriod(amount: number, from: Period, to: Period): number {
  return Math.round(convertSalaryPeriod(amount, from, to));
}

const jobFilters = useJobFilters();
const {
  query, source, salaryMin, displayCurrency, displayPeriod, sort, countries, cities,
  includeRu, includeBy, workMode, relocation, employmentKind, hasSalary, maxExperience,
  foreignerOnly, hideRisky, noExperience, language, languageLevel, excludeLanguages,
  skills, showAdvanced, buildFeedParams, resetValues: resetFilterValues,
} = jobFilters;

// Reka UI reserves an empty string for clearing a combobox and throws when an
// item itself has value="". Keep the API-facing refs empty for "any", while
// exposing a non-empty sentinel to USelectMenu.
const workModeSelect = useNullableSelect(workMode);
const relocationSelect = useNullableSelect(relocation);
const employmentKindSelect = useNullableSelect(employmentKind);
const languageSelect = useNullableSelect(language, { onClear: () => { languageLevel.value = ""; } });
const languageLevelSelect = useNullableSelect(languageLevel);

const {
  jobs, total, page, pageSize, stats, loading, loadingMore, failed, warming,
  loadedSourceCount, pendingSourceCount, loadMoreSentinel, loadFeed,
} = useJobFeed(usdRates);
const activeJob = ref<Job | null>(null);
const jobModalOpen = ref(false);
const shareCopied = ref(false);
const shareCopiedJobId = ref<string | null>(null);

// ---- Personal vacancy lists (localStorage; no account or backend required) ----
type SavedJobsView = "active" | "favorites" | "hidden";
const savedView = ref<SavedJobsView>("active");
const {
  favorites: favoriteJobs,
  hidden: hiddenJobs,
  hiddenIds,
  favoriteIds,
  isHidden,
  isFavorite,
  toggleFavorite: toggleSavedFavorite,
  toggleHidden: toggleSavedHidden,
  load: loadSavedJobs,
} = useSavedCollections<Job>({
  namespace: "jobs",
  getId: (job) => job.id,
  favoritesLimit: 200,
  hiddenLimit: 200,
});
const savedViewTabs = computed(() => [
  { value: "active", label: t("activeVacancies") },
  { value: "favorites", label: t("favoriteVacancies"), count: favoriteJobs.value.length },
  { value: "hidden", label: t("hiddenVacancies"), count: hiddenJobs.value.length },
]);
function toggleHidden(job: Job) {
  const willHide = !isHidden(job.id);
  toggleSavedHidden(job);
  if (willHide && activeJob.value?.id === job.id) jobModalOpen.value = false;
}

function toggleFavorite(job: Job) {
  toggleSavedFavorite(job);
}

function selectSavedView(view: string) {
  savedView.value = view as SavedJobsView;
}

// ---- Seen / recently-viewed (localStorage) ----
const SEEN_KEY = "jobs:seen:v1";
const RECENT_KEY = "jobs:recent:v1";
const MAX_SEEN = 500;
const MAX_RECENT = 4; // "last seen" strip: up to 4 in a row
const seenIds = ref<Set<string>>(new Set());
const recentlyViewed = ref<RecentJob[]>([]);
const isSeen = (id: string) => seenIds.value.has(id);

function loadSeen() {
  if (!import.meta.client) return;
  try { seenIds.value = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { /* ignore */ }
  try { recentlyViewed.value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { /* ignore */ }
}

function markSeen(job: Job | RecentJob) {
  const next = new Set(seenIds.value);
  next.add(job.id);
  seenIds.value = next.size > MAX_SEEN ? new Set([...next].slice(-MAX_SEEN)) : next;
  const snap: RecentJob = { id: job.id, title: job.title, company: job.company, url: job.url, source: job.source };
  recentlyViewed.value = [snap, ...recentlyViewed.value.filter((r) => r.id !== job.id)].slice(0, MAX_RECENT);
  if (!import.meta.client) return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seenIds.value]));
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyViewed.value));
  } catch { /* storage full/disabled */ }
}

function openJob(job: Job) {
  activeJob.value = job;
  jobModalOpen.value = true;
  shareCopied.value = false;
  markSeen(job);
  persistState();
}

// Fetch a single vacancy by id and open it — used by shared links and the
// recently-viewed strip, which must open a posting outside the current results.
async function openSharedJob(id: string) {
  const { data } = await safeFetch<{ job: Job | null }>("/jobs-vacancy", { params: { id } });
  if (data?.job) openJob(data.job);
}

function jobShareLink(job: Job | RecentJob): string {
  const base = import.meta.client ? window.location.origin : "https://whiteslove.me";
  const qs = new URLSearchParams({ ...currentState(), job: job.id }).toString();
  return `${base}${localePath("/jobs")}${qs ? `?${qs}` : ""}`;
}

async function shareJob(job: Job | RecentJob): Promise<boolean> {
  const link = jobShareLink(job);
  if (await copyText(link)) {
    shareCopiedJobId.value = job.id;
    setTimeout(() => {
      if (shareCopiedJobId.value === job.id) shareCopiedJobId.value = null;
    }, 2000);
    return true;
  }
  return false;
}

async function shareActiveJob() {
  if (!activeJob.value) return;
  if (await shareJob(activeJob.value)) {
    shareCopied.value = true;
    setTimeout(() => (shareCopied.value = false), 2000);
  }
}

const empLabel = (kind?: string) =>
  kind ? t("emp" + kind.charAt(0).toUpperCase() + kind.slice(1)) : "";
const modeLabel = (mode?: string) =>
  mode && mode !== "unknown" ? t("wm" + mode.charAt(0).toUpperCase() + mode.slice(1)) : "";
const seniorityLabel = (value?: Job["seniority"]) =>
  value ? t("seniority" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
const employerTypeLabel = (value?: Job["employerType"]) =>
  value ? t("employer" + value.charAt(0).toUpperCase() + value.slice(1)) : "";
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();
let loadTimer: ReturnType<typeof setTimeout> | undefined;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const hasMore = computed(() => savedView.value === "active" && sort.value !== "ats" && page.value < totalPages.value);
const canLoadMore = computed(() =>
  hasMore.value
  && !warming.value
  && !loading.value
  && !loadingMore.value
  && page.value < totalPages.value,
);
useInfiniteFeed({
  sentinel: loadMoreSentinel,
  hasMore,
  loading: computed(() => loading.value || loadingMore.value),
  canLoad: canLoadMore,
  loadMore,
  rootMargin: "300px 0px",
});

function scheduleLoad(delay = 250) {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    loadTimer = undefined;
    void load(1);
  }, delay);
}

function clearSearch() {
  query.value = "";
  persistState();
  scheduleLoad(0);
}

function selectSource(value: string) {
  if (source.value === value) return;
  savedView.value = "active";
  source.value = value;
  scheduleLoad(100);
}

// ---- ATS ----
const displayedJobs = computed(() => {
  if (savedView.value === "favorites") return favoriteJobs.value;
  if (savedView.value === "hidden") return hiddenJobs.value;
  return jobs.value.filter((job) => !isHidden(job.id));
});
const displayedTotal = computed(() => savedView.value === "active" ? total.value : displayedJobs.value.length);

const {
  cvProfile,
  cvPaste,
  cvError,
  cvLoading,
  scored,
  activeAts,
  onCvFile,
  applyPastedCv,
  clearCv,
} = useJobAts({
  jobs,
  displayedJobs,
  activeJob,
  total,
  pageSize,
  sort,
  reload: () => load(1),
  translate: (key) => t(key),
});

const countryLabel = (code: string) =>
  countryOptions.find((c) => c.value === code)?.label ?? code;

async function load(
  toPage = 1,
  options: { append?: boolean; background?: boolean } = {},
) {
  const params = buildFeedParams({
    page: toPage,
    pageSize: pageSize.value,
    cvReady: Boolean(cvProfile.value),
    convertCurrency,
    convertPeriod,
  });

  const data = await loadFeed(params, options);
  if (!data) return;
  // Persist the filters that produced this result (foreground loads only, so a
  // background warm-poll or a "load more" page doesn't rewrite the URL).
  if (!options.append && !options.background) persistState();
}

function loadMore() {
  if (canLoadMore.value) void load(page.value + 1, { append: true });
}

function resetFilters() {
  savedView.value = "active";
  resetFilterValues();
  scheduleLoad(100);
}

// ---- Shareable + persisted search state ----
// The current filters are mirrored to the URL query (so a search is shareable via
// the address bar) AND to localStorage (so a reload restores the last search).
const SEARCH_STATE_KEY = "jobs:last-search:v1";

const { persist: persistState, restore: restoreState, serialize: currentState } = useJobRouteState({
  storageKey: SEARCH_STATE_KEY,
  filters: jobFilters,
  ignoredUrlKeys: ["job"],
  extraQuery: () => jobModalOpen.value && activeJob.value ? { job: activeJob.value.id } : {},
});

// Salary in the vacancy's own currency (as provided by the source).
function formatSalary(job: Job): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const cur = job.salaryCurrency || "";
  const fmt = (n?: number) => (n ? n.toLocaleString() : "");
  const period = job.salaryPeriod ? `/${periodLabel(job.salaryPeriod)}` : "";
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)} ${cur}${period}`.trim();
  return `${fmt(job.salaryMin || job.salaryMax)} ${cur}${period}`.trim();
}

const periodLabel = (p: Period) => t("per" + p.charAt(0).toUpperCase() + p.slice(1));

// Convert one currency amount at the vacancy's detected period into the chosen
// currency + chosen period (e.g. "5,000 UZS/mo" → "≈ $475/mo" or "≈ $5,700/yr").
function toDisplayAmount(amount: number, from: string, srcPeriod: Period): number | undefined {
  const inCur = convertCurrency(amount, from, displayCurrency.value);
  if (inCur === undefined) return undefined;
  return convertPeriod(inCur, srcPeriod, displayPeriod.value);
}

// The vacancy's salary converted into the chosen currency AND period. Shown when
// either the currency or the pay period differs from what the source provided.
function convertedSalary(job: Job): string | null {
  const from = (job.salaryCurrency || "").toUpperCase();
  const srcPeriod = (job.salaryPeriod || "month") as Period;
  if (!from) return null;
  if (from === displayCurrency.value.toUpperCase() && srcPeriod === displayPeriod.value) return null;
  if (!job.salaryMin && !job.salaryMax) return null;
  const lo = job.salaryMin ? toDisplayAmount(job.salaryMin, from, srcPeriod) : undefined;
  const hi = job.salaryMax ? toDisplayAmount(job.salaryMax, from, srcPeriod) : undefined;
  if (lo === undefined && hi === undefined) return null;
  const body = lo !== undefined && hi !== undefined
    ? `${lo.toLocaleString()}–${hi.toLocaleString()}`
    : (lo ?? hi)!.toLocaleString();
  const sym = currencySymbol(displayCurrency.value);
  const money = sym === displayCurrency.value.toUpperCase() ? `${body} ${sym}` : `${sym}${body}`;
  return `≈ ${money}/${periodLabel(displayPeriod.value)}`;
}

// Format an ANNUAL USD stat value into the chosen display currency + period. The
// surrounding stats label carries the "(CUR/period)" context, so no suffix here.
function money(annualUsd: number): string {
  const converted = convertCurrency(annualUsd, "USD", displayCurrency.value);
  const cur = converted === undefined ? "USD" : displayCurrency.value;
  const v = convertPeriod(converted ?? annualUsd, "year", displayPeriod.value);
  return formatAmount(v, cur);
}

// Tooltip for the Suspicious badge: spell out WHY, so the warning is auditable
// rather than an opaque label. Unknown reason codes fall back to their key.
function suspicionHint(job: Job): string {
  const reasons = (job.suspicionReasons || []).map((r) => t(`susp_${r.replace(/-/g, "_")}`));
  return reasons.length ? `${t("suspiciousWhy")}: ${reasons.join("; ")}` : t("suspiciousWhy");
}
function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
}

// ---- normalized vacancy spec table (details modal) ----
// ATS match for the open vacancy (only when a CV profile is loaded).
const vBool = (v?: boolean) => (v === true ? t("yes") : v === false ? t("no") : t("notSpecified"));
const vStr = (v?: string | null) => (v ? v : t("notSpecified"));
function experienceValue(j: Job): string {
  if (j.experienceMinYears !== undefined && j.experienceMaxYears !== undefined && j.experienceMaxYears > j.experienceMinYears) {
    return t("experienceRange", { min: j.experienceMinYears, max: j.experienceMaxYears });
  }
  if (j.experienceMinYears !== undefined && j.experienceMinYears > 0) return t("experienceYears", { n: j.experienceMinYears });
  if (j.experienceMaxYears !== undefined && j.experienceMaxYears > 0) return t("experienceUpTo", { n: j.experienceMaxYears });
  if (j.noExperience) return t("noExpRequired");
  return t("notSpecified");
}
function relocationValue(j: Job): string {
  if (j.relocation === "offered") return t("yes");
  if (j.relocation === "none") return t("no");
  return t("notSpecified");
}
function salaryTypeValue(j: Job): string {
  if (j.salaryGross === true) return t("salaryGross");
  if (j.salaryGross === false) return t("salaryNet");
  return t("notSpecified");
}
const vacRows = computed<Array<{ label: string; value: string }>>(() => {
  const j = activeJob.value;
  if (!j) return [];
  const ats = activeAts.value;
  const langs = (j.languages || []).map((l) => (l.level ? `${l.language} (${l.level})` : l.language)).join(", ");
  const rows = [
    { label: t("vCompany"), value: vStr(j.company) },
    { label: t("vLocation"), value: vStr(j.location) },
    { label: t("vCountry"), value: j.country && !["OTHER", "REMOTE"].includes(j.country) ? countryLabel(j.country) : t("notSpecified") },
    { label: t("vCity"), value: vStr(j.city) },
    { label: t("vSource"), value: vStr(j.source) },
    { label: t("vPublished"), value: timeAgo(j.postedAt) },
    { label: t("vDeadline"), value: vStr(j.deadline) },
    { label: t("vSalary"), value: formatSalary(j) || t("notSpecified") },
    { label: t("vSalaryMonthly"), value: convertedSalary(j) || t("notSpecified") },
    { label: t("vSalaryType"), value: salaryTypeValue(j) },
    { label: t("vSalaryNegotiable"), value: vBool(j.salaryNegotiable) },
    { label: t("vWorkFormat"), value: modeLabel(j.workMode) || (j.remote ? t("remote") : t("notSpecified")) },
    { label: t("vEmployment"), value: empLabel(j.employmentKind) || t("notSpecified") },
    { label: t("vExperience"), value: experienceValue(j) },
    { label: t("vSeniority"), value: seniorityLabel(j.seniority) || t("notSpecified") },
    { label: t("vManagement"), value: vBool(j.managementRole) },
    { label: t("vEducation"), value: vStr(j.education) },
    { label: t("vSchedule"), value: vStr(j.schedule) },
    { label: t("vContractType"), value: vStr(j.contractType) },
    { label: t("vRelocation"), value: relocationValue(j) },
    { label: t("vVisa"), value: vBool(j.foreignerFriendly) },
    { label: t("vLanguages"), value: langs || t("notSpecified") },
    { label: t("vSkills"), value: (j.skills && j.skills.length ? j.skills.join(", ") : t("notSpecified")) },
    { label: t("vNiceToHave"), value: (j.niceToHave && j.niceToHave.length ? j.niceToHave.join(", ") : t("notSpecified")) },
    { label: t("vTools"), value: (j.tools && j.tools.length ? j.tools.join(", ") : t("notSpecified")) },
    { label: t("vApplicationLanguage"), value: vStr(j.applicationLanguage) },
  ];
  if (ats) {
    rows.push({ label: t("vMatch"), value: `${ats.score}%` });
    rows.push({ label: t("vMatched"), value: ats.matched.length ? ats.matched.join(", ") : t("notSpecified") });
    rows.push({ label: t("vMissing"), value: ats.missing.length ? ats.missing.join(", ") : t("notSpecified") });
  }
  return rows;
});

// sorted views over the stats maps for stable rendering
const countryStats = computed(() =>
  Object.entries(stats.value?.byCountry ?? {})
    .filter(([, v]) => v.medianUsd > 0)
    .sort((a, b) => b[1].medianUsd - a[1].medianUsd),
);
const sourceStats = computed(() =>
  Object.entries(stats.value?.bySource ?? {})
    .filter(([, v]) => v.medianUsd > 0)
    .sort((a, b) => b[1].medianUsd - a[1].medianUsd),
);
const languageStats = computed(() =>
  Object.entries(stats.value?.byLanguage ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8),
);
const workModeStats = computed(() => {
  const m = stats.value?.byWorkMode ?? {};
  return [
    { key: "remote", n: m.remote ?? 0 },
    { key: "hybrid", n: m.hybrid ?? 0 },
    { key: "office", n: m.office ?? 0 },
  ].filter((x) => x.n > 0);
});

// { label, value } item lists for the u-select-menu controls (site convention).
type Item = { label: string; value: string };
const sortItems = computed<Item[]>(() => {
  const base: Item[] = [
    { label: t("sortDate"), value: "date" },
    { label: t("sortOldest"), value: "oldest" },
    { label: t("sortTitle"), value: "title" },
    { label: t("sortCompany"), value: "company" },
    { label: t("sortSalary"), value: "salary" },
  ];
  if (cvProfile.value) base.push({ label: t("sortAts"), value: "ats" });
  return base;
});
// Multi-select: drop the "any" pseudo-option (empty selection already means any).
const countryItems = computed<Item[]>(() =>
  countryOptions.filter((c) => c.value).map((c) => ({ value: c.value, label: c.label! })),
);
const currencyItems = computed<Item[]>(() => currencyOptions.value.map((c) => ({ label: c, value: c })));
const periodItems = computed<Item[]>(() => JOB_SALARY_PERIODS.map((p) => ({ label: periodLabel(p), value: p })));
const workModeItems = computed<Item[]>(() => [
  { label: t("any"), value: ANY_SELECT_VALUE },
  { label: t("wmRemote"), value: "remote" },
  { label: t("wmHybrid"), value: "hybrid" },
  { label: t("wmOffice"), value: "office" },
]);
const relocationItems = computed<Item[]>(() => [
  { label: t("any"), value: ANY_SELECT_VALUE },
  { label: t("relYes"), value: "offered" },
  { label: t("relNo"), value: "none" },
]);
const employmentKindItems = computed<Item[]>(() => [
  { label: t("any"), value: ANY_SELECT_VALUE },
  { label: t("empFulltime"), value: "fulltime" },
  { label: t("empParttime"), value: "parttime" },
  { label: t("empContract"), value: "contract" },
  { label: t("empInternship"), value: "internship" },
  { label: t("empTemporary"), value: "temporary" },
]);
const languageItems = computed<Item[]>(() => [
  { label: t("any"), value: ANY_SELECT_VALUE },
  ...languageOptions.map((l) => ({ label: l, value: l })),
]);
// Multi-select of languages to exclude (no "any" pseudo-option).
const excludeLanguageItems = computed<Item[]>(() =>
  languageOptions.map((l) => ({ label: l, value: l })),
);
const levelItems = computed<Item[]>(() => [
  { label: t("any"), value: ANY_SELECT_VALUE },
  ...levelOptions.map((l) => ({ label: l, value: l })),
]);

const jobFilterBlocks = useJobFilterBlocks({
  t,
  filters: jobFilters,
  workModeSelect,
  relocationSelect,
  employmentKindSelect,
  languageSelect,
  languageLevelSelect,
  countryItems,
  currencyItems,
  periodItems,
  workModeItems,
  relocationItems,
  employmentKindItems,
  languageItems,
  levelItems,
  excludeLanguageItems,
  periodLabel,
  scheduleLoad,
  submit: () => load(1),
});

// Do not suspend SSR/hydration on the aggregated feed. A cold job store can
// take several seconds while upstream boards time out; keeping that request at
// top level leaves all filters rendered but inert until it finishes.
onMounted(() => {
  loadSeen(); // restore "seen"/recently-viewed marks
  loadSavedJobs();
  const sharedJobId = new URLSearchParams(window.location.search).get("job");
  restoreState(); // hydrate filters from the URL query, else last-saved localStorage
  void load(1);
  if (sharedJobId) void openSharedJob(sharedJobId); // a shared link opens the vacancy popup
});
watch(jobModalOpen, (isOpen) => {
  if (isOpen) return;
  activeJob.value = null;
  persistState();
});
onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
});
</script>

<template>
  <SearchPageShell class-name="jobs" :title="t('title')">
    <template #header>
      <div class="jobs__header text-center space-y-3">
        <h1 class="jobs__title">{{ t("title") }}</h1>
        <p class="jobs__headline text-muted">{{ t("headline") }}</p>
        <p class="jobs__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
      </div>
    </template>

    <UiResultsLoader :loading="loading && savedView === 'active'" :label="t('searching')" min-height="420px">
    <AtsPanel
      v-model:paste="cvPaste"
      :error="cvError"
      :loading="cvLoading"
      :ready="Boolean(cvProfile)"
      @upload="onCvFile"
      @apply="applyPastedCv"
      @clear="clearCv"
    />

    <!-- Filters + sort -->
    <SearchFilterPanel tag="form" class="jobs__controls" @submit="load(1)">
      <u-input v-model="query" clearable icon="i-lucide-search" :label="t('search')" :placeholder="t('searchPlaceholder')" @clear="clearSearch" />
      <UiSortSelect
        v-model="sort"
        :items="sortItems"
        :label="t('sortLabel')"
        @update:model-value="(value: string) => value !== 'ats' && scheduleLoad()"
      />

      <div class="jobs__row">
        <div class="jobs__filters">
          <button
              v-for="opt in sourceOptions"
              :key="opt.value"
              type="button"
              class="jobs__pill"
              :class="{ 'jobs__pill_active': source === opt.value }"
              @click="selectSource(opt.value)"
          >
            {{ opt.label ?? t(opt.labelKey!) }}
          </button>
        </div>
        <SearchSavedTabs
          :model-value="savedView"
          :items="savedViewTabs"
          :aria-label="t('savedFilters')"
          @update:model-value="selectSavedView"
        />
        <u-button type="submit" icon="i-lucide-search">
          {{ t("search") }}
        </u-button>
      </div>

      <!-- Advanced filters -->
      <div class="jobs__row jobs__adv-toggle">
        <button type="button" class="jobs__advbtn" @click="showAdvanced = !showAdvanced">
          <u-icon :name="showAdvanced ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" />
          {{ t("advanced") }}
        </button>
      </div>
      <div v-if="showAdvanced" class="jobs__advanced">
        <SearchFilterBlocks :blocks="jobFilterBlocks" class="jobs__filter-blocks" />

        <UiFilterFooter class="jobs-filter-actions" :reset-label="t('reset')" @reset="resetFilters" />
      </div>
    </SearchFilterPanel>

    <p v-if="failed" class="jobs__error">{{ t("error") }}</p>
    <p v-else-if="warming && savedView === 'active'" class="jobs__warming" role="status" aria-live="polite">
      <span class="jobs__warming-dot" aria-hidden="true"></span>
      {{ t("warming", { loaded: loadedSourceCount, pending: pendingSourceCount }) }}
    </p>
    <p v-else class="jobs__count text-muted">{{ t("jobsFound", { n: displayedTotal }) }}</p>

    <StatsPanel
      v-if="savedView === 'active' && stats && total"
      :jobs="jobs"
      :stats="stats"
      :display-currency="displayCurrency"
      :display-period-label="periodLabel(displayPeriod)"
      :country-stats="countryStats"
      :source-stats="sourceStats"
      :work-mode-stats="workModeStats"
      :language-stats="languageStats"
      :money="money"
      :country-label="countryLabel"
    />
    <RecentlyViewed :jobs="recentlyViewed" @open="openSharedJob" />

    <JobGrid :items="scored">
      <template #default="{ job, ats }">
      <JobCard
          :key="job.id"
          :job="job"
          :ats="ats"
          :seen="isSeen(job.id)"
          :favorite="isFavorite(job.id)"
          :hidden="isHidden(job.id)"
          :share-copied="shareCopiedJobId === job.id"
          :salary="formatSalary(job)"
          :converted-salary="convertedSalary(job)"
          @open="openJob"
          @share="shareJob"
          @seen="markSeen"
          @favorite="toggleFavorite"
          @hidden="toggleHidden"
      />
      </template>
    </JobGrid>
<div v-if="!loading && !(warming && savedView === 'active') && !displayedJobs.length && !failed" class="jobs__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    <div v-if="savedView === 'active' && sort !== 'ats' && displayedJobs.length" ref="loadMoreSentinel" class="jobs__load-more">
      <u-button
        v-if="hasMore && !warming"
        variant="outline"
        :loading="loadingMore"
        :disabled="!canLoadMore"
        @click="loadMore"
      >
        {{ t("loadMore") }}
      </u-button>
      <span class="text-muted">{{ t("shown", { shown: displayedJobs.length, total }) }}</span>
    </div>

    </UiResultsLoader>

    <!-- Full vacancy popup -->
    <SearchDetailsModal v-model:open="jobModalOpen" :title="activeJob?.title || ''" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div v-if="activeJob" class="job-modal">
          <div class="job-modal__meta text-muted">
            <span class="job-card__company">{{ activeJob.company }}</span>
            <span class="job-card__dot">·</span>
            <span>{{ activeJob.location }}</span>
            <span class="job-card__dot">·</span>
            <span>{{ timeAgo(activeJob.postedAt) }}</span>
            <span v-if="employerTypeLabel(activeJob.employerType)" class="job-card__badge job-card__badge_source">{{ employerTypeLabel(activeJob.employerType) }}</span>
          </div>
          <div class="job-modal__badges">
            <span v-if="empLabel(activeJob.employmentKind)" class="job-card__badge job-card__badge_mode">{{ empLabel(activeJob.employmentKind) }}</span>
            <span v-if="modeLabel(activeJob.workMode)" class="job-card__badge">{{ modeLabel(activeJob.workMode) }}</span>
            <span v-else-if="activeJob.remote" class="job-card__badge">{{ t("remote") }}</span>
            <span v-if="seniorityLabel(activeJob.seniority)" class="job-card__badge job-card__badge_seniority">{{ seniorityLabel(activeJob.seniority) }}</span>
            <span v-if="activeJob.managementRole" class="job-card__badge job-card__badge_management">{{ t("management") }}</span>
            <span v-if="isToday(activeJob.postedAt)" class="job-card__badge job-card__badge_new">{{ t("newToday") }}</span>
            <span v-if="activeJob.experienceMinYears !== undefined && activeJob.experienceMinYears > 0" class="job-card__badge job-card__badge_exp">{{ t("experienceYears", { n: activeJob.experienceMinYears }) }}</span>
            <span v-if="activeJob.foreignerFriendly" class="job-card__badge job-card__badge_visa">{{ t("cardForeigner") }}</span>
            <span v-if="activeJob.suspicious" class="job-card__badge job-card__badge_suspicious" :title="suspicionHint(activeJob)">⚠ {{ t("suspicious") }}</span>
            <span v-if="activeJob.relocation === 'offered'" class="job-card__badge job-card__badge_reloc">{{ t("cardReloc") }}</span>
            <span v-if="formatSalary(activeJob)" class="job-card__badge job-card__badge_salary">{{ t("salaryDisclosed") }}</span>
            <span v-if="activeJob.salaryNegotiable" class="job-card__badge job-card__badge_salary">{{ t("salaryNegotiable") }}</span>
            <span v-if="formatSalary(activeJob)" class="job-card__salary">{{ formatSalary(activeJob) }}</span>
            <span v-if="convertedSalary(activeJob)" class="job-card__salary job-card__salary_conv">{{ convertedSalary(activeJob) }}</span>
          </div>
          <div v-if="activeJob.languages && activeJob.languages.length" class="job-card__langs text-muted job-modal__langs">
            <u-icon name="i-lucide-languages" class="job-card__lang-icon" />
            <span v-for="l in activeJob.languages" :key="l.language" class="job-card__lang">
              {{ l.language }}<template v-if="l.level"> ({{ l.level }})</template>
            </span>
          </div>
          <UiSpecTable :rows="vacRows" :hide-empty-label="t('hideEmpty')" :empty-value="t('notSpecified')" />
          <p v-if="activeJob.description" class="job-modal__desc">{{ activeJob.description }}</p>
          <p v-else class="text-muted">{{ t("noDescription") }}</p>
          <div v-if="activeJob.skills && activeJob.skills.length" class="job-card__tags job-modal__tags">
            <span v-for="s in activeJob.skills" :key="s" class="job-card__tag job-card__tag_skill">{{ s }}</span>
            <span v-for="s in (activeJob.niceToHave || [])" :key="'plus-' + s" class="job-card__tag job-card__tag_plus">+{{ s }}</span>
          </div>
        </div>
      </template>
      <template #footer>
        <UiModalFooter>
        <u-button
            v-if="activeJob"
            variant="outline"
            color="neutral"
            icon="i-lucide-heart"
            @click="toggleFavorite(activeJob)"
        >{{ isFavorite(activeJob.id) ? t("removeFavorite") : t("addFavorite") }}</u-button>
        <u-button
            v-if="activeJob"
            variant="outline"
            color="neutral"
            :icon="isHidden(activeJob.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            @click="toggleHidden(activeJob)"
        >{{ isHidden(activeJob.id) ? t("restoreVacancy") : t("hideVacancy") }}</u-button>
        <a
            v-if="activeJob"
            class="modal-footer__primary"
            :href="activeJob.applyUrl || activeJob.url"
            target="_blank"
            rel="noopener noreferrer"
            @click="markSeen(activeJob)"
        >{{ t("apply") }} →</a>
        <a
            v-if="activeJob?.applyUrl && activeJob.applyUrl !== activeJob.url"
            class="modal-footer__secondary"
            :href="activeJob.url"
            target="_blank"
            rel="noopener noreferrer"
            @click="markSeen(activeJob)"
        >{{ t("openSource") }} ↗</a>
        <u-button
            variant="outline"
            color="neutral"
            :icon="shareCopied ? 'i-lucide-check' : 'i-lucide-share-2'"
            @click="shareActiveJob"
        >{{ shareCopied ? t("shareCopied") : t("share") }}</u-button>
        </UiModalFooter>
      </template>
    </SearchDetailsModal>
  </SearchPageShell>
</template>

<style scoped>
.jobs { position: relative; isolation: isolate; padding-top: 24px; padding-bottom: 96px; }
.jobs__header { position: relative; z-index: 1; }
.jobs__title { font-size: 32px; font-weight: 600; }
.jobs__headline { font-size: 16px; }
.jobs__subtitle { max-width: 760px; font-size: 14px; }

.jobs__controls {
  margin: 16px 0 28px; display: grid; gap: 12px; grid-template-columns: 1fr;
  @media (min-width: 900px) { grid-template-columns: 1fr 200px 180px; }
}
.jobs__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.jobs__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.jobs__pill {
  height: 34px; padding: 0 13px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px;
  cursor: pointer; transition: filter 180ms ease, color 180ms ease;
}
.jobs__pill:hover { filter: brightness(1.06); color: var(--text-white); }
.jobs__pill_active { color: var(--text-white); border-color: rgba(224, 103, 154,0.40); background: rgba(224, 103, 154,0.18); }
.jobs__remote { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.jobs__error { color: var(--ui-error, #f87171); }
.jobs__count { font-size: 13px; margin-bottom: 12px; }
.jobs__warming {
  display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
  color: var(--ui-text-muted); font-size: 13px;
}
.jobs__warming-dot {
  width: 8px; height: 8px; border-radius: 2px; background: var(--accent-pink, #e0679a);
  animation: jobs-warming 1s ease-in-out infinite alternate;
}
@keyframes jobs-warming { to { opacity: 0.35; } }

.jobs__adv-toggle { margin-top: -2px; }
.jobs__advbtn {
  display: inline-flex; align-items: center; gap: 6px; background: none; border: none;
  color: var(--ui-text-muted); font-weight: 600; font-size: 13px; cursor: pointer; padding: 0;
}
.jobs__advbtn:hover { color: var(--text-white); }
.jobs__advanced {
  grid-column: 1 / -1; display: grid; grid-template-columns: 1fr; gap: 12px;
  padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--ocean-form-surface);
  box-shadow: 0 18px 42px rgba(2, 5, 18, 0.22);
}
.jobs__filter-blocks { grid-column: 1 / -1; }
.jobs__filter-blocks :deep(.search-filter-blocks__grid) { align-items: end; }
.jobs-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
.jobs-filter-group__flags { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: center; }
.jobs__field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.jobs__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.jobs__field_inline { align-self: center; min-height: var(--ui-control-h-md); }
@media (min-width: 700px) {
  .jobs__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid_salary { grid-template-columns: minmax(0, 1.4fr) minmax(110px, .7fr) minmax(130px, .8fr); }
  .jobs-filter-group__grid_salary .jobs__field_inline { grid-column: 1 / -1; }
  .jobs__field_wide { grid-column: span 2; }
  .jobs-filter-actions { grid-column: 1 / -1; }
}
@media (min-width: 1200px) {
  .jobs__advanced { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .jobs-filter-group__grid_location { grid-template-columns: minmax(180px, .8fr) minmax(0, 1.6fr); }
}

.jobs__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-panel); }
.jobs__load-more {
  min-height: 76px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; margin-top: 16px; font-size: 12px;
}
.job-modal { display: flex; flex-direction: column; gap: 12px; }
.job-modal__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; }
.job-modal__badges { display: flex; flex-wrap: wrap; gap: 6px; }
.job-modal__langs { margin: 0; }
.job-modal__desc {
  font-size: 13.5px; line-height: 1.55; white-space: pre-wrap;
  color: var(--text-soft, inherit); max-height: 52vh; overflow-y: auto;
}
.job-modal__tags { margin-top: 4px; }
</style>
