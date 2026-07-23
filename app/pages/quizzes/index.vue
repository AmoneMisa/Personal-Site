<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import { safeFetch } from "~/utils/safeFetch";

type QuizType = {
  id: string;
  image?: string | null;
  titleKey: string;
  descriptionKey: string;
  link: string;          // куда переходим по клику (например /quizzes/country-fit)
  categoryId?: string;   // для фильтра
  tags?: string[];       // опционально
};

type QuizCategoryType = {
  id: string;
  titleKey: string;
};

const { t } = useI18n();
const config = useRuntimeConfig();

useSeoMeta({
  title: () => t("seo.pages.quizzes.title"),
  description: () => t("seo.pages.quizzes.description"),
  robots: () => t("seo.common.robots"),
  ogType: "website",
  ogSiteName: () => t("seo.common.siteName"),
  ogTitle: () => t("seo.pages.quizzes.ogTitle"),
  ogDescription: () => t("seo.pages.quizzes.ogDescription")
});

const { data: rawQuizzesData } = await safeFetch<QuizType[]>(
    `${config.public.apiBase}/quizzes`
);

const { data: quizCategoriesData } = await safeFetch<QuizCategoryType[]>(
    `${config.public.apiBase}/quiz-categories`
);

const quizzes = computed(() => (Array.isArray(rawQuizzesData) ? rawQuizzesData : []));
const quizCategories = computed(() => (Array.isArray(quizCategoriesData) ? quizCategoriesData : []));

const query = ref("");
const activeCategory = ref<"all" | string>("all");

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const filteredQuizzes = computed(() => {
  const byCategory = quizzes.value.filter(q =>
      activeCategory.value === "all" || q.categoryId === activeCategory.value
  );

  const q = normalizedQuery.value;
  if (!q) return [...byCategory];

  // Важно: т.к. title/description i18n-ключи, ищем по локализованному тексту.
  return byCategory.filter(item => {
    const title = (t(item.titleKey) || "").toLowerCase();
    const desc = (t(item.descriptionKey) || "").toLowerCase();
    return title.includes(q) || desc.includes(q);
  });
});

const howSteps = [
  { icon: "i-lucide-mouse-pointer-click", titleKey: "quizzes.how.step1.title", textKey: "quizzes.how.step1.text" },
  { icon: "i-lucide-clipboard-list",      titleKey: "quizzes.how.step2.title", textKey: "quizzes.how.step2.text" },
  { icon: "i-lucide-sparkles",            titleKey: "quizzes.how.step3.title", textKey: "quizzes.how.step3.text" },
];
</script>

<template>
  <u-container class="quizzes">
    <div class="quizzes__header text-center space-y-3">
      <page-header
          title="quizzes.title"
          headline="quizzes.headline"
          class="mb-6"
      />

      <p class="quizzes__subtitle text-muted mx-auto">
        {{ t("quizzes.subtitle") }}
      </p>
    </div>

    <div class="quizzes__controls">
      <div class="quizzes__search">
        <u-input
            icon="i-lucide-search"
            :placeholder="t('quizzes.searchPlaceholder')"
            v-model="query"
        />
      </div>

      <div class="quizzes__filters" v-if="quizCategories.length">
        <button
            type="button"
            class="quizzes__pill"
            :class="{ 'quizzes__pill_active': activeCategory === 'all' }"
            @click="activeCategory = 'all'"
        >
          {{ t("quizzes.filters.all") }}
        </button>

        <button
            v-for="c in quizCategories"
            :key="c.id"
            type="button"
            class="quizzes__pill"
            :class="{ 'quizzes__pill_active': activeCategory === c.id }"
            @click="activeCategory = c.id"
        >
          {{ t(c.titleKey) }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" v-if="filteredQuizzes.length">
      <quiz-card
          v-for="qz in filteredQuizzes"
          :key="qz.id"
          :image="qz.image"
          :title="qz.titleKey"
          :description="qz.descriptionKey"
          :link="qz.link"
      />
    </div>

    <div v-else class="quizzes__empty">
      <div class="quizzes__empty-title">{{ t("quizzes.empty.title") }}</div>
      <div class="text-muted">{{ t("quizzes.empty.text") }}</div>
    </div>

    <section class="quizzes__how">
      <h2 class="quizzes__h2">{{ t("quizzes.howTitle") }}</h2>

      <div class="quizzes__how-grid">
        <div class="how-card" v-for="step in howSteps" :key="step.titleKey">
          <u-icon :name="step.icon" class="how-card__icon" />
          <div class="how-card__title">{{ t(step.titleKey) }}</div>
          <div class="how-card__text text-muted">{{ t(step.textKey) }}</div>
        </div>
      </div>
    </section>
  </u-container>
</template>

<style scoped>
.quizzes {
  padding-top: 24px;
  padding-bottom: 96px;
}

.quizzes__subtitle {
  max-width: 720px;
  font-size: 14px;
}

.quizzes__controls {
  margin: 28px 0 28px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 900px) {
    grid-template-columns: 1fr auto auto;
    align-items: center;
  }
}

.quizzes__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;

  @media (min-width: 900px) {
    justify-content: flex-start;
  }
}

.quizzes__pill {
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: filter 180ms ease, transform 140ms ease, color 180ms ease;
}

.quizzes__pill:hover {
  filter: brightness(1.06);
  color: var(--text-white);
}

.quizzes__pill:active {
  transform: translateY(1px);
}

.quizzes__pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(128, 90, 245, 0.30),
  0 0 0 6px rgba(128, 90, 245, 0.14);
}

.quizzes__pill_active {
  color: var(--text-white);
  border-color: rgba(128, 90, 245, 0.40);
  background: rgba(128, 90, 245, 0.18);
}

.quizzes__empty {
  margin-top: 18px;
  text-align: center;
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
}

.quizzes__empty-title {
  font-weight: 900;
  margin-bottom: 6px;
}

.quizzes__how {
  margin-top: 84px;
  text-align: center;
}

.quizzes__h2 {
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 18px;
}

.quizzes__how-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;

  @media (min-width: 800px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.how-card {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.how-card__icon {
  font-size: 22px;
  color: var(--color-primary);
  margin-bottom: 10px;
}

.how-card__title {
  font-weight: 900;
  margin-bottom: 6px;
}
</style>