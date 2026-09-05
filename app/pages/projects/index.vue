<script setup lang="ts">
import { useProjects } from "~/composables/useProjects";

const { t } = useI18n();
const localePath = useLocalePath();
const groups = useProjects();

// Copy lives in i18n/locales/*.json under `projects`, beside the group titles
// and item descriptions that useProjects reads.
const chrome = computed(() => ({
  eyebrow: t("projects.eyebrow"),
  title: t("projects.title"),
  subtitle: t("projects.subtitle"),
  open: t("projects.open"),
  download: t("projects.download"),
  soon: t("projects.soon"),
}));

function resolveHref(href: string) {
  return href.startsWith("/") ? localePath(href) : href;
}
function isExternal(href: string | null) {
  return !!href && href.startsWith("http");
}
function tagsFor(stack: string) {
  return stack.split("·").map((tag) => tag.trim()).filter(Boolean);
}

const SITE_URL = "https://whiteslove.me";

useSeoMeta({
  title: () => t("projects.seoTitle"),
  description: () => chrome.value.subtitle,
  keywords: () => Array.from(new Set(groups.value.flatMap((g) => g.items.flatMap((p) => tagsFor(p.stack))))).join(", "),
  ogType: "website",
  ogTitle: () => chrome.value.title,
  ogDescription: () => chrome.value.subtitle,
  twitterTitle: () => chrome.value.title,
  twitterDescription: () => chrome.value.subtitle,
});

// ItemList schema so search engines can index the catalog as a structured
// list of creative works, not just a wall of anchor tags.
useHead(() => ({
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: chrome.value.title,
        description: chrome.value.subtitle,
        itemListElement: groups.value.flatMap((group) =>
          group.items.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "SoftwareSourceCode",
              name: p.name,
              description: p.description,
              programmingLanguage: p.stack,
              ...(p.href ? {codeRepository: p.href} : {}),
              ...(p.downloadHref ? {downloadUrl: `${SITE_URL}${p.downloadHref}`} : {}),
            },
          }))
        ),
      }),
    },
  ],
}));
</script>

<template>
  <div class="projects-page">
    <section class="rd-section projects-page__hero">
      <div class="rd-wrap">
        <div class="projects-page__eyebrow mono">{{ chrome.eyebrow }}</div>
        <h1 class="projects-page__title">{{ chrome.title }}</h1>
        <p class="projects-page__lead">{{ chrome.subtitle }}</p>
      </div>
    </section>

    <template v-for="(group, gi) in groups" :key="group.title">
      <div class="rd-divider" />
      <section class="rd-section projects-page__section">
        <div class="rd-wrap">
          <h2 class="projects-page__group-title">{{ group.title }}</h2>
          <div class="projects-page__grid">
            <article v-for="p in group.items" :key="p.name" class="projects-page__card">
              <div>
                <div class="projects-page__tags">
                  <span v-for="tag in tagsFor(p.stack)" :key="tag" class="projects-page__tag mono">{{ tag }}</span>
                </div>
                <h3 class="projects-page__card-title">{{ p.name }}</h3>
                <p class="projects-page__description">{{ p.description }}</p>
              </div>
              <div class="projects-page__actions">
                <a
                    v-if="p.href"
                    class="projects-page__link mono"
                    :href="resolveHref(p.href)"
                    :target="isExternal(p.href) ? '_blank' : undefined"
                    :rel="isExternal(p.href) ? 'noopener noreferrer' : undefined"
                >{{ isExternal(p.href) ? "GitHub" : chrome.open }} →</a>
                <span v-else-if="!p.downloadHref" class="projects-page__link projects-page__link_muted mono">{{ chrome.soon }}</span>
                <a
                    v-if="p.downloadHref"
                    class="projects-page__link projects-page__link_accent mono"
                    :href="p.downloadHref"
                    download
                >{{ chrome.download }} ↓</a>
              </div>
            </article>
          </div>
        </div>
      </section>
      <div v-if="gi === groups.length - 1" class="rd-divider" />
    </template>

    <section class="rd-section projects-page__section">
      <div class="rd-wrap">
        <a class="projects-page__back-link mono" :href="localePath('/')">← {{ t('projects.backHome') }}</a>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.projects-page__eyebrow {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.projects-page__hero {
  padding-top: 56px;
}
.projects-page__title {
  font-size: clamp(30px, 5vw, 44px);
  font-weight: 600;
  letter-spacing: -0.015em;
  margin-bottom: 18px;
}
.projects-page__lead {
  color: var(--text-muted);
  font-size: 16px;
  max-width: 640px;
  line-height: 1.65;
}
.projects-page__group-title {
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin-bottom: 22px;
}
.projects-page__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.projects-page__card {
  background: var(--bg-deep);
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-height: 168px;
}
.projects-page__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.projects-page__tag {
  font-size: 10.5px;
  color: var(--text-muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 3px 9px;
  white-space: nowrap;
}
.projects-page__card-title {
  font-size: 16px;
  font-weight: 400;
  margin-bottom: 8px;
  color: var(--text-primary);
}
.projects-page__description {
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.55;
}
.projects-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 14px;
}
.projects-page__link {
  font-size: 12.5px;
  color: var(--text-muted);
  align-self: flex-start;
}
a.projects-page__link:hover {
  color: var(--accent-pink);
}
.projects-page__link_muted {
  opacity: 0.65;
}
.projects-page__link_accent {
  color: var(--accent-pink);
}
.projects-page__back-link {
  font-size: 13px;
  color: var(--text-muted);
}
.projects-page__back-link:hover {
  color: var(--accent-pink);
}
@media (max-width: 760px) {
  .projects-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
