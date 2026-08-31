<script setup lang="ts">
defineProps<{
  image?: string | null;
  title: string;
  description: string;
  link: string;
}>();

const {t} = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <NuxtLink :to="localePath(link)" class="quiz-card-link">
    <img v-if="image" :src="image" :alt="t(title)" class="quiz-card-link__image" loading="lazy"/>
    <div class="quiz-card-link__title">{{ t(title) }}</div>
    <div class="quiz-card-link__desc text-muted">{{ t(description) }}</div>
  </NuxtLink>
</template>

<style scoped>
.quiz-card-link {
  display: block;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--ocean-form-surface);
  text-decoration: none;
  color: inherit;
  transition: border-color 140ms ease, transform 140ms ease;
}

.quiz-card-link:hover,
.quiz-card-link:focus-visible {
  border-color: rgba(224, 103, 154, 0.4);
  transform: translateY(-2px);
}

.quiz-card-link__image {
  width: 100%;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 12px;
}

.quiz-card-link__title {
  font-weight: 800;
  font-size: 16px;
  margin-bottom: 6px;
}

.quiz-card-link__desc {
  font-size: 13px;
  line-height: 1.4;
}
</style>
