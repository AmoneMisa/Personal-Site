<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "reef" | "treasure" | "home" | "ambient";
}>(), {
  variant: "reef",
});
</script>

<template>
  <div
    class="ocean-page-backdrop"
    :class="[
      `ocean-page-backdrop_${variant}`,
      { 'ocean-page-backdrop_has-life': variant === 'reef' || variant === 'treasure' },
    ]"
    aria-hidden="true"
  >
    <underwater-ambient v-if="variant === 'reef' || variant === 'treasure'" />
  </div>
</template>

<style scoped>
.ocean-page-backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  isolation: isolate;
  overflow: hidden;
  pointer-events: none;
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, 0.38) 0%, rgba(4, 8, 28, 0.54) 54%, rgba(4, 8, 28, 0.76) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
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

/*
 * Animated water is intentionally attached only to the image-backed underwater
 * variants that also render fish/bubbles. The home image and ambient gradient
 * stay completely static.
 */
.ocean-page-backdrop_has-life::before,
.ocean-page-backdrop_has-life::after {
  content: "";
  position: absolute;
  inset: -12%;
  z-index: 0;
  pointer-events: none;
  transform: translate3d(0, 0, 0);
}

/* Broad, very slow moving light bands: visible enough to read as water motion,
 * but low-contrast so text/cards above the backdrop never flicker. */
.ocean-page-backdrop_has-life::before {
  opacity: 0.28;
  background:
    repeating-radial-gradient(
      ellipse at 50% -22%,
      rgba(114, 205, 255, 0.16) 0 2px,
      rgba(79, 166, 235, 0.055) 3px 10px,
      transparent 12px 34px
    );
  filter: blur(2.5px);
  animation: ocean-water-caustics 16s ease-in-out infinite alternate;
}

/* A second phase moving in another direction prevents the backdrop from looking
 * like one texture sliding over the image. */
.ocean-page-backdrop_has-life::after {
  opacity: 0.2;
  background:
    radial-gradient(ellipse at 18% 12%, rgba(114, 204, 255, 0.13), transparent 24%),
    radial-gradient(ellipse at 72% 18%, rgba(71, 158, 231, 0.11), transparent 28%),
    repeating-linear-gradient(
      104deg,
      transparent 0 52px,
      rgba(109, 201, 255, 0.055) 58px 61px,
      transparent 67px 120px
    );
  filter: blur(7px);
  mix-blend-mode: screen;
  animation: ocean-water-drift 22s ease-in-out infinite alternate;
}

/* Canvas must stay above the water-light overlay while the complete backdrop
 * remains below the site's interface because its parent is z-index:-1. */
.ocean-page-backdrop_has-life :deep(.underwater-ambient) {
  z-index: 1;
}

.ocean-page-backdrop_ambient {
  background:
    radial-gradient(circle at 82% 18%, rgba(37, 117, 221, 0.12), transparent 25%),
    radial-gradient(circle at 12% 84%, rgba(138, 68, 209, 0.12), transparent 28%),
    radial-gradient(circle at 58% 4%, rgba(241, 73, 157, 0.07), transparent 25%),
    #070c22;
}

.ocean-page-backdrop_ambient::before,
.ocean-page-backdrop_ambient::after {
  content: "";
  position: absolute;
  z-index: -1;
  border: 1px solid rgba(75, 145, 255, 0.22);
  border-radius: 999px;
}
.ocean-page-backdrop_ambient::before { width: 10px; height: 10px; left: 7%; top: 34%; box-shadow: 32px 42px 0 3px rgba(67,119,221,.09),105px 420px 0 5px rgba(66,172,255,.08); }
.ocean-page-backdrop_ambient::after { width: 8px; height: 8px; right: 8%; top: 26%; box-shadow: -42px 54px 0 2px rgba(64,157,255,.08),16px 190px 0 4px rgba(118,83,226,.08); }

@keyframes ocean-water-caustics {
  0% {
    transform: translate3d(-1.6%, -1%, 0) scale(1.01, 0.99) rotate(-0.25deg);
  }
  48% {
    transform: translate3d(0.8%, 1.2%, 0) scale(1.025, 1.01) rotate(0.2deg);
  }
  100% {
    transform: translate3d(1.8%, -0.3%, 0) scale(1.01, 1.025) rotate(-0.08deg);
  }
}

@keyframes ocean-water-drift {
  0% {
    transform: translate3d(1.5%, -1%, 0) scale(1.02);
  }
  55% {
    transform: translate3d(-0.7%, 0.7%, 0) scale(1.035, 1.01);
  }
  100% {
    transform: translate3d(-1.8%, 1.2%, 0) scale(1.015, 1.035);
  }
}

@media (max-width: 720px) {
  .ocean-page-backdrop {
    background-position: var(--ocean-page-mobile-position, 66% top);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-page-backdrop_has-life::before,
  .ocean-page-backdrop_has-life::after {
    animation: none;
  }
}
</style>
