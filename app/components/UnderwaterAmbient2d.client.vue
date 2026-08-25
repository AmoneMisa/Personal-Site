<script setup lang="ts">
import { computed } from "vue";

type CreatureKind = "fish" | "shark" | "seahorse" | "puffer" | "jelly";

type CreaturePreset = {
  id: string;
  src: string;
  kind: CreatureKind;
  top: string;
  size: string;
  duration: string;
  delay: string;
  direction?: "ltr" | "rtl";
  opacity?: number;
};

const creatures: CreaturePreset[] = [
  { id: "shark", src: "/images/ocean-creatures/shark.webp", kind: "shark", top: "22%", size: "clamp(150px, 15vw, 280px)", duration: "29s", delay: "-8s", direction: "rtl", opacity: .96 },
  { id: "fish-blue", src: "/images/ocean-creatures/fish-blue.webp", kind: "fish", top: "44%", size: "clamp(86px, 8vw, 150px)", duration: "19s", delay: "-2s", direction: "ltr", opacity: .92 },
  { id: "fish-coral", src: "/images/ocean-creatures/fish-coral.webp", kind: "fish", top: "66%", size: "clamp(78px, 7vw, 135px)", duration: "23s", delay: "-13s", direction: "rtl", opacity: .9 },
  { id: "fish-fancy", src: "/images/ocean-creatures/fish-fancy.webp", kind: "fish", top: "34%", size: "clamp(92px, 8.5vw, 160px)", duration: "25s", delay: "-17s", direction: "ltr", opacity: .9 },
  { id: "seahorse", src: "/images/ocean-creatures/seahorse.webp", kind: "seahorse", top: "52%", size: "clamp(82px, 7vw, 132px)", duration: "31s", delay: "-10s", direction: "rtl", opacity: .88 },
  { id: "puffer", src: "/images/ocean-creatures/puffer.webp", kind: "puffer", top: "73%", size: "clamp(72px, 6.5vw, 122px)", duration: "27s", delay: "-20s", direction: "ltr", opacity: .91 },
  { id: "jelly-blue", src: "/images/ocean-creatures/jelly-blue.webp", kind: "jelly", top: "14%", size: "clamp(74px, 6vw, 118px)", duration: "34s", delay: "-22s", direction: "ltr", opacity: .82 },
  { id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink.webp", kind: "jelly", top: "61%", size: "clamp(68px, 5.5vw, 108px)", duration: "37s", delay: "-4s", direction: "rtl", opacity: .8 },
];

const styleFor = (item: CreaturePreset) => ({
  "--creature-top": item.top,
  "--creature-size": item.size,
  "--creature-duration": item.duration,
  "--creature-delay": item.delay,
  "--creature-opacity": String(item.opacity ?? 1),
});
</script>

<template>
  <div class="underwater-2d" aria-hidden="true">
    <div
      v-for="item in creatures"
      :key="item.id"
      class="underwater-2d__creature"
      :class="[
        `underwater-2d__creature_${item.kind}`,
        `underwater-2d__creature_${item.direction ?? 'ltr'}`,
      ]"
      :style="styleFor(item)"
    >
      <div class="underwater-2d__bob">
        <img
          class="underwater-2d__sprite"
          :src="item.src"
          alt=""
          decoding="async"
          draggable="false"
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.underwater-2d {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
  contain: layout paint;
}

.underwater-2d__creature {
  position: absolute;
  top: var(--creature-top);
  left: 0;
  width: var(--creature-size);
  opacity: var(--creature-opacity);
  will-change: transform;
}

.underwater-2d__creature_ltr {
  animation: ocean-creature-ltr var(--creature-duration) linear var(--creature-delay) infinite;
}

.underwater-2d__creature_rtl {
  animation: ocean-creature-rtl var(--creature-duration) linear var(--creature-delay) infinite;
}

.underwater-2d__bob {
  width: 100%;
  animation: ocean-creature-bob 2.8s ease-in-out infinite alternate;
  transform-origin: 50% 50%;
}

.underwater-2d__sprite {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  filter: drop-shadow(0 10px 18px rgba(4, 12, 43, .28));
  transform-origin: 50% 50%;
  will-change: transform, filter;
}

/* Fish and shark stay flat 2D, but the soft squash/skew produces a tiny
   "swimming" flex rather than a rigid PNG gliding across the viewport. */
.underwater-2d__creature_fish .underwater-2d__sprite,
.underwater-2d__creature_shark .underwater-2d__sprite {
  animation: ocean-fish-flex 1.15s ease-in-out infinite alternate;
}

.underwater-2d__creature_fish:nth-of-type(3) .underwater-2d__sprite {
  animation-duration: .92s;
}

.underwater-2d__creature_fish:nth-of-type(4) .underwater-2d__sprite {
  animation-duration: 1.32s;
}

.underwater-2d__creature_shark .underwater-2d__sprite {
  animation-duration: 1.55s;
}

.underwater-2d__creature_seahorse .underwater-2d__sprite {
  animation: ocean-seahorse-sway 2.3s ease-in-out infinite alternate;
}

.underwater-2d__creature_puffer .underwater-2d__sprite {
  animation: ocean-puffer-breathe 1.9s ease-in-out infinite;
}

.underwater-2d__creature_jelly .underwater-2d__bob {
  animation-duration: 4.8s;
}

.underwater-2d__creature_jelly .underwater-2d__sprite {
  animation: ocean-jelly-pulse 2.1s ease-in-out infinite;
  filter:
    drop-shadow(0 0 14px rgba(103, 197, 255, .18))
    drop-shadow(0 10px 18px rgba(5, 8, 40, .24));
}

.underwater-2d__creature_rtl .underwater-2d__bob {
  scale: -1 1;
}

/* Re-flip vertical creatures so texturing/facial lighting remains authored;
   route direction is still mirrored at the wrapper level. */
.underwater-2d__creature_rtl:is(.underwater-2d__creature_jelly, .underwater-2d__creature_seahorse) .underwater-2d__sprite {
  scale: -1 1;
}

@keyframes ocean-creature-ltr {
  0% { transform: translate3d(calc(-1 * var(--creature-size) - 8vw), 0, 0); }
  100% { transform: translate3d(calc(100vw + 10vw), -3vh, 0); }
}

@keyframes ocean-creature-rtl {
  0% { transform: translate3d(calc(100vw + 10vw), 0, 0); }
  100% { transform: translate3d(calc(-1 * var(--creature-size) - 8vw), 3vh, 0); }
}

@keyframes ocean-creature-bob {
  0% { transform: translate3d(0, -5px, 0) rotate(-1deg); }
  100% { transform: translate3d(0, 7px, 0) rotate(1deg); }
}

@keyframes ocean-fish-flex {
  0% { transform: skewY(-1.1deg) scaleX(.99) rotate(-.45deg); }
  50% { transform: skewY(.8deg) scaleX(1.008) rotate(.2deg); }
  100% { transform: skewY(1.2deg) scaleX(.994) rotate(.55deg); }
}

@keyframes ocean-seahorse-sway {
  0% { transform: rotate(-2.2deg) translateY(-2px); }
  100% { transform: rotate(2.6deg) translateY(4px); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.025, 1.035); }
}

@keyframes ocean-jelly-pulse {
  0%, 100% { transform: scale(1, .965) translateY(0); }
  50% { transform: scale(.972, 1.035) translateY(-5px); }
}

@media (max-width: 1199px) {
  .underwater-2d {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .underwater-2d {
    display: none;
  }
}
</style>
