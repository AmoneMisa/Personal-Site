<script setup lang="ts">
type CreatureKind = "fish" | "shark" | "seahorse" | "puffer" | "jelly";

type CreaturePreset = {
  id: string;
  src: string;
  kind: CreatureKind;
  top: string;
  size: string;
  duration: string;
  delay: string;
  direction: "ltr" | "rtl";
  opacity: number;
};

const creatures: CreaturePreset[] = [
  {
    id: "shark",
    src: "/images/ocean-creatures/shark.webp",
    kind: "shark",
    top: "20%",
    size: "clamp(190px, 18vw, 330px)",
    duration: "30s",
    delay: "-9s",
    direction: "rtl",
    opacity: 0.97,
  },
  {
    id: "fish-blue",
    src: "/images/ocean-creatures/fish-blue.webp",
    kind: "fish",
    top: "42%",
    size: "clamp(105px, 9vw, 165px)",
    duration: "19s",
    delay: "-3s",
    direction: "ltr",
    opacity: 0.93,
  },
  {
    id: "fish-coral",
    src: "/images/ocean-creatures/fish-coral.webp",
    kind: "fish",
    top: "69%",
    size: "clamp(98px, 8.5vw, 155px)",
    duration: "23s",
    delay: "-14s",
    direction: "rtl",
    opacity: 0.88,
  },
  {
    id: "fish-fancy",
    src: "/images/ocean-creatures/fish-fancy.webp",
    kind: "fish",
    top: "31%",
    size: "clamp(90px, 8vw, 145px)",
    duration: "25s",
    delay: "-18s",
    direction: "ltr",
    opacity: 0.82,
  },
  {
    id: "seahorse",
    src: "/images/ocean-creatures/seahorse.webp",
    kind: "seahorse",
    top: "55%",
    size: "clamp(70px, 5.6vw, 112px)",
    duration: "34s",
    delay: "-21s",
    direction: "rtl",
    opacity: 0.9,
  },
  {
    id: "puffer",
    src: "/images/ocean-creatures/puffer.webp",
    kind: "puffer",
    top: "78%",
    size: "clamp(82px, 7vw, 130px)",
    duration: "27s",
    delay: "-11s",
    direction: "ltr",
    opacity: 0.9,
  },
  {
    id: "jelly-blue",
    src: "/images/ocean-creatures/jelly-blue.webp",
    kind: "jelly",
    top: "14%",
    size: "clamp(82px, 6.5vw, 126px)",
    duration: "38s",
    delay: "-28s",
    direction: "ltr",
    opacity: 0.76,
  },
  {
    id: "jelly-pink",
    src: "/images/ocean-creatures/jelly-pink.webp",
    kind: "jelly",
    top: "62%",
    size: "clamp(76px, 6vw, 118px)",
    duration: "41s",
    delay: "-6s",
    direction: "rtl",
    opacity: 0.72,
  },
];
</script>

<template>
  <div class="underwater-2d" aria-hidden="true">
    <div
      v-for="creature in creatures"
      :key="creature.id"
      class="underwater-2d__swimmer"
      :class="[
        `underwater-2d__swimmer_${creature.direction}`,
        `underwater-2d__swimmer_${creature.kind}`,
        `underwater-2d__swimmer_${creature.id}`,
      ]"
      :style="{
        '--creature-top': creature.top,
        '--creature-size': creature.size,
        '--creature-duration': creature.duration,
        '--creature-delay': creature.delay,
        '--creature-opacity': creature.opacity,
      }"
    >
      <div class="underwater-2d__bob">
        <div class="underwater-2d__facing">
          <img
            class="underwater-2d__creature"
            :class="`underwater-2d__creature_${creature.kind}`"
            :src="creature.src"
            alt=""
            draggable="false"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.underwater-2d {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  contain: strict;
}

.underwater-2d__swimmer {
  position: absolute;
  top: var(--creature-top);
  width: var(--creature-size);
  opacity: var(--creature-opacity);
  will-change: transform;
  filter: drop-shadow(0 8px 18px rgba(8, 34, 93, 0.2));
}

.underwater-2d__swimmer_ltr {
  left: -24vw;
  animation: ocean-creature-ltr var(--creature-duration) linear var(--creature-delay) infinite;
}

.underwater-2d__swimmer_rtl {
  right: -24vw;
  animation: ocean-creature-rtl var(--creature-duration) linear var(--creature-delay) infinite;
}

.underwater-2d__bob {
  width: 100%;
  animation: ocean-creature-bob 3.8s ease-in-out infinite alternate;
  will-change: transform;
}

.underwater-2d__facing {
  width: 100%;
  transform-origin: center;
}

.underwater-2d__swimmer_rtl .underwater-2d__facing {
  transform: scaleX(-1);
}

.underwater-2d__creature {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  backface-visibility: hidden;
  transform-origin: 50% 50%;
  will-change: transform;
}

/*
 * Keep each source image intact. The previous implementation rendered the same
 * sprite several times and clipped those copies into "body", "tail", "fin"
 * and "mouth" regions. Because the source files are already final composite
 * sprites, those clipped copies exposed detached fins/tails next to the animal.
 * Whole-sprite deformation is deliberately subtle until true layered source
 * art is available.
 */
.underwater-2d__creature_fish {
  animation: ocean-fish-swim 1.35s ease-in-out infinite alternate;
}

.underwater-2d__creature_shark {
  animation: ocean-shark-swim 1.7s ease-in-out infinite alternate;
}

.underwater-2d__creature_seahorse {
  transform-origin: 52% 46%;
  animation: ocean-seahorse-drift 2.8s ease-in-out infinite alternate;
}

.underwater-2d__creature_puffer {
  animation: ocean-puffer-breathe 3.1s ease-in-out infinite;
}

.underwater-2d__creature_jelly {
  transform-origin: 50% 30%;
  animation: ocean-jelly-pulse 2.4s ease-in-out infinite;
}

.underwater-2d__swimmer_fish-blue .underwater-2d__bob { animation-duration: 3.2s; }
.underwater-2d__swimmer_fish-coral .underwater-2d__bob { animation-duration: 4.4s; }
.underwater-2d__swimmer_fish-fancy .underwater-2d__bob { animation-duration: 3.6s; }
.underwater-2d__swimmer_seahorse .underwater-2d__bob { animation-duration: 5.2s; }
.underwater-2d__swimmer_puffer .underwater-2d__bob { animation-duration: 4.7s; }
.underwater-2d__swimmer_jelly .underwater-2d__bob { animation-duration: 6s; }

@keyframes ocean-creature-ltr {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(150vw, 0, 0); }
}

@keyframes ocean-creature-rtl {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(-150vw, 0, 0); }
}

@keyframes ocean-creature-bob {
  0% { transform: translate3d(0, -7px, 0) rotate(-1deg); }
  100% { transform: translate3d(0, 8px, 0) rotate(1deg); }
}

@keyframes ocean-fish-swim {
  0% { transform: skewY(-1deg) scaleX(0.992) scaleY(1.008) rotate(-0.35deg); }
  50% { transform: skewY(0.6deg) scaleX(1.006) scaleY(0.994) rotate(0.2deg); }
  100% { transform: skewY(1deg) scaleX(0.995) scaleY(1.005) rotate(0.35deg); }
}

@keyframes ocean-shark-swim {
  0% { transform: skewY(-0.7deg) scaleX(0.995) rotate(-0.25deg); }
  100% { transform: skewY(0.7deg) scaleX(1.004) rotate(0.25deg); }
}

@keyframes ocean-seahorse-drift {
  0% { transform: rotate(-1.6deg) scaleX(0.99); }
  100% { transform: rotate(1.8deg) scaleX(1.01); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1); }
  48% { transform: scale(1.035, 1.055); }
  60% { transform: scale(1.012, 1.025); }
}

@keyframes ocean-jelly-pulse {
  0%, 100% { transform: translateY(0) scale(1, 0.985); }
  45% { transform: translateY(-2px) scale(1.035, 1.035); }
  68% { transform: translateY(2px) scale(0.99, 0.96); }
}

@media (max-width: 900px) {
  .underwater-2d__swimmer_shark { width: clamp(150px, 28vw, 240px); }
  .underwater-2d__swimmer_fish { width: clamp(74px, 15vw, 120px); }
  .underwater-2d__swimmer_seahorse,
  .underwater-2d__swimmer_puffer,
  .underwater-2d__swimmer_jelly { width: clamp(62px, 12vw, 102px); }
}

@media (prefers-reduced-motion: reduce) {
  .underwater-2d__swimmer,
  .underwater-2d__bob,
  .underwater-2d__creature {
    animation: none !important;
  }

  .underwater-2d__swimmer {
    display: none;
  }
}
</style>
