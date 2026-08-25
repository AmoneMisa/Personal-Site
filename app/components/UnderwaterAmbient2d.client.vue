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
    opacity: .97,
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
    opacity: .93,
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
    opacity: .88,
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
    opacity: .82,
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
    opacity: .9,
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
    opacity: .9,
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
    opacity: .76,
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
    opacity: .72,
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
        <div class="underwater-2d__puppet">
          <img class="underwater-2d__part underwater-2d__part_body" :src="creature.src" alt="" draggable="false" />

          <template v-if="creature.kind === 'fish' || creature.kind === 'shark'">
            <img class="underwater-2d__part underwater-2d__part_tail" :src="creature.src" alt="" draggable="false" />
            <img class="underwater-2d__part underwater-2d__part_fin" :src="creature.src" alt="" draggable="false" />
          </template>

          <template v-else-if="creature.kind === 'seahorse'">
            <img class="underwater-2d__part underwater-2d__part_seahorse-tail" :src="creature.src" alt="" draggable="false" />
            <img class="underwater-2d__part underwater-2d__part_seahorse-fin" :src="creature.src" alt="" draggable="false" />
          </template>

          <template v-else-if="creature.kind === 'jelly'">
            <img class="underwater-2d__part underwater-2d__part_jelly-bell" :src="creature.src" alt="" draggable="false" />
            <img class="underwater-2d__part underwater-2d__part_jelly-tentacles" :src="creature.src" alt="" draggable="false" />
          </template>

          <img
            v-if="creature.kind === 'fish' || creature.kind === 'shark' || creature.kind === 'seahorse'"
            class="underwater-2d__part underwater-2d__part_mouth"
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
  filter: drop-shadow(0 8px 18px rgba(8, 34, 93, .2));
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
}

.underwater-2d__puppet {
  position: relative;
  width: 100%;
}

.underwater-2d__puppet::before {
  content: "";
  display: block;
  padding-top: 64%;
}

.underwater-2d__swimmer_seahorse .underwater-2d__puppet::before { padding-top: 171%; }
.underwater-2d__swimmer_jelly-blue .underwater-2d__puppet::before { padding-top: 114%; }
.underwater-2d__swimmer_jelly-pink .underwater-2d__puppet::before { padding-top: 91%; }

.underwater-2d__swimmer_rtl .underwater-2d__puppet {
  transform: scaleX(-1);
}

.underwater-2d__part {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  backface-visibility: hidden;
}

.underwater-2d__swimmer_fish .underwater-2d__part_body,
.underwater-2d__swimmer_shark .underwater-2d__part_body {
  clip-path: polygon(27% 0, 100% 0, 100% 100%, 27% 100%);
}

.underwater-2d__swimmer_fish .underwater-2d__part_tail,
.underwater-2d__swimmer_shark .underwater-2d__part_tail {
  clip-path: polygon(0 0, 34% 0, 34% 100%, 0 100%);
  transform-origin: 31% 52%;
  animation: ocean-tail-sway 1.08s ease-in-out infinite alternate;
}

.underwater-2d__swimmer_fish .underwater-2d__part_fin,
.underwater-2d__swimmer_shark .underwater-2d__part_fin {
  clip-path: polygon(42% 50%, 76% 50%, 76% 100%, 39% 100%);
  transform-origin: 54% 58%;
  animation: ocean-fin-flap 1.45s ease-in-out infinite alternate;
}

.underwater-2d__swimmer_shark .underwater-2d__part_tail {
  animation-duration: 1.3s;
}

.underwater-2d__swimmer_shark .underwater-2d__part_fin {
  clip-path: polygon(37% 55%, 82% 55%, 82% 100%, 35% 100%);
  animation-duration: 1.7s;
}

.underwater-2d__swimmer_seahorse .underwater-2d__part_body {
  clip-path: polygon(0 0, 100% 0, 100% 72%, 58% 72%, 45% 58%, 25% 58%, 0 70%);
}

.underwater-2d__part_seahorse-tail {
  clip-path: polygon(0 53%, 74% 53%, 84% 100%, 0 100%);
  transform-origin: 56% 58%;
  animation: ocean-seahorse-tail 2.4s ease-in-out infinite alternate;
}

.underwater-2d__part_seahorse-fin {
  clip-path: polygon(0 31%, 34% 30%, 39% 63%, 0 67%);
  transform-origin: 28% 48%;
  animation: ocean-fin-flap .78s ease-in-out infinite alternate;
}

.underwater-2d__swimmer_jelly .underwater-2d__part_body {
  display: none;
}

.underwater-2d__part_jelly-bell {
  clip-path: polygon(0 0, 100% 0, 100% 47%, 0 47%);
  transform-origin: 50% 45%;
  animation: ocean-jelly-bell 2.3s ease-in-out infinite;
}

.underwater-2d__part_jelly-tentacles {
  clip-path: polygon(0 39%, 100% 39%, 100% 100%, 0 100%);
  transform-origin: 50% 40%;
  animation: ocean-jelly-tentacles 2.3s ease-in-out infinite;
}

.underwater-2d__swimmer_puffer .underwater-2d__part_body {
  animation: ocean-puffer-breathe 3.1s ease-in-out infinite;
}

.underwater-2d__part_mouth {
  z-index: 5;
  transform-origin: 82% 66%;
  animation: ocean-mouth-wiggle 4.8s ease-in-out infinite;
}

.underwater-2d__swimmer_shark .underwater-2d__part_mouth {
  clip-path: polygon(61% 52%, 100% 49%, 100% 86%, 58% 86%);
}

.underwater-2d__swimmer_fish .underwater-2d__part_mouth {
  clip-path: polygon(67% 49%, 100% 48%, 100% 85%, 64% 85%);
}

.underwater-2d__swimmer_seahorse .underwater-2d__part_mouth {
  clip-path: polygon(56% 19%, 100% 17%, 100% 43%, 55% 44%);
  transform-origin: 78% 34%;
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

@keyframes ocean-tail-sway {
  0% { transform: rotate(-5.5deg) scaleY(.98); }
  100% { transform: rotate(5.5deg) scaleY(1.02); }
}

@keyframes ocean-fin-flap {
  0% { transform: rotate(-3deg) scaleY(.94); }
  100% { transform: rotate(5deg) scaleY(1.04); }
}

@keyframes ocean-seahorse-tail {
  0% { transform: rotate(-2.5deg) scaleX(.98); }
  100% { transform: rotate(3deg) scaleX(1.02); }
}

@keyframes ocean-jelly-bell {
  0%, 100% { transform: scale(1, .98); }
  46% { transform: scale(1.045, 1.045); }
  68% { transform: scale(.985, .955); }
}

@keyframes ocean-jelly-tentacles {
  0%, 100% { transform: translateY(-1%) scaleX(.97); }
  46% { transform: translateY(2.5%) scaleX(1.03); }
  68% { transform: translateY(4%) scaleX(.99); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1); }
  48% { transform: scale(1.045, 1.075); }
  58% { transform: scale(1.02, 1.035); }
}

@keyframes ocean-mouth-wiggle {
  0%, 66%, 100% { transform: translateY(0) scaleY(1); }
  70% { transform: translateY(1.2%) scaleY(1.035); }
  74% { transform: translateY(-.4%) scaleY(.985); }
  79% { transform: translateY(1.6%) scaleY(1.045); }
  84% { transform: translateY(0) scaleY(1); }
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
