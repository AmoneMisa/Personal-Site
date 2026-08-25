<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

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
  filter?: string;
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
    // The old fish-fancy file contains baked rendering artefacts. Reuse the
    // clean blue fish with a colour shift until a clean source export exists.
    id: "fish-violet",
    src: "/images/ocean-creatures/fish-blue.webp",
    kind: "fish",
    top: "31%",
    size: "clamp(90px, 8vw, 145px)",
    duration: "25s",
    delay: "-18s",
    direction: "ltr",
    opacity: 0.84,
    filter: "hue-rotate(54deg) saturate(1.12)",
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

const swimmerElements = new Map<string, HTMLElement>();
let pointerX = -10_000;
let pointerY = -10_000;
let reactionRaf = 0;
let reducedMotion: MediaQueryList | null = null;

function bindSwimmer(id: string, element: Element | null) {
  if (element instanceof HTMLElement) swimmerElements.set(id, element);
  else swimmerElements.delete(id);
}

function setReaction(element: HTMLElement, x: number, y: number, strength: number) {
  element.style.setProperty("--react-x", `${x.toFixed(2)}px`);
  element.style.setProperty("--react-y", `${y.toFixed(2)}px`);
  element.style.setProperty("--react-rotate", `${(x * 0.035).toFixed(2)}deg`);
  element.style.setProperty("--react-scale", `${(1 + strength * 0.035).toFixed(3)}`);
}

function updateReactions() {
  reactionRaf = 0;
  if (reducedMotion?.matches) return;

  for (const element of swimmerElements.values()) {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - pointerX;
    const dy = cy - pointerY;
    const distance = Math.hypot(dx, dy);
    const radius = Math.max(150, rect.width * 1.45);

    if (distance >= radius || !Number.isFinite(distance)) {
      setReaction(element, 0, 0, 0);
      continue;
    }

    const strength = 1 - distance / radius;
    const normal = Math.max(1, distance);
    const flee = 28 * strength * strength;
    setReaction(element, (dx / normal) * flee, (dy / normal) * flee * 0.72, strength);
  }
}

function scheduleReaction() {
  if (!reactionRaf) reactionRaf = requestAnimationFrame(updateReactions);
}

function handlePointerMove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
  scheduleReaction();
}

function handlePointerLeave() {
  pointerX = -10_000;
  pointerY = -10_000;
  scheduleReaction();
}

function handlePointerDown(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;

  for (const element of swimmerElements.values()) {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - pointerX;
    const dy = cy - pointerY;
    const distance = Math.hypot(dx, dy);
    const radius = Math.max(120, rect.width * 1.15);
    if (distance > radius) continue;

    const normal = Math.max(1, distance);
    const burstX = (dx / normal) * 58;
    const burstY = (dy / normal) * 40;
    const reaction = element.querySelector<HTMLElement>(".underwater-2d__reaction");
    reaction?.animate(
      [
        { transform: "translate3d(var(--react-x), var(--react-y), 0) scale(var(--react-scale))" },
        { transform: `translate3d(${burstX}px, ${burstY}px, 0) scale(1.08)`, offset: 0.3 },
        { transform: "translate3d(var(--react-x), var(--react-y), 0) scale(var(--react-scale))" },
      ],
      { duration: 480, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }

  scheduleReaction();
}

function hideBrokenImage(event: Event) {
  const image = event.currentTarget;
  if (image instanceof HTMLImageElement) image.closest<HTMLElement>(".underwater-2d__swimmer")?.remove();
}

onMounted(() => {
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });
});

onBeforeUnmount(() => {
  if (reactionRaf) cancelAnimationFrame(reactionRaf);
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerdown", handlePointerDown);
  document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
  swimmerElements.clear();
});
</script>

<template>
  <div class="underwater-2d" aria-hidden="true">
    <div
      v-for="creature in creatures"
      :key="creature.id"
      :ref="(element) => bindSwimmer(creature.id, element as Element | null)"
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
        '--creature-filter': creature.filter ?? 'none',
      }"
    >
      <div class="underwater-2d__reaction">
        <div class="underwater-2d__bob">
          <div class="underwater-2d__facing">
            <div class="underwater-2d__crop">
              <img
                class="underwater-2d__creature"
                :class="`underwater-2d__creature_${creature.kind}`"
                :src="creature.src"
                alt=""
                draggable="false"
                @error="hideBrokenImage"
              />
            </div>
          </div>
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
  --react-x: 0px;
  --react-y: 0px;
  --react-rotate: 0deg;
  --react-scale: 1;
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

.underwater-2d__reaction {
  width: 100%;
  transform: translate3d(var(--react-x), var(--react-y), 0) rotate(var(--react-rotate)) scale(var(--react-scale));
  transition: transform 180ms cubic-bezier(.2,.75,.25,1);
  will-change: transform;
}

.underwater-2d__bob {
  width: 100%;
  animation: ocean-creature-bob 3.8s ease-in-out infinite alternate;
  will-change: transform;
}

.underwater-2d__facing,
.underwater-2d__crop {
  width: 100%;
}

.underwater-2d__facing {
  transform-origin: center;
}

.underwater-2d__swimmer_rtl .underwater-2d__facing {
  transform: scaleX(-1);
}

.underwater-2d__crop {
  overflow: hidden;
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
  filter: var(--creature-filter);
}

/* Remove the detached auxiliary pieces that were baked into two generated
   sheets. This crops a single intact sprite; it does not duplicate the image. */
.underwater-2d__swimmer_shark .underwater-2d__crop {
  clip-path: inset(0 7% 0 0 round 2px);
}

.underwater-2d__swimmer_seahorse .underwater-2d__crop {
  clip-path: inset(0 18% 0 0 round 2px);
}

.underwater-2d__creature_fish {
  animation: ocean-fish-swim 0.92s ease-in-out infinite alternate;
}

.underwater-2d__creature_shark {
  animation: ocean-shark-swim 1.18s ease-in-out infinite alternate;
}

.underwater-2d__creature_seahorse {
  transform-origin: 52% 46%;
  animation: ocean-seahorse-drift 1.75s ease-in-out infinite alternate;
}

.underwater-2d__creature_puffer {
  animation: ocean-puffer-breathe 2.3s ease-in-out infinite;
}

.underwater-2d__creature_jelly {
  transform-origin: 50% 30%;
  animation: ocean-jelly-pulse 1.7s ease-in-out infinite;
}

.underwater-2d__swimmer_fish-blue .underwater-2d__bob { animation-duration: 3.2s; }
.underwater-2d__swimmer_fish-coral .underwater-2d__bob { animation-duration: 4.4s; }
.underwater-2d__swimmer_fish-violet .underwater-2d__bob { animation-duration: 3.6s; }
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
  0% { transform: translate3d(0, -9px, 0) rotate(-1.6deg); }
  100% { transform: translate3d(0, 10px, 0) rotate(1.6deg); }
}

@keyframes ocean-fish-swim {
  0% { transform: skewY(-2.2deg) scaleX(.965) scaleY(1.025) rotate(-1.1deg); }
  50% { transform: skewY(.7deg) scaleX(1.018) scaleY(.985) rotate(.35deg); }
  100% { transform: skewY(2.2deg) scaleX(.972) scaleY(1.018) rotate(1.1deg); }
}

@keyframes ocean-shark-swim {
  0% { transform: skewY(-1.5deg) scaleX(.975) scaleY(1.012) rotate(-.75deg); }
  100% { transform: skewY(1.5deg) scaleX(1.018) scaleY(.99) rotate(.75deg); }
}

@keyframes ocean-seahorse-drift {
  0% { transform: rotate(-3.2deg) scaleX(.975) translateY(-2px); }
  100% { transform: rotate(3.4deg) scaleX(1.025) translateY(2px); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1); }
  46% { transform: scale(1.075, 1.105); }
  62% { transform: scale(1.025, 1.04); }
}

@keyframes ocean-jelly-pulse {
  0%, 100% { transform: translateY(1px) scale(1.02, .91); }
  44% { transform: translateY(-5px) scale(.96, 1.09); }
  68% { transform: translateY(2px) scale(1.035, .94); }
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
