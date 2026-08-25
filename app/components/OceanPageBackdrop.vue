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

/* Underwater light: broad refracted shafts and thin caustic streaks.
   No radial/repeating circles — this should read as light coming through
   the surface above the viewer, not as ripples painted on the screen. */
.ocean-page-backdrop_has-life::before,
.ocean-page-backdrop_has-life::after {
  content: "";
  position: absolute;
  inset: -16%;
  z-index: 0;
  pointer-events: none;
  transform: translate3d(0, 0, 0);
  mix-blend-mode: screen;
}

.ocean-page-backdrop_has-life::before {
  opacity: .34;
  background:
    linear-gradient(104deg, transparent 0 8%, rgba(123, 210, 255, .10) 12%, transparent 18% 27%, rgba(100, 193, 246, .075) 32%, transparent 39% 51%, rgba(122, 211, 255, .085) 57%, transparent 64% 75%, rgba(95, 183, 239, .065) 80%, transparent 87%),
    linear-gradient(78deg, transparent 0 14%, rgba(159, 225, 255, .035) 20%, transparent 29% 52%, rgba(139, 215, 255, .035) 59%, transparent 69%);
  filter: blur(18px);
  transform-origin: 50% -10%;
  animation: ocean-underwater-shafts 18s ease-in-out infinite alternate;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.82) 52%, transparent 92%);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.82) 52%, transparent 92%);
}

.ocean-page-backdrop_has-life::after {
  opacity: .24;
  background:
    repeating-linear-gradient(
      112deg,
      transparent 0 76px,
      rgba(151, 226, 255, .07) 84px 87px,
      transparent 96px 154px,
      rgba(102, 195, 244, .04) 162px 164px,
      transparent 172px 238px
    );
  filter: blur(5px);
  transform: skewX(-5deg) scale(1.12);
  animation: ocean-underwater-caustics 13s ease-in-out infinite alternate;
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.65) 42%, transparent 76%);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.65) 42%, transparent 76%);
}

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

@keyframes ocean-underwater-shafts {
  0% {
    transform: translate3d(-2.2%, -1.4%, 0) rotate(-1.1deg) scale(1.03, 1.01);
  }
  52% {
    transform: translate3d(.7%, .6%, 0) rotate(.35deg) scale(1.06, 1.025);
  }
  100% {
    transform: translate3d(2.4%, -0.4%, 0) rotate(-.25deg) scale(1.025, 1.055);
  }
}

@keyframes ocean-underwater-caustics {
  0% {
    transform: translate3d(-2.5%, -1.2%, 0) skewX(-7deg) scale(1.12, 1.02);
  }
  48% {
    transform: translate3d(.9%, .7%, 0) skewX(-3deg) scale(1.16, 1.035);
  }
  100% {
    transform: translate3d(2.8%, -.2%, 0) skewX(-6deg) scale(1.11, 1.06);
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
