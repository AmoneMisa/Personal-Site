<script setup lang="ts">
import { useHomeContent } from "~/composables/useHomeContent";

const content = useHomeContent();
const p = computed(() => content.value.petSection);

const localePath = useLocalePath();
function resolveHref(href: string) {
  return href && href.startsWith("/") ? localePath(href) : href;
}
function isExternal(href: string | null) {
  return !!href && href.startsWith("http");
}
</script>

<template>
  <section class="rd-section" id="pet-projects">
    <div class="rd-wrap">
      <div class="section-head">
        <div class="eyebrow mono">{{ p.eyebrow }}</div>
        <h2>{{ p.title }}</h2>
        <p>{{ p.subtitle }}</p>
      </div>

      <div class="bento">
        <div v-for="proj in p.items" :key="proj.title" class="p-card" :class="{ 'span-2': proj.span2 }">
          <div>
            <div class="p-kind mono">{{ proj.kind }}</div>
            <h4>{{ proj.title }}</h4>
            <p>{{ proj.description }}</p>
          </div>
          <a
              v-if="proj.href"
              class="p-link mono"
              :href="resolveHref(proj.href)"
              :target="isExternal(proj.href) ? '_blank' : undefined"
              :rel="isExternal(proj.href) ? 'noopener noreferrer' : undefined"
          >{{ proj.linkLabel }} →</a>
          <span v-else class="p-link p-link_muted mono">{{ proj.linkLabel }}</span>
        </div>
      </div>

      <a class="all-projects mono" :href="localePath('/projects')">{{ p.allLabel }} →</a>
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
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.p-card {
  background: var(--bg-deep);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 172px;
}
.p-card.span-2 {
  grid-column: span 2;
}
.p-kind {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 14px;
}
.p-card h4 {
  font-size: 15px;
  font-weight: 400;
  margin-bottom: 7px;
}
.p-card p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.p-link {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-muted);
  transition: color 0.15s;
}
a.p-link:hover {
  color: var(--accent-pink);
}
.p-link_muted {
  opacity: 0.7;
}
.all-projects {
  display: inline-block;
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-muted);
}
.all-projects:hover {
  color: var(--accent-pink);
}

@media (max-width: 960px) {
  .bento {
    grid-template-columns: repeat(2, 1fr);
  }
  .p-card.span-2 {
    grid-column: span 2;
  }
}
@media (max-width: 560px) {
  .bento {
    grid-template-columns: 1fr;
  }
  .p-card.span-2 {
    grid-column: span 1;
  }
}
</style>
