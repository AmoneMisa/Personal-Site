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

// чтобы не долбить один и тот же key 10 раз
const loaded = new Set<string>();
const pending = new Set<string>();

async function fetchBundles(keys: string[]) {
  // backend: POST /indices/bundles
  // frontend: POST /api/indices/bundles (proxy)
  const res = await $fetch<BundlesResponse>("/api/indices/bundles", {
    method: "POST",
    body: { keys, includeRaw: false },
  });

  for (const b of res.items ?? []) {
    indicesMap.value[b.key] = b;
    loaded.add(b.key);
  }

  // если бэк вернул не все ключи (или пусто) — всё равно помечаем как “видели”
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
    // не падаем — матчинг будет просто без индексов
    // можно потом подключить toast/логгер
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

// когда меняются результаты — подкачиваем индексы только для реально попавших карточек
watchEffect(() => {
  const keys: string[] = [];
  for (const g of results.value) {
    keys.push(g.base.key);
    if (g.city) keys.push(g.city.key);
  }
  ensureIndices(keys);
});
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
            {{ t("quizzes.countryFit.constraints.job.hint") }}
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
            {{ t("quizzes.countryFit.constraints.budget.hint") }}
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
            {{ t("quizzes.countryFit.constraints.languageRu.hint") }}
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
            {{ t("quizzes.countryFit.constraints.languageEn.hint") }}
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
            {{ t("quizzes.countryFit.constraints.family.hint") }}
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
            {{ t("quizzes.countryFit.constraints.kids.hint") }}
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

      <div v-if="results.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
            v-for="g in results"
            :key="g.base.key"
            class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)]"
        >
          <div class="font-black">
            {{ t(g.base.titleKey, g.base.fallbackName) || g.base.fallbackName }}
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

            <!-- optional: показать индексы, если пришли -->
            <div class="text-muted mt-2 text-sm" v-if="indicesMap[g.base.key]?.normalized">
              <span v-if="indicesMap[g.base.key]?.normalized.income != null">
                💰 {{ t("quizzes.countryFit.indices.income") }}: {{ indicesMap[g.base.key]!.normalized.income!.toFixed(1) }}/10
              </span>
              <span v-if="indicesMap[g.base.key]?.normalized.qualityOfLife != null" class="ml-3">
                ✨ {{ t("quizzes.countryFit.indices.quality") }}: {{ indicesMap[g.base.key]!.normalized.qualityOfLife!.toFixed(1) }}/10
              </span>
              <span v-if="indicesMap[g.base.key]?.normalized.safety != null" class="ml-3">
                🛡 {{ t("quizzes.countryFit.indices.safety") }}: {{ indicesMap[g.base.key]!.normalized.safety!.toFixed(1) }}/10
              </span>
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
</style>