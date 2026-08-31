<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import {lifeValuesQuestions} from "~/utils/quizzes/values/lifeValues";
import {scoreLifeValues} from "~/composables/useLifeValuesQuizEngine";
import LifeValueBar from "~/components/quizzes/LifeValueBar.vue";

const {t} = useI18n();
const localePath = useLocalePath();

useSeoMeta({
  title: () => t("seo.pages.lifeValues.title"),
  description: () => t("seo.pages.lifeValues.description"),
});

const LS_KEY = "lifeValues:answers";

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is optional when storage is unavailable or full.
  }
}

const answers = ref<Record<string, string>>({});
onMounted(() => {
  answers.value = lsGet(LS_KEY, {});
});
watch(answers, (v) => lsSet(LS_KEY, v), {deep: true});

const sortedQuestions = computed(() => [...lifeValuesQuestions].sort((a, b) => a.order - b.order));
const hasAnswers = computed(() => Object.keys(answers.value).length > 0);
const results = computed(() => scoreLifeValues(answers.value));
const topValues = computed(() => new Set(results.value.slice(0, 3).map((r) => r.key)));

// A light, non-intrusive nudge toward the site's other quizzes when they'd
// genuinely fit the top values — not shown otherwise.
const suggestCountryFit = computed(() =>
    topValues.value.has("freedom_autonomy") || topValues.value.has("adventure_novelty")
);
const suggestCareerFit = computed(() =>
    topValues.value.has("achievement_growth") || topValues.value.has("recognition_influence")
);
</script>

<template>
  <u-container class="life-values py-8">
    <ocean-page-backdrop/>
    <page-header
        title="quizzes.lifeValues.title"
        headline="quizzes.lifeValues.headline"
        class="mb-4"
    />

    <div class="mb-4 text-muted">
      {{ t("quizzes.lifeValues.description") }}
    </div>

    <div class="quiz-form-surface">
      <div class="quiz-questions grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="q in sortedQuestions" :key="q.id" class="quiz-card">
          <div :id="`${q.id}-title`" class="quiz-card__title">{{ t(q.titleKey) }}</div>

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
              <span class="quiz-option__dot" aria-hidden="true"/>
              <span class="quiz-option__text">{{ t(opt.textKey) }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-10">
      <div class="text-2xl font-black mb-4">{{ t("quizzes.lifeValues.resultsTitle") }}</div>

      <div v-if="hasAnswers" class="values-list">
        <life-value-bar v-for="(r, i) in results" :key="r.key" :item="r" :rank="i + 1"/>
      </div>

      <div v-else class="text-muted">
        {{ t("quizzes.lifeValues.noAnswersYet") }}
      </div>

      <div v-if="hasAnswers && (suggestCountryFit || suggestCareerFit)" class="suggestions">
        <NuxtLink v-if="suggestCountryFit" :to="localePath('/quizzes/country-fit')" class="suggestion">
          <Icon name="i-lucide-globe" class="i-icon"/>
          {{ t("quizzes.lifeValues.suggestCountryFit") }}
        </NuxtLink>
        <NuxtLink v-if="suggestCareerFit" :to="localePath('/quizzes/career-fit')" class="suggestion">
          <Icon name="i-lucide-briefcase" class="i-icon"/>
          {{ t("quizzes.lifeValues.suggestCareerFit") }}
        </NuxtLink>
      </div>
    </div>
  </u-container>
</template>

<style scoped>
.life-values {
  position: relative;
  isolation: isolate;
  padding-bottom: 96px;
}

.quiz-form-surface {
  position: relative;
  isolation: isolate;
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface);
  box-shadow: 0 14px 34px rgba(2, 5, 18, 0.18);
}

.quiz-questions { align-items: stretch; }
.quiz-questions > * { display: flex; flex-direction: column; }

.quiz-card {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface-soft);
}

.quiz-card__title {
  margin-bottom: 10px;
  font-weight: 800;
  font-size: 14px;
  line-height: 1.25;
}

.quiz-options {
  margin-top: auto;
  display: grid;
  gap: 6px;
}

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
  box-shadow: inset 0 0 0 3px var(--accent-pink, #e0679a);
}
.quiz-option__text { min-width: 0; }
.quiz-option:has(.quiz-option__input:focus-visible) {
  outline: none;
  box-shadow: var(--ui-focus-ring);
  border-color: var(--accent-pink, #e0679a);
}

.values-list {
  display: grid;
  gap: 10px;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.suggestion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--text-white);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: border-color 120ms ease, color 120ms ease;
}
.suggestion:hover, .suggestion:focus-visible {
  border-color: var(--accent-pink, #e0679a);
  color: var(--accent-pink, #e0679a);
}

.i-icon {
  width: 16px;
  height: 16px;
}
</style>
