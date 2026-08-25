<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: "reef" | "treasure" | "home" | "ambient";
}>(), {
  variant: "reef",
});

const hasUnderwaterLife = computed(() => props.variant === "reef" || props.variant === "treasure");
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
    <div v-if="hasUnderwaterLife" class="ocean-page-backdrop__water" />
    <div v-if="hasUnderwaterLife" class="ocean-page-backdrop__caustics ocean-page-backdrop__caustics_primary" />
    <div v-if="hasUnderwaterLife" class="ocean-page-backdrop__caustics ocean-page-backdrop__caustics_secondary" />
    <ocean-bubbles v-if="hasUnderwaterLife" />
    <underwater-ambient-glb v-if="hasUnderwaterLife" />
  </div>
</template>

<style scoped>
/* Keep the negative fixed backdrop inside the application stacking context.
   Without an isolated root, z-index:-1 can fall behind UApp/body backgrounds
   and make the complete ocean layer (including bubbles) disappear. */
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
.ocean-page-backdrop__water,
.ocean-page-backdrop__caustics {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ocean-page-backdrop__image {
  inset: -1.5%;
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, 0.34) 0%, rgba(4, 8, 28, 0.5) 52%, rgba(4, 8, 28, 0.76) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
  transform: scale(1.02);
  animation: ocean-water-breathe 22s ease-in-out infinite alternate;
  will-change: transform, filter;
}

/* Broad low-contrast refraction bands. They move on a different axis to the
   photograph so the background reads as water rather than a panning image. */
.ocean-page-backdrop__water {
  z-index: 0;
  inset: -12% -8%;
  opacity: 0.22;
  mix-blend-mode: screen;
  background:
    radial-gradient(ellipse 46% 8% at 20% 10%, rgba(194, 239, 255, 0.2) 0 12%, transparent 58%),
    radial-gradient(ellipse 40% 7% at 69% 16%, rgba(135, 211, 255, 0.16) 0 10%, transparent 61%),
    radial-gradient(ellipse 32% 6% at 43% 28%, rgba(91, 183, 255, 0.12) 0 9%, transparent 64%),
    radial-gradient(ellipse 30% 6% at 89% 36%, rgba(179, 232, 255, 0.1) 0 8%, transparent 62%);
  filter: blur(18px);
  transform-origin: 50% 0;
  animation: ocean-water-flow 17s ease-in-out infinite alternate;
  will-change: transform, opacity;
}

.ocean-page-backdrop__caustics {
  z-index: 0;
  mix-blend-mode: screen;
  transform-origin: 50% 0;
  will-change: transform, opacity;
}

.ocean-page-backdrop__caustics_primary {
  inset: -5% -6% 34%;
  opacity: 0.18;
  background:
    repeating-radial-gradient(ellipse at 14% -8%, transparent 0 26px, rgba(184, 235, 255, 0.055) 31px 34px, transparent 40px 62px),
    repeating-radial-gradient(ellipse at 72% -12%, transparent 0 31px, rgba(121, 205, 255, 0.045) 38px 41px, transparent 48px 78px);
  filter: blur(7px);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0, 0, 0, 0.82) 48%, transparent 100%);
  animation: ocean-caustic-drift 13s ease-in-out infinite alternate;
}

.ocean-page-backdrop__caustics_secondary {
  inset: -9% -8% 45%;
  opacity: 0.12;
  background:
    radial-gradient(52% 20% at 17% 7%, rgba(175, 232, 255, 0.25), transparent 74%),
    radial-gradient(38% 16% at 78% 10%, rgba(142, 219, 255, 0.2), transparent 76%),
    radial-gradient(32% 11% at 49% 18%, rgba(120, 202, 255, 0.15), transparent 78%);
  filter: blur(22px);
  animation: ocean-caustic-swell 21s ease-in-out infinite alternate-reverse;
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
    radial-gradient(circle at 82% 18%, rgba(37, 117, 221, 0.12), transparent 25%),
    radial-gradient(circle at 12% 84%, rgba(138, 68, 209, 0.12), transparent 28%),
    radial-gradient(circle at 58% 4%, rgba(241, 73, 157, 0.07), transparent 25%),
    #070c22;
}

.ocean-page-backdrop_ambient .ocean-page-backdrop__image {
  background: none;
  animation: none;
}

.ocean-page-backdrop_ambient::before,
.ocean-page-backdrop_ambient::after {
  content: "";
  position: absolute;
  z-index: -1;
  border: 1px solid rgba(75, 145, 255, 0.22);
  border-radius: 999px;
}

.ocean-page-backdrop_ambient::before {
  width: 10px;
  height: 10px;
  left: 7%;
  top: 34%;
  box-shadow:
    32px 42px 0 3px rgba(67, 119, 221, 0.09),
    105px 420px 0 5px rgba(66, 172, 255, 0.08);
}

.ocean-page-backdrop_ambient::after {
  width: 8px;
  height: 8px;
  right: 8%;
  top: 26%;
  box-shadow:
    -42px 54px 0 2px rgba(64, 157, 255, 0.08),
    16px 190px 0 4px rgba(118, 83, 226, 0.08);
}

.ocean-page-backdrop_has-life :deep(.underwater-glb) {
  z-index: 1;
}

/* Bubbles have their own resilient canvas now. The legacy GLB component still
   maintains its bubble simulation internally because fish interactions use it,
   but its 2D canvases are hidden to avoid duplicate visible bubbles. */
.ocean-page-backdrop_has-life :deep(.underwater-glb__back),
.ocean-page-backdrop_has-life :deep(.underwater-glb__front) {
  display: none;
}

@keyframes ocean-water-breathe {
  0% {
    transform: translate3d(-0.16%, -0.08%, 0) scale(1.02);
    filter: saturate(1) brightness(1);
  }
  46% {
    transform: translate3d(0.2%, 0.12%, 0) scale(1.024);
    filter: saturate(1.025) brightness(1.015);
  }
  100% {
    transform: translate3d(-0.08%, 0.2%, 0) scale(1.021);
    filter: saturate(1.01) brightness(1.005);
  }
}

@keyframes ocean-water-flow {
  0% {
    transform: translate3d(-2.2%, -1%, 0) skewX(-1.2deg) scale(1.02, 0.96);
    opacity: 0.16;
  }
  48% {
    transform: translate3d(1.1%, 1.2%, 0) skewX(0.8deg) scale(1.05, 1.03);
    opacity: 0.25;
  }
  100% {
    transform: translate3d(2.4%, -0.4%, 0) skewX(-0.4deg) scale(1.01, 1.05);
    opacity: 0.19;
  }
}

@keyframes ocean-caustic-drift {
  0% {
    transform: translate3d(-1.6%, -0.8%, 0) rotate(-0.25deg) scale(1.03, 0.96);
    opacity: 0.13;
  }
  52% {
    transform: translate3d(0.4%, 0.5%, 0) rotate(0.2deg) scale(1.055, 1.03);
    opacity: 0.2;
  }
  100% {
    transform: translate3d(1.5%, -0.2%, 0) rotate(-0.1deg) scale(1.025, 1.06);
    opacity: 0.15;
  }
}

@keyframes ocean-caustic-swell {
  0% {
    transform: translate3d(-0.9%, -0.4%, 0) scale(1.02);
    opacity: 0.08;
  }
  55% {
    transform: translate3d(0.3%, 0.6%, 0) scale(1.065, 0.96);
    opacity: 0.14;
  }
  100% {
    transform: translate3d(1%, -0.1%, 0) scale(1.035, 1.04);
    opacity: 0.1;
  }
}

@media (max-width: 720px) {
  .ocean-page-backdrop__image {
    inset: -1%;
    background-position: var(--ocean-page-mobile-position, 66% top);
    animation-duration: 30s;
  }

  .ocean-page-backdrop__water,
  .ocean-page-backdrop__caustics_primary {
    opacity: 0.11;
    filter: blur(14px);
  }

  .ocean-page-backdrop__caustics_secondary {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-page-backdrop__image,
  .ocean-page-backdrop__water,
  .ocean-page-backdrop__caustics {
    animation: none;
  }

  .ocean-page-backdrop__image {
    transform: none;
  }
}
</style>
