<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";
import EmailEditorShell from "~/components/emailEditor/EmailEditorShell.vue";

const { t } = useI18n();

useSeoMeta({
  title: () => t("seo.pages.emailEditor.title"),
  description: () => t("seo.pages.emailEditor.description"),
  robots: () => t("seo.common.robots"),
  ogType: "website",
  ogSiteName: () => t("seo.common.siteName"),
  ogTitle: () => t("seo.pages.emailEditor.ogTitle"),
  ogDescription: () => t("seo.pages.emailEditor.ogDescription")
});
</script>

<template>
  <u-container class="email-editor">
    <div class="email-editor__header background-hero text-center space-y-3">
      <page-header
          title="services.emailEditor.title"
          description="services.emailEditor.subtitle"
          class="mb-6"
          :is-centered="true"
      />
    </div>

    <EmailEditorShell />
  </u-container>
</template>

<style lang="scss">
.email-editor {
  padding-top: 24px;
  padding-bottom: 96px;
}

.email-editor__subtitle {
  max-width: 760px;
  font-size: 14px;
}
</style>
