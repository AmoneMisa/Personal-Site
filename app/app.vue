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
const DEFAULT_OG_IMAGE = `${SITE_URL}/share-og.png?kind=site`;

const {t, locale, locales} = useI18n();
const route = useRoute();

// Map i18n codes -> Open Graph locale format. og:locale must follow the page's
// actual language (was hardcoded to ru_RU on every route, incl. English), and
// the other enabled locales are advertised as alternates.

computed(() =>
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
  ogImage: DEFAULT_OG_IMAGE,
  ogImageSecureUrl: DEFAULT_OG_IMAGE,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageType: "image/png",
  ogImageAlt: "WhitesLove — portfolio, services and search tools",
  twitterCard: () => t('seo.common.twitterCard'),
  twitterImage: DEFAULT_OG_IMAGE,
  twitterImageAlt: "WhitesLove — portfolio, services and search tools"
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
.site-app {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.site-app__main {
  min-width: 0;
  flex: 1 0 auto;
}

.site-app__footer {
  margin-top: auto;
  flex: 0 0 auto;
}

/* The radial apartment cards are teleported to <body>. Their slots are rendered
   after the centre pager, so without an explicit stacking order they can paint
   over the pager and hide/cut off its arrows. Keep the pager above every card. */
.flat-radial__hub {
  z-index: 50 !important;
  width: 64px !important;
  height: 64px !important;
  grid-template-columns: 20px 20px 20px !important;
  overflow: visible !important;
}

.flat-radial__hub-arrow {
  position: relative;
  z-index: 2;
  min-width: 20px;
  min-height: 44px;
  font-size: 28px !important;
  font-weight: 700;
}

.flat-radial__hub-count {
  position: relative;
  z-index: 2;
  font-size: 12px !important;
}

.flat-radial__slot {
  z-index: 1;
}

/* Search forms expose their loading state through the submit UButton. While a
   foreground request is running, cover the whole filter area: this prevents a
   second/third filter mutation from being queued before the current result has
   settled, and gives an unambiguous visual loading state. Load-more requests do
   not disable the submit button, so infinite scrolling remains unaffected. */
.jobs__controls,
.hiring__controls {
  position: relative;
}

.jobs__controls:has(button[type="submit"][disabled]),
.hiring__controls:has(button[type="submit"][disabled]) {
  cursor: wait;
}

.jobs__controls:has(button[type="submit"][disabled])::before,
.hiring__controls:has(button[type="submit"][disabled])::before {
  content: "";
  position: absolute;
  inset: -6px;
  z-index: 80;
  border-radius: 12px;
  background: rgba(10, 15, 38, 0.62);
  backdrop-filter: blur(1.5px);
  pointer-events: auto;
  cursor: wait;
}

.jobs__controls:has(button[type="submit"][disabled])::after,
.hiring__controls:has(button[type="submit"][disabled])::after {
  content: "";
  position: absolute;
  z-index: 81;
  top: 50%;
  left: 50%;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 3px solid rgba(255, 255, 255, 0.18);
  border-top-color: var(--accent-pink, #e0679a);
  border-radius: 50%;
  animation: search-controls-spin 0.75s linear infinite;
  pointer-events: none;
}

@keyframes search-controls-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .jobs__controls:has(button[type="submit"][disabled])::after,
  .hiring__controls:has(button[type="submit"][disabled])::after {
    animation-duration: 1.8s;
  }
}
</style>
