<script setup lang="ts">
import EmailEditorShell from "~/components/emailEditor/EmailEditorShell.vue";
import ServicePageHeader from "~/components/services/ServicePageHeader.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";

useServiceSeo("emailEditor");
</script>

<template>
  <u-container class="email-editor">
    <service-page-header
        backdrop="home"
        title="services.emailEditor.title"
        description="services.emailEditor.subtitle"
    />

    <EmailEditorShell />
  </u-container>
</template>

<style lang="scss">
.email-editor {
  padding-top: 24px;
  padding-bottom: 96px;
}

</style>
