<script setup lang="ts">
// Self-hosted Twemoji image with explicit dimensions (no CDN, no layout shift).
// These emojis are purely decorative — every usage sits next to text that already
// carries the meaning — so they render with empty alt + aria-hidden and stay out
// of the accessibility tree and image-SEO index (the `alt` prop is kept only for
// backwards-compatible call sites and is intentionally not rendered).
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
      alt=""
      aria-hidden="true"
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
