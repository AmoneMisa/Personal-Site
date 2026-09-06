<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import {countryFitQuiz} from "~/utils/quizzes/country/countryFit";
import {matchCountries, type UserProfile} from "~/composables/useCountryQuizEngine";
import {countries} from "~/utils/quizzes/country/countries";
import CountryFitCard from "~/components/quizzes/CountryFitCard.vue";
import CustomInput from "~/components/common/CustomInput.vue";
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";

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
  raw?: unknown;
};

type BundlesResponse = { items: IndicesBundle[] };

const isShowUSA = ref(true);
const isShowCountries = ref(true);
const showedCountriesCount = ref(12);

const {t} = useI18n();
const route = useRoute();
const router = useRouter();

function encodeProfileToParam(profile: unknown) {
  const json = JSON.stringify(profile) ?? "null";
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
}

function decodeProfileFromParam(s: string) {
  const padded = s + "===".slice((s.length + 3) % 4);
  const b64 = padded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);
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

const selectedUSAStates = ref<string[]>([]);
const selectedCountries = ref<string[]>([]);
const LS_KEYS = {
  selectedUSAStates: "countryFit:selectedUSAStates",
  selectedCountries: "countryFit:selectedCountries",
  user: "countryFit:user",
  answers: "countryFit:answers",
};

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
useSeoMeta({
  title: () => t("seo.pages.countryFit.title"),
  description: () => t("seo.pages.countryFit.description"),
});

const answers = ref<Record<string, string>>({});

const user = ref<UserProfile>({
  job: {type: "remote"},
  languages: {ru: "native", en: "intermediate"},
  family: {status: "single", kidsCount: 0},
  budget: {monthlyUSD: 2500, includesRent: true},
});

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

  const savedUser = lsGet<UserProfile | null>(LS_KEYS.user, null);
  if (savedUser) user.value = savedUser;

  const savedAnswers = lsGet<Record<string, string> | null>(LS_KEYS.answers, null);
  if (savedAnswers) answers.value = savedAnswers;

  appliedFromUrl.value = true;
});

// --------------------
// Update query (throttled)
// --------------------
let qTimer: any = null;

function scheduleQueryUpdate() {
  if (!appliedFromUrl.value) return;
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    router.replace({
      query: {
        ...route.query,
        selectedUSAStates: toCsvParam(selectedUSAStates.value) || undefined,
        selectedCountries: toCsvParam(selectedCountries.value) || undefined,
        profile: encodeProfileToParam({user: user.value, answers: answers.value}),
      },
    });
  }, 250);
}

watch(user, scheduleQueryUpdate, {deep: true});
watch(answers, scheduleQueryUpdate, {deep: true});
watch(answers, (v) => lsSet(LS_KEYS.answers, v), {deep: true});
watch(selectedUSAStates, scheduleQueryUpdate, {deep: true});
watch(selectedCountries, scheduleQueryUpdate, {deep: true});

// --------------------
// Indices cache
// --------------------
const indicesMap = ref<Record<string, IndicesBundle | undefined>>({});
const activeIndexRequests = ref(0);
const indicesLoading = computed(() => activeIndexRequests.value > 0);

const loaded = new Set<string>();
const pending = new Set<string>();
const retryAfter = new Map<string, number>();
const INDEX_RETRY_DELAY_MS = 30_000;

async function fetchBundles(keys: string[]) {
  const res = await $fetch<BundlesResponse>("/api/indices/bundles", {
    method: "POST",
    body: {keys, includeRaw: false},
  });

  for (const b of res.items ?? []) {
    indicesMap.value[b.key] = b;
    loaded.add(b.key);
    retryAfter.delete(b.key);
  }

  const returned = new Set((res.items ?? []).map((bundle) => bundle.key));
  for (const k of keys) {
    if (!returned.has(k)) retryAfter.set(k, Date.now() + INDEX_RETRY_DELAY_MS);
  }
}

async function ensureIndices(keys: string[]) {
  const uniq = Array.from(new Set(keys)).filter(Boolean);
  const now = Date.now();
  const toLoad = uniq.filter((k) => !loaded.has(k)
    && !pending.has(k)
    && (!retryAfter.has(k) || (retryAfter.get(k) ?? 0) <= now));
  if (!toLoad.length) return;

  toLoad.forEach((k) => pending.add(k));
  activeIndexRequests.value += 1;

  try {
    await fetchBundles(toLoad);
  } catch (e) {
    toLoad.forEach((key) => retryAfter.set(key, Date.now() + INDEX_RETRY_DELAY_MS));
    console.error("Failed to fetch indices bundles:", e);
  } finally {
    toLoad.forEach((k) => pending.delete(k));
    activeIndexRequests.value = Math.max(0, activeIndexRequests.value - 1);
  }
}

const resultsAll = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, 999, {
      selectedUSAStates: selectedUSAStates.value,
      selectedCountries: selectedCountries.value,
      usaVariantsLimit: 999,
    })
);

const usaGroup = computed(() => resultsAll.value.find((g) => g.base.key === "countries.usa"));
const results = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, showedCountriesCount.value, {
      selectedCountries: selectedCountries.value,
      usaVariantsLimit: 3,
    })
);

const filteredResults = computed(() =>
    results.value.filter((g) => g.base.key !== "countries.usa").slice(0, showedCountriesCount.value)
);
const topUsaStates = computed(() => (usaGroup.value?.variants ?? []).slice(0, 3));
const usaStatesForCompare = computed(() => topUsaStates.value);

watchEffect(() => {
  const keys: string[] = [];

  for (const g of results.value) {
    keys.push(g.base.key);
    if (g.city) keys.push(g.city.key);
  }

  for (const s of usaStatesForCompare.value) keys.push(s.key);

  for (const k of selectedUSAStates.value) keys.push(k);

  for (const k of selectedCountries.value) keys.push(k);

  ensureIndices(keys);
});

// --------------------
// UI helpers
// --------------------

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
  } catch {
    // Persistence is optional when storage is unavailable or full.
  }
}

const usaStateItems = computed(() =>
    (usaGroup.value?.variants ?? []).map(v => ({
      label: t(v.titleKey, v.fallbackName) || v.fallbackName,
      value: v.key,
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

// Hide entries that are already added to the compare list so they can't be
// re-selected as no-ops (and shorten the searchable dropdown).
const usaStateItemsAvailable = computed(() =>
    usaStateItems.value.filter(i => !selectedUSAStates.value.includes(i.value))
);

const countryItemsAvailable = computed(() =>
    countryItems.value.filter(i => !selectedCountries.value.includes(i.value))
);

const addUsaState = ref<string>("");
const addCountry = ref<string>("");

function addUsaStateToCompare() {
  const key = String(addUsaState.value || "").trim();
  if (!key) return;

  const set = new Set(selectedUSAStates.value);
  set.add(key);
  selectedUSAStates.value = Array.from(set);

  addUsaState.value = "";
}

function removeUsaState(key: string) {
  const k = String(key || "").trim();
  const set = new Set(selectedUSAStates.value);
  set.delete(k);
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

watch(selectedUSAStates, (v) => lsSet(LS_KEYS.selectedUSAStates, v), {deep: true});
watch(selectedCountries, (v) => lsSet(LS_KEYS.selectedCountries, v), {deep: true});
watch(user, (v) => lsSet(LS_KEYS.user, v), {deep: true});
</script>

<template>
  <u-container class="country-fit py-8">
    <ocean-page-backdrop />
    <page-header
        title="quizzes.countryFit.title"
        headline="quizzes.countryFit.headline"
        class="mb-4"
    />

    <div class="mb-4 text-muted">
      {{ t(countryFitQuiz.descriptionKey) }}
    </div>

    <div class="quiz-form-surface">
    <div class="quiz-card quiz-card_situation">
      <div class="quiz-card__title">{{ t("quizzes.countryFit.constraintsTitle") }}</div>
      <div class="quiz-fields grid grid-cols-1 md:grid-cols-3">
        <div class="field">
          <custom-checkbox id="cf_isShowUSA" v-model="isShowUSA" label-key="quizzes.countryFit.constraints.isShowUSA.label"/>
        </div>
        <div class="field">
          <custom-checkbox id="cf_isShowCountries" v-model="isShowCountries" label-key="quizzes.countryFit.constraints.isShowCountries.label"
          />
        </div>
        <div class="field">
          <custom-input id="cf_showedCountriesCount" v-model.number="showedCountriesCount"
                        type="number"
                        :min="1"
                        :max="40"
                        label-key="quizzes.countryFit.constraints.showedCountriesCount.label"/>
        </div>
        <!-- Job -->
        <div class="field">
          <u-select
              :label='t("quizzes.countryFit.constraints.job.label")'
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
          <custom-input id="cf_budget" v-model.number="user.budget.monthlyUSD"
                        type="number"
                        :min="1"
                        label-key="quizzes.countryFit.constraints.budget.label"
                        placeholder-key="quizzes.countryFit.constraints.budget.placeholder"/>
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.budget.hint') }}
          </div>
        </div>

        <!-- RU level -->
        <div class="field">
          <u-select
              :label='t("quizzes.countryFit.constraints.languageRu.label")'
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
          <u-select
              :label='t("quizzes.countryFit.constraints.languageEn.label")'
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
          <u-select
              :label='t("quizzes.countryFit.constraints.family.label")'
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
          <custom-input id="cf_kids" v-model.number="user.family.kidsCount"
                        type="number"
                        :min="0"
                        placeholder-key="quizzes.countryFit.constraints.kids.placeholder"
                        label-key="quizzes.countryFit.constraints.kids.label"/>
          <div class="field__hint text-muted">
            {{ t('quizzes.countryFit.constraints.kids.hint') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Questions -->
    <div class="quiz-questions grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div
          v-for="q in [...countryFitQuiz.questions].sort((a, b) => a.order - b.order)"
          :key="q.id"
          class="quiz-card"
      >
        <div :id="`${q.id}-title`" class="quiz-card__title">{{ t(q.titleKey) }}</div>
        <div class="quiz-card__desc text-muted">{{ t(q.descriptionKey) }}</div>

        <!-- One answer per question, so these are a radio group rather than a
             row of buttons: arrow keys move between them, a screen reader
             announces which is chosen, and the whole group is one tab stop. -->
        <div class="quiz-options" role="radiogroup" :aria-labelledby="`${q.id}-title`">
          <label
              v-for="opt in q.options"
              :key="opt.id"
              class="quiz-option"
              :class="{ 'quiz-option_selected': answers[q.id] === opt.id }"
          >
            <input
                type="radio"
                class="quiz-option__input"
                :name="q.id"
                :value="opt.id"
                :checked="answers[q.id] === opt.id"
                @change="answers[q.id] = opt.id"
            />
            <span class="quiz-option__dot" aria-hidden="true" />
            <span class="quiz-option__text">{{ t(opt.textKey) }}</span>
          </label>
        </div>
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

      <!-- Compare block -->
      <div class="country-compare-panel p-4 rounded-xl border border-[var(--line)] mb-8">
        <div class="font-black mb-3">
          {{ t("quizzes.countryFit.compareTitle") }}
        </div>

        <!-- USA: add + selected cards -->
        <div class="mb-8">
          <div class="font-black text-lg mb-3 flex items-center gap-2">
            <Icon name="i-lucide-flag" class="i-icon"/>
            {{ t("quizzes.countryFit.manualUsaCompareTitle") }}
          </div>

          <!-- add USA state -->
          <div class="flex flex-col md:flex-row gap-2">
            <u-select-menu
                v-model="addUsaState"
                :items="usaStateItemsAvailable"
                value-key="value"
                label-key="label"
                class="flex-1"
                :placeholder="t('quizzes.countryFit.addUsaStatePlaceholder')"
                :search-input="{ placeholder: t('quizzes.countryFit.addUsaStatePlaceholder') }"
            />
            <u-button :disabled="!addUsaState" @click="addUsaStateToCompare">
              {{ t("common.add") }}
            </u-button>
          </div>

          <div v-if="selectedUSAStates.length" class="mt-4 country-results-grid">
            <country-fit-card
                v-for="s in (usaGroup?.variants ?? []).filter(v => selectedUSAStates.includes(v.key))"
                :key="s.key"
                :item="s"
                :indices="indicesMap[s.key]"
                :removable="true"
                @remove="removeUsaState"
            />
          </div>

          <div v-else class="text-muted mt-3">
            {{ t("quizzes.countryFit.manualUsaEmpty") }}
          </div>
        </div>

        <!-- Countries: add + selected cards -->
        <div>
          <div class="font-black text-lg mb-3 flex items-center gap-2">
            <Icon name="i-lucide-globe" class="i-icon"/>
            {{ t("quizzes.countryFit.manualCountriesCompareTitle") }}
          </div>

          <!-- add country -->
          <div class="flex flex-col md:flex-row gap-2">
            <u-select-menu
                v-model="addCountry"
                :items="countryItemsAvailable"
                value-key="value"
                label-key="label"
                class="flex-1"
                :placeholder="t('quizzes.countryFit.addCountryPlaceholder')"
                :search-input="{ placeholder: t('quizzes.countryFit.addCountryPlaceholder') }"
            />
            <u-button :disabled="!addCountry" @click="addCountryToCompare">
              {{ t("common.add") }}
            </u-button>
          </div>

          <div v-if="selectedCountries.length" class="mt-4 country-results-grid">
            <country-fit-card
                v-for="c in selectedCountries.map(k => resultsAll.find(g => g.base.key === k)?.base).filter(Boolean)"
                :key="c!.key"
                :item="c!"
                :indices="indicesMap[c!.key]"
                :removable="true"
                :showWhy="true"
                @remove="removeCountry"
            />
          </div>

          <div v-else class="text-muted mt-3">
            {{ t("quizzes.countryFit.manualCountriesEmpty") }}
          </div>
        </div>
      </div>

      <div v-if="usaStatesForCompare.length && isShowUSA" class="mb-6">
        <div class="font-black text-lg mb-3 flex items-center gap-2">
          <Icon name="i-lucide-flag" class="i-icon"/>
          {{ t("quizzes.countryFit.usaCompareTitle") }}
        </div>

        <div class="country-results-grid">
          <country-fit-card
              v-for="s in usaStatesForCompare"
              :key="s.key"
              :item="s"
              :indices="indicesMap[s.key]"
              :show-ratings="true"
              :show-why="false"
              :removable="false"
          />
        </div>
      </div>

      <!-- Countries -->
      <div class="font-black text-lg mb-3 flex items-center gap-2">
        <Icon name="i-lucide-flag" class="i-icon"/>
        {{ t("quizzes.countryFit.compareTitle") }}
      </div>
      <div v-if="filteredResults.length && isShowCountries" class="country-results-grid">
        <country-fit-card
            v-for="g in filteredResults"
            :key="g.base.key"
            :item="g.base"
            :indices="indicesMap[g.base.key]"
            :show-ratings="true"
            :show-why="true"
            :removable="false"
        />
      </div>

      <div v-else class="text-muted">
        {{ t("quizzes.countryFit.noResults") }}
      </div>
    </div>
  </u-container>
</template>

<style scoped>
.country-fit {
  position: relative;
  isolation: isolate;
  padding-bottom: 96px;
}

.field {
  display: grid;
  gap: 5px;
  align-content: start;
}

/* ---- density and alignment ------------------------------------------------
   The form and the question cards are one grid each, so every row lines up on
   its own without margins fighting the grid. */

.quiz-form-surface {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface);
  box-shadow: 0 14px 34px rgba(2, 5, 18, 0.18);
}

.country-results-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}
@media (min-width: 700px) {
  .country-results-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1180px) {
  .country-results-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.quiz-form-surface::before,
.quiz-form-surface::after {
  content: "";
  position: absolute;
  z-index: 0;
  border: 1px solid rgba(75, 145, 255, 0.1);
  border-radius: 999px;
  pointer-events: none;
}

.quiz-form-surface::before {
  width: 8px;
  height: 8px;
  left: 32%;
  top: 25%;
}

.quiz-form-surface::after {
  width: 6px;
  height: 6px;
  right: 2%;
  top: 58%;
  border-color: rgba(207, 92, 220, 0.1);
}

.quiz-form-surface > * {
  position: relative;
  z-index: 1;
}

.quiz-card {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface-soft);
}
.quiz-card_situation { margin-bottom: 0; }

.country-compare-panel {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: var(--ocean-form-surface);
  box-shadow: 0 14px 34px rgba(2, 5, 18, 0.18);
}

.quiz-card__title {
  margin-bottom: 10px;
  font-weight: 800;
  font-size: 14px;
  line-height: 1.25;
}
.quiz-card__desc {
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.35;
}

/* Question cards stretch to the tallest in their row, so a card whose question
   wraps does not leave its neighbour floating. */
.quiz-questions { align-items: stretch; }
.quiz-questions > * { display: flex; flex-direction: column; }
/* Options sit at the bottom, so cards in a row line their answers up even when
   one title runs to two lines. */
.quiz-options { margin-top: auto; }

/* Stacked, not a three-across grid: with three or four cards per row there is
   no width for side-by-side answers, and a vertical list is what a radio group
   is meant to look like anyway. */
.quiz-options { display: grid; gap: 6px; }

.quiz-option {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--ocean-form-surface-soft);
  font-size: 12.5px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-transition), border-color var(--ui-transition);
}
.quiz-option:hover { background: rgba(255, 255, 255, 0.05); }
.quiz-option_selected {
  border-color: rgba(224, 103, 154, 0.35);
  background: rgba(224, 103, 154, 0.18);
}

/* The native input stays in the accessibility tree and keeps arrow-key
   behaviour; only its appearance is replaced by the dot beside it. */
.quiz-option__input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.quiz-option__dot {
  flex: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.03);
  transition: border-color var(--ui-transition), box-shadow var(--ui-transition);
}
.quiz-option_selected .quiz-option__dot {
  border-color: var(--accent-pink, #e0679a);
  /* The filled centre is an inset ring, so it scales with the dot. */
  box-shadow: inset 0 0 0 3px var(--accent-pink, #e0679a);
}
.quiz-option__text { min-width: 0; }
/* Focus has to show on the label, since the input itself is not visible. */
.quiz-option:has(.quiz-option__input:focus-visible) {
  outline: none;
  box-shadow: var(--ui-focus-ring);
  border-color: var(--accent-pink, #e0679a);
}

/* One row-gap for the whole form. The hint under a field is part of that
   field's cell, so a longer hint no longer shifts the field beside it. */
.quiz-fields {
  column-gap: 16px;
  row-gap: 14px;
  align-items: start;
}


.field__hint {
  font-size: 11.5px;
  line-height: 1.3;
}

.i-icon {
  width: 16px;
  height: 16px;
}
</style>
