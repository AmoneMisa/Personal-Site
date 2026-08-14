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
  // derived
  country?: string;
  workMode?: "remote" | "hybrid" | "office" | "unknown";
  relocation?: "offered" | "none" | "unknown";
  foreignerFriendly?: boolean;
  noExperience?: boolean;
  languages?: LanguageReq[];
  skills?: string[];
  niceToHave?: string[];
  skillDetails?: JobSkillDetail[];
  niceToHaveDetails?: JobSkillDetail[];
  experienceMinYears?: number;
  salaryPeriod?: "hour" | "month" | "year";
  salaryUsd?: number; // normalized ANNUAL midpoint in USD
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

const { t: translate } = useI18n();
const t = (key: string, params: Record<string, unknown> = {}) =>
  translate(`jobs.${key}`, params);

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
const includeRu = ref(false); // Russia is excluded by the backend unless opted-in
const includeBy = ref(false); // Belarus is excluded by the backend unless opted-in
const workMode = ref("");
const relocation = ref("");
const foreignerOnly = ref(false);
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
let loadSequence = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let warmTimer: ReturnType<typeof setTimeout> | undefined;
let loadMoreObserver: IntersectionObserver | undefined;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const hasMore = computed(() => sort.value !== "ats" && page.value < totalPages.value);
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

function selectSource(value: string) {
  if (source.value === value) return;
  source.value = value;
  scheduleLoad(100);
}

// ---- ATS ----
const cvProfile = ref<CvProfile | null>(null);
const cvPaste = ref("");
const cvError = ref<string | null>(null);
const cvLoading = ref(false);

const scored = computed(() => {
  const profile = cvProfile.value;
  const list = jobs.value.map((job) => ({
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
  if (includeRu.value) params.includeRu = "true";
  if (includeBy.value) params.includeBy = "true";
  if (workMode.value) params.workMode = workMode.value;
  if (relocation.value) params.relocation = relocation.value;
  if (foreignerOnly.value) params.foreignerFriendly = "true";
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
  scheduleWarmPoll();
}

function loadMore() {
  if (canLoadMore.value) void load(page.value + 1, { append: true });
}

function resetFilters() {
  countries.value = []; includeRu.value = false; includeBy.value = false;
  workMode.value = ""; relocation.value = "";
  foreignerOnly.value = false; noExperience.value = false; language.value = ""; languageLevel.value = "";
  excludeLanguages.value = []; skills.value = "";
  scheduleLoad(100);
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

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 30) return t("daysAgo", { n: days });
  return t("monthsAgo", { n: Math.floor(days / 30) });
}

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
  void load(1);
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
    <div class="jobs__header text-center space-y-3">
      <h1 class="jobs__title">{{ t("title") }}</h1>
      <p class="jobs__headline text-muted">{{ t("headline") }}</p>
      <p class="jobs__subtitle text-muted mx-auto">{{ t("subtitle") }}</p>
    </div>

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
      <u-input v-model="query" icon="i-lucide-search" :placeholder="t('searchPlaceholder')" />
      <u-input v-model.number="salaryMin" type="number" icon="i-lucide-banknote" :placeholder="`${t('salaryMin')} (${displayCurrency}/${periodLabel(displayPeriod)})`" />
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
        <u-button type="submit" :loading="loading" icon="i-lucide-search">
          {{ loading ? t("searching") : t("search") }}
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
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("country") }}</span>
          <u-select-menu
              v-model="countries" :items="countryItems" value-key="value" label-key="label"
              multiple :placeholder="t('countryPlaceholder')"
              class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("currency") }}</span>
          <u-select-menu
              v-model="displayCurrency" :items="currencyItems" value-key="value" label-key="label"
              class="jobs__select" @update:model-value="salaryMin && scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("period") }}</span>
          <u-select-menu
              v-model="displayPeriod" :items="periodItems" value-key="value" label-key="label"
              :search-input="false" class="jobs__select" @update:model-value="salaryMin && scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("workMode") }}</span>
          <u-select-menu
              v-model="workModeSelect" :items="workModeItems" value-key="value" label-key="label"
              :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("relocation") }}</span>
          <u-select-menu
              v-model="relocationSelect" :items="relocationItems" value-key="value" label-key="label"
              :search-input="false" class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("language") }}</span>
          <u-select-menu
              v-model="languageSelect" :items="languageItems" value-key="value" label-key="label"
              class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("languageLevel") }}</span>
          <u-select-menu
              v-model="languageLevelSelect" :items="levelItems" value-key="value" label-key="label"
              :search-input="false" :disabled="!language" class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("excludeLanguage") }}</span>
          <u-select-menu
              v-model="excludeLanguages" :items="excludeLanguageItems" value-key="value" label-key="label"
              multiple :placeholder="t('excludeLangPlaceholder')"
              class="jobs__select" @update:model-value="scheduleLoad()"
          />
        </label>
        <label class="jobs__field jobs__field_wide">
          <span class="jobs__field-label">{{ t("skills") }}</span>
          <u-input v-model="skills" icon="i-lucide-wrench" :placeholder="t('skillsPlaceholder')" @keyup.enter="load(1)" />
        </label>
        <label class="jobs__remote jobs__field_inline">
          <u-switch v-model="foreignerOnly" @update:model-value="scheduleLoad()" />
          <span>{{ t("foreigner") }}</span>
        </label>
        <label class="jobs__remote jobs__field_inline">
          <u-switch v-model="noExperience" @update:model-value="scheduleLoad()" />
          <span>{{ t("noExperience") }}</span>
        </label>
        <label class="jobs__remote jobs__field_inline">
          <u-switch v-model="includeRu" @update:model-value="scheduleLoad()" />
          <span>{{ t("includeRu") }}</span>
        </label>
        <label class="jobs__remote jobs__field_inline">
          <u-switch v-model="includeBy" @update:model-value="scheduleLoad()" />
          <span>{{ t("includeBy") }}</span>
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">
          {{ t("reset") }}
        </u-button>
      </div>
    </form>

    <p v-if="failed" class="jobs__error">{{ t("error") }}</p>
    <p v-else-if="warming" class="jobs__warming" role="status" aria-live="polite">
      <span class="jobs__warming-dot" aria-hidden="true"></span>
      {{ t("warming", { loaded: loadedSourceCount, pending: pendingSourceCount }) }}
    </p>
    <p v-else class="jobs__count text-muted">{{ t("jobsFound", { n: total }) }}</p>

    <!-- Statistics panel -->
    <section v-if="stats && total" class="stats">
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

    <div class="jobs__results">
     <div class="jobs__grid" :class="{ 'jobs__grid_loading': loading }">
      <div v-for="{ job, ats } in scored" :key="job.id" class="job-card">
        <div class="job-card__head">
          <a :href="job.url" target="_blank" rel="noopener noreferrer" class="job-card__title">{{ job.title }}</a>
          <span
              v-if="ats"
              class="job-card__ats"
              :style="{ color: scoreColor(ats.score), borderColor: scoreColor(ats.score) }"
              :title="ats.missing.length ? t('atsMissing') + ': ' + ats.missing.join(', ') : ''"
          >{{ ats.score }}% {{ t("atsMatch") }}</span>
          <span v-else class="job-card__src">{{ job.source }}</span>
        </div>
        <div class="job-card__meta text-muted">
          <span class="job-card__company">{{ job.company }}</span>
          <span class="job-card__dot">·</span>
          <span>{{ job.location }}</span>
          <span class="job-card__dot">·</span>
          <span>{{ timeAgo(job.postedAt) }}</span>
          <span v-if="job.workMode && job.workMode !== 'unknown'" class="job-card__badge job-card__badge_mode">{{ t("wm" + job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)) }}</span>
          <span v-else-if="job.remote" class="job-card__badge">{{ t("remote") }}</span>
          <span v-if="job.experienceMinYears !== undefined && job.experienceMinYears > 0" class="job-card__badge job-card__badge_exp">{{ t("experienceYears", { n: job.experienceMinYears }) }}</span>
          <span v-if="job.foreignerFriendly" class="job-card__badge job-card__badge_visa">{{ t("cardForeigner") }}</span>
          <span v-if="job.relocation === 'offered'" class="job-card__badge job-card__badge_reloc">{{ t("cardReloc") }}</span>
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
          <span v-for="s in (job.niceToHave || []).slice(0, 4)" :key="'plus-' + s" class="job-card__tag job-card__tag_plus" :title="t('cardReloc')">+{{ s }}</span>
        </div>
        <div v-else-if="job.tags.length" class="job-card__tags">
          <span v-for="tag in job.tags.slice(0, 6)" :key="tag" class="job-card__tag">{{ tag }}</span>
        </div>
      </div>
     </div>
     <div v-if="loading" class="jobs__loader" role="status" aria-live="polite">
       <u-icon name="i-lucide-loader-circle" class="jobs__loader-icon" />
       <span>{{ t("searching") }}</span>
     </div>
    </div>

    <div v-if="!loading && !warming && !jobs.length && !failed" class="jobs__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    <div v-if="sort !== 'ats' && jobs.length" ref="loadMoreSentinel" class="jobs__load-more">
      <u-button
        v-if="hasMore && !warming"
        variant="outline"
        :loading="loadingMore"
        :disabled="!canLoadMore"
        @click="loadMore"
      >
        {{ t("loadMore") }}
      </u-button>
      <span class="text-muted">{{ t("shown", { shown: jobs.length, total }) }}</span>
    </div>
  </u-container>
</template>

<style scoped>
.jobs { padding-top: 24px; padding-bottom: 96px; }
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
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end;
  grid-template-columns: 1fr;
  padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: rgba(255,255,255,0.02);
  @media (min-width: 700px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 1000px) { grid-template-columns: repeat(4, 1fr); }
}
.jobs__field { display: flex; flex-direction: column; gap: 5px; }
.jobs__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.jobs__field_wide { @media (min-width: 700px) { grid-column: span 2; } }
.jobs__field_inline { align-self: center; margin-top: 14px; }

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

.jobs__results { position: relative; }
.jobs__grid {
  display: grid; gap: 12px; grid-template-columns: 1fr; align-items: stretch;
  @media (min-width: 640px) { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 1024px) { grid-template-columns: repeat(3, 1fr); }
}
/* Dim + lock the current results while a new page/filter is loading, and float a
   spinner over them so it's clear the list is refreshing (not empty). */
.jobs__grid_loading { opacity: 0.35; pointer-events: none; transition: opacity 140ms ease; }
.jobs__loader {
  position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center;
  gap: 10px; padding-top: 72px; color: var(--ui-text-muted); font-weight: 600; z-index: 2;
}
.jobs__loader-icon { width: 28px; height: 28px; animation: jobs-spin 0.7s linear infinite; }
@keyframes jobs-spin { to { transform: rotate(360deg); } }
.job-card {
  padding: 16px; border-radius: 10px; border: 1px solid var(--line);
  background: rgba(255,255,255,0.03); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  transition: transform 140ms ease, border-color 180ms ease;
  /* Uniform cards: fill the grid cell so every card in a row is the same height. */
  height: 100%; min-height: 210px; display: flex; flex-direction: column;
}
/* Tags/skills sink to the bottom so cards line up regardless of body length. */
.job-card__tags, .job-card__skills:last-child { margin-top: auto; }
.job-card:hover { transform: translateY(-2px); border-color: rgba(224, 103, 154,0.40); }
.job-card__head {
  display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between;
  column-gap: 10px; row-gap: 6px;
}
.job-card__title {
  flex: 1 1 210px; min-width: 0; overflow-wrap: anywhere;
  font-weight: 600; font-size: 16px; line-height: 1.35;
  text-decoration: none; color: var(--text-white, inherit);
}
.job-card__title:hover { color: var(--color-primary, #e0679a); }
.job-card__src { font-size: 11px; text-transform: capitalize; opacity: 0.6; white-space: nowrap; }
.job-card__ats {
  flex: 0 0 auto; max-width: 100%; margin-left: auto;
  font-size: 12px; font-weight: 600; white-space: nowrap; padding: 1px 8px;
  border: 1px solid; border-radius: 6px;
}
.job-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 4px; }
.job-card__company { font-weight: 600; }
.job-card__dot { opacity: 0.5; }
.job-card__badge { flex: 0 0 auto; white-space: nowrap; border-radius: 6px; padding: 1px 7px; font-size: 11px; color: #34d399; background: rgba(52,211,153,0.14); }
.job-card__badge_mode { color: #38bdf8; background: rgba(56,189,248,0.14); }
.job-card__badge_visa { color: #fbbf24; background: rgba(251,191,36,0.14); }
.job-card__badge_reloc { color: #f472b6; background: rgba(244,114,182,0.14); }
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
</style>
