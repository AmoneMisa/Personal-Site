<template>
  <u-app class="site-app">
    <header-nav class="site-app__header" />
    <u-main class="site-app__main" as="main">
      <NuxtPage />
    </u-main>
    <telegram-subscription-button />
    <site-footer class="site-app__footer" />
  </u-app>
</template>
<script setup lang="ts">
import HeaderNav from "~/components/redesign/HeaderNav.vue";
import SiteFooter from "~/components/redesign/SiteFooter.vue";
import TelegramSubscriptionButton from "~/components/TelegramSubscriptionButton.client.vue";

const SITE_URL = "https://whiteslove.me";

const {t, locale, locales} = useI18n();
const route = useRoute();

// Map i18n codes -> Open Graph locale format. og:locale must follow the page's
// actual language (was hardcoded to ru_RU on every route, incl. English), and
// the other enabled locales are advertised as alternates.
const OG_LOCALE: Record<string, string> = {ru: 'ru_RU', en: 'en_US', kk: 'kk_KZ'};
const activeCodes = computed(() =>
    (locales.value ?? []).map((l: any) => (typeof l === 'string' ? l : l.code))
);

const localeHead = useLocaleHead({
  dir: true,
  seo: true,
  lang: true
});

// Site-wide social preview defaults. Individual pages can still override any of
// these via their own useSeoMeta call. Twitter tags are emitted site-wide so
// every route produces a valid card; twitter:title/description fall back to the
// per-page og:title/og:description automatically when a page doesn't set them.
useSeoMeta({
  ogImage: `${SITE_URL}/images/og-home.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: "image/png",
  ogUrl: () => `${SITE_URL}${route.path === '/' ? '' : route.path}` || SITE_URL,
  ogLocale: () => OG_LOCALE[locale.value] ?? 'ru_RU',
  ogLocaleAlternate: () => activeCodes.value
      .filter((c) => c !== locale.value)
      .map((c) => OG_LOCALE[c])
      .filter(Boolean),
  twitterCard: () => t('seo.common.twitterCard'),
  twitterImage: `${SITE_URL}/images/og-home.png`
});

// Canonical URL for every route. useLocaleHead emits hreflang alternates but no
// canonical, so pages were flagged "Canonical URL missing". Path-only (no query)
// and locale-prefixed, so /en/about canonicalises to .../en/about.
const canonicalUrl = computed(() => `${SITE_URL}${route.path === "/" ? "" : route.path}`);
useHead(() => ({
  link: [{ rel: "canonical", href: canonicalUrl.value }]
}));

useHead({
  ...localeHead,
  script: [
    {
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "WhitesLove",
        url: SITE_URL,
        inLanguage: ["ru", "en"],
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/services?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      })
    },
    {
      // Person schema — the site is a developer portfolio, so the owner is the
      // primary entity. Helps HR/recruiters and rich results tie the pages to a
      // real professional profile (name, role, skills, verified social links).
      type: "application/ld+json",
      innerHTML: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        name: "Marharyta Kubai",
        alternateName: "Маргарита Кубай",
        url: SITE_URL,
        image: `${SITE_URL}/images/photo.png`,
        jobTitle: "Frontend Developer",
        knowsAbout: [
          "Vue.js", "Nuxt.js", "TypeScript", "JavaScript", "SCSS",
          "REST API", "Git", "Docker", "PostgreSQL"
        ],
        sameAs: [
          "https://github.com/AmoneMisa",
          "https://www.linkedin.com/in/whiteslove-marharyta-kubai",
          "https://t.me/WhitesLove"
        ],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Bucharest",
          addressCountry: "RO"
        },
        nationality: { "@type": "Country", name: "Ukraine" }
      })
    }
  ]
});
</script>
<style lang="scss">

</style>
