<script setup lang="ts">
import { useProjects } from "~/composables/useProjects";

const { locale } = useI18n();
const localePath = useLocalePath();
const groups = useProjects();

const chrome = computed(() =>
  locale.value === "en"
    ? {
        eyebrow: "everything I've built",
        title: "Projects",
        subtitle: "The full list — from my work stack to desktop apps, bots and game mods. Grouped by type, most-relevant first.",
        open: "Open",
        soon: "Coming soon",
      }
    : {
        eyebrow: "всё, что я собрала",
        title: "Проекты",
        subtitle: "Полный список — от рабочего стека до десктопа, ботов и игровых модов. Сгруппировано по типу, ближе к стеку — выше.",
        open: "Открыть",
        soon: "Скоро",
      }
);

function resolveHref(href: string) {
  return href.startsWith("/") ? localePath(href) : href;
}
function isExternal(href: string | null) {
  return !!href && href.startsWith("http");
}

useSeoMeta({
  title: () => (locale.value === "en" ? "Projects — Marharyta Kubai" : "Проекты — Маргарита Кубай"),
  description: () => chrome.value.subtitle,
  ogType: "website",
  ogTitle: () => chrome.value.title,
  ogDescription: () => chrome.value.subtitle,
  twitterTitle: () => chrome.value.title,
  twitterDescription: () => chrome.value.subtitle,
});
</script>

<template>
  <div class="projects">
    <section class="rd-section projects-hero">
      <div class="rd-wrap">
        <div class="eyebrow mono">{{ chrome.eyebrow }}</div>
        <h1>{{ chrome.title }}</h1>
        <p class="lead">{{ chrome.subtitle }}</p>
      </div>
    </section>

    <template v-for="(group, gi) in groups" :key="group.title">
      <div class="rd-divider" />
      <section class="rd-section">
        <div class="rd-wrap">
          <h2 class="group-title">{{ group.title }}</h2>
          <div class="proj-grid">
            <div v-for="p in group.items" :key="p.name" class="proj-card">
              <div>
                <div class="proj-stack mono">{{ p.stack }}</div>
                <h3 class="proj-name">{{ p.name }}</h3>
                <p class="proj-desc">{{ p.description }}</p>
              </div>
              <a
                  v-if="p.href"
                  class="proj-link mono"
                  :href="resolveHref(p.href)"
                  :target="isExternal(p.href) ? '_blank' : undefined"
                  :rel="isExternal(p.href) ? 'noopener noreferrer' : undefined"
              >{{ isExternal(p.href) ? "GitHub" : chrome.open }} →</a>
              <span v-else class="proj-link proj-link_muted mono">{{ chrome.soon }}</span>
            </div>
          </div>
        </div>
      </section>
      <div v-if="gi === groups.length - 1" class="rd-divider" />
    </template>

    <section class="rd-section">
      <div class="rd-wrap">
        <a class="back-link mono" :href="localePath('/')">← {{ locale === 'en' ? 'Back to home' : 'На главную' }}</a>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.projects-hero {
  padding-top: 56px;
}
.projects-hero h1 {
  font-size: 34px;
  font-weight: 400;
  margin-bottom: 18px;
}
.projects-hero .lead {
  color: var(--text-muted);
  font-size: 16px;
  max-width: 640px;
  line-height: 1.65;
}
.group-title {
  font-size: 22px;
  font-weight: 400;
  margin-bottom: 22px;
}
.proj-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.proj-card {
  background: var(--bg-deep);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-height: 168px;
}
.proj-stack {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.proj-name {
  font-size: 16px;
  font-weight: 400;
  margin-bottom: 8px;
  color: var(--text-primary);
}
.proj-desc {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.55;
}
.proj-link {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--text-muted);
  align-self: flex-start;
}
a.proj-link:hover {
  color: var(--accent-pink);
}
.proj-link_muted {
  opacity: 0.65;
}
.back-link {
  font-size: 13px;
  color: var(--text-muted);
}
.back-link:hover {
  color: var(--accent-pink);
}
@media (max-width: 760px) {
  .proj-grid {
    grid-template-columns: 1fr;
  }
}
</style>
