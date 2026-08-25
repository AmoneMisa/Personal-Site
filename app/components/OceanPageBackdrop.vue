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
    <template v-if="hasUnderwaterLife">
      <svg class="ocean-page-backdrop__filter-defs" width="0" height="0" focusable="false" aria-hidden="true">
        <defs>
          <filter
            id="ocean-underwater-refraction"
            x="-8%"
            y="-8%"
            width="116%"
            height="116%"
            color-interpolation-filters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.004 0.012"
              numOctaves="2"
              seed="17"
              stitchTiles="stitch"
              result="waterNoise"
            >
              <animate
                attributeName="baseFrequency"
                dur="22s"
                values="0.004 0.012;0.0052 0.014;0.0036 0.0108;0.004 0.012"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feGaussianBlur in="waterNoise" stdDeviation="0.55" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="softNoise"
              scale="3.2"
              xChannelSelector="R"
              yChannelSelector="B"
            >
              <animate
                attributeName="scale"
                dur="17s"
                values="2.4;4.4;3.1;2.4"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
      </svg>

      <div class="ocean-page-backdrop__refracted-image" />
    </template>

    <underwater-ambient v-if="hasUnderwaterLife" />
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

.ocean-page-backdrop__filter-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* The original image remains on the parent as a stable fallback. This nearly
   opaque duplicate is displaced by low-frequency animated noise, so only the
   scenery appears to bend through water; page content above it never moves. */
.ocean-page-backdrop__refracted-image {
  position: absolute;
  inset: -2.5%;
  z-index: 0;
  pointer-events: none;
  opacity: .96;
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, 0.38) 0%, rgba(4, 8, 28, 0.54) 54%, rgba(4, 8, 28, 0.76) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
  filter: url("#ocean-underwater-refraction");
  transform: scale(1.018);
  transform-origin: 50% 22%;
  will-change: filter, transform;
  animation: ocean-refraction-drift 19s ease-in-out infinite alternate;
}

/* Light is deliberately secondary to the refraction: broad, diffuse patches
   imitate moving surface caustics without drawing obvious stripes or circles. */
.ocean-page-backdrop_has-life::before,
.ocean-page-backdrop_has-life::after {
  content: "";
  position: absolute;
  inset: -12%;
  z-index: 1;
  pointer-events: none;
  mix-blend-mode: screen;
  transform: translate3d(0, 0, 0);
}

.ocean-page-backdrop_has-life::before {
  opacity: .14;
  background:
    radial-gradient(ellipse 28% 48% at 12% -4%, rgba(142, 222, 255, .17), transparent 72%),
    radial-gradient(ellipse 22% 52% at 39% -9%, rgba(110, 205, 250, .13), transparent 72%),
    radial-gradient(ellipse 29% 50% at 68% -6%, rgba(140, 221, 255, .14), transparent 72%),
    radial-gradient(ellipse 24% 45% at 92% 0%, rgba(100, 195, 245, .11), transparent 72%);
  filter: blur(24px);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.62) 52%, transparent 91%);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.62) 52%, transparent 91%);
  animation: ocean-caustic-light-a 17s ease-in-out infinite alternate;
}

.ocean-page-backdrop_has-life::after {
  opacity: .095;
  background:
    radial-gradient(ellipse 18% 32% at 24% 12%, rgba(160, 230, 255, .15), transparent 74%),
    radial-gradient(ellipse 24% 36% at 55% 8%, rgba(112, 207, 252, .14), transparent 74%),
    radial-gradient(ellipse 20% 34% at 82% 16%, rgba(151, 225, 255, .12), transparent 75%);
  filter: blur(31px);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.5) 48%, transparent 82%);
  mask-image: linear-gradient(to bottom, #000 0%, rgba(0,0,0,.5) 48%, transparent 82%);
  animation: ocean-caustic-light-b 23s ease-in-out infinite alternate;
}

.ocean-page-backdrop_has-life :deep(.underwater-ambient) {
  z-index: 2;
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

.ocean-page-backdrop_ambient::before {
  width: 10px;
  height: 10px;
  left: 7%;
  top: 34%;
  box-shadow: 32px 42px 0 3px rgba(67,119,221,.09),105px 420px 0 5px rgba(66,172,255,.08);
}

.ocean-page-backdrop_ambient::after {
  width: 8px;
  height: 8px;
  right: 8%;
  top: 26%;
  box-shadow: -42px 54px 0 2px rgba(64,157,255,.08),16px 190px 0 4px rgba(118,83,226,.08);
}

@keyframes ocean-refraction-drift {
  0% {
    transform: translate3d(-.35%, -.18%, 0) scale(1.018, 1.012);
  }
  46% {
    transform: translate3d(.22%, .25%, 0) scale(1.022, 1.018);
  }
  100% {
    transform: translate3d(.42%, -.08%, 0) scale(1.016, 1.024);
  }
}

@keyframes ocean-caustic-light-a {
  0% {
    transform: translate3d(-2%, -1%, 0) rotate(-.45deg) scale(1.02);
  }
  52% {
    transform: translate3d(.7%, .8%, 0) rotate(.2deg) scale(1.055, 1.025);
  }
  100% {
    transform: translate3d(2%, -.4%, 0) rotate(-.12deg) scale(1.025, 1.06);
  }
}

@keyframes ocean-caustic-light-b {
  0% {
    transform: translate3d(1.8%, -.8%, 0) scale(1.03, 1.015);
  }
  48% {
    transform: translate3d(-.6%, .55%, 0) scale(1.065, 1.025);
  }
  100% {
    transform: translate3d(-2.2%, .9%, 0) scale(1.025, 1.06);
  }
}

@media (max-width: 1199px) {
  .ocean-page-backdrop__refracted-image {
    filter: none;
    transform: none;
    animation: none;
  }

  .ocean-page-backdrop_has-life::before,
  .ocean-page-backdrop_has-life::after {
    display: none;
  }
}

@media (max-width: 720px) {
  .ocean-page-backdrop,
  .ocean-page-backdrop__refracted-image {
    background-position: var(--ocean-page-mobile-position, 66% top);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-page-backdrop__refracted-image {
    filter: none;
    transform: none;
    animation: none;
  }

  .ocean-page-backdrop_has-life::before,
  .ocean-page-backdrop_has-life::after {
    animation: none;
  }
}
</style>
