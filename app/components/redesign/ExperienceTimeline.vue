<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const e = computed(() => content.value.experienceSection);
</script>

<template>
  <section class="rd-section" id="experience">
    <div class="rd-wrap">
      <div class="section-head">
        <div class="eyebrow mono">{{ e.eyebrow }}</div>
        <h2>{{ e.title }}</h2>
        <p>{{ e.subtitle }}</p>
      </div>

      <div class="timeline">
        <div v-for="job in e.items" :key="job.title" class="tl-item">
          <div class="tl-year mono">{{ job.period }}</div>
          <h3>{{ job.title }}</h3>
          <div class="role">{{ job.meta }}</div>
          <p>{{ job.description }}</p>
          <div class="tl-tags">
            <span v-for="tag in job.tags" :key="tag" class="tag mono">{{ tag }}</span>
          </div>
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
  font-weight: 500;
  letter-spacing: -0.01em;
}
.section-head p {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.timeline {
  position: relative;
  padding-left: 28px;
  border-left: 1px solid var(--line);
}
.tl-item {
  position: relative;
  padding-bottom: 38px;
}
.tl-item:last-child {
  padding-bottom: 0;
}
.tl-item::before {
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
.tl-year {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.tl-item h3 {
  font-size: 16.5px;
  font-weight: 400;
  margin-bottom: 5px;
}
.tl-item .role {
  color: var(--text-muted);
  font-size: 13.5px;
  margin-bottom: 9px;
}
.tl-item p {
  color: var(--text-muted);
  font-size: 14px;
  max-width: 580px;
  line-height: 1.6;
}
.tl-tags {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.tag {
  font-size: 11px;
  color: var(--text-muted);
}
.tag:not(:last-child)::after {
  content: "·";
  margin-left: 8px;
  color: var(--line);
}
</style>
