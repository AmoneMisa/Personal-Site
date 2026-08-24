<script setup lang="ts">
withDefaults(defineProps<{
  src: string;
  width: number;
  height: number;
}>(), {});
</script>

<template>
  <span class="decorative-easter-egg" aria-hidden="true">
    <nuxt-img
      class="decorative-easter-egg__image"
      :src="src"
      alt=""
      :width="width"
      :height="height"
      densities="1x 2x"
      format="webp"
      :quality="70"
      loading="lazy"
      decoding="async"
      fetchpriority="low"
      draggable="false"
    />
  </span>
</template>

<style scoped>
.decorative-easter-egg {
  display: block;
  pointer-events: none;
  user-select: none;
  contain: layout paint style;
}

.decorative-easter-egg__image {
  display: block;
  width: 100%;
  height: auto;
}
</style>
