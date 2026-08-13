<template>
  <u-app>
    <custom-header/>
    <u-main as="main">
      <u-container class="m-auto">
        <NuxtPage/>
      </u-container>
    </u-main>
    <chat-form />
    <custom-footer/>
    <under-footer/>
    <i18n-loader-overlay/>
  </u-app>
</template>
<script setup lang="ts">
import CustomHeader from "~/layout/Header.vue";
import CustomFooter from "~/layout/Footer.vue";
import UnderFooter from "~/layout/UnderFooter.vue";
import I18nLoaderOverlay from "~/components/common/I18nLoaderOverlay.vue";
import ChatForm from "~/components/common/ChatForm.vue";

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
  ogImage: `${SITE_URL}/images/admin-panel.png`,
  ogUrl: () => `${SITE_URL}${route.path === '/' ? '' : route.path}` || SITE_URL,
  ogLocale: () => OG_LOCALE[locale.value] ?? 'ru_RU',
  ogLocaleAlternate: () => activeCodes.value
      .filter((c) => c !== locale.value)
      .map((c) => OG_LOCALE[c])
      .filter(Boolean),
  twitterCard: () => t('seo.common.twitterCard'),
  twitterImage: `${SITE_URL}/images/admin-panel.png`
});

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
    }
  ]
});
</script>
<style lang="scss">

</style>