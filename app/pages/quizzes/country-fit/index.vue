<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import {countryFitQuiz} from "~/utils/quizzes/country/countryFit";
import {matchCountries, type MatchGroup, type UserProfile} from "~/composables/useCountryQuizEngine";

type TeleportScores = {
  slug: string;
  overall: number | null;
  categories: Array<{ key: string; name: string; score: number | null }>;
};

const {t} = useI18n();

useSeoMeta({
  title: () => t("seo.pages.countryFit.title"),
  description: () => t("seo.pages.countryFit.description")
});

const answers = ref<Record<string, string>>({});

const user = ref<UserProfile>({
  job: {type: "remote"},
  languages: {ru: "native", en: "intermediate"},
  family: {status: "single", kidsCount: 0},
  budget: {monthlyUSD: 2500, includesRent: true}
});

const results = computed<MatchGroup[]>(() => matchCountries(countryFitQuiz, answers.value, user.value, 12));

// ---- Teleport cache (на клиенте) ----
const tpCache = ref<Record<string, TeleportScores | null>>({});
const tpLoading = ref<Record<string, boolean>>({});

function getTpCat(tp: TeleportScores | null | undefined, key: string): number | null {
  const s = tp?.categories?.find(c => c.key === key)?.score;
  return typeof s === "number" ? s : null;
}

function budgetMultiplier(tp: TeleportScores | null | undefined) {
  const housing = getTpCat(tp, "HOUSING");
  const col = getTpCat(tp, "COST_OF_LIVING");

  const housingMul = housing != null ? (1 + (housing - 5) * 0.05) : 1;
  const colMul = col != null ? (1 + (col - 5) * 0.04) : 1;

  const mul = Math.min(1.35, Math.max(0.70, housingMul * colMul));
  return {mul, housing, col};
}

async function ensureTeleport(slug?: string) {
  if (!slug) return;
  if (tpCache.value[slug] !== undefined) return; // есть и null (404) тоже
  if (tpLoading.value[slug]) return;

  tpLoading.value[slug] = true;
  try {
    tpCache.value[slug] = await $fetch<TeleportScores>("/api/teleport/scores", {query: {slug}});
  } catch (e) {
    tpCache.value[slug] = null;
  } finally {
    tpLoading.value[slug] = false;
  }
}

watchEffect(() => {
  for (const g of results.value) {
    const slug = g.city?.teleportSlug;
    if (slug) ensureTeleport(slug);
  }
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
          v-for="q in [...countryFitQuiz.questions].sort((a,b)=>a.order-b.order)"
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
              :class="answers[q.id] === opt.id
              ? 'bg-[rgba(128,90,245,0.18)] border-[rgba(128,90,245,0.35)]'
              : 'bg-[rgba(255,255,255,0.02)] hover:brightness-[1.05]'"
              @click="answers[q.id] = opt.id"
          >
            {{ t(opt.textKey) }}
          </button>
        </div>
      </div>
    </div>

    <!-- Results -->
    <div class="mt-10">
      <div class="text-2xl font-black mb-4">{{ t("quizzes.countryFit.resultsTitle") }}</div>

      <div v-if="results.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
            v-for="g in results"
            :key="g.base.key"
            class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)]"
        >
          <!-- Title -->
          <div class="font-black">
            {{ t(g.base.titleKey, g.base.fallbackName) || g.base.fallbackName }}
          </div>

          <!-- Top: Main city (Teleport) -->
          <div v-if="g.city?.teleportSlug"
               class="mt-3 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.02)] p-3">
            <div class="flex items-center justify-between gap-2">
              <div class="font-black text-sm">
                {{ t("quizzes.countryFit.cityBlockTitle") }}
              </div>

              <div class="text-xs text-muted" v-if="tpLoading[g.city.teleportSlug]">
                {{ t("quizzes.countryFit.loadingTeleport") }}
              </div>
            </div>

            <template v-if="tpCache[g.city.teleportSlug]">
              <div class="text-muted mt-1 text-sm">
                <!-- город/агломерация мы можем показать как fallbackName city-энтити -->
                {{ t(g.city.titleKey, g.city.fallbackName) || g.city.fallbackName }}
              </div>

              <div class="city-budget"
                   tabindex="0"
                   role="button"
                   :aria-label="t('quizzes.countryFit.tpTooltip.aria')"
              >
                <div class="text-muted mt-2 flex items-center gap-2">
    <span class="font-black">
      ~${{
        Math.round(
            g.base.estimatedMonthlyUSD *
            (g.city?.teleportSlug && tpCache[g.city.teleportSlug]
                ? budgetMultiplier(tpCache[g.city.teleportSlug]).mul
                : 1)
        ).toLocaleString("en-US")
      }}
    </span>
                  <span class="text-muted">/ month</span>

                  <span class="hint-icon" aria-hidden="true">ⓘ</span>
                </div>

                <!-- Tooltip: рендерится всегда -->
                <div class="tp-tooltip" role="tooltip">
                  <div class="tp-tooltip__title">
                    {{ t("quizzes.countryFit.tpTooltip.title") }}
                  </div>

                  <template v-if="g.city?.teleportSlug && tpLoading[g.city.teleportSlug]">
                    <div class="text-muted text-sm">
                      {{ t("quizzes.countryFit.loadingTeleport") }}
                    </div>
                  </template>

                  <template v-else-if="g.city?.teleportSlug && tpCache[g.city.teleportSlug]">
                    <div class="tp-tooltip__row">
                      <span class="tp-tooltip__label">🏠 {{ t("quizzes.countryFit.tp.housing") }}</span>
                      <span class="tp-tooltip__value">
          {{ getTpCat(tpCache[g.city.teleportSlug], "HOUSING")?.toFixed(1) ?? "—" }}/10
        </span>
                    </div>

                    <div class="tp-tooltip__row">
                      <span class="tp-tooltip__label">🧾 {{ t("quizzes.countryFit.tp.costOfLiving") }}</span>
                      <span class="tp-tooltip__value">
          {{ getTpCat(tpCache[g.city.teleportSlug], "COST_OF_LIVING")?.toFixed(1) ?? "—" }}/10
        </span>
                    </div>

                    <div class="tp-tooltip__row tp-tooltip__row_strong">
                      <span class="tp-tooltip__label">{{ t("quizzes.countryFit.tpTooltip.multiplier") }}</span>
                      <span class="tp-tooltip__value">
          ×{{ budgetMultiplier(tpCache[g.city.teleportSlug]).mul.toFixed(2) }}
        </span>
                    </div>

                    <div class="tp-tooltip__note text-muted">
                      {{ t("quizzes.countryFit.tpTooltip.note") }}
                    </div>
                  </template>

                  <template v-else>
                    <div class="text-muted text-sm">
                      {{ t("quizzes.countryFit.tpUnavailable") }}
                    </div>
                  </template>
                </div>
              </div>

              <div class="chips mt-2">
            <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'HOUSING') != null">
              🏠 {{
                t("quizzes.countryFit.tp.housing")
              }}: {{ getTpCat(tpCache[g.city.teleportSlug], 'HOUSING')!.toFixed(1) }}/10
            </span>
                <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'COST_OF_LIVING') != null">
              🧾 {{
                    t("quizzes.countryFit.tp.costOfLiving")
                  }}: {{ getTpCat(tpCache[g.city.teleportSlug], 'COST_OF_LIVING')!.toFixed(1) }}/10
            </span>
                <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'SAFETY') != null">
              🛡 {{ t("quizzes.countryFit.tp.safety") }}: {{
                    getTpCat(tpCache[g.city.teleportSlug], 'SAFETY')!.toFixed(1)
                  }}/10
            </span>
                <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'INTERNET_ACCESS') != null">
              🌐 {{
                    t("quizzes.countryFit.tp.internet")
                  }}: {{ getTpCat(tpCache[g.city.teleportSlug], 'INTERNET_ACCESS')!.toFixed(1) }}/10
            </span>
                <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'COMMUTE') != null">
              🚇 {{
                    t("quizzes.countryFit.tp.commute")
                  }}: {{ getTpCat(tpCache[g.city.teleportSlug], 'COMMUTE')!.toFixed(1) }}/10
            </span>
                <span class="chip" v-if="getTpCat(tpCache[g.city.teleportSlug], 'TOLERANCE') != null">
              🌈 {{
                    t("quizzes.countryFit.tp.tolerance")
                  }}: {{ getTpCat(tpCache[g.city.teleportSlug], 'TOLERANCE')!.toFixed(1) }}/10
            </span>
              </div>

              <div class="text-xs text-muted mt-2">
                {{ t("quizzes.countryFit.tp.note") }}
              </div>
            </template>

            <template v-else-if="tpCache[g.city.teleportSlug] === null">
              <div class="text-muted mt-2 text-sm">
                {{ t("quizzes.countryFit.tpUnavailable") }}
              </div>
            </template>
          </div>

          <!-- Bottom: Median (base) -->
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
}

.city-budget {
  position: relative;
  display: inline-block;
  outline: none;
}

.city-budget,
.city-budget * {
  overflow: visible;
}

.hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255,255,255,0.03);
  color: var(--ui-text-muted);
}

.tp-tooltip {
  position: absolute;
  z-index: 9999;
  left: 0;
  top: calc(100% + 10px);
  width: 300px;

  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(15, 15, 18, 0.92);
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);

  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

.city-budget:hover .tp-tooltip,
.city-budget:focus-visible .tp-tooltip {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.tp-tooltip__title {
  font-weight: 900;
  margin-bottom: 8px;
  font-size: 13px;
}

.tp-tooltip__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
}

.tp-tooltip__row_strong {
  border-top: 1px solid rgba(255,255,255,0.08);
  margin-top: 6px;
  padding-top: 10px;
  font-weight: 900;
}

.tp-tooltip__label,
.tp-tooltip__value {
  color: rgba(255,255,255,0.92);
}

.tp-tooltip__note {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.25;
}

.hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  width: 18px;
  height: 18px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  transform: translateY(-1px);
}

.tp-tooltip {
  position: absolute;
  z-index: 50;
  left: 0;
  top: calc(100% + 10px);
  width: 280px;

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

.tp-tooltip__title {
  font-weight: 900;
  margin-bottom: 8px;
  font-size: 13px;
}

.tp-tooltip__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
}

.tp-tooltip__row_strong {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 6px;
  padding-top: 10px;
  font-weight: 900;
}

.tp-tooltip__label {
  color: rgba(255, 255, 255, 0.92);
}

.tp-tooltip__value {
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
}

.tp-tooltip__note {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.25;
}
</style>