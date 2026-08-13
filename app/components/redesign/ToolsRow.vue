<script setup lang="ts">
import { useHomeContent, TOOLS } from "~/composables/useHomeContent";

const content = useHomeContent();
const t = computed(() => content.value.toolsSection);
</script>

<template>
  <section class="rd-section" id="tools">
    <div class="rd-wrap">
      <div class="section-head">
        <div class="eyebrow mono">{{ t.eyebrow }}</div>
        <h2>{{ t.title }}</h2>
      </div>
      <div class="tools-row">
        <div v-for="tool in TOOLS" :key="tool" class="tool-pill">
          <span class="dash" />{{ tool }}
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.section-head {
  margin-bottom: 42px;
  max-width: 600px;
}
.eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
h2 {
  font-size: 25px;
  font-weight: 400;
}
.tools-row {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}
.tool-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: var(--text-muted);
}
.tool-pill .dash {
  width: 10px;
  height: 1px;
  background: var(--accent-blue);
}
</style>
