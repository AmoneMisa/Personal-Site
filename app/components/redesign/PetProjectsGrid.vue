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
  <section class="rd-section pet-projects" id="pet-projects">
    <div class="rd-wrap">
      <div class="pet-projects__header">
        <div class="pet-projects__eyebrow mono">{{ p.eyebrow }}</div>
        <h2 class="pet-projects__title">{{ p.title }}</h2>
        <p class="pet-projects__subtitle">{{ p.subtitle }}</p>
      </div>

      <div class="pet-projects__grid">
        <article v-for="proj in p.items" :key="proj.title" class="pet-projects__card" :class="{ 'pet-projects__card_wide': proj.span2 }">
          <div>
            <div class="pet-projects__kind mono">{{ proj.kind }}</div>
            <h4 class="pet-projects__card-title">{{ proj.title }}</h4>
            <p class="pet-projects__description">{{ proj.description }}</p>
          </div>
          <a
              v-if="proj.href"
              class="pet-projects__link mono"
              :href="resolveHref(proj.href)"
              :target="isExternal(proj.href) ? '_blank' : undefined"
              :rel="isExternal(proj.href) ? 'noopener noreferrer' : undefined"
          >{{ proj.linkLabel }} →</a>
          <span v-else class="pet-projects__link pet-projects__link_muted mono">{{ proj.linkLabel }}</span>
        </article>
      </div>

      <a class="pet-projects__all-link mono" :href="localePath('/projects')">{{ p.allLabel }} →</a>
    </div>
  </section>
</template>

<style scoped lang="scss">
.pet-projects__header {
  margin-bottom: 42px;
  max-width: 600px;
}
.pet-projects__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.pet-projects__title {
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.pet-projects__subtitle {
  color: var(--text-muted);
  margin-top: 10px;
  font-size: 14.5px;
}
.pet-projects__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.pet-projects__card {
  background: var(--bg-deep);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 172px;
}
.pet-projects__card_wide {
  grid-column: span 2;
}
.pet-projects__kind {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 14px;
}
.pet-projects__card-title {
  font-size: 15px;
  font-weight: 400;
  margin-bottom: 7px;
}
.pet-projects__description {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.pet-projects__link {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-muted);
  transition: color 0.15s;
}
a.pet-projects__link:hover {
  color: var(--accent-pink);
}
.pet-projects__link_muted {
  opacity: 0.7;
}
.pet-projects__all-link {
  display: inline-block;
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-muted);
}
.pet-projects__all-link:hover {
  color: var(--accent-pink);
}

@media (max-width: 960px) {
  .pet-projects__grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .pet-projects__card_wide {
    grid-column: span 2;
  }
}
@media (max-width: 560px) {
  .pet-projects__grid {
    grid-template-columns: 1fr;
  }
  .pet-projects__card_wide {
    grid-column: span 1;
  }
}
</style>
