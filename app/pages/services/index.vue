<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";

const { t } = useI18n();
const localePath = useLocalePath();

useSeoMeta({
  title: () => t("seo.pages.services.title"),
  description: () => t("seo.pages.services.description"),
  robots: () => t("seo.common.robots"),
  ogType: "website",
  ogSiteName: () => t("seo.common.siteName"),
  ogTitle: () => t("seo.pages.services.ogTitle"),
  ogDescription: () => t("seo.pages.services.ogDescription"),
});

// Static tool catalog (was DB-driven). Titles/descriptions reuse the per-tool
// SEO i18n keys that already exist in the static locale files.
const TOOLS = [
  { titleKey: "seo.pages.pdfEditor.title", descKey: "seo.pages.pdfEditor.description", link: "/services/pdf-editor" },
  { titleKey: "seo.pages.mergeJson.title", descKey: "seo.pages.mergeJson.description", link: "/services/merge-json" },
  { titleKey: "seo.pages.emailEditor.title", descKey: "seo.pages.emailEditor.description", link: "/services/email-editor" },
  { titleKey: "seo.pages.svgEditor.title", descKey: "seo.pages.svgEditor.description", link: "/services/svg-editor" },
  { titleKey: "seo.pages.markdownEditor.title", descKey: "seo.pages.markdownEditor.description", link: "/services/markdown-editor" },
  { titleKey: "seo.pages.converter.title", descKey: "seo.pages.converter.description", link: "/services/converter" },
  { titleKey: "seo.pages.dockerSearch.title", descKey: "seo.pages.dockerSearch.description", link: "/services/dockerhub" },
];

const query = ref("");
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return TOOLS;
  return TOOLS.filter((tool) => t(tool.titleKey).toLowerCase().includes(q));
});

const howSteps = [
  { icon: "i-lucide-mouse-pointer-click", titleKey: "services.how.step1.title", textKey: "services.how.step1.text" },
  { icon: "i-lucide-sliders-horizontal", titleKey: "services.how.step2.title", textKey: "services.how.step2.text" },
  { icon: "i-lucide-check-circle", titleKey: "services.how.step3.title", textKey: "services.how.step3.text" },
];
</script>

<template>
  <u-container class="services">
    <decorative-easter-egg
      class="services__easter-egg"
      src="/images/easter-eggs/services-tools.png"
      :width="320"
      :height="225"
    />
    <div class="services__header text-center space-y-3">
      <page-header title="services.title" headline="services.headline" class="mb-6" />
      <p class="services__subtitle mx-auto">{{ t("services.subtitle") }}</p>
    </div>

    <div class="services__search">
      <u-input icon="i-lucide-search" :placeholder="t('services.searchPlaceholder')" v-model="query" />
    </div>

    <div class="services__grid">
      <a v-for="tool in filtered" :key="tool.link" class="tool-card" :href="localePath(tool.link)">
        <div class="tool-card__title">{{ t(tool.titleKey) }}</div>
        <p class="tool-card__desc">{{ t(tool.descKey) }}</p>
        <span class="tool-card__link mono">{{ t("services.open") }} →</span>
      </a>
    </div>

    <div v-if="filtered.length === 0" class="services__empty">
      <div class="services__empty-title">{{ t("services.empty.title") }}</div>
      <div class="text-muted">{{ t("services.empty.text") }}</div>
    </div>

    <section class="services__how">
      <h2 class="services__h2">{{ t("services.howTitle") }}</h2>
      <div class="services__how-grid">
        <div class="how-card" v-for="step in howSteps" :key="step.titleKey">
          <u-icon :name="step.icon" class="how-card__icon" />
          <div class="how-card__title">{{ t(step.titleKey) }}</div>
          <div class="how-card__text">{{ t(step.textKey) }}</div>
        </div>
      </div>
    </section>
  </u-container>
</template>

<style scoped lang="scss">
.services {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 40px 0 96px;
}
.services__header {
  position: relative;
  z-index: 1;
}
.services__easter-egg {
  position: absolute;
  top: 8px;
  left: -24px;
  z-index: 0;
  width: 260px;
  opacity: 0.18;
}
.services__subtitle {
  max-width: 720px;
  font-size: 14.5px;
  color: var(--text-muted);
}
.services__search {
  max-width: 420px;
  margin: 28px auto 24px;
}
.services__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
}
.tool-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-deep);
  padding: 24px;
  transition: background 0.15s;
}
.tool-card:hover {
  background: var(--bg-panel);
}
.tool-card__title {
  font-family: "Golos Text", sans-serif;
  font-size: 16px;
  color: var(--text-primary);
}
.tool-card__desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  flex: 1;
}
.tool-card__link {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 6px;
}
.tool-card:hover .tool-card__link {
  color: var(--accent-pink);
}
.services__empty {
  margin-top: 18px;
  text-align: center;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.services__empty-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.services__how {
  margin-top: 72px;
  text-align: center;
}
.services__h2 {
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.01em;
  margin-bottom: 22px;
}
.services__how-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.how-card {
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-panel);
  text-align: left;
}
.how-card__icon {
  font-size: 22px;
  color: var(--accent-pink);
  margin-bottom: 10px;
}
.how-card__title {
  font-weight: 600;
  margin-bottom: 6px;
}
.how-card__text {
  color: var(--text-muted);
  font-size: 13.5px;
}
@media (min-width: 800px) {
  .services__how-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 800px) {
  .services__grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 1100px) {
  .services__easter-egg {
    display: none;
  }
}
</style>
