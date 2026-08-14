<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const e = computed(() => content.value.experienceSection);
</script>

<template>
  <section class="rd-section experience" id="experience">
    <div class="rd-wrap">
      <div class="experience__header">
        <div class="experience__eyebrow mono">{{ e.eyebrow }}</div>
        <h2 class="experience__title">{{ e.title }}</h2>
        <p v-if="e.subtitle" class="experience__subtitle">{{ e.subtitle }}</p>
      </div>

      <div class="experience__timeline">
        <article v-for="job in e.items" :key="job.title" class="experience__item">
          <div class="experience__period mono">{{ job.period }}</div>
          <h3 class="experience__role-title">{{ job.title }}</h3>
          <div class="experience__meta">{{ job.meta }}</div>
          <p class="experience__description">{{ job.description }}</p>
          <div class="experience__tags">
            <span v-for="tag in job.tags" :key="tag" class="experience__tag mono">{{ tag }}</span>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.experience__header {
  margin-bottom: 42px;
  max-width: 600px;
}
.experience__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.experience__title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.experience__subtitle {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.experience__timeline {
  position: relative;
  padding-left: 28px;
  border-left: 1px solid var(--line);
}
.experience__item {
  position: relative;
  padding-bottom: 38px;
}
.experience__item:last-child {
  padding-bottom: 0;
}
.experience__item::before {
  content: "";
  position: absolute;
  left: -33px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--bg-deep);
  border: 1px solid var(--accent-blue);
}
.experience__period {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.experience__role-title {
  font-size: 16.5px;
  font-weight: 400;
  margin-bottom: 5px;
}
.experience__meta {
  color: var(--text-muted);
  font-size: 13.5px;
  margin-bottom: 9px;
}
.experience__description {
  color: var(--text-muted);
  font-size: 14px;
  max-width: 580px;
  line-height: 1.6;
}
.experience__tags {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.experience__tag {
  font-size: 11px;
  color: var(--text-muted);
}
.experience__tag:not(:last-child)::after {
  content: "·";
  margin-left: 8px;
  color: var(--line);
}
</style>
