<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { buildCvProfile, scoreJob, scoreColor, type CvProfile } from "~/utils/atsScore";
import { extractCvText } from "~/utils/cvExtract";

// Job Finder service. Auto-routed at /jobs. Aggregates many boards, enforces a
// 14-day freshness cap server-side, offers full sort + advanced filters, shows
// aggregate statistics (salary/countries/sources/languages/skills), and computes
// an ATS match score for each vacancy from a CV that stays in the browser.

interface LanguageReq { language: string; level?: string }
interface JobSkillDetail { name: string; category: string; subcategory: string }
interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  remote: boolean;
  tags: string[];
  postedAt: string;
  description?: string;
  employmentType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  applyUrl?: string;
  // derived
  country?: string;
  city?: string;
  workMode?: "remote" | "hybrid" | "office" | "unknown";
  relocation?: "offered" | "none" | "unknown";
  foreignerFriendly?: boolean;
  suspicious?: boolean;
  suspicionReasons?: string[];
  riskCategory?: "gambling" | "adult" | "scam" | null;
  noExperience?: boolean;
  languages?: LanguageReq[];
  skills?: string[];
  niceToHave?: string[];
  skillDetails?: JobSkillDetail[];
  niceToHaveDetails?: JobSkillDetail[];
  experienceMinYears?: number;
  experienceMaxYears?: number;
  salaryPeriod?: "hour" | "month" | "year";
  salaryUsd?: number; // normalized ANNUAL midpoint in USD
  salaryGross?: boolean;
  salaryNegotiable?: boolean;
  seniority?: "junior" | "middle" | "senior" | "lead" | null;
  managementRole?: boolean;
  education?: string;
  schedule?: string;
  contractType?: string;
  deadline?: string;
  tools?: string[];
  applicationLanguage?: string;
  employerType?: "direct" | "agency" | "board" | "telegram";
}
interface SalaryStat { count: number; medianUsd: number; avgUsd: number; minUsd: number; maxUsd: number }
interface JobStats {
  salary: SalaryStat;
  bySource: Record<string, { count: number; medianUsd: number }>;
  byCountry: Record<string, { count: number; medianUsd: number }>;
  byWorkMode: Record<string, number>;
  foreignerFriendly: number;
  byLanguage: Record<string, number>;
  topSkills: { skill: string; count: number }[];
}
interface JobResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  sources: Record<string, number>;
  stats: JobStats;
  rates?: Record<string, number>;
  warming?: boolean;
  loadedSources?: string[];
  pendingSources?: string[];
  failedSources?: string[];
}

const { t: translate, locale } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) =>
  translate(`jobs.${key}`, params);
const label = (ru: string, en: string) => String(locale.value).toLowerCase().startsWith("ru") ? ru : en;
const localePath = useLocalePath();

useSeoMeta({
  title: () => t("seoTitle"), description: () => t("seoDescription"),
  robots: () => "index, follow", ogType: () => "website",
  ogTitle: () => t("seoTitle"), ogDescription: () => t("seoDescription"),
  twitterTitle: () => t("seoTitle"), twitterDescription: () => t("seoDescription"),
});

const sourceOptions = [
  { value: "", labelKey: "all" },
  { value: "rss", label: "DOU.ua" },
  { value: "jooble", label: "Jooble" },
  { value: "themuse", label: "The Muse" },
  { value: "jobicy", label: "Jobicy" },
  { value: "remotive", label: "Remotive" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "arbeitnow", label: "Arbeitnow" },
  { value: "adzuna", label: "Adzuna" },
  { value: "companies", label: "Companies" },
  { value: "devkg", label: "DevKG (Kyrgyzstan)" },
  { value: "itjobsuz", label: "IT-Jobs.uz" },
  { value: "ishgo", label: "ishGO.uz" },
  { value: "telegram", label: "Telegram" },
  { value: "olx", label: "OLX" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "threads", label: "Threads" },
];

// CIS-focused country list (RU/BY excluded by the backend). "Remote" is NOT a
// country — remote/worldwide postings are filtered via the Work mode selector.
// No flag emojis: Windows renders them as raw region letters ("uz Uzbekistan").
const countryOptions = [
  { value: "", labelKey: "any" },
  { value: "UZ", label: "Uzbekistan" },
  { value: "UA", label: "Ukraine" },
  { value: "KZ", label: "Kazakhstan" },
  { value: "GE", label: "Georgia" },
  { value: "AZ", label: "Azerbaijan" },
  { value: "AM", label: "Armenia" },
  { value: "KG", label: "Kyrgyzstan" },
  { value: "MD", label: "Moldova" },
  { value: "RO", label: "Romania" },
  { value: "TJ", label: "Tajikistan" },
  { value: "TM", label: "Turkmenistan" },
  { value: "PL", label: "Poland" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "UK" },
  { value: "US", label: "USA" },
  { value: "CN", label: "China" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "TW", label: "Taiwan" },
];

const languageOptions = ["English", "German", "Russian", "Ukrainian", "Uzbek", "Kazakh", "French", "Spanish", "Polish", "Turkish", "Japanese"];
const levelOptions = ["A1", "A2", "B1", "B2", "C1", "C2", "Intermediate", "Upper-Intermediate", "Advanced", "Fluent", "Native"];

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
const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

// Convert between two currencies via USD. Returns undefined if a rate is unknown.
function convertCurrency(amount: number, from: string, to: string): number | undefined {
  const rf = usdRates.value[(from || "USD").toUpperCase()];
  const rt = usdRates.value[(to || "USD").toUpperCase()];
  if (!rf || !rt) return undefined;
  return Math.round((amount * rf) / rt);
}

function formatAmount(n: number, cur: string): string {
  const sym = CURRENCY_SYMBOL[cur.toUpperCase()];
  return sym ? `${sym}${n.toLocaleString()}` : `${n.toLocaleString()} ${cur.toUpperCase()}`;
}

// Pay-period conversion. PER_YEAR turns an amount at a period into a yearly amount
// (must match server enrich.ts: 160 work hours/month). To convert an amount from
// period A to B: multiply by PER_YEAR[A] / PER_YEAR[B].
const HOURS_PER_MONTH = 160;
const PER_YEAR: Record<string, number> = { hour: 12 * HOURS_PER_MONTH, month: 12, year: 1 };
const periodOptions = ["hour", "month", "year"] as const;
type Period = (typeof periodOptions)[number];

function convertPeriod(amount: number, from: Period, to: Period): number {
  return Math.round((amount * (PER_YEAR[from] ?? 1)) / (PER_YEAR[to] ?? 1));
}

const query = ref("");
const source = ref("");
const salaryMin = ref<number | undefined>(undefined);
const displayCurrency = ref("USD"); // currency the user wants amounts shown in
const displayPeriod = ref<Period>("month"); // hour | month | year for converted salaries
const sort = ref("date"); // date | oldest | title | company | salary | ats

// advanced filters — default to no country selected (= any). Country is a
// heuristic guess from job text, so pinning it to a single CIS country hides
// almost every vacancy; users can multi-select the countries they care about.
const countries = ref<string[]>([]);
const cities = ref(""); // free-text, comma-separated cities (any-of), may span countries
const includeRu = ref(false); // Russia is excluded by the backend unless opted-in
const includeBy = ref(false); // Belarus is excluded by the backend unless opted-in
const workMode = ref("");
const relocation = ref("");
const employmentKind = ref("");
const hasSalary = ref(false);
const maxExperience = ref<number | undefined>(undefined);
const foreignerOnly = ref(false);
// Hide gambling / adult / earnings-bait postings. Default ON; unchecking sends
// hideRiskyIndustries=false so the backend stops filtering them out.
const hideRisky = ref(true);
const noExperience = ref(false);
const language = ref("");
const languageLevel = ref("");
const excludeLanguages = ref<string[]>([]);
const skills = ref("");
const showAdvanced = ref(true);

// Reka UI reserves an empty string for clearing a combobox and throws when an
// item itself has value="". Keep the API-facing refs empty for "any", while
// exposing a non-empty sentinel to USelectMenu.
const ANY_SELECT_VALUE = "__any__";
function withAnyOption(model: { value: string }) {
  return computed<string>({
    get: () => model.value || ANY_SELECT_VALUE,
    set: (value) => {
      model.value = value === ANY_SELECT_VALUE ? "" : value;
    },
  });
}
const workModeSelect = withAnyOption(workMode);
const relocationSelect = withAnyOption(relocation);
const employmentKindSelect = withAnyOption(employmentKind);
const languageSelect = computed<string>({
  get: () => language.value || ANY_SELECT_VALUE,
  set: (value) => {
    language.value = value === ANY_SELECT_VALUE ? "" : value;
    if (!language.value) languageLevel.value = "";
  },
});
const languageLevelSelect = withAnyOption(languageLevel);

const jobs = ref<Job[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const stats = ref<JobStats | null>(null);
const loading = ref(false);
const loadingMore = ref(false);
const failed = ref(false);
const warming = ref(false);
const loadedSourceCount = ref(0);
const pendingSourceCount = ref(0);
const loadMoreSentinel = ref<HTMLElement | null>(null);
const activeJob = ref<Job | null>(null);
const jobModalOpen = ref(false);
const shareCopied = ref(false);
const shareCopiedJobId = ref<string | null>(null);

// ---- Personal vacancy lists (localStorage; no account or backend required) ----
type SavedJobsView = "active" | "favorites" | "hidden";
const HIDDEN_JOBS_KEY = "jobs:hidden:v1";
const FAVORITE_JOBS_KEY = "jobs:favorites:v1";
const MAX_SAVED_JOBS = 200;
const savedView = ref<SavedJobsView>("active");
const hiddenJobs = ref<Job[]>([]);
const favoriteJobs = ref<Job[]>([]);
const hiddenIds = computed(() => new Set(hiddenJobs.value.map((job) => job.id)));
const favoriteIds = computed(() => new Set(favoriteJobs.value.map((job) => job.id)));
const isHidden = (id: string) => hiddenIds.value.has(id);
const isFavorite = (id: string) => favoriteIds.value.has(id);

function loadSavedJobs() {
  if (!import.meta.client) return;
  try { hiddenJobs.value = JSON.parse(localStorage.getItem(HIDDEN_JOBS_KEY) || "[]"); } catch { /* ignore */ }
  try { favoriteJobs.value = JSON.parse(localStorage.getItem(FAVORITE_JOBS_KEY) || "[]"); } catch { /* ignore */ }
}

function persistSavedJobs() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(HIDDEN_JOBS_KEY, JSON.stringify(hiddenJobs.value));
    localStorage.setItem(FAVORITE_JOBS_KEY, JSON.stringify(favoriteJobs.value));
  } catch { /* storage full/disabled */ }
}

function upsertSaved(list: Job[], job: Job): Job[] {
  return [job, ...list.filter((item) => item.id !== job.id)].slice(0, MAX_SAVED_JOBS);
}

function toggleHidden(job: Job) {
  if (isHidden(job.id)) {
    hiddenJobs.value = hiddenJobs.value.filter((item) => item.id !== job.id);
  } else {
    hiddenJobs.value = upsertSaved(hiddenJobs.value, job);
    favoriteJobs.value = favoriteJobs.value.filter((item) => item.id !== job.id);
    if (activeJob.value?.id === job.id) jobModalOpen.value = false;
  }
  persistSavedJobs();
}

function toggleFavorite(job: Job) {
  if (isFavorite(job.id)) {
    favoriteJobs.value = favoriteJobs.value.filter((item) => item.id !== job.id);
  } else {
    favoriteJobs.value = upsertSaved(favoriteJobs.value, job);
    hiddenJobs.value = hiddenJobs.value.filter((item) => item.id !== job.id);
  }
  persistSavedJobs();
}

function selectSavedView(view: SavedJobsView) {
  savedView.value = view;
}

// ---- Seen / recently-viewed (localStorage) ----
type RecentJob = { id: string; title: string; company: string; url: string; source: string };
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
  try {
    await navigator.clipboard.writeText(link);
    shareCopiedJobId.value = job.id;
    setTimeout(() => {
      if (shareCopiedJobId.value === job.id) shareCopiedJobId.value = null;
    }, 2000);
    return true;
  } catch {
    return false;
  }
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
let loadSequence = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let loadMoreObserver: IntersectionObserver | undefined;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const hasMore = computed(() => savedView.value === "active" && sort.value !== "ats" && page.value < totalPages.value);
const canLoadMore = computed(() =>
  hasMore.value
  && !warming.value
  && !loading.value
  && !loadingMore.value
  && page.value < totalPages.value,
);

function scheduleWarmPoll() {
  if (warmTimer) clearTimeout(warmTimer);
  if (!warming.value) return;
  warmTimer = setTimeout(() => {
    warmTimer = undefined;
    void load(1, { background: true });
  }, 1800);
}

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
const cvProfile = ref<CvProfile | null>(null);
const cvPaste = ref("");
const cvError = ref<string | null>(null);
const cvLoading = ref(false);

const displayedJobs = computed(() => {
  if (savedView.value === "favorites") return favoriteJobs.value;
  if (savedView.value === "hidden") return hiddenJobs.value;
  return jobs.value.filter((job) => !isHidden(job.id));
});
const displayedTotal = computed(() => savedView.value === "active" ? total.value : displayedJobs.value.length);

const scored = computed(() => {
  const profile = cvProfile.value;
  const list = displayedJobs.value.map((job) => ({
    job,
    ats: profile ? scoreJob(profile, job) : null,
  }));
  if (profile && sort.value === "ats") {
    list.sort((a, b) => (b.ats?.score ?? 0) - (a.ats?.score ?? 0));
  }
  return list;
});

const countryLabel = (code: string) =>
  countryOptions.find((c) => c.value === code)?.label ?? code;

async function load(
  toPage = 1,
  options: { append?: boolean; background?: boolean } = {},
) {
  const requestId = ++loadSequence;
  if (!options.background) {
    if (warmTimer) clearTimeout(warmTimer);
    if (options.append) loadingMore.value = true;
    else loading.value = true;
    failed.value = false;
  }
  const serverSort = sort.value === "ats" ? "date" : sort.value; // ATS sorts client-side
  const params: Record<string, string> = {
    page: String(toPage), pageSize: String(cvProfile.value ? 50 : pageSize.value), sort: serverSort,
  };
  if (query.value) params.q = query.value;
  if (source.value) params.source = source.value;
  if (salaryMin.value) {
    // salaryMin is entered in the chosen currency + period; the server filters on
    // the ANNUAL-USD salaryUsd, so convert currency→USD then period→year.
    const inUsd = convertCurrency(salaryMin.value, displayCurrency.value, "USD");
    if (inUsd) params.salaryMin = String(convertPeriod(inUsd, displayPeriod.value, "year"));
  }
  if (countries.value.length) params.country = countries.value.join(",");
  if (cities.value.trim()) params.cities = cities.value.trim();
  if (includeRu.value) params.includeRu = "true";
  if (includeBy.value) params.includeBy = "true";
  if (workMode.value) params.workMode = workMode.value;
  if (relocation.value) params.relocation = relocation.value;
  if (employmentKind.value) params.employmentKind = employmentKind.value;
  if (hasSalary.value) params.hasSalary = "true";
  if (maxExperience.value != null) params.maxExperienceYears = String(maxExperience.value);
  if (foreignerOnly.value) params.foreignerFriendly = "true";
  if (!hideRisky.value) params.hideRiskyIndustries = "false";
  if (noExperience.value) params.noExperience = "true";
  if (language.value) params.language = language.value;
  if (languageLevel.value) params.languageLevel = languageLevel.value;
  if (excludeLanguages.value.length) params.excludeLanguage = excludeLanguages.value.join(",");
  if (skills.value.trim()) params.skills = skills.value.trim();

  // Served by Nitro at /jobs-feed (NOT under /api, which the host site proxies to FastAPI).
  const { data, error } = await safeFetch<JobResult>("/jobs-feed", { params });
  // A slower previous request must never overwrite a newer filter selection.
  if (requestId !== loadSequence) return;
  if (error || !data) {
    if (!options.background) {
      failed.value = true;
      if (!options.append) {
        jobs.value = []; total.value = 0; stats.value = null;
      }
    }
  } else {
    if (data.rates && data.rates.USD) usdRates.value = data.rates;
    if (options.append) {
      const known = new Set(jobs.value.map((job) => job.url || job.id));
      jobs.value = [...jobs.value, ...data.jobs.filter((job) => !known.has(job.url || job.id))];
    } else {
      jobs.value = data.jobs;
    }
    total.value = data.total; page.value = data.page;
    pageSize.value = data.pageSize; stats.value = data.stats;
    warming.value = !!data.warming;
    loadedSourceCount.value = data.loadedSources?.length ?? 0;
    pendingSourceCount.value = data.pendingSources?.length ?? 0;
  }
  loading.value = false;
  loadingMore.value = false;
  // Persist the filters that produced this result (foreground loads only, so a
  // background warm-poll or a "load more" page doesn't rewrite the URL).
  if (!options.append && !options.background) persistState();
  scheduleWarmPoll();
}

function loadMore() {
  if (canLoadMore.value) void load(page.value + 1, { append: true });
}

function resetFilters() {
  savedView.value = "active";
  countries.value = []; cities.value = ""; includeRu.value = false; includeBy.value = false;
  workMode.value = ""; relocation.value = "";
  employmentKind.value = ""; hasSalary.value = false; maxExperience.value = undefined;
  foreignerOnly.value = false; hideRisky.value = true; noExperience.value = false; language.value = ""; languageLevel.value = "";
  excludeLanguages.value = []; skills.value = "";
  scheduleLoad(100);
}

// ---- Shareable + persisted search state ----
// The current filters are mirrored to the URL query (so a search is shareable via
// the address bar) AND to localStorage (so a reload restores the last search).
const SEARCH_STATE_KEY = "jobs:last-search:v1";

function currentState(): Record<string, string> {
  const s: Record<string, string> = {};
  if (query.value.trim()) s.q = query.value.trim();
  if (source.value) s.source = source.value;
  if (salaryMin.value != null) s.salaryMin = String(salaryMin.value);
  if (displayCurrency.value !== "USD") s.currency = displayCurrency.value;
  if (displayPeriod.value !== "month") s.period = displayPeriod.value;
  if (sort.value !== "date") s.sort = sort.value;
  if (countries.value.length) s.country = countries.value.join(",");
  if (cities.value.trim()) s.cities = cities.value.trim();
  if (includeRu.value) s.includeRu = "1";
  if (includeBy.value) s.includeBy = "1";
  if (workMode.value) s.workMode = workMode.value;
  if (relocation.value) s.relocation = relocation.value;
  if (employmentKind.value) s.employment = employmentKind.value;
  if (hasSalary.value) s.hasSalary = "1";
  if (maxExperience.value != null) s.maxExp = String(maxExperience.value);
  if (foreignerOnly.value) s.foreigner = "1";
  if (!hideRisky.value) s.hideRisky = "0";
  if (noExperience.value) s.noExp = "1";
  if (language.value) s.language = language.value;
  if (languageLevel.value) s.level = languageLevel.value;
  if (excludeLanguages.value.length) s.exclLang = excludeLanguages.value.join(",");
  if (skills.value.trim()) s.skills = skills.value.trim();
  return s;
}

function applyState(s: Record<string, string>) {
  if (!s || typeof s !== "object") return;
  query.value = s.q ?? "";
  source.value = s.source ?? "";
  salaryMin.value = s.salaryMin ? Number(s.salaryMin) : undefined;
  displayCurrency.value = s.currency ?? "USD";
  displayPeriod.value = periodOptions.includes(s.period as Period) ? (s.period as Period) : "month";
  sort.value = s.sort ?? "date";
  countries.value = s.country ? s.country.split(",").filter(Boolean) : [];
  cities.value = s.cities ?? "";
  includeRu.value = s.includeRu === "1";
  includeBy.value = s.includeBy === "1";
  workMode.value = s.workMode ?? "";
  relocation.value = s.relocation ?? "";
  employmentKind.value = s.employment ?? "";
  hasSalary.value = s.hasSalary === "1";
  maxExperience.value = s.maxExp ? Number(s.maxExp) : undefined;
  foreignerOnly.value = s.foreigner === "1";
  hideRisky.value = s.hideRisky !== "0";
  noExperience.value = s.noExp === "1";
  language.value = s.language ?? "";
  languageLevel.value = s.level ?? "";
  excludeLanguages.value = s.exclLang ? s.exclLang.split(",").filter(Boolean) : [];
  skills.value = s.skills ?? "";
  // ATS sort needs a CV, which is never persisted — fall back to newest.
  if (sort.value === "ats") sort.value = "date";
}

function persistState() {
  if (!import.meta.client) return;
  const s = currentState();
  try {
    localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(s));
  } catch { /* storage full / disabled */ }
  const urlState = jobModalOpen.value && activeJob.value
    ? { ...s, job: activeJob.value.id }
    : s;
  const qs = new URLSearchParams(urlState).toString();
  // replaceState (not push) so the back button isn't spammed on every filter change.
  window.history.replaceState(window.history.state, "", qs ? `?${qs}` : window.location.pathname);
}

function restoreState() {
  if (!import.meta.client) return;
  const fromUrl = new URLSearchParams(window.location.search);
  // `job` is a share target, not a filter — it must not count as "URL has filters"
  // (otherwise a bare ?job=… link would wipe the visitor's saved search).
  if ([...fromUrl.keys()].some((k) => k !== "job")) {
    applyState(Object.fromEntries(fromUrl.entries()));
    return;
  }
  try {
    const raw = localStorage.getItem(SEARCH_STATE_KEY);
    if (raw) applyState(JSON.parse(raw));
  } catch { /* ignore corrupt state */ }
}

async function onCvFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  cvError.value = null;
  cvLoading.value = true;
  try {
    const text = await extractCvText(file);
    cvPaste.value = text;
    cvProfile.value = buildCvProfile(text);
    if (!jobs.value.length || total.value > pageSize.value) await load(1);
  } catch (err: any) {
    cvError.value = err?.message || t("atsReadError");
  } finally {
    cvLoading.value = false;
  }
}

function applyPastedCv() {
  if (cvPaste.value.trim().length < 30) {
    cvError.value = t("atsPasteTooShort");
    return;
  }
  cvError.value = null;
  cvProfile.value = buildCvProfile(cvPaste.value);
}

function clearCv() {
  cvProfile.value = null;
  cvPaste.value = "";
  cvError.value = null;
  if (sort.value === "ats") sort.value = "date";
}

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
  const sym = CURRENCY_SYMBOL[displayCurrency.value.toUpperCase()];
  const money = sym ? `${sym}${body}` : `${body} ${displayCurrency.value.toUpperCase()}`;
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
const activeAts = computed(() => (cvProfile.value && activeJob.value ? scoreJob(cvProfile.value, activeJob.value) : null));
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
const periodItems = computed<Item[]>(() => periodOptions.map((p) => ({ label: periodLabel(p), value: p })));
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

// Do not suspend SSR/hydration on the aggregated feed. A cold job store can
// take several seconds while upstream boards time out; keeping that request at
// top level leaves all filters rendered but inert until it finishes.
onMounted(() => {
  loadMoreObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) loadMore();
    },
    { rootMargin: "300px 0px" },
  );
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
watch(loadMoreSentinel, (element, previous) => {
  if (previous) loadMoreObserver?.unobserve(previous);
  if (element) loadMoreObserver?.observe(element);
});
onBeforeUnmount(() => {
  if (loadTimer) clearTimeout(loadTimer);
  if (warmTimer) clearTimeout(warmTimer);
  loadMoreObserver?.disconnect();
});
</script>

<template>
  <u-container class="jobs">
    <decorative-easter-egg
      class="jobs__easter-egg"
      src="/images/easter-eggs/jobs-search.png"
      :width="320"
      :height="185"
    />
    <div class="jobs__header text-center space-y-3">
      <h1 class="jobs__title">{{ t("title") }}</h1>
      <p class="jobs__headline text-muted">{{ t("headline") }}</p>
      <p class="jobs__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
    </div>

    <UiResultsLoader :loading="loading && savedView === 'active'" :label="t('searching')" min-height="420px">
    <!-- ATS CV panel -->
    <section class="ats">
      <div class="ats__head">
        <u-icon name="i-lucide-file-check-2" class="ats__icon" />
        <div>
          <div class="ats__title">{{ t("atsTitle") }}</div>
          <div class="ats__intro text-muted">{{ t("atsIntro") }}</div>
        </div>
      </div>
      <div class="ats__body">
        <label class="ats__upload">
          <input type="file" accept=".pdf,.docx,.txt,.md" class="hidden" @change="onCvFile" />
          <u-icon name="i-lucide-upload" /> {{ t("atsUpload") }}
        </label>
        <u-textarea
            v-model="cvPaste"
            :rows="3"
            :placeholder="t('atsPaste')"
            class="ats__paste"
            @blur="applyPastedCv"
        />
        <div class="ats__actions">
          <u-button v-if="cvProfile" variant="soft" color="neutral" icon="i-lucide-x" @click="clearCv">
            {{ t("atsClear") }}
          </u-button>
        </div>
      </div>
      <p v-if="cvError" class="jobs__error">{{ cvError }}</p>
      <p v-else-if="cvLoading" class="text-muted ats__status">…</p>
      <p v-else-if="cvProfile" class="ats__status" :style="{ color: '#34d399' }">{{ t("atsReady") }}</p>
    </section>

    <!-- Filters + sort -->
    <form class="jobs__controls" @submit.prevent="load(1)">
      <u-input v-model="query" clearable icon="i-lucide-search" :label="t('search')" :placeholder="t('searchPlaceholder')" @clear="clearSearch" />
      <div class="jobs__sort">
        <u-icon name="i-lucide-arrow-down-wide-narrow" />
        <u-select-menu
            v-model="sort"
            :items="sortItems"
            value-key="value"
            label-key="label"
            :search-input="false"
            class="jobs__select"
            :aria-label="t('sortLabel')"
            @update:model-value="(v: string) => v !== 'ats' && scheduleLoad()"
        />
      </div>

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
        <div class="jobs__saved-filters" :aria-label="t('savedFilters')">
          <button
              type="button"
              class="jobs__pill"
              :class="{ 'jobs__pill_active': savedView === 'active' }"
              @click="selectSavedView('active')"
          >{{ t("activeVacancies") }}</button>
          <button
              type="button"
              class="jobs__pill"
              :class="{ 'jobs__pill_active': savedView === 'favorites' }"
              @click="selectSavedView('favorites')"
          >{{ t("favoriteVacancies") }} · {{ favoriteJobs.length }}</button>
          <button
              type="button"
              class="jobs__pill"
              :class="{ 'jobs__pill_active': savedView === 'hidden' }"
              @click="selectSavedView('hidden')"
          >{{ t("hiddenVacancies") }} · {{ hiddenJobs.length }}</button>
        </div>
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
        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-map-pin" /> {{ label("Местоположение", "Location") }}</div>
          <div class="jobs-filter-group__grid jobs-filter-group__grid_location">
            <div class="jobs__field">
              <u-select-menu :label="t('country')" v-model="countries" :items="countryItems" value-key="value" label-key="label"
                  multiple :placeholder="t('countryPlaceholder')" class="jobs__select" @update:model-value="scheduleLoad()" />
            </div>
            <div class="jobs__field jobs__field_wide">
              <u-input v-model="cities" icon="i-lucide-map-pin" :label="t('cities')" :placeholder="t('citiesPlaceholder')"
                  @keyup.enter="load(1)" @change="scheduleLoad()" />
            </div>
          </div>
        </section>

        <section class="jobs-filter-group jobs-filter-group_salary">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-banknote" /> {{ label("Зарплата", "Salary") }}</div>
          <div class="jobs-filter-group__grid jobs-filter-group__grid_salary">
            <div class="jobs__field">
              <u-input v-model.number="salaryMin" type="number" min="0" icon="i-lucide-banknote"
                  :label="`${t('salaryMin')} (${displayCurrency}/${periodLabel(displayPeriod)})`" @change="scheduleLoad()" />
            </div>
            <div class="jobs__field">
              <u-select-menu :label="t('currency')" v-model="displayCurrency" :items="currencyItems" value-key="value" label-key="label"
                  class="jobs__select" @update:model-value="salaryMin && scheduleLoad()" />
            </div>
            <div class="jobs__field">
              <u-select-menu :label="t('period')" v-model="displayPeriod" :items="periodItems" value-key="value" label-key="label"
                  :search-input="false" class="jobs__select" @update:model-value="salaryMin && scheduleLoad()" />
            </div>
            <label class="jobs__remote jobs__field_inline">
              <u-switch v-model="hasSalary" @update:model-value="scheduleLoad()" />
              <span>{{ t("hasSalary") }}</span>
            </label>
          </div>
        </section>

        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-briefcase-business" /> {{ label("Условия работы", "Work conditions") }}</div>
          <div class="jobs-filter-group__grid">
            <div class="jobs__field"><u-select-menu :label="t('workMode')" v-model="workModeSelect" :items="workModeItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('relocation')" v-model="relocationSelect" :items="relocationItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('employment')" v-model="employmentKindSelect" :items="employmentKindItems" value-key="value" label-key="label" :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-input v-model.number="maxExperience" type="number" min="0" max="40" icon="i-lucide-briefcase" :label="t('experienceMax')" :placeholder="t('experienceMaxPlaceholder')" @keyup.enter="load(1)" @change="scheduleLoad()" /></div>
            <label class="jobs__remote jobs__field_inline"><u-switch v-model="noExperience" @update:model-value="scheduleLoad()" /><span>{{ t("noExperience") }}</span></label>
            <label class="jobs__remote jobs__field_inline"><u-switch v-model="foreignerOnly" @update:model-value="scheduleLoad()" /><span>{{ t("foreigner") }}</span></label>
          </div>
        </section>

        <section class="jobs-filter-group">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-languages" /> {{ label("Навыки и языки", "Skills & languages") }}</div>
          <div class="jobs-filter-group__grid">
            <div class="jobs__field"><u-select-menu :label="t('language')" v-model="languageSelect" :items="languageItems" value-key="value" label-key="label" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('languageLevel')" v-model="languageLevelSelect" :items="levelItems" value-key="value" label-key="label" :search-input="false" :disabled="!language" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field"><u-select-menu :label="t('excludeLanguage')" v-model="excludeLanguages" :items="excludeLanguageItems" value-key="value" label-key="label" multiple :placeholder="t('excludeLangPlaceholder')" class="jobs__select" @update:model-value="scheduleLoad()" /></div>
            <div class="jobs__field jobs__field_wide"><u-input v-model="skills" icon="i-lucide-wrench" :label="t('skills')" :placeholder="t('skillsPlaceholder')" @keyup.enter="load(1)" /></div>
          </div>
        </section>

        <section class="jobs-filter-group jobs-filter-group_flags">
          <div class="jobs-filter-group__title"><u-icon name="i-lucide-shield-check" /> {{ label("Исключения и охват", "Exclusions & coverage") }}</div>
          <div class="jobs-filter-group__flags">
            <label class="jobs__remote" :title="t('hideRiskyHint')"><u-switch v-model="hideRisky" @update:model-value="scheduleLoad()" /><span>{{ t("hideRisky") }}</span></label>
            <label class="jobs__remote"><u-switch v-model="includeRu" @update:model-value="scheduleLoad()" /><span>{{ t("includeRu") }}</span></label>
            <label class="jobs__remote"><u-switch v-model="includeBy" @update:model-value="scheduleLoad()" /><span>{{ t("includeBy") }}</span></label>
          </div>
        </section>

        <div class="jobs-filter-actions">
          <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">{{ t("reset") }}</u-button>
        </div>
      </div>
    </form>

    <p v-if="failed" class="jobs__error">{{ t("error") }}</p>
    <p v-else-if="warming && savedView === 'active'" class="jobs__warming" role="status" aria-live="polite">
      <span class="jobs__warming-dot" aria-hidden="true"></span>
      {{ t("warming", { loaded: loadedSourceCount, pending: pendingSourceCount }) }}
    </p>
    <p v-else class="jobs__count text-muted">{{ t("jobsFound", { n: displayedTotal }) }}</p>

    <!-- Statistics panel -->
    <section v-if="savedView === 'active' && stats && total" class="stats">
      <div class="stats__head">
        <u-icon name="i-lucide-bar-chart-3" class="stats__icon" />
        <span class="stats__title">{{ t("statsTitle") }}</span>
      </div>
      <div class="stats__grid">
        <div class="stats__card">
          <div class="stats__label">{{ t("statsSalary") }} ({{ displayCurrency }}/{{ periodLabel(displayPeriod) }})</div>
          <template v-if="stats.salary.count">
            <div class="stats__big">{{ money(stats.salary.medianUsd) }}</div>
            <div class="stats__sub text-muted">
              {{ t("statAvg") }} {{ money(stats.salary.avgUsd) }} ·
              {{ t("statRange") }} {{ money(stats.salary.minUsd) }}–{{ money(stats.salary.maxUsd) }}
            </div>
            <div class="stats__sub text-muted">{{ t("statSamples", { n: stats.salary.count }) }}</div>
          </template>
          <div v-else class="stats__sub text-muted">{{ t("statNone") }}</div>
        </div>

        <div v-if="countryStats.length" class="stats__card">
          <div class="stats__label">{{ t("statByCountry") }}</div>
          <div v-for="[code, v] in countryStats.slice(0, 6)" :key="code" class="stats__row">
            <span class="stats__row-key">{{ countryLabel(code) }}</span>
            <span class="stats__row-val">{{ money(v.medianUsd) }} <em class="text-muted">({{ v.count }})</em></span>
          </div>
        </div>

        <div v-if="sourceStats.length" class="stats__card">
          <div class="stats__label">{{ t("statBySource") }}</div>
          <div v-for="[src, v] in sourceStats.slice(0, 6)" :key="src" class="stats__row">
            <span class="stats__row-key">{{ src }}</span>
            <span class="stats__row-val">{{ money(v.medianUsd) }} <em class="text-muted">({{ v.count }})</em></span>
          </div>
        </div>

        <div v-if="workModeStats.length" class="stats__card">
          <div class="stats__label">{{ t("statByMode") }}</div>
          <div v-for="wm in workModeStats" :key="wm.key" class="stats__row">
            <span class="stats__row-key">{{ t("wm" + wm.key.charAt(0).toUpperCase() + wm.key.slice(1)) }}</span>
            <span class="stats__row-val">{{ wm.n }}</span>
          </div>
          <div class="stats__row stats__row_hl">
            <span class="stats__row-key">{{ t("foreigner") }}</span>
            <span class="stats__row-val">{{ stats.foreignerFriendly }}</span>
          </div>
        </div>

        <div v-if="languageStats.length" class="stats__card">
          <div class="stats__label">{{ t("statLanguages") }}</div>
          <div class="stats__chips">
            <span v-for="[lang, n] in languageStats" :key="lang" class="stats__chip">{{ lang }} · {{ n }}</span>
          </div>
        </div>

        <div v-if="stats.topSkills.length" class="stats__card stats__card_wide">
          <div class="stats__label">{{ t("statTopSkills") }}</div>
          <div class="stats__chips">
            <span v-for="s in stats.topSkills" :key="s.skill" class="stats__chip stats__chip_skill">{{ s.skill }} · {{ s.count }}</span>
          </div>
        </div>
      </div>
    </section>
<!-- Recently viewed (last up to 4) -->
    <section v-if="recentlyViewed.length" class="recent">
      <div class="recent__title">{{ t("recentlyViewed") }}</div>
      <div class="recent__row">
        <button v-for="r in recentlyViewed" :key="r.id" type="button" class="recent__chip" @click="openSharedJob(r.id)">
          <span class="recent__chip-title">{{ r.title }}</span>
          <span class="recent__chip-company">{{ r.company }}</span>
        </button>
      </div>
    </section>

    <div class="jobs__grid">
      <div
          v-for="{ job, ats } in scored"
          :key="job.id"
          class="job-card"
          :class="{
            'job-card_seen': isSeen(job.id),
            'job-card_favorite': isFavorite(job.id),
            'job-card_hidden': isHidden(job.id),
          }"
      >
        <div class="job-card__head">
          <button type="button" class="job-card__title" @click="openJob(job)">{{ job.title }}</button>
          <div class="job-card__actions">
            <span
                v-if="ats"
                class="job-card__ats"
                :style="{ color: scoreColor(ats.score), borderColor: scoreColor(ats.score) }"
                :title="ats.missing.length ? t('atsMissing') + ': ' + ats.missing.join(', ') : ''"
            >{{ ats.score }}% {{ t("atsMatch") }}</span>
            <button
                type="button"
                class="job-card__action"
                :aria-label="t('share')"
                :title="t('share')"
                @click="shareJob(job)"
            ><u-icon :name="shareCopiedJobId === job.id ? 'i-lucide-check' : 'i-lucide-share-2'" /></button>
            <a
                :href="job.url"
                target="_blank"
                rel="noopener noreferrer"
                class="job-card__action"
                :aria-label="t('openSource')"
                :title="t('openSource')"
                @click="markSeen(job)"
            ><u-icon name="i-lucide-external-link" /></a>
            <button
                type="button"
                class="job-card__action"
                :class="{ 'job-card__action_active': isFavorite(job.id) }"
                :aria-label="isFavorite(job.id) ? t('removeFavorite') : t('addFavorite')"
                :title="isFavorite(job.id) ? t('removeFavorite') : t('addFavorite')"
                @click="toggleFavorite(job)"
            ><u-icon name="i-lucide-heart" /></button>
            <button
                type="button"
                class="job-card__action"
                :aria-label="isHidden(job.id) ? t('restoreVacancy') : t('hideVacancy')"
                :title="isHidden(job.id) ? t('restoreVacancy') : t('hideVacancy')"
                @click="toggleHidden(job)"
            ><u-icon :name="isHidden(job.id) ? 'i-lucide-eye' : 'i-lucide-eye-off'" /></button>
          </div>
        </div>
        <div class="job-card__meta text-muted">
          <span class="job-card__company">{{ job.company }}</span>
          <span class="job-card__dot">·</span>
          <span>{{ job.location }}</span>
          <span class="job-card__dot">·</span>
          <span>{{ timeAgo(job.postedAt) }}</span>
          <span v-if="employerTypeLabel(job.employerType)" class="job-card__badge job-card__badge_source">{{ employerTypeLabel(job.employerType) }}</span>
          <span v-if="isToday(job.postedAt)" class="job-card__badge job-card__badge_new">{{ t("newToday") }}</span>
          <span v-if="isSeen(job.id)" class="job-card__badge job-card__badge_seen">{{ t("seen") }}</span>
          <span v-if="job.workMode && job.workMode !== 'unknown'" class="job-card__badge job-card__badge_mode">{{ t("wm" + job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)) }}</span>
          <span v-else-if="job.remote" class="job-card__badge">{{ t("remote") }}</span>
          <span v-if="empLabel(job.employmentKind)" class="job-card__badge job-card__badge_employment">{{ empLabel(job.employmentKind) }}</span>
          <span v-if="seniorityLabel(job.seniority)" class="job-card__badge job-card__badge_seniority">{{ seniorityLabel(job.seniority) }}</span>
          <span v-if="job.managementRole" class="job-card__badge job-card__badge_management">{{ t("management") }}</span>
          <span v-if="job.experienceMinYears !== undefined && job.experienceMinYears > 0" class="job-card__badge job-card__badge_exp">{{ t("experienceYears", { n: job.experienceMinYears }) }}</span>
          <span v-if="job.foreignerFriendly" class="job-card__badge job-card__badge_visa">{{ t("cardForeigner") }}</span>
          <span v-if="job.suspicious" class="job-card__badge job-card__badge_suspicious" :title="suspicionHint(job)">⚠ {{ t("suspicious") }}</span>
          <span v-if="job.relocation === 'offered'" class="job-card__badge job-card__badge_reloc">{{ t("cardReloc") }}</span>
          <span v-if="formatSalary(job)" class="job-card__badge job-card__badge_salary">{{ t("salaryDisclosed") }}</span>
          <span v-if="job.salaryNegotiable" class="job-card__badge job-card__badge_salary">{{ t("salaryNegotiable") }}</span>
          <span v-if="formatSalary(job)" class="job-card__salary">{{ formatSalary(job) }}</span>
          <span v-if="convertedSalary(job)" class="job-card__salary job-card__salary_conv">{{ convertedSalary(job) }}</span>
        </div>
        <div v-if="job.languages && job.languages.length" class="job-card__langs text-muted">
          <u-icon name="i-lucide-languages" class="job-card__lang-icon" />
          <span v-for="l in job.languages" :key="l.language" class="job-card__lang">
            {{ l.language }}<template v-if="l.level"> ({{ l.level }})</template>
          </span>
        </div>
        <p v-if="job.description" class="job-card__desc text-muted">{{ job.description }}</p>
        <button type="button" class="job-card__details-btn" @click="openJob(job)">{{ t("viewVacancy") }}</button>
        <template v-if="ats">
          <div v-if="ats.matched.length" class="job-card__skills">
            <span class="job-card__skills-label">{{ t("atsMatched") }}:</span>
            <span v-for="kw in ats.matched" :key="kw" class="job-card__tag job-card__tag_match">{{ kw }}</span>
          </div>
          <div v-if="ats.missing.length" class="job-card__skills">
            <span class="job-card__skills-label">{{ t("atsMissing") }}:</span>
            <span v-for="kw in ats.missing" :key="kw" class="job-card__tag job-card__tag_miss">{{ kw }}</span>
          </div>
          <div v-if="!ats.matched.length && !ats.missing.length" class="job-card__skills">
            <span class="job-card__skills-label">{{ t("atsNoSkills") }}</span>
          </div>
        </template>
        <div v-else-if="job.skills && job.skills.length" class="job-card__tags">
          <span v-for="s in job.skills.slice(0, 8)" :key="s" class="job-card__tag job-card__tag_skill">{{ s }}</span>
          <span v-for="s in (job.niceToHave || []).slice(0, 4)" :key="'plus-' + s" class="job-card__tag job-card__tag_plus" :title="t('vNiceToHave')">+{{ s }}</span>
        </div>
        <div v-else-if="job.tags.length" class="job-card__tags">
          <span v-for="tag in job.tags.slice(0, 6)" :key="tag" class="job-card__tag">{{ tag }}</span>
        </div>
      </div>
     </div>
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
    <u-modal v-model:open="jobModalOpen" :title="activeJob?.title || ''" :ui="{ content: 'max-w-2xl' }">
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
    </u-modal>
  </u-container>
</template>

<style scoped>
.jobs { position: relative; isolation: isolate; overflow: hidden; padding-top: 24px; padding-bottom: 96px; }
.jobs__header { position: relative; z-index: 1; }
.jobs__easter-egg {
  position: absolute; top: 4px; left: -24px; z-index: 0;
  width: 270px; opacity: 0.18;
}
.jobs__title { font-size: 32px; font-weight: 600; }
.jobs__headline { font-size: 16px; }
.jobs__subtitle { max-width: 760px; font-size: 14px; }

.ats {
  margin: 28px 0 8px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(224, 103, 154, 0.06);
}
.ats__head { display: flex; gap: 12px; align-items: flex-start; }
.ats__icon { font-size: 22px; color: var(--color-primary, #e0679a); margin-top: 2px; }
.ats__title { font-weight: 600; }
.ats__intro { font-size: 13px; }
.ats__body {
  display: grid; gap: 10px; margin-top: 12px; align-items: center;
  grid-template-columns: 1fr;
  @media (min-width: 800px) { grid-template-columns: auto 1fr auto; }
}
.ats__upload {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer;
  border: 1px dashed rgba(224, 103, 154, 0.5); color: var(--text-white, inherit); font-weight: 700; font-size: 13px;
}
.ats__paste { width: 100%; }
.ats__actions { display: flex; justify-content: flex-end; }
.ats__status { margin-top: 10px; font-size: 13px; }
.hidden { display: none; }

.jobs__controls {
  margin: 16px 0 28px; display: grid; gap: 12px; grid-template-columns: 1fr;
  @media (min-width: 900px) { grid-template-columns: 1fr 200px 180px; }
}
.jobs__sort { display: flex; align-items: center; gap: 8px; }
/* u-select-menu carries the site's own theme; we only own the width here. */
.jobs__select { flex: 1; width: 100%; }
.jobs__select :deep(button) { width: 100%; }
.jobs__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.jobs__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.jobs__saved-filters {
  display: flex; flex-wrap: wrap; gap: 8px; padding-left: 12px;
  border-left: 1px solid var(--line);
}
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
  padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
}
.jobs-filter-group { min-width: 0; padding: 14px; border: 1px solid var(--line); border-radius: 9px; background: rgba(255,255,255,0.025); }
.jobs-filter-group__title { display: flex; align-items: center; gap: 7px; margin-bottom: 12px; color: var(--ui-text-muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.jobs-filter-group__title :deep(svg) { color: var(--accent-pink); }
.jobs-filter-group__grid { display: grid; grid-template-columns: 1fr; gap: 12px; align-items: end; }
.jobs-filter-group__flags { display: flex; flex-wrap: wrap; gap: 14px 24px; align-items: center; }
.jobs-filter-actions { display: flex; justify-content: flex-end; }
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

.stats {
  margin: 4px 0 26px; padding: 16px; border-radius: 10px;
  border: 1px solid var(--line); background: rgba(52,211,153,0.05);
}
.stats__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.stats__icon { font-size: 20px; color: #34d399; }
.stats__title { font-weight: 600; }
.stats__grid { display: grid; gap: 12px; grid-template-columns: 1fr; @media (min-width: 640px) { grid-template-columns: 1fr 1fr; } @media (min-width: 1000px) { grid-template-columns: repeat(3, 1fr); } }
.stats__card { padding: 12px 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }
.stats__card_wide { @media (min-width: 640px) { grid-column: 1 / -1; } }
.stats__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin-bottom: 8px; }
.stats__big { font-size: 26px; font-weight: 600; color: #34d399; }
.stats__sub { font-size: 12px; margin-top: 2px; }
.stats__row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 2px 0; }
.stats__row_hl { border-top: 1px solid var(--line); margin-top: 4px; padding-top: 6px; }
.stats__row-key { font-weight: 600; }
.stats__row-val { font-weight: 600; white-space: nowrap; }
.stats__row-val em { font-weight: 500; font-style: normal; font-size: 11px; }
.stats__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stats__chip { font-size: 12px; padding: 2px 9px; border-radius: 6px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.stats__chip_skill { border-color: rgba(224, 103, 154,0.35); color: #e79ec0; }

.jobs__grid {
  display: grid; gap: 12px; grid-template-columns: 1fr; align-items: stretch;
  grid-auto-rows: 1fr; /* every card the same height across all rows */
  @media (min-width: 640px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: 1024px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (min-width: 1440px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.job-card {
  padding: 16px; border-radius: 10px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  transition: transform 140ms ease, border-color 180ms ease;
  /* Uniform cards: fill the grid cell so every card in a row is the same height. */
  height: 100%; min-height: 210px; display: flex; flex-direction: column;
}
/* Tags/skills sink to the bottom so cards line up regardless of body length. */
/* Bottom group (details button + tags/skills) is pushed down via the
   details button's margin-top:auto, so every card's footer sits at the bottom. */
.job-card:hover { transform: translateY(-2px); border-color: rgba(224, 103, 154,0.40); }
.job-card__head {
  display: grid; grid-template-columns: minmax(0, 1fr);
  align-items: start; row-gap: 8px;
}
.job-card__actions {
  width: 100%; justify-self: stretch; display: flex; flex-wrap: wrap; justify-content: flex-end;
  align-items: center; gap: 5px; max-width: 100%;
}
.job-card__actions .job-card__ats { margin-right: auto; }
.job-card__action {
  width: 28px; height: 28px; display: inline-grid; place-items: center;
  padding: 0; border: 1px solid var(--line); border-radius: 6px;
  background: transparent; color: var(--ui-text-muted); cursor: pointer;
}
.job-card__action:hover { color: var(--accent-pink, #e0679a); border-color: rgba(224,103,154,0.45); }
.job-card__action_active { color: var(--accent-pink, #e0679a); background: rgba(224,103,154,0.12); }
.job-card__title {
  width: 100%; min-width: 0; overflow-wrap: break-word; word-break: normal;
  font-weight: 600; font-size: 16px; line-height: 1.35;
  padding: 0; border: 0; background: transparent; cursor: pointer; text-align: left;
  text-decoration: none; color: var(--text-white, inherit);
}
.job-card__title:hover { color: var(--color-primary, #e0679a); }
.job-card__src { justify-self: end; font-size: 11px; text-transform: capitalize; opacity: 0.6; white-space: nowrap; }
.job-card__ats {
  justify-self: end; white-space: nowrap;
  font-size: 12px; font-weight: 600; padding: 1px 8px;
  border: 1px solid; border-radius: 6px;
}
.job-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 4px; }
.job-card__company { font-weight: 600; }
.job-card__dot { opacity: 0.5; }
.job-card__badge { flex: 0 0 auto; white-space: nowrap; border-radius: 6px; padding: 1px 7px; font-size: 11px; color: #34d399; background: rgba(52,211,153,0.14); }
.job-card__badge_mode { color: #38bdf8; background: rgba(56,189,248,0.14); }
.job-card__badge_visa { color: #fbbf24; background: rgba(251,191,36,0.14); }
.job-card__badge_suspicious { color: #f87171; background: rgba(248,113,113,0.14); border-color: rgba(248,113,113,0.35); cursor: help; }
.job-card__badge_reloc { color: #f472b6; background: rgba(244,114,182,0.14); }
.job-card__badge_source { color: #c4b5fd; background: rgba(167,139,250,0.14); }
.job-card__badge_new { color: #6ee7b7; background: rgba(52,211,153,0.14); }
.job-card__badge_employment { color: #93c5fd; background: rgba(59,130,246,0.13); }
.job-card__badge_seniority { color: #f9a8d4; background: rgba(236,72,153,0.13); }
.job-card__badge_management { color: #fcd34d; background: rgba(245,158,11,0.13); }
.job-card__badge_salary { color: #f0abfc; background: rgba(217,70,239,0.12); }
.job-card__salary { border-radius: 6px; padding: 1px 7px; font-size: 11px; color: #e0679a; background: rgba(224, 103, 154,0.14); }
.job-card__salary_conv { color: #94a3b8; background: rgba(148,163,184,0.12); font-weight: 600; }
.job-card__langs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; }
.job-card__lang-icon { font-size: 14px; opacity: 0.7; }
.job-card__lang:not(:last-child)::after { content: ","; }
.job-card__desc {
  margin-top: 8px; font-size: 13px; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.job-card__tags, .job-card__skills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
.job-card__skills-label { font-size: 11px; opacity: 0.7; }
.job-card__tag { border-radius: 6px; padding: 2px 8px; font-size: 11px; border: 1px solid var(--line); color: var(--ui-text-muted); }
.job-card__tag_skill { border-color: rgba(224, 103, 154,0.3); color: #e79ec0; }
.job-card__tag_plus { border-color: rgba(52,211,153,0.35); color: #6ee7b7; }
.job-card__tag_match { border-color: rgba(52,211,153,0.45); color: #34d399; background: rgba(52,211,153,0.10); }
.job-card__tag_miss { border-color: rgba(248,113,113,0.4); color: #f87171; }
.jobs__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 10px; border: 1px solid var(--line); background: rgba(255,255,255,0.03); }
.jobs__load-more {
  min-height: 76px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; margin-top: 16px; font-size: 12px;
}
.job-card__details-btn {
  align-self: flex-start; margin-top: auto; padding: 0; background: none; border: none;
  color: var(--accent-pink, #e0679a); font-size: 12px; font-weight: 600; cursor: pointer;
}
.job-card__details-btn:hover { text-decoration: underline; }
.job-modal { display: flex; flex-direction: column; gap: 12px; }
.job-modal__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; }
.job-modal__badges { display: flex; flex-wrap: wrap; gap: 6px; }
.job-modal__langs { margin: 0; }
.job-modal__desc {
  font-size: 13.5px; line-height: 1.55; white-space: pre-wrap;
  color: var(--text-soft, inherit); max-height: 52vh; overflow-y: auto;
}
.job-modal__tags { margin-top: 4px; }
/* The apply and source links now use the shared footer classes from
   components/ui/ModalFooter.vue. Their old fixed 36px height was what the
   global override stylesheet existed to undo. */
.job-card_seen { opacity: 0.72; }
.job-card_seen:hover { opacity: 1; }
.job-card_favorite { border-color: rgba(224,103,154,0.48); }
.job-card_hidden { opacity: 0.62; border-style: dashed; }
.job-card__badge_seen { color: #94a3b8; background: rgba(148,163,184,0.14); }
.recent { margin: 4px 0 18px; }
.recent__title {
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  opacity: 0.7; margin-bottom: 8px;
}
.recent__row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
.recent__chip {
  display: flex; flex-direction: column; gap: 2px; text-align: left; min-width: 0;
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); cursor: pointer; transition: border-color 160ms ease;
}
.recent__chip:hover { border-color: rgba(224,103,154,0.4); }
.recent__chip-title {
  font-size: 12.5px; font-weight: 600; color: var(--text-white, inherit);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.recent__chip-company { font-size: 11px; color: var(--ui-text-muted); }
@media (max-width: 1100px) {
  .jobs__easter-egg { display: none; }
}
</style>
