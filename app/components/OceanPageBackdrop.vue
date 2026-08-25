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
    <svg v-if="hasUnderwaterLife" class="ocean-page-backdrop__defs" focusable="false" aria-hidden="true">
      <filter id="ocean-page-refraction" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.0018 0.0065"
          numOctaves="1"
          seed="7"
          stitchTiles="stitch"
          result="noise"
        >
          <animate
            attributeName="baseFrequency"
            dur="56s"
            values="0.0018 0.0065;0.0020 0.0061;0.0017 0.0068;0.0018 0.0065"
            repeatCount="indefinite"
          />
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.8" xChannelSelector="R" yChannelSelector="G">
          <animate attributeName="scale" dur="44s" values="2.2;3.3;2.6;2.2" repeatCount="indefinite" />
        </feDisplacementMap>
      </filter>
    </svg>

    <div
      class="ocean-page-backdrop__image"
      :class="{ 'ocean-page-backdrop__image_refraction': hasUnderwaterLife }"
    />
    <div v-if="hasUnderwaterLife" class="ocean-page-backdrop__caustics" />
    <underwater-ambient-glb v-if="hasUnderwaterLife" />
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
}

.ocean-page-backdrop__defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.ocean-page-backdrop__image,
.ocean-page-backdrop__caustics {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ocean-page-backdrop__image {
  background-color: #05091d;
  background-image:
    linear-gradient(180deg, rgba(4, 8, 28, 0.36) 0%, rgba(4, 8, 28, 0.5) 52%, rgba(4, 8, 28, 0.74) 100%),
    var(--ocean-page-image);
  background-position: center top;
  background-repeat: no-repeat;
  background-size: cover;
}

.ocean-page-backdrop__image_refraction {
  filter: url(#ocean-page-refraction);
  transform: scale(1.025);
  will-change: filter;
}

.ocean-page-backdrop__caustics {
  z-index: 0;
  opacity: 0.12;
  mix-blend-mode: screen;
  background:
    radial-gradient(52% 20% at 17% 7%, rgba(157, 226, 255, 0.18), transparent 74%),
    radial-gradient(38% 16% at 78% 10%, rgba(142, 219, 255, 0.15), transparent 76%),
    radial-gradient(32% 11% at 49% 18%, rgba(120, 202, 255, 0.11), transparent 78%);
  filter: blur(24px);
  animation: ocean-caustic-drift 34s ease-in-out infinite alternate;
  will-change: transform;
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

@keyframes ocean-caustic-drift {
  0% {
    transform: translate3d(-0.8%, -0.3%, 0) scale(1.025);
  }
  50% {
    transform: translate3d(0.35%, 0.1%, 0) scale(1.035);
  }
  100% {
    transform: translate3d(0.8%, -0.15%, 0) scale(1.028);
  }
}

@media (max-width: 720px) {
  .ocean-page-backdrop__image {
    background-position: var(--ocean-page-mobile-position, 66% top);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-page-backdrop__caustics {
    animation: none;
  }

  .ocean-page-backdrop__image_refraction {
    filter: none;
    transform: none;
  }
}
</style>
