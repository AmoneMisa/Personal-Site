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

const localeHead = useLocaleHead({
  dir: true,
  seo: true,
  lang: true
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
  ]
});
</script>
<style lang="scss">

</style>