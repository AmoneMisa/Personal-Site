<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import { countryFitQuiz } from "~/utils/quizzes/country/countryFit";
import { matchCountries, type UserProfile } from "~/composables/useCountryQuizEngine";

type IndicesNormalized = {
  income: number | null;
  education: number | null;
  qualityOfLife: number | null;
  safety: number | null;
};

type IndicesBundle = {
  key: string;
  updatedAtISO: string;
  normalized: IndicesNormalized;
  raw?: any;
};

type BundlesResponse = { items: IndicesBundle[] };

const { t } = useI18n();

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

// ----------------------------------------------------
// Indices client cache (ONLY our backend API)
// ----------------------------------------------------
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

// ----------------------------------------------------
// Results
// ----------------------------------------------------
const results = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, 12)
);

const resultsAll = computed(() =>
    matchCountries(countryFitQuiz, answers.value, user.value, indicesMap.value, 999)
);

const usaGroup = computed(() => resultsAll.value.find((g) => g.base.key === "countries.usa"));

const bestUsState = computed(() => {
  const variants = usaGroup.value?.variants ?? [];
  return variants.length ? variants[0] : null;
});

const filteredResults = computed(() => results.value.filter((g) => g.base.key !== "countries.usa"));

watchEffect(() => {
  const keys: string[] = [];
  for (const g of results.value) {
    keys.push(g.base.key);
    if (g.city) keys.push(g.city.key);
  }
  ensureIndices(keys);
});

watchEffect(() => {
  const k = bestUsState.value?.key;
  if (k) ensureIndices([k]);
});

// ----------------------------------------------------
// helpers
// ----------------------------------------------------
function fmt100(v: number | null | undefined) {
  if (typeof v !== "number") return "—";
  return `${Math.round(v)}/100`;
}

function hasAnyIndex(b: IndicesBundle | undefined) {
  const n = b?.normalized;
  if (!n) return false;
  return [n.income, n.education, n.qualityOfLife, n.safety].some((x) => typeof x === "number");
}
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
</style>