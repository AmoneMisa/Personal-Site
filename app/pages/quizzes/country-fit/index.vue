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
  raw?: any;
};

type BundlesResponse = { items: IndicesBundle[] };

const isShowUSA = ref(true);
const isShowCountries = ref(true);
const showedCountriesCount = ref(12);

const {t} = useI18n();
const route = useRoute();
const router = useRouter();

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
const indicesLoading = ref(false);

const loaded = new Set<string>();
const pending = new Set<string>();

async function fetchBundles(keys: string[]) {
  const res = await $fetch<BundlesResponse>("/api/indices/bundles", {
    method: "POST",
    body: {keys, includeRaw: false},
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
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="field">
          <label class="field__label" for="cf_job">{{ t("quizzes.countryFit.constraints.isShowUSA.label") }}</label>
          <custom-checkbox id="cf_isShowUSA" v-model="isShowUSA" label-key="quizzes.countryFit.constraints.isShowUSA.label"/>
        </div>
        <div class="field">
          <label class="field__label" for="cf_job">{{ t("quizzes.countryFit.constraints.isShowCountries.label") }}</label>
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
    <div class="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-2">
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

      <!-- Compare block -->
      <div class="p-4 rounded-xl border border-[var(--ui-border)] mb-8 bg-[rgba(255,255,255,0.03)]">
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

          <div v-if="selectedUSAStates.length" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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
                :placeholder="t('quizzes.countryFit.addCountryPlaceholder') || 'Выбери страну'"
                :search-input="{ placeholder: t('quizzes.countryFit.addCountryPlaceholder') || 'Выбери страну' }"
            />
            <u-button :disabled="!addCountry" @click="addCountryToCompare">
              {{ t("common.add") }}
            </u-button>
          </div>

          <div v-if="selectedCountries.length" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      <div v-if="filteredResults.length && isShowCountries" class="grid grid-cols-1 md:grid-cols-3 gap-3">
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
.field {
  display: grid;
  gap: 6px;
}

.field__label {
  font-weight: 900;
  font-size: 13px;
  color: var(--text-white);
}

.field__hint {
  font-size: 12px;
  line-height: 1.25;
}

.i-icon {
  width: 16px;
  height: 16px;
}
</style>