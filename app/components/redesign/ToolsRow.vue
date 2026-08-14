<script setup lang="ts">
import { useHomeContent, TOOLS } from "~/composables/useHomeContent";

const content = useHomeContent();
const t = computed(() => content.value.toolsSection);
</script>

<template>
  <section class="rd-section tools" id="tools">
    <div class="rd-wrap">
      <div class="tools__header">
        <div class="tools__eyebrow mono">{{ t.eyebrow }}</div>
        <h2 class="tools__title">{{ t.title }}</h2>
      </div>
      <div class="tools__list">
        <div v-for="tool in TOOLS" :key="tool" class="tools__item">
          <span class="tools__dash" />{{ tool }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.tools__header {
  margin-bottom: 42px;
  max-width: 600px;
}
.tools__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.tools__title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.tools__list {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.tools__item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--text-muted);
}
.tools__dash {
  width: 10px;
  height: 1px;
  background: var(--accent-blue);
}
</style>
