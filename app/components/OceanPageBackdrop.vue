<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: "reef" | "treasure" | "home" | "ambient";
}>(), {
  variant: "reef",
});

const hasUnderwaterLife = computed(() => (
  props.variant === "reef"
  || props.variant === "treasure"
  || props.variant === "home"
));
</script>

<template>
  <div
    class="ocean-page-backdrop"
    :class="[
      `ocean-page-backdrop_${variant}`,
      { 'ocean-page-backdrop_has-life': hasUnderwaterLife },
    ]"
    aria-hidden="true"
  >
    <div class="ocean-page-backdrop__image" />
    <ocean-bubbles v-if="hasUnderwaterLife" />
    <underwater-ambient2d v-if="hasUnderwaterLife" />
    <header-crab v-if="hasUnderwaterLife" />
    <div v-if="hasUnderwaterLife" class="ocean-page-backdrop__vignette" />
  </div>
</template>

<style scoped>
:global(.site-app) {
  position: relative;
  isolation: isolate;
}

.ocean-page-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  isolation: isolate;
  overflow: hidden;
  pointer-events: none;
  contain: paint;
  background-color: #05091d;
}

.ocean-page-backdrop__image,
.ocean-page-backdrop__vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* The darkening and cold cast of being under the surface. Cheap, and it does
   most of the work of selling the depth. */
.ocean-page-backdrop__vignette {
  z-index: 4;
  background:
    radial-gradient(ellipse 78% 70% at 50% 44%, transparent 46%, rgba(3, 12, 38, .34) 82%, rgba(2, 7, 24, .62) 100%),
    radial-gradient(ellipse 120% 60% at 50% 0%, rgba(126, 206, 255, .07), transparent 58%);
  animation: ocean-lens-breathe 13s ease-in-out infinite alternate;
}

.ocean-page-backdrop__image {
  inset: -1.5%;
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, .34) 0%, rgba(4, 8, 28, .5) 52%, rgba(4, 8, 28, .76) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
  transform: scale(1.02);
  animation: ocean-water-breathe 22s ease-in-out infinite alternate;
  will-change: transform, filter;
}

.ocean-page-backdrop_reef {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-reef.webp");
  --ocean-page-mobile-position: 66% top;
}

.ocean-page-backdrop_treasure {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-treasure.webp");
  --ocean-page-mobile-position: 69% top;
}

.ocean-page-backdrop_home {
  --ocean-page-image: url("/images/easter-eggs/ocean-page-home.webp");
  --ocean-page-mobile-position: 70% top;
}

.ocean-page-backdrop_ambient {
  background:
    radial-gradient(circle at 82% 18%, rgba(37, 117, 221, .12), transparent 25%),
    radial-gradient(circle at 12% 84%, rgba(138, 68, 209, .12), transparent 28%),
    radial-gradient(circle at 58% 4%, rgba(241, 73, 157, .07), transparent 25%),
    #070c22;
}

.ocean-page-backdrop_ambient .ocean-page-backdrop__image {
  background: none;
  animation: none;
}

.ocean-page-backdrop_has-life :deep(.underwater-2d) {
  z-index: 1;
}

@keyframes ocean-water-breathe {
  0% { transform: translate3d(-.16%, -.08%, 0) scale(1.02); filter: saturate(1) brightness(1); }
  46% { transform: translate3d(.2%, .12%, 0) scale(1.024); filter: saturate(1.025) brightness(1.015); }
  100% { transform: translate3d(-.08%, .2%, 0) scale(1.021); filter: saturate(1.01) brightness(1.005); }
}

@keyframes ocean-lens-breathe {
  0% { opacity: .88; }
  100% { opacity: 1; }
}

@media (max-width: 720px) {
  .ocean-page-backdrop__image {
    inset: 0;
    background-position: var(--ocean-page-mobile-position, 66% top);
    transform: none;
    animation: none;
    will-change: auto;
  }

  :deep(.ocean-bubbles) {
    display: none !important;
  }

  .ocean-page-backdrop__vignette {
    animation: none;
  }

  .ocean-page-backdrop_has-life :deep(.underwater-2d__swimmer:not(.underwater-2d__swimmer_shark)) {
    display: none !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-page-backdrop__image,
  .ocean-page-backdrop__vignette {
    animation: none;
  }

  .ocean-page-backdrop__image { transform: none; }
}
</style>
