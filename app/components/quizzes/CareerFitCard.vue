<script setup lang="ts">
import type {ProfessionMatch} from "~/composables/useCareerQuizEngine";

const props = defineProps<{ item: ProfessionMatch }>();

const {t} = useI18n();
const localePath = useLocalePath();

function fmt100(v: number) {
  return `${Math.round(v)}/100`;
}
</script>

<template>
  <div class="p-4 rounded-xl border border-[var(--ui-border)] result-card">
    <div class="flex items-start justify-between gap-3">
      <div class="font-black">{{ t(item.profession.titleKey) }}</div>
      <div class="rating__val">{{ fmt100(item.match100) }}</div>
    </div>

    <div class="text-muted mt-2">{{ t(item.profession.descriptionKey) }}</div>

    <div v-if="item.profession.jobsQuery" class="result-card__links">
      <NuxtLink
          :to="localePath({ path: '/jobs', query: { q: item.profession.jobsQuery } })"
          class="result-card__link"
      >
        <Icon name="i-lucide-briefcase" class="i-icon"/>
        {{ t("quizzes.careerFit.viewJobs") }}
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.result-card {
  min-width: 0;
  height: 100%;
  background: var(--bg-panel);
  box-shadow: 0 12px 28px rgba(2, 5, 18, 0.2);
}

.rating__val {
  font-weight: 900;
  font-size: 13px;
  color: var(--text-white);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.result-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--ui-border);
}

.result-card__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  color: var(--text-white);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  transition: border-color 120ms ease, color 120ms ease;
}

.result-card__link:hover,
.result-card__link:focus-visible {
  border-color: var(--accent-pink, #e0679a);
  color: var(--accent-pink, #e0679a);
}

.i-icon {
  width: 16px;
  height: 16px;
}
</style>
