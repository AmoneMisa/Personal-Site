<script setup lang="ts">
const props = defineProps<{
  image?: string | null;
  title: string;        // i18n key
  description: string;  // i18n key
  link: string;

  // опционально — если захочешь показывать метаданные
  minutes?: number;
  questions?: number;
  levelKey?: string; // i18n key типа "quizzes.level.easy"
}>();

const { t } = useI18n();

const metaBadges = computed(() => {
  const items: Array<{ icon: string; text: string }> = [];

  if (typeof props.minutes === "number") {
    items.push({ icon: "i-lucide-timer", text: t("quizzes.card.minutes", { n: props.minutes }) });
  }
  if (typeof props.questions === "number") {
    items.push({ icon: "i-lucide-list-checks", text: t("quizzes.card.questions", { n: props.questions }) });
  }
  if (props.levelKey) {
    items.push({ icon: "i-lucide-sparkles", text: t(props.levelKey) });
  }

  return items;
});
</script>

<template>
  <NuxtLink :to="link" class="quiz-card" :aria-label="t(title)">
    <div class="quiz-card__media">
      <img
          v-if="image"
          class="quiz-card__img"
          :src="image"
          :alt="t(title)"
          loading="lazy"
      />
      <div v-else class="quiz-card__placeholder">
        <u-icon name="i-lucide-clipboard-list" class="quiz-card__placeholder-icon" />
      </div>

      <!-- мягкий градиент + подсветка -->
      <div class="quiz-card__overlay" />

      <div v-if="metaBadges.length" class="quiz-card__badges">
        <div v-for="b in metaBadges" :key="b.text" class="quiz-card__badge">
          <u-icon :name="b.icon" class="quiz-card__badge-icon" />
          <span class="quiz-card__badge-text">{{ b.text }}</span>
        </div>
      </div>
    </div>

    <div class="quiz-card__content">
      <div class="quiz-card__title">{{ t(title) }}</div>
      <div class="quiz-card__desc text-muted">
        {{ t(description) }}
      </div>

      <div class="quiz-card__footer">
        <span class="quiz-card__cta">{{ t("quizzes.card.open") }}</span>
        <u-icon name="i-lucide-arrow-right" class="quiz-card__arrow" />
      </div>
    </div>
  </NuxtLink>
</template>

<style scoped>
.quiz-card {
  display: grid;
  grid-template-rows: 168px 1fr;
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform 160ms ease, filter 180ms ease, border-color 180ms ease;
}

.quiz-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.04);
  border-color: rgba(128, 90, 245, 0.35);
}

.quiz-card:active {
  transform: translateY(-1px);
}

.quiz-card:focus-visible {
  outline: none;
  box-shadow:
      0 0 0 2px rgba(128, 90, 245, 0.30),
      0 0 0 6px rgba(128, 90, 245, 0.14);
}

.quiz-card__media {
  position: relative;
  height: 168px;
  overflow: hidden;
}

.quiz-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
  transition: transform 260ms ease;
}

.quiz-card:hover .quiz-card__img {
  transform: scale(1.06);
}

.quiz-card__placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  background:
      radial-gradient(80% 80% at 30% 20%, rgba(128, 90, 245, 0.35), transparent 60%),
      radial-gradient(80% 80% at 70% 70%, rgba(255, 255, 255, 0.10), transparent 55%),
      rgba(255, 255, 255, 0.03);
}

.quiz-card__placeholder-icon {
  font-size: 30px;
  color: rgba(255, 255, 255, 0.85);
}

.quiz-card__overlay {
  position: absolute;
  inset: 0;
  background:
      linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.42)),
      radial-gradient(60% 60% at 20% 20%, rgba(128, 90, 245, 0.18), transparent 60%);
  pointer-events: none;
}

.quiz-card__badges {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quiz-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.92);
  font-weight: 800;
  font-size: 12px;
}

.quiz-card__badge-icon {
  font-size: 14px;
  color: var(--color-primary);
}

.quiz-card__content {
  padding: 14px 14px 12px;
  display: grid;
  gap: 8px;
}

.quiz-card__title {
  font-weight: 900;
  font-size: 16px;
  line-height: 1.2;
}

.quiz-card__desc {
  font-size: 13px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.quiz-card__footer {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.quiz-card__cta {
  font-weight: 900;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.quiz-card__arrow {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  transition: transform 180ms ease;
}

.quiz-card:hover .quiz-card__arrow {
  transform: translateX(2px);
}
</style>