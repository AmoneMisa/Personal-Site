<script setup lang="ts">
import PageHeader from "~/components/common/PageHeader.vue";

withDefaults(defineProps<{
  backdrop: string;
  title: string;
  headline?: string;
  description?: string;
}>(), {
  headline: undefined,
  description: undefined,
});
</script>

<template>
  <ocean-page-backdrop :variant="backdrop" />
  <div class="service-page-header text-center space-y-3">
    <page-header
        :title="title"
        :headline="headline"
        :description="description"
        :is-centered="true"
    />
  </div>
</template>

<style>
/* Shared outer rhythm for every tool page. Internal editors keep their own
 * layouts, while control metrics and direct tool surfaces come from one system. */
.service-page-header {
  width: min(100%, 1440px);
  margin: 0 auto;
  padding-inline: 24px;
  box-sizing: border-box;
}

.service-page-header + * {
  width: min(100%, 1440px) !important;
  max-width: 1440px !important;
  margin: 28px auto 0 !important;
  box-sizing: border-box;
}

.service-page-header + section,
.service-page-header + .tabs-row {
  border: 1px solid var(--color-border, var(--line));
  border-radius: 14px;
  background: var(--secondary-bg-gradient, rgba(255, 255, 255, 0.025));
  box-shadow: var(--shadow-light, inset 0 1px 0 rgba(255, 255, 255, 0.04));
}

/* Service controls use one 44px metric. This catches direct UInput/USelectMenu
 * usage as well as the existing CustomInput/CustomButton wrappers, without
 * changing compact controls elsewhere on the site. */
.service-page-header ~ * .ui-control,
.service-page-header ~ * .u-select-menu__trigger,
.service-page-header ~ * .btn,
.service-page-header ~ * .u-button {
  min-height: var(--ui-control-h-lg, 44px);
}

.service-page-header ~ * .btn,
.service-page-header ~ * .u-button {
  height: var(--ui-control-h-lg, 44px);
}

.service-page-header ~ * .ui-control,
.service-page-header ~ * .u-select-menu__trigger {
  border-radius: var(--ui-control-radius, 8px);
}

@media (max-width: 767px) {
  .service-page-header {
    padding-inline: 16px;
  }

  .service-page-header + * {
    margin-top: 20px !important;
  }
}
</style>
