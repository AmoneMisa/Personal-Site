<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UIcon>.
//
// Icon rendering itself comes from @nuxt/icon, which is a separate module we
// already depend on — it is what Nuxt UI used underneath anyway, so every
// existing `i-lucide-*` name keeps working unchanged.
defineOptions({ inheritAttrs: false });

defineProps<{
  name?: string;
  // Accepted and ignored: call sites pass Nuxt UI's `ui` override object.
  ui?: unknown;
}>();
</script>

<template>
  <Icon v-if="name" :name="name" class="u-icon" v-bind="$attrs" />
</template>

<style scoped>
.u-icon {
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: none;
  vertical-align: -0.125em;
}
</style>
