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

const localeHead = useLocaleHead({
  dir: true,
  seo: true,
  lang: true
});

// Site-wide default social preview image. Individual pages can still override
// og:image via their own useSeoMeta call.
useSeoMeta({
  ogImage: `${SITE_URL}/images/admin-panel.png`,
  ogUrl: SITE_URL,
  ogLocale: "ru_RU"
});

useHead({
  ...localeHead,
  link: [
    {
      rel: 'preload',
      as: 'image',
      href: '/_ipx/w_988&f_webp&q_80/images/admin-panel.png',
      fetchpriority: 'high',
      type: 'image/webp'
    }
  ],
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