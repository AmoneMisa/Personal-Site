<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import {careerFitQuestions} from "~/utils/quizzes/career/careerFit";
import {matchProfessions} from "~/composables/useCareerQuizEngine";
import CareerFitCard from "~/components/quizzes/CareerFitCard.vue";

const {t} = useI18n();

useSeoMeta({
  title: () => t("seo.pages.careerFit.title"),
  description: () => t("seo.pages.careerFit.description"),
});

const LS_KEY = "careerFit:answers";

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
  }
}

const answers = ref<Record<string, string>>({});
onMounted(() => {
  answers.value = lsGet(LS_KEY, {});
});
watch(answers, (v) => lsSet(LS_KEY, v), {deep: true});

const sortedQuestions = computed(() => [...careerFitQuestions].sort((a, b) => a.order - b.order));
const answeredCount = computed(() => Object.keys(answers.value).length);
const results = computed(() => matchProfessions(answers.value, 8));
const hasAnswers = computed(() => answeredCount.value > 0);
</script>

<template>
  <u-container class="career-fit py-8">
    <ocean-page-backdrop/>
    <page-header
        title="quizzes.careerFit.title"
        headline="quizzes.careerFit.headline"
        class="mb-4"
    />

    <div class="mb-4 text-muted">
      {{ t("quizzes.careerFit.description") }}
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
      <div class="text-2xl font-black mb-4">{{ t("quizzes.careerFit.resultsTitle") }}</div>

      <div v-if="hasAnswers" class="results-grid">
        <career-fit-card v-for="r in results" :key="r.profession.key" :item="r"/>
      </div>

      <div v-else class="text-muted">
        {{ t("quizzes.careerFit.noAnswersYet") }}
      </div>
    </div>
  </u-container>
</template>

<style scoped>
.career-fit {
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

.quiz-questions {
  align-items: stretch;
}
.quiz-questions > * {
  display: flex;
  flex-direction: column;
}

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

.results-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
@media (min-width: 700px) {
  .results-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1180px) {
  .results-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
