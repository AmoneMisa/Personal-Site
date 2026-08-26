<script setup lang="ts">
import SvgEditorShell from "~/components/svgEditor/SvgEditorShell.vue";
import { useServiceSeo } from "~/composables/services/useServiceSeo";

useServiceSeo("svgEditor");
</script>

<template>
  <u-container class="svg-editor">
    <service-page-header
        backdrop="home"
        title="services.svgEditor.title"
        description="services.svgEditor.subtitle"
    />

    <svg-editor-shell />
  </u-container>
</template>

<style lang="scss">
.svg-editor {
  padding-top: 24px;
  padding-bottom: 96px;
}
</style>
