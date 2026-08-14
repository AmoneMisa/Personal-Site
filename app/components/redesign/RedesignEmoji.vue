<script setup lang="ts">
// Self-hosted Twemoji image with explicit dimensions (no CDN, no layout shift).
const props = withDefaults(defineProps<{ cp: string; size?: number; alt?: string }>(), {
  size: 20,
  alt: "",
});
</script>

<template>
  <img
      :src="`/twemoji/${props.cp}.svg`"
      :width="props.size"
      :height="props.size"
      :alt="props.alt"
      class="redesign-emoji"
      loading="lazy"
      decoding="async"
      draggable="false"
  />
</template>

<style scoped>
.redesign-emoji {
  display: inline-block;
  vertical-align: -0.15em;
  flex-shrink: 0;
}
</style>
