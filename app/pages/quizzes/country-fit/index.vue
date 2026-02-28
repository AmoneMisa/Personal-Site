<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import { countryFitQuiz } from "~/utils/quizzes/country/countryFit";
import { matchCountries, type UserProfile } from "~/composables/useCountryQuizEngine";
import {usRegions} from "~/utils/quizzes/country/usStates";
import {countries} from "~/utils/quizzes/country/countries";

type IndicesNormalized = {
  income: number | null;
  education: number | null;
  qualityOfLife: number | null;
  safety: number | null;

  internet?: number | null;
  unemployment?: number | null;
  air?: number | null;
  inequality?: number | null;
  health?: number | null;
};

type IndicesBundle = {
  key: string;
  updatedAtISO: string;
  normalized: IndicesNormalized;
  raw?: any;
};

type BundlesResponse = { items: IndicesBundle[] };

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// --------------------
// URL helpers
// --------------------
function encodeProfileToParam(profile: any) {
  const json = JSON.stringify(profile);
  return btoa(unescape(encodeURIComponent(json)))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
}

function decodeProfileFromParam(s: string) {
  const padded = s + "===".slice((s.length + 3) % 4);
  const b64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

function parseCsvParam(v: unknown): string[] {
  if (!v) return [];
  const s = Array.isArray(v) ? String(v[0] ?? "") : String(v);
  return s.split(",").map(x => x.trim()).filter(Boolean);
}

function toCsvParam(list: string[]) {
  return Array.from(new Set(list.map(x => x.trim()).filter(Boolean))).join(",");
}

// --------------------
// State from query
// --------------------
const selectedUSAStates = ref<string[]>([]);
const selectedCountries = ref<string[]>([]);

// применяем из URL (если есть), иначе из LS
function hydrateSelections() {
  const fromUrlStates = parseCsvParam(route.query.selectedUSAStates);
  const fromUrlCountries = parseCsvParam(route.query.selectedCountries);

  if (fromUrlStates.length || fromUrlCountries.length) {
    selectedUSAStates.value = fromUrlStates;
    selectedCountries.value = fromUrlCountries;
    return;
  }

  selectedUSAStates.value = lsGet<string[]>(LS_KEYS.selectedUSAStates, []);
  selectedCountries.value = lsGet<string[]>(LS_KEYS.selectedCountries, []);
}

hydrateSelections();

watch(() => route.query.selectedUSAStates, (v) => {
  const list = parseCsvParam(v);
  if (list.length) selectedUSAStates.value = list;
});

watch(() => route.query.selectedCountries, (v) => {
  const list = parseCsvParam(v);
  if (list.length) selectedCountries.value = list;
});
// --------------------
// Main state
// --------------------
useSeoMeta({
  title: () => t("seo.pages.countryFit.title"),
  description: () => t("seo.pages.countryFit.description"),
});

const answers = ref<Record<string, string>>({});

const user = ref<UserProfile>({
  job: { type: "remote" },
  languages: { ru: "native", en: "intermediate" },
  family: { status: "single", kidsCount: 0 },
  budget: { monthlyUSD: 2500, includesRent: true },
});

// --- apply profile from URL once ---
const appliedFromUrl = ref(false);
onMounted(() => {
  const p = route.query.profile;
  const s = Array.isArray(p) ? String(p[0] ?? "") : String(p ?? "");

  if (s) {
    try {
      const decoded = decodeProfileFromParam(s);
      if (decoded?.user) user.value = decoded.user;
      if (decoded?.answers) answers.value = decoded.answers;
      else if (!decoded?.user && decoded?.job) user.value = decoded;
    } catch (e) {
      console.warn("Failed to decode profile from URL:", e);
    }
    appliedFromUrl.value = true;
    return;
  }

  // если URL пустой — берём из LS
  const savedUser = lsGet<UserProfile | null>(LS_KEYS.user, null);
  if (savedUser) user.value = savedUser;

  appliedFromUrl.value = true;
});

// --------------------
// Update query (throttled)
// --------------------
let qTimer: any = null;
function scheduleQueryUpdate() {
  if (!appliedFromUrl.value) return; // пока не применили URL (или не попытались) — не перетираем
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    router.replace({
      query: {
        ...route.query,
        selectedUSAStates: toCsvParam(selectedUSAStates.value) || undefined,
        selectedCountries: toCsvParam(selectedCountries.value) || undefined,
        profile: encodeProfileToParam({ user: user.value, answers: answers.value }),
      },
    });
  }, 250);
}

watch(user, scheduleQueryUpdate, { deep: true });
watch(answers, scheduleQueryUpdate, { deep: true });
watch(selectedUSAStates, scheduleQueryUpdate, { deep: true });
watch(selectedCountries, scheduleQueryUpdate, { deep: true });

// --------------------
// Indices cache
// --------------------
const indicesMap = ref<Record<string, IndicesBundle | undefined>>({});
const indicesLoading = ref(false);

const loaded = new Set<string>();
const pending = new Set<string>();

async function fetchBundles(keys: string[]) {
  const res = await $fetch<BundlesResponse>("/api/indices/bundles", {
    method: "POST",
    body: { keys, includeRaw: false },
  });

  for (const b of res.items ?? []) {
    indicesMap.value[b.key] = b;
    loaded.add(b.key);
  }

  for (const k of keys) loaded.add(k);
}

async function ensureIndices(keys: string[]) {
  const uniq = Array.from(new Set(keys)).filter(Boolean);
  const toLoad = uniq.filter((k) => !loaded.has(k) && !pending.has(k));
  if (!toLoad.length) return;

  toLoad.forEach((k) => pending.add(k));
  indicesLoading.value = true;

  try {
    await fetchBundles(toLoad);
  } catch (e) {
    console.error("Failed to fetch indices bundles:", e);
  } finally {
    toLoad.forEach((k) => pending.delete(k));
    indicesLoading.value = false;
  }
}

// --------------------
// Results
// --------------------
const results = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, 12, {
      selectedUSAStates: selectedUSAStates.value,
      selectedCountries: selectedCountries.value,
      usaVariantsLimit: 6,
    })
);

const resultsAll = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, 999, {
      selectedUSAStates: selectedUSAStates.value,
      selectedCountries: selectedCountries.value,
      usaVariantsLimit: 999,
    })
);

const usaGroup = computed(() => resultsAll.value.find((g) => g.base.key === "countries.usa"));

const bestUsState = computed(() => {
  const variants = usaGroup.value?.variants ?? [];
  return variants.length ? variants[0] : null;
});

const filteredResults = computed(() => results.value.filter((g) => g.base.key !== "countries.usa"));

// --- pick 6 states: top6 + pinned from URL ---
const topUsaStates = computed(() => (usaGroup.value?.variants ?? []).slice(0, 6));

const pinnedUsaStates = computed(() => {
  const all = usaGroup.value?.variants ?? [];
  const map = new Map(all.map(v => [stateCodeFromKey(v.key), v]));
  return selectedUSAStates.value.map(code => map.get(code)).filter(Boolean) as any[];
});

// merge unique keeping order: pinned first, then top
const usaStatesForCompare = computed(() => {
  const out: any[] = [];
  const seen = new Set<string>();

  for (const r of pinnedUsaStates.value) {
    if (!seen.has(r.key)) { out.push(r); seen.add(r.key); }
  }
  for (const r of topUsaStates.value) {
    if (!seen.has(r.key)) { out.push(r); seen.add(r.key); }
  }
  return out.slice(0, 6);
});

// ensure indices for visible cards + usa compare list
watchEffect(() => {
  const keys: string[] = [];

  for (const g of results.value) {
    keys.push(g.base.key);
    if (g.city) keys.push(g.city.key);
  }

  if (bestUsState.value?.key) keys.push(bestUsState.value.key);

  for (const s of usaStatesForCompare.value) keys.push(s.key);

  // pinned countries (если ты хочешь их принудительно догружать для сравнения)
  for (const k of selectedCountries.value) keys.push(k);

  ensureIndices(keys);
});

function stateCodeFromKey(key: string) {
  const p = String(key).split(".");
  return p[0] === "countries" && p[1] === "usa" ? (p[2] ?? "") : "";
}

function toggleUsaState(key: string) {
  const code = stateCodeFromKey(key);
  if (!code) return;

  const set = new Set(selectedUSAStates.value); // теперь тут будут "al", "ca"
  if (set.has(code)) set.delete(code);
  else set.add(code);
  selectedUSAStates.value = Array.from(set);
}
// --------------------
// UI helpers
// --------------------
const LS_KEYS = {
  selectedUSAStates: "countryFit:selectedUSAStates",
  selectedCountries: "countryFit:selectedCountries",
  user: "countryFit:user",
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function fmt100(v: number | null | undefined) {
  if (typeof v !== "number") return "—";
  return `${Math.round(v)}/100`;
}

function hasAnyIndex(b: IndicesBundle | undefined) {
  const n = b?.normalized;
  if (!n) return false;
  return [n.income, n.education, n.qualityOfLife, n.safety, n.internet, n.unemployment, n.air, n.inequality, n.health]
      .some((x) => typeof x === "number");
}

const usaStateItems = computed(() =>
    usRegions.map(r => ({
      label: t(r.titleKey, r.fallbackName) || r.fallbackName,
      value: r.code, // важно: code ("ny"), а не key
    }))
);

const countryItems = computed(() => {
  return countries
      .filter((c: any) => !String(c.key).startsWith("countries.usa."))
      .map((c: any) => ({
        label: t(c.titleKey, c.fallbackName) || c.fallbackName,
        value: c.key,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
});

const addUsaState = ref<string>("");
const addCountry = ref<string>("");
function addUsaStateToCompare() {
  const code = String(addUsaState.value || "").toLowerCase().trim();
  if (!code) return;
  const set = new Set(selectedUSAStates.value);
  set.add(code);
  selectedUSAStates.value = Array.from(set);
  addUsaState.value = "";
}

function removeUsaState(code: string) {
  const set = new Set(selectedUSAStates.value);
  set.delete(code);
  selectedUSAStates.value = Array.from(set);
}

function addCountryToCompare() {
  const key = String(addCountry.value || "").trim();
  if (!key) return;
  const set = new Set(selectedCountries.value);
  set.add(key);
  selectedCountries.value = Array.from(set);
  addCountry.value = "";
}

function removeCountry(key: string) {
  const set = new Set(selectedCountries.value);
  set.delete(key);
  selectedCountries.value = Array.from(set);
}

watch(selectedUSAStates, (v) => lsSet(LS_KEYS.selectedUSAStates, v), { deep: true });
watch(selectedCountries, (v) => lsSet(LS_KEYS.selectedCountries, v), { deep: true });
watch(user, (v) => lsSet(LS_KEYS.user, v), { deep: true });
</script>

<template>
  <u-container class="py-8">
    <page-header
        title="quizzes.countryFit.title"
        headline="quizzes.countryFit.headline"
        class="mb-6"
    />

    <div class="mb-6 text-muted">
      {{ t(countryFitQuiz.descriptionKey) }}
    </div>

    <div class="p-4 rounded-xl border border-[var(--ui-border)] mb-8 bg-[rgba(255,255,255,0.03)]">
      <div class="font-black mb-3">{{ t("quizzes.countryFit.constraintsTitle") }}</div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Job -->
        <div class="field">
          <label class="field__label" for="cf_job">{{ t("quizzes.countryFit.constraints.job.label") }}</label>
          <u-select
              id="cf_job"
              v-model="user.job.type"
              :items="[
              { label: t('quizzes.countryFit.constraints.job.remote'), value: 'remote' },
              { label: t('quizzes.countryFit.constraints.job.local'), value: 'local' },
              { label: t('quizzes.countryFit.constraints.job.mixed'), value: 'mixed' }
            ]"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.job.hint') }}
          </div>
        </div>

        <!-- Budget -->
        <div class="field">
          <label class="field__label" for="cf_budget">{{ t("quizzes.countryFit.constraints.budget.label") }}</label>
          <u-input
              id="cf_budget"
              v-model.number="user.budget.monthlyUSD"
              type="number"
              :placeholder="t('quizzes.countryFit.constraints.budget.placeholder')"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.budget.hint') }}
          </div>
        </div>

        <!-- RU level -->
        <div class="field">
          <label class="field__label" for="cf_ru">{{ t("quizzes.countryFit.constraints.languageRu.label") }}</label>
          <u-select
              id="cf_ru"
              v-model="user.languages.ru"
              :items="[
              { label: t('quizzes.countryFit.langLevels.native'), value: 'native' },
              { label: t('quizzes.countryFit.langLevels.fluent'), value: 'fluent' },
              { label: t('quizzes.countryFit.langLevels.intermediate'), value: 'intermediate' },
              { label: t('quizzes.countryFit.langLevels.basic'), value: 'basic' },
              { label: t('quizzes.countryFit.langLevels.none'), value: 'none' }
            ]"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.languageRu.hint') }}
          </div>
        </div>

        <!-- EN level -->
        <div class="field">
          <label class="field__label" for="cf_en">{{ t("quizzes.countryFit.constraints.languageEn.label") }}</label>
          <u-select
              id="cf_en"
              v-model="user.languages.en"
              :items="[
              { label: t('quizzes.countryFit.langLevels.fluent'), value: 'fluent' },
              { label: t('quizzes.countryFit.langLevels.intermediate'), value: 'intermediate' },
              { label: t('quizzes.countryFit.langLevels.basic'), value: 'basic' },
              { label: t('quizzes.countryFit.langLevels.none'), value: 'none' }
            ]"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.languageEn.hint') }}
          </div>
        </div>

        <!-- Family -->
        <div class="field">
          <label class="field__label" for="cf_family">{{ t("quizzes.countryFit.constraints.family.label") }}</label>
          <u-select
              id="cf_family"
              v-model="user.family.status"
              :items="[
              { label: t('quizzes.countryFit.constraints.family.single'), value: 'single' },
              { label: t('quizzes.countryFit.constraints.family.couple'), value: 'couple' },
              { label: t('quizzes.countryFit.constraints.family.coupleWithKids'), value: 'couple_with_kids' },
              { label: t('quizzes.countryFit.constraints.family.singleParent'), value: 'single_parent' }
            ]"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.family.hint') }}
          </div>
        </div>

        <!-- Kids -->
        <div class="field">
          <label class="field__label" for="cf_kids">{{ t("quizzes.countryFit.constraints.kids.label") }}</label>
          <u-input
              id="cf_kids"
              v-model.number="user.family.kidsCount"
              type="number"
              :min="0"
              :placeholder="t('quizzes.countryFit.constraints.kids.placeholder')"
          />
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.kids.hint') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Questions -->
    <div class="space-y-6">
      <div
          v-for="q in [...countryFitQuiz.questions].sort((a, b) => a.order - b.order)"
          :key="q.id"
          class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)]"
      >
        <div class="font-black mb-2">{{ t(q.titleKey) }}</div>
        <div class="text-muted mb-3">{{ t(q.descriptionKey) }}</div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button
              v-for="opt in q.options"
              :key="opt.id"
              type="button"
              class="px-4 py-3 rounded-xl border border-[var(--ui-border)] text-left transition"
              :class="
              answers[q.id] === opt.id
                ? 'bg-[rgba(128,90,245,0.18)] border-[rgba(128,90,245,0.35)]'
                : 'bg-[rgba(255,255,255,0.02)] hover:brightness-[1.05]'
            "
              @click="answers[q.id] = opt.id"
          >
            {{ t(opt.textKey) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="mt-10">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="text-2xl font-black">{{ t("quizzes.countryFit.resultsTitle") }}</div>
        <div v-if="indicesLoading" class="text-xs text-muted">
          {{ t("quizzes.countryFit.loadingIndices") }}
        </div>
      </div>
      <div class="p-4 rounded-xl border border-[var(--ui-border)] mb-8 bg-[rgba(255,255,255,0.03)]">
        <div class="font-black mb-3">{{ t("quizzes.countryFit.compareTitle") || "Сравнение" }}</div>

        <!-- USA states manual add -->
        <div class="mb-4">
          <div class="font-black text-sm mb-2">США: добавить штат</div>

          <div class="flex flex-col md:flex-row gap-2">
            <u-select v-model="addUsaState" :items="usaStateItems" placeholder="Выбери штат" />
            <u-button :disabled="!addUsaState" @click="addUsaStateToCompare">Добавить</u-button>
          </div>

          <div v-if="selectedUSAStates.length" class="mt-3 flex flex-wrap gap-2">
            <button
                v-for="code in selectedUSAStates"
                :key="code"
                type="button"
                class="chip"
                @click="removeUsaState(code)"
                :title="'Убрать ' + code.toUpperCase()"
            >
              <Icon name="i-lucide-x" class="i-icon" />
              {{ code.toUpperCase() }}
            </button>
          </div>
        </div>

        <!-- Countries manual add -->
        <div>
          <div class="font-black text-sm mb-2">Добавить страну</div>

          <div class="flex flex-col md:flex-row gap-2">
            <u-select v-model="addCountry" :items="countryItems" placeholder="Выбери страну" />
            <u-button :disabled="!addCountry" @click="addCountryToCompare">Добавить</u-button>
          </div>

          <div v-if="selectedCountries.length" class="mt-3 flex flex-wrap gap-2">
            <button
                v-for="k in selectedCountries"
                :key="k"
                type="button"
                class="chip"
                @click="removeCountry(k)"
                :title="'Убрать ' + k"
            >
              <Icon name="i-lucide-x" class="i-icon" />
              {{ k }}
            </button>
          </div>
        </div>
      </div>

      <!-- Best US state -->
      <div
          v-if="bestUsState"
          class="mb-6 p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.04)] result-card"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="font-black text-lg flex items-center gap-2">
            <Icon name="i-lucide-flag" class="i-icon" />
            {{ t("quizzes.countryFit.bestUsStateTitle") }}
          </div>
          <div class="text-xs text-muted">{{ t("quizzes.countryFit.bestUsStateHint") }}</div>
        </div>

        <div class="mt-3 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.02)] p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-black">
                {{ t(bestUsState.titleKey, bestUsState.fallbackName) || bestUsState.fallbackName }}
              </div>

              <div class="text-muted mt-2">
                ~${{ Math.round(bestUsState.estimatedMonthlyUSD).toLocaleString("en-US") }} / month
              </div>

              <div class="text-muted mt-2" v-if="bestUsState.why.length">
                • {{ bestUsState.why.join(" • ") }}
              </div>
            </div>

            <div class="ratings">
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.match") }}</div>
                <div class="rating__val">{{ fmt100(bestUsState.match100) }}</div>
              </div>
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.live") }}</div>
                <div class="rating__val">{{ fmt100(bestUsState.live100) }}</div>
              </div>
            </div>
          </div>

          <div v-if="hasAnyIndex(indicesMap[bestUsState.key])" class="indices mt-3">
            <button type="button" class="indices__trigger" :aria-label="t('quizzes.countryFit.indices.aria')">
              <Icon name="i-lucide-info" class="i-icon" />
              {{ t("quizzes.countryFit.indices.title") }}
            </button>

            <div class="indices__panel" role="tooltip">
              <div class="indices__title">{{ t("quizzes.countryFit.indices.title") }}</div>

              <div class="indices__row" v-if="indicesMap[bestUsState.key]?.normalized.income != null">
                <span class="indices__k">
                  <Icon name="i-lucide-dollar-sign" class="i-icon" />
                  {{ t("quizzes.countryFit.indices.income") }}
                </span>
                <span class="indices__val">{{ indicesMap[bestUsState.key]!.normalized.income!.toFixed(1) }}/10</span>
              </div>

              <div class="indices__row" v-if="indicesMap[bestUsState.key]?.normalized.education != null">
                <span class="indices__k">
                  <Icon name="i-lucide-graduation-cap" class="i-icon" />
                  {{ t("quizzes.countryFit.indices.education") }}
                </span>
                <span class="indices__val">{{ indicesMap[bestUsState.key]!.normalized.education!.toFixed(1) }}/10</span>
              </div>

              <div class="indices__row" v-if="indicesMap[bestUsState.key]?.normalized.qualityOfLife != null">
                <span class="indices__k">
                  <Icon name="i-lucide-sparkles" class="i-icon" />
                  {{ t("quizzes.countryFit.indices.quality") }}
                </span>
                <span class="indices__val">{{ indicesMap[bestUsState.key]!.normalized.qualityOfLife!.toFixed(1) }}/10</span>
              </div>

              <div class="indices__row" v-if="indicesMap[bestUsState.key]?.normalized.safety != null">
                <span class="indices__k">
                  <Icon name="i-lucide-shield" class="i-icon" />
                  {{ t("quizzes.countryFit.indices.safety") }}
                </span>
                <span class="indices__val">{{ indicesMap[bestUsState.key]!.normalized.safety!.toFixed(1) }}/10</span>
              </div>

              <div class="indices__meta text-muted" v-if="indicesMap[bestUsState.key]?.updatedAtISO">
                {{ t("quizzes.countryFit.indices.updated") }}:
                {{ indicesMap[bestUsState.key]!.updatedAtISO.slice(0, 10) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Compare 6 USA states -->
      <div v-if="usaStatesForCompare.length" class="mb-6">
        <div class="font-black text-lg mb-3 flex items-center gap-2">
          <Icon name="i-lucide-flag" class="i-icon" />
          {{ t("quizzes.countryFit.usaCompareTitle") }}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
              v-for="s in usaStatesForCompare"
              :key="s.key"
              class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)] result-card"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="font-black">
                {{ t(s.titleKey, s.fallbackName) || s.fallbackName }}
              </div>

              <button
                  type="button"
                  class="chip"
                  @click="toggleUsaState(s.key)"
              >
                <Icon name="i-lucide-pin" class="i-icon" />
                {{ selectedUSAStates.includes(stateCodeFromKey(s.key)) ? t("common.pinned") : t("common.pin") }}
              </button>
            </div>

            <div class="text-muted mt-2">
              ~${{ Math.round(s.estimatedMonthlyUSD).toLocaleString("en-US") }} / month
            </div>

            <div class="ratings mt-3">
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.match") }}</div>
                <div class="rating__val">{{ fmt100(s.match100) }}</div>
              </div>
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.live") }}</div>
                <div class="rating__val">{{ fmt100(s.live100) }}</div>
              </div>
            </div>

            <div v-if="hasAnyIndex(indicesMap[s.key])" class="indices mt-3">
              <button type="button" class="indices__trigger" :aria-label="t('quizzes.countryFit.indices.aria')">
                <Icon name="i-lucide-info" class="i-icon" />
                {{ t("quizzes.countryFit.indices.title") }}
              </button>

              <div class="indices__panel" role="tooltip">
                <div class="indices__title">{{ t("quizzes.countryFit.indices.title") }}</div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.income != null">
                  <span class="indices__k"><Icon name="i-lucide-dollar-sign" class="i-icon" />{{ t("quizzes.countryFit.indices.income") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.income!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.education != null">
                  <span class="indices__k"><Icon name="i-lucide-graduation-cap" class="i-icon" />{{ t("quizzes.countryFit.indices.education") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.education!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.qualityOfLife != null">
                  <span class="indices__k"><Icon name="i-lucide-sparkles" class="i-icon" />{{ t("quizzes.countryFit.indices.quality") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.qualityOfLife!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.safety != null">
                  <span class="indices__k"><Icon name="i-lucide-shield" class="i-icon" />{{ t("quizzes.countryFit.indices.safety") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.safety!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.internet != null">
                  <span class="indices__k"><Icon name="i-lucide-wifi" class="i-icon" />{{ t("quizzes.countryFit.indices.internet") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.internet!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.unemployment != null">
                  <span class="indices__k"><Icon name="i-lucide-briefcase" class="i-icon" />{{ t("quizzes.countryFit.indices.unemployment") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.unemployment!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.air != null">
                  <span class="indices__k"><Icon name="i-lucide-wind" class="i-icon" />{{ t("quizzes.countryFit.indices.air") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.air!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.inequality != null">
                  <span class="indices__k"><Icon name="i-lucide-scale" class="i-icon" />{{ t("quizzes.countryFit.indices.inequality") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.inequality!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[s.key]?.normalized.health != null">
                  <span class="indices__k"><Icon name="i-lucide-heart-pulse" class="i-icon" />{{ t("quizzes.countryFit.indices.health") }}</span>
                  <span class="indices__val">{{ indicesMap[s.key]!.normalized.health!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__meta text-muted" v-if="indicesMap[s.key]?.updatedAtISO">
                  {{ t("quizzes.countryFit.indices.updated") }}: {{ indicesMap[s.key]!.updatedAtISO.slice(0, 10) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Countries -->
      <div v-if="filteredResults.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
            v-for="g in filteredResults"
            :key="g.base.key"
            class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)] result-card"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="font-black">
              {{ t(g.base.titleKey, g.base.fallbackName) || g.base.fallbackName }}
            </div>

            <div class="ratings">
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.match") }}</div>
                <div class="rating__val">{{ fmt100(g.base.match100) }}</div>
              </div>
              <div class="rating">
                <div class="rating__label">{{ t("quizzes.countryFit.rating.live") }}</div>
                <div class="rating__val">{{ fmt100(g.base.live100) }}</div>
              </div>
            </div>
          </div>

          <div class="mt-3 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.02)] p-3">
            <div class="font-black text-sm">
              {{ t("quizzes.countryFit.medianBlockTitle") }}
            </div>

            <div class="text-muted mt-2">
              ~${{ Math.round(g.base.estimatedMonthlyUSD).toLocaleString("en-US") }} / month
            </div>

            <div class="text-muted mt-2" v-if="g.base.why.length">
              • {{ g.base.why.join(" • ") }}
            </div>

            <div v-if="hasAnyIndex(indicesMap[g.base.key])" class="indices mt-3">
              <button type="button" class="indices__trigger" :aria-label="t('quizzes.countryFit.indices.aria')">
                <Icon name="i-lucide-info" class="i-icon" />
                {{ t("quizzes.countryFit.indices.title") }}
              </button>

              <div class="indices__panel" role="tooltip">
                <div class="indices__title">{{ t("quizzes.countryFit.indices.title") }}</div>

                <div class="indices__row" v-if="indicesMap[g.base.key]?.normalized.income != null">
                  <span class="indices__k">
                    <Icon name="i-lucide-dollar-sign" class="i-icon" />
                    {{ t("quizzes.countryFit.indices.income") }}
                  </span>
                  <span class="indices__val">{{ indicesMap[g.base.key]!.normalized.income!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[g.base.key]?.normalized.education != null">
                  <span class="indices__k">
                    <Icon name="i-lucide-graduation-cap" class="i-icon" />
                    {{ t("quizzes.countryFit.indices.education") }}
                  </span>
                  <span class="indices__val">{{ indicesMap[g.base.key]!.normalized.education!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[g.base.key]?.normalized.qualityOfLife != null">
                  <span class="indices__k">
                    <Icon name="i-lucide-sparkles" class="i-icon" />
                    {{ t("quizzes.countryFit.indices.quality") }}
                  </span>
                  <span class="indices__val">{{ indicesMap[g.base.key]!.normalized.qualityOfLife!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__row" v-if="indicesMap[g.base.key]?.normalized.safety != null">
                  <span class="indices__k">
                    <Icon name="i-lucide-shield" class="i-icon" />
                    {{ t("quizzes.countryFit.indices.safety") }}
                  </span>
                  <span class="indices__val">{{ indicesMap[g.base.key]!.normalized.safety!.toFixed(1) }}/10</span>
                </div>

                <div class="indices__meta text-muted" v-if="indicesMap[g.base.key]?.updatedAtISO">
                  {{ t("quizzes.countryFit.indices.updated") }}:
                  {{ indicesMap[g.base.key]!.updatedAtISO.slice(0, 10) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-muted">
        {{ t("quizzes.countryFit.noResults") }}
      </div>
    </div>
  </u-container>
</template>

<style scoped>
.field {
  display: grid;
  gap: 6px;
}

.field__label {
  font-weight: 900;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.field__hint {
  font-size: 12px;
  line-height: 1.25;
}

.result-card {
  position: relative;
}

.ratings {
  display: grid;
  gap: 6px;
  text-align: right;
}

.rating__label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1;
}

.rating__val {
  font-weight: 900;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.i-icon {
  width: 16px;
  height: 16px;
}

/* -------- Indices hover -------- */
.indices {
  position: relative;
  display: inline-block;
}

.indices__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
  cursor: default;
}

.indices__trigger:focus-visible {
  outline: 2px solid rgba(128, 90, 245, 0.55);
  outline-offset: 2px;
}

.indices__panel {
  position: absolute;
  z-index: 70;
  left: 0;
  top: calc(100% + 10px);
  width: 320px;

  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(15, 15, 18, 0.92);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

.indices:hover .indices__panel,
.indices:focus-within .indices__panel {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.indices__title {
  font-weight: 900;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__k {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.indices__val {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
}

.indices__meta {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.25;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
}
</style>