<script setup lang="ts">
import type {LifeValueResult} from "~/composables/useLifeValuesQuizEngine";

defineProps<{ item: LifeValueResult; rank: number }>();

const {t} = useI18n();
</script>

<template>
  <div class="value-row">
    <div class="value-row__head">
      <span class="value-row__rank">#{{ rank }}</span>
      <span class="value-row__title">{{ t(`quizzes.lifeValues.values.${item.key}.title`) }}</span>
    </div>
    <div class="value-row__bar-track">
      <div class="value-row__bar-fill" :style="{ width: `${item.percent}%` }"/>
    </div>
    <div class="value-row__desc text-muted">{{ t(`quizzes.lifeValues.values.${item.key}.desc`) }}</div>
  </div>
</template>

<style scoped>
.value-row {
  padding: 12px 14px;
  border: 1px solid var(--ui-border);
  border-radius: 10px;
  background: var(--bg-panel);
}

.value-row__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.value-row__rank {
  font-weight: 900;
  font-size: 12px;
  color: var(--accent-pink, #e0679a);
}

.value-row__title {
  font-weight: 800;
  font-size: 14px;
}

.value-row__bar-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
  margin-bottom: 8px;
}

.value-row__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent-pink, #e0679a);
  transition: width 220ms ease;
}

.value-row__desc {
  font-size: 12.5px;
  line-height: 1.35;
}
</style>
