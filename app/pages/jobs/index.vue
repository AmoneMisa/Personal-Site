<script setup lang="ts">
import { safeFetch } from "~/utils/safeFetch";
import { buildCvProfile, scoreJob, scoreColor, type CvProfile } from "~/utils/atsScore";
import { extractCvText } from "~/utils/cvExtract";

// Job Finder service. Auto-routed at /jobs. Aggregates many boards, enforces a
// 14-day freshness cap server-side, offers full sort + advanced filters, shows
// aggregate statistics (salary/countries/sources/languages/skills), and computes
// an ATS match score for each vacancy from a CV that stays in the browser.

interface LanguageReq { language: string; level?: string }
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
  languages?: LanguageReq[];
  skills?: string[];
  niceToHave?: string[];
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
}

const messages = {
  en: {
    title: "Job Finder", headline: "Vacancies from many sources, no older than 14 days",
    subtitle: "Search jobs aggregated from HeadHunter, DOU.ua, Jooble, The Muse, Jobicy, Remotive, RemoteOK, Arbeitnow and more. Tuned for Uzbekistan & CIS.",
    searchPlaceholder: "Title, keyword or company", locationPlaceholder: "Location",
    remoteOnly: "Remote only", search: "Search", searching: "Searching…", all: "All",
    sortLabel: "Sort", salaryMin: "Min salary", currency: "Currency", period: "Per",
    perHour: "hour", perMonth: "month", perYear: "year",
    sortDate: "Newest", sortOldest: "Oldest", sortTitle: "Title A–Z", sortCompany: "Company A–Z",
    sortSalary: "Salary", sortAts: "ATS match",
    jobsFound: "{n} jobs", empty: "No jobs match your search.", error: "Could not load jobs. Please try again.",
    prev: "Previous", next: "Next", page: "Page {page} / {total}", remote: "Remote", today: "today",
    yesterday: "yesterday", daysAgo: "{n}d ago", monthsAgo: "{n}mo ago",
    // advanced filters
    advanced: "Advanced filters", country: "Country", workMode: "Work mode", relocation: "Relocation",
    language: "Language", languageLevel: "Level", skills: "Skills (comma-separated)",
    foreigner: "Foreigner-friendly", any: "Any",
    wmRemote: "Remote", wmHybrid: "Hybrid", wmOffice: "Office",
    relYes: "Offered", relNo: "None", reset: "Reset filters",
    // stats
    statsTitle: "Statistics", statsSalary: "Salary", statMedian: "median", statAvg: "avg",
    statRange: "range", statSamples: "{n} with pay", statByCountry: "Median pay by country",
    statBySource: "Median pay by source", statByMode: "Work mode", statLanguages: "Languages in demand",
    statForeigner: "Foreigner-friendly: {n}", statTopSkills: "Top skills", statNone: "Not enough salary data yet.",
    // card
    cardForeigner: "foreigner-friendly", cardReloc: "relocation",
    atsTitle: "ATS match", atsIntro: "Upload or paste your CV to see how well you match each vacancy. Your CV stays in your browser.",
    atsUpload: "Upload CV (.pdf .docx .txt)", atsPaste: "…or paste CV text here",
    atsClear: "Clear CV", atsReady: "CV loaded — scores shown on each vacancy.", atsMatch: "match",
    atsMissing: "Missing keywords", seoTitle: "Job Finder — vacancies from many sources with ATS match",
    seoDescription: "Search fresh job vacancies (max 14 days) from multiple sources, filter by country/skills/language, see salary statistics, and get an ATS match score for your CV.",
  },
  ru: {
    title: "Поиск вакансий", headline: "Вакансии из множества источников, не старше 14 дней",
    subtitle: "Поиск вакансий из HeadHunter, DOU.ua, Jooble, The Muse, Jobicy, Remotive, RemoteOK, Arbeitnow и других. Настроено на Узбекистан и СНГ.",
    searchPlaceholder: "Должность, ключевое слово или компания", locationPlaceholder: "Локация",
    remoteOnly: "Только удалённо", search: "Искать", searching: "Поиск…", all: "Все",
    sortLabel: "Сортировка", salaryMin: "Зарплата от", currency: "Валюта", period: "За",
    perHour: "час", perMonth: "месяц", perYear: "год",
    sortDate: "Сначала новые", sortOldest: "Сначала старые", sortTitle: "Название A–Я", sortCompany: "Компания A–Я",
    sortSalary: "Зарплата", sortAts: "Совпадение ATS",
    jobsFound: "Вакансий: {n}", empty: "Ничего не найдено.", error: "Не удалось загрузить вакансии.",
    prev: "Назад", next: "Вперёд", page: "Страница {page} / {total}", remote: "Удалённо", today: "сегодня",
    yesterday: "вчера", daysAgo: "{n} дн. назад", monthsAgo: "{n} мес. назад",
    advanced: "Расширенные фильтры", country: "Страна", workMode: "Формат работы", relocation: "Релокация",
    language: "Язык", languageLevel: "Уровень", skills: "Навыки (через запятую)",
    foreigner: "Для иностранцев", any: "Любой",
    wmRemote: "Удалённо", wmHybrid: "Гибрид", wmOffice: "Офис",
    relYes: "Есть", relNo: "Нет", reset: "Сбросить фильтры",
    statsTitle: "Статистика", statsSalary: "Зарплата", statMedian: "медиана", statAvg: "средн.",
    statRange: "диапазон", statSamples: "{n} с зарплатой", statByCountry: "Медиана по странам",
    statBySource: "Медиана по источникам", statByMode: "Формат работы", statLanguages: "Востребованные языки",
    statForeigner: "Для иностранцев: {n}", statTopSkills: "Топ навыков", statNone: "Пока мало данных о зарплатах.",
    cardForeigner: "для иностранцев", cardReloc: "релокация",
    atsTitle: "Совпадение ATS", atsIntro: "Загрузите или вставьте резюме, чтобы увидеть, насколько вы подходите. Резюме остаётся в браузере.",
    atsUpload: "Загрузить резюме (.pdf .docx .txt)", atsPaste: "…или вставьте текст резюме",
    atsClear: "Очистить", atsReady: "Резюме загружено — оценки показаны у вакансий.", atsMatch: "совпадение",
    atsMissing: "Не хватает ключевых слов", seoTitle: "Поиск вакансий из множества источников с оценкой ATS",
    seoDescription: "Поиск свежих вакансий (не старше 14 дней) из разных источников, фильтры по стране/навыкам/языку, статистика зарплат и оценка ATS для резюме.",
  },
} as const;

const { t } = useI18n({ useScope: "local", messages });

useSeoMeta({
  title: () => t("seoTitle"), description: () => t("seoDescription"),
  robots: () => "index, follow", ogType: () => "website",
  ogTitle: () => t("seoTitle"), ogDescription: () => t("seoDescription"),
});

const sourceOptions = [
  { value: "", labelKey: "all" },
  { value: "headhunter", label: "HeadHunter" },
  { value: "rss", label: "DOU.ua" },
  { value: "jooble", label: "Jooble" },
  { value: "themuse", label: "The Muse" },
  { value: "jobicy", label: "Jobicy" },
  { value: "remotive", label: "Remotive" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "arbeitnow", label: "Arbeitnow" },
  { value: "adzuna", label: "Adzuna" },
  { value: "companies", label: "Companies" },
];

// CIS-focused country list (RU/BY excluded by the backend). REMOTE = worldwide.
const countryOptions = [
  { value: "", labelKey: "any" },
  { value: "UZ", label: "🇺🇿 Uzbekistan" },
  { value: "UA", label: "🇺🇦 Ukraine" },
  { value: "KZ", label: "🇰🇿 Kazakhstan" },
  { value: "GE", label: "🇬🇪 Georgia" },
  { value: "AZ", label: "🇦🇿 Azerbaijan" },
  { value: "AM", label: "🇦🇲 Armenia" },
  { value: "KG", label: "🇰🇬 Kyrgyzstan" },
  { value: "MD", label: "🇲🇩 Moldova" },
  { value: "TJ", label: "🇹🇯 Tajikistan" },
  { value: "TM", label: "🇹🇲 Turkmenistan" },
  { value: "PL", label: "🇵🇱 Poland" },
  { value: "DE", label: "🇩🇪 Germany" },
  { value: "GB", label: "🇬🇧 UK" },
  { value: "US", label: "🇺🇸 USA" },
  { value: "REMOTE", label: "🌍 Remote" },
];

const languageOptions = ["English", "German", "Russian", "Ukrainian", "Uzbek", "French", "Spanish", "Polish", "Turkish"];
const levelOptions = ["A1", "A2", "B1", "B2", "C1", "C2", "Intermediate", "Upper-Intermediate", "Advanced", "Fluent", "Native"];

// Approximate currency → USD rates. Mirrors server/utils/enrich.ts USD_RATES so the
// client can display salaries in the user's chosen currency without a refetch.
const USD_RATES: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, PLN: 0.25, UAH: 0.024, KZT: 0.0019,
  UZS: 0.000079, AZN: 0.59, GEL: 0.37, AMD: 0.0026, KGS: 0.011, MDL: 0.056,
  TJS: 0.092, TMT: 0.286, TRY: 0.030, CAD: 0.73, CHF: 1.12, INR: 0.012,
};
const currencyOptions = ["USD", "EUR", "UZS", "UAH", "KZT", "PLN", "GBP", "AZN", "GEL", "AMD", "KGS", "MDL", "TJS", "TRY"];
const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

// Convert between two currencies via USD. Returns undefined if a rate is unknown.
function convertCurrency(amount: number, from: string, to: string): number | undefined {
  const rf = USD_RATES[(from || "USD").toUpperCase()];
  const rt = USD_RATES[(to || "USD").toUpperCase()];
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
const location = ref("");
const remoteOnly = ref(false);
const source = ref("");
const salaryMin = ref<number | undefined>(undefined);
const displayCurrency = ref("USD"); // currency the user wants amounts shown in
const displayPeriod = ref<Period>("month"); // hour | month | year for converted salaries
const sort = ref("date"); // date | oldest | title | company | salary | ats

// advanced filters — default to "Any" country. Country is a heuristic guess from
// job text, so pinning it to a single CIS country (e.g. UZ) hides almost every
// vacancy; users can still narrow to Uzbekistan/CIS via the Country selector.
const country = ref("");
const workMode = ref("");
const relocation = ref("");
const foreignerOnly = ref(false);
const language = ref("");
const languageLevel = ref("");
const skills = ref("");
const showAdvanced = ref(true);

const jobs = ref<Job[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const stats = ref<JobStats | null>(null);
const loading = ref(false);
const failed = ref(false);

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

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

async function load(toPage = 1) {
  loading.value = true;
  failed.value = false;
  const serverSort = sort.value === "ats" ? "date" : sort.value; // ATS sorts client-side
  const params: Record<string, string> = {
    page: String(toPage), pageSize: String(cvProfile.value ? 50 : pageSize.value), sort: serverSort,
  };
  if (query.value) params.q = query.value;
  if (location.value) params.location = location.value;
  if (remoteOnly.value) params.remote = "true";
  if (source.value) params.source = source.value;
  if (salaryMin.value) {
    // salaryMin is entered in the chosen currency + period; the server filters on
    // the ANNUAL-USD salaryUsd, so convert currency→USD then period→year.
    const inUsd = convertCurrency(salaryMin.value, displayCurrency.value, "USD");
    if (inUsd) params.salaryMin = String(convertPeriod(inUsd, displayPeriod.value, "year"));
  }
  if (country.value) params.country = country.value;
  if (workMode.value) params.workMode = workMode.value;
  if (relocation.value) params.relocation = relocation.value;
  if (foreignerOnly.value) params.foreignerFriendly = "true";
  if (language.value) params.language = language.value;
  if (languageLevel.value) params.languageLevel = languageLevel.value;
  if (skills.value.trim()) params.skills = skills.value.trim();

  // Served by Nitro at /jobs-feed (NOT under /api, which the host site proxies to FastAPI).
  const { data, error } = await safeFetch<JobResult>("/jobs-feed", { params });
  if (error || !data) {
    failed.value = true; jobs.value = []; total.value = 0; stats.value = null;
  } else {
    jobs.value = data.jobs; total.value = data.total; page.value = data.page;
    pageSize.value = data.pageSize; stats.value = data.stats;
  }
  loading.value = false;
}

function resetFilters() {
  country.value = ""; workMode.value = ""; relocation.value = "";
  foreignerOnly.value = false; language.value = ""; languageLevel.value = ""; skills.value = "";
  load(1);
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
    cvError.value = err?.message || "Could not read file.";
  } finally {
    cvLoading.value = false;
  }
}

function applyPastedCv() {
  if (cvPaste.value.trim().length < 30) {
    cvError.value = "Please paste a bit more CV text.";
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
  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)}–${fmt(job.salaryMax)} ${cur}`.trim();
  return `${fmt(job.salaryMin || job.salaryMax)} ${cur}`.trim();
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

await load(1);
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
      <u-input v-model="location" icon="i-lucide-map-pin" :placeholder="t('locationPlaceholder')" />
      <u-input v-model.number="salaryMin" type="number" icon="i-lucide-banknote" :placeholder="`${t('salaryMin')} (${displayCurrency}/${periodLabel(displayPeriod)})`" />
      <div class="jobs__sort">
        <u-icon name="i-lucide-arrow-down-wide-narrow" />
        <select v-model="sort" class="jobs__select" :aria-label="t('sortLabel')" @change="sort !== 'ats' && load(1)">
          <option value="date">{{ t("sortDate") }}</option>
          <option value="oldest">{{ t("sortOldest") }}</option>
          <option value="title">{{ t("sortTitle") }}</option>
          <option value="company">{{ t("sortCompany") }}</option>
          <option value="salary">{{ t("sortSalary") }}</option>
          <option v-if="cvProfile" value="ats">{{ t("sortAts") }}</option>
        </select>
      </div>

      <div class="jobs__row">
        <div class="jobs__filters">
          <button
              v-for="opt in sourceOptions"
              :key="opt.value"
              type="button"
              class="jobs__pill"
              :class="{ 'jobs__pill_active': source === opt.value }"
              @click="source = opt.value"
          >
            {{ opt.label ?? t(opt.labelKey!) }}
          </button>
        </div>
        <label class="jobs__remote">
          <u-switch v-model="remoteOnly" />
          <span>{{ t("remoteOnly") }}</span>
        </label>
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
          <select v-model="country" class="jobs__select" @change="load(1)">
            <option v-for="c in countryOptions" :key="c.value" :value="c.value">
              {{ c.label ?? t(c.labelKey!) }}
            </option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("currency") }}</span>
          <select v-model="displayCurrency" class="jobs__select" @change="salaryMin && load(1)">
            <option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("period") }}</span>
          <select v-model="displayPeriod" class="jobs__select" @change="salaryMin && load(1)">
            <option v-for="p in periodOptions" :key="p" :value="p">{{ periodLabel(p) }}</option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("workMode") }}</span>
          <select v-model="workMode" class="jobs__select" @change="load(1)">
            <option value="">{{ t("any") }}</option>
            <option value="remote">{{ t("wmRemote") }}</option>
            <option value="hybrid">{{ t("wmHybrid") }}</option>
            <option value="office">{{ t("wmOffice") }}</option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("relocation") }}</span>
          <select v-model="relocation" class="jobs__select" @change="load(1)">
            <option value="">{{ t("any") }}</option>
            <option value="offered">{{ t("relYes") }}</option>
            <option value="none">{{ t("relNo") }}</option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("language") }}</span>
          <select v-model="language" class="jobs__select" @change="load(1)">
            <option value="">{{ t("any") }}</option>
            <option v-for="l in languageOptions" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label class="jobs__field">
          <span class="jobs__field-label">{{ t("languageLevel") }}</span>
          <select v-model="languageLevel" class="jobs__select" :disabled="!language" @change="load(1)">
            <option value="">{{ t("any") }}</option>
            <option v-for="lv in levelOptions" :key="lv" :value="lv">{{ lv }}</option>
          </select>
        </label>
        <label class="jobs__field jobs__field_wide">
          <span class="jobs__field-label">{{ t("skills") }}</span>
          <u-input v-model="skills" icon="i-lucide-wrench" placeholder="react, typescript, docker" @keyup.enter="load(1)" />
        </label>
        <label class="jobs__remote jobs__field_inline">
          <u-switch v-model="foreignerOnly" @update:model-value="load(1)" />
          <span>{{ t("foreigner") }}</span>
        </label>
        <u-button type="button" variant="ghost" color="neutral" size="sm" icon="i-lucide-rotate-ccw" @click="resetFilters">
          {{ t("reset") }}
        </u-button>
      </div>
    </form>

    <p v-if="failed" class="jobs__error">{{ t("error") }}</p>
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

    <div class="jobs__grid">
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
        <div v-if="ats && ats.missing.length" class="job-card__missing">
          <span class="job-card__missing-label">{{ t("atsMissing") }}:</span>
          <span v-for="kw in ats.missing" :key="kw" class="job-card__tag job-card__tag_miss">{{ kw }}</span>
        </div>
        <div v-else-if="job.skills && job.skills.length" class="job-card__tags">
          <span v-for="s in job.skills.slice(0, 8)" :key="s" class="job-card__tag job-card__tag_skill">{{ s }}</span>
          <span v-for="s in (job.niceToHave || []).slice(0, 4)" :key="'plus-' + s" class="job-card__tag job-card__tag_plus" :title="t('cardReloc')">+{{ s }}</span>
        </div>
        <div v-else-if="job.tags.length" class="job-card__tags">
          <span v-for="tag in job.tags.slice(0, 6)" :key="tag" class="job-card__tag">{{ tag }}</span>
        </div>
      </div>
    </div>

    <div v-if="!loading && !jobs.length && !failed" class="jobs__empty">
      <div class="text-muted">{{ t("empty") }}</div>
    </div>

    <nav v-if="totalPages > 1 && sort !== 'ats'" class="jobs__pager">
      <u-button variant="outline" :disabled="page <= 1 || loading" icon="i-lucide-chevron-left" @click="load(page - 1)">
        {{ t("prev") }}
      </u-button>
      <span class="text-muted">{{ t("page", { page, total: totalPages }) }}</span>
      <u-button variant="outline" :disabled="page >= totalPages || loading" trailing-icon="i-lucide-chevron-right" @click="load(page + 1)">
        {{ t("next") }}
      </u-button>
    </nav>
  </u-container>
</template>

<style scoped>
.jobs { padding-top: 24px; padding-bottom: 96px; }
.jobs__title { font-size: 32px; font-weight: 900; }
.jobs__headline { font-size: 16px; }
.jobs__subtitle { max-width: 760px; font-size: 14px; }

.ats {
  margin: 28px 0 8px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(128, 90, 245, 0.06);
}
.ats__head { display: flex; gap: 12px; align-items: flex-start; }
.ats__icon { font-size: 22px; color: var(--color-primary, #a78bfa); margin-top: 2px; }
.ats__title { font-weight: 900; }
.ats__intro { font-size: 13px; }
.ats__body {
  display: grid; gap: 10px; margin-top: 12px; align-items: center;
  grid-template-columns: 1fr;
  @media (min-width: 800px) { grid-template-columns: auto 1fr auto; }
}
.ats__upload {
  display: inline-flex; align-items: center; gap: 8px; white-space: nowrap;
  height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer;
  border: 1px dashed rgba(128, 90, 245, 0.5); color: var(--text-white, inherit); font-weight: 700; font-size: 13px;
}
.ats__paste { width: 100%; }
.ats__actions { display: flex; justify-content: flex-end; }
.ats__status { margin-top: 10px; font-size: 13px; }
.hidden { display: none; }

.jobs__controls {
  margin: 16px 0 28px; display: grid; gap: 12px; grid-template-columns: 1fr;
  @media (min-width: 900px) { grid-template-columns: 1fr 1fr 160px 180px; }
}
.jobs__sort { display: flex; align-items: center; gap: 8px; }
.jobs__select {
  flex: 1; height: 40px; padding: 0 10px; border-radius: 8px;
  border: 1px solid var(--ui-border); background: rgba(255,255,255,0.03); color: inherit; font-size: 14px;
}
.jobs__select:disabled { opacity: 0.5; }
.jobs__row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.jobs__filters { display: flex; flex-wrap: wrap; gap: 8px; }
.jobs__pill {
  height: 34px; padding: 0 13px; border-radius: 999px; border: 1px solid var(--ui-border);
  background: rgba(255,255,255,0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 12px;
  cursor: pointer; transition: filter 180ms ease, color 180ms ease;
}
.jobs__pill:hover { filter: brightness(1.06); color: var(--text-white); }
.jobs__pill_active { color: var(--text-white); border-color: rgba(128,90,245,0.40); background: rgba(128,90,245,0.18); }
.jobs__remote { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
.jobs__error { color: var(--ui-error, #f87171); }
.jobs__count { font-size: 13px; margin-bottom: 12px; }

.jobs__adv-toggle { margin-top: -2px; }
.jobs__advbtn {
  display: inline-flex; align-items: center; gap: 6px; background: none; border: none;
  color: var(--ui-text-muted); font-weight: 800; font-size: 13px; cursor: pointer; padding: 0;
}
.jobs__advbtn:hover { color: var(--text-white); }
.jobs__advanced {
  grid-column: 1 / -1; display: grid; gap: 12px 14px; align-items: end;
  grid-template-columns: 1fr;
  padding: 14px; border-radius: 14px; border: 1px solid var(--ui-border); background: rgba(255,255,255,0.02);
  @media (min-width: 700px) { grid-template-columns: repeat(3, 1fr); }
  @media (min-width: 1000px) { grid-template-columns: repeat(4, 1fr); }
}
.jobs__field { display: flex; flex-direction: column; gap: 5px; }
.jobs__field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
.jobs__field_wide { @media (min-width: 700px) { grid-column: span 2; } }
.jobs__field_inline { align-self: center; margin-top: 14px; }

.stats {
  margin: 4px 0 26px; padding: 16px; border-radius: 18px;
  border: 1px solid var(--ui-border); background: rgba(52,211,153,0.05);
}
.stats__head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.stats__icon { font-size: 20px; color: #34d399; }
.stats__title { font-weight: 900; }
.stats__grid { display: grid; gap: 12px; grid-template-columns: 1fr; @media (min-width: 640px) { grid-template-columns: 1fr 1fr; } @media (min-width: 1000px) { grid-template-columns: repeat(3, 1fr); } }
.stats__card { padding: 12px 14px; border-radius: 14px; border: 1px solid var(--ui-border); background: rgba(255,255,255,0.03); }
.stats__card_wide { @media (min-width: 640px) { grid-column: 1 / -1; } }
.stats__label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; margin-bottom: 8px; }
.stats__big { font-size: 26px; font-weight: 900; color: #34d399; }
.stats__sub { font-size: 12px; margin-top: 2px; }
.stats__row { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; padding: 2px 0; }
.stats__row_hl { border-top: 1px solid var(--ui-border); margin-top: 4px; padding-top: 6px; }
.stats__row-key { font-weight: 600; }
.stats__row-val { font-weight: 800; white-space: nowrap; }
.stats__row-val em { font-weight: 500; font-style: normal; font-size: 11px; }
.stats__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.stats__chip { font-size: 12px; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--ui-border); color: var(--ui-text-muted); }
.stats__chip_skill { border-color: rgba(128,90,245,0.35); color: #c4b5fd; }

.jobs__grid { display: grid; grid-template-columns: 1fr; gap: 12px; @media (min-width: 800px) { grid-template-columns: 1fr 1fr; } }
.job-card {
  padding: 16px; border-radius: 18px; border: 1px solid var(--ui-border);
  background: rgba(255,255,255,0.03); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
  transition: transform 140ms ease, border-color 180ms ease;
}
.job-card:hover { transform: translateY(-2px); border-color: rgba(128,90,245,0.40); }
.job-card__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.job-card__title { font-weight: 800; font-size: 16px; text-decoration: none; color: var(--text-white, inherit); }
.job-card__title:hover { color: var(--color-primary, #a78bfa); }
.job-card__src { font-size: 11px; text-transform: capitalize; opacity: 0.6; white-space: nowrap; }
.job-card__ats {
  font-size: 12px; font-weight: 800; white-space: nowrap; padding: 1px 8px;
  border: 1px solid; border-radius: 999px;
}
.job-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 4px; }
.job-card__company { font-weight: 600; }
.job-card__dot { opacity: 0.5; }
.job-card__badge { border-radius: 6px; padding: 1px 7px; font-size: 11px; color: #34d399; background: rgba(52,211,153,0.14); }
.job-card__badge_mode { color: #38bdf8; background: rgba(56,189,248,0.14); }
.job-card__badge_visa { color: #fbbf24; background: rgba(251,191,36,0.14); }
.job-card__badge_reloc { color: #f472b6; background: rgba(244,114,182,0.14); }
.job-card__salary { border-radius: 6px; padding: 1px 7px; font-size: 11px; color: #a78bfa; background: rgba(128,90,245,0.14); }
.job-card__salary_conv { color: #94a3b8; background: rgba(148,163,184,0.12); font-weight: 600; }
.job-card__langs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; margin-top: 6px; }
.job-card__lang-icon { font-size: 14px; opacity: 0.7; }
.job-card__lang:not(:last-child)::after { content: ","; }
.job-card__desc {
  margin-top: 8px; font-size: 13px; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.job-card__tags, .job-card__missing { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; align-items: center; }
.job-card__missing-label { font-size: 11px; opacity: 0.7; }
.job-card__tag { border-radius: 6px; padding: 2px 8px; font-size: 11px; border: 1px solid var(--ui-border); color: var(--ui-text-muted); }
.job-card__tag_skill { border-color: rgba(128,90,245,0.3); color: #c4b5fd; }
.job-card__tag_plus { border-color: rgba(52,211,153,0.35); color: #6ee7b7; }
.job-card__tag_miss { border-color: rgba(248,113,113,0.4); color: #f87171; }
.jobs__empty { margin-top: 18px; text-align: center; padding: 18px; border-radius: 18px; border: 1px solid var(--ui-border); background: rgba(255,255,255,0.03); }
.jobs__pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 24px; }
</style>
