<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

type CreatureKind = "shark" | "seahorse" | "puffer" | "jelly";

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
  { id: "shark", src: "/images/ocean-creatures/shark-clean.webp", kind: "shark", top: "18%", size: "clamp(190px, 18vw, 330px)", duration: "34s", delay: "-9s", direction: "rtl", opacity: 0.88 },
  { id: "puffer", src: "/images/ocean-creatures/puffer-clean.webp", kind: "puffer", top: "43%", size: "clamp(94px, 9vw, 158px)", duration: "25s", delay: "-3s", direction: "ltr", opacity: 0.9 },
  { id: "seahorse", src: "/images/ocean-creatures/seahorse-clean.webp", kind: "seahorse", top: "61%", size: "clamp(70px, 5.7vw, 112px)", duration: "39s", delay: "-21s", direction: "rtl", opacity: 0.88 },
  { id: "jelly-blue", src: "/images/ocean-creatures/jelly-blue.webp", kind: "jelly", top: "29%", size: "clamp(82px, 6.5vw, 126px)", duration: "43s", delay: "-28s", direction: "ltr", opacity: 0.7 },
  { id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink.webp", kind: "jelly", top: "72%", size: "clamp(76px, 6vw, 118px)", duration: "47s", delay: "-6s", direction: "rtl", opacity: 0.68 },
];

const swimmerElements = new Map<string, HTMLElement>();
let pointerX = -10_000;
let pointerY = -10_000;
let reactionRaf = 0;
let reducedMotion: MediaQueryList | null = null;

function bindSwimmer(id: string, element: unknown) {
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
      :ref="(element) => bindSwimmer(creature.id, element)"
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
      <div class="underwater-2d__reaction">
        <div class="underwater-2d__bob">
          <div class="underwater-2d__facing">
            <img
              class="underwater-2d__creature"
              :class="`underwater-2d__creature_${creature.kind}`"
              :src="creature.src"
              alt=""
              draggable="false"
            >
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
  top: clamp(60px, var(--creature-top), calc(100% - 220px));
  left: 0;
  width: var(--creature-size);
  opacity: 0;
  will-change: transform, opacity;
  filter: drop-shadow(0 8px 18px rgba(8, 34, 93, 0.2));
}

.underwater-2d__swimmer_ltr {
  animation:
    ocean-creature-ltr var(--creature-duration) linear var(--creature-delay) infinite,
    ocean-creature-fade var(--creature-duration) ease-in-out var(--creature-delay) infinite;
}

.underwater-2d__swimmer_rtl {
  animation:
    ocean-creature-rtl var(--creature-duration) linear var(--creature-delay) infinite,
    ocean-creature-fade var(--creature-duration) ease-in-out var(--creature-delay) infinite;
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

.underwater-2d__facing {
  width: 100%;
}

.underwater-2d__facing {
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

.underwater-2d__creature_shark {
  animation: ocean-shark-swim 1.8s ease-in-out infinite alternate;
}

.underwater-2d__creature_puffer {
  animation: ocean-puffer-breathe 2.4s ease-in-out infinite;
}

.underwater-2d__creature_seahorse {
  transform-origin: 52% 46%;
  animation: ocean-seahorse-drift 2.2s ease-in-out infinite alternate;
}

.underwater-2d__creature_jelly {
  transform-origin: 50% 30%;
  animation: ocean-jelly-pulse 2.2s ease-in-out infinite;
}

.underwater-2d__swimmer_puffer .underwater-2d__bob { animation-duration: 4.2s; }
.underwater-2d__swimmer_seahorse .underwater-2d__bob { animation-duration: 5.2s; }
.underwater-2d__swimmer_jelly .underwater-2d__bob { animation-duration: 6s; }

@keyframes ocean-creature-ltr {
  0% { transform: translate3d(calc(-100% - 48px), 8px, 0); }
  15% { transform: translate3d(24px, -8px, 0); }
  50% { transform: translate3d(calc(50vw - 50%), 7px, 0); }
  85% { transform: translate3d(calc(100vw - 100% - 24px), -6px, 0); }
  100% { transform: translate3d(calc(100vw + 48px), 8px, 0); }
}

@keyframes ocean-creature-rtl {
  0% { transform: translate3d(calc(100vw + 48px), -7px, 0); }
  15% { transform: translate3d(calc(100vw - 100% - 24px), 8px, 0); }
  50% { transform: translate3d(calc(50vw - 50%), -6px, 0); }
  85% { transform: translate3d(24px, 7px, 0); }
  100% { transform: translate3d(calc(-100% - 48px), -7px, 0); }
}

@keyframes ocean-creature-fade {
  0%, 15%, 87%, 100% { opacity: 0; }
  17%, 85% { opacity: var(--creature-opacity); }
}

@keyframes ocean-creature-bob {
  0% { transform: translate3d(0, -9px, 0) rotate(-1.6deg); }
  100% { transform: translate3d(0, 10px, 0) rotate(1.6deg); }
}

@keyframes ocean-shark-swim {
  0% { transform: skewY(-1.5deg) scaleX(.975) scaleY(1.012) rotate(-.75deg); }
  100% { transform: skewY(1.5deg) scaleX(1.018) scaleY(.99) rotate(.75deg); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1) rotate(-.5deg); }
  48% { transform: scale(1.045, 1.065) rotate(.6deg); }
}

@keyframes ocean-seahorse-drift {
  0% { transform: rotate(-3deg) translateY(-2px); }
  100% { transform: rotate(3deg) translateY(2px); }
}

@keyframes ocean-jelly-pulse {
  0%, 100% { transform: translateY(1px) scale(1.02, .91); }
  44% { transform: translateY(-5px) scale(.96, 1.09); }
  68% { transform: translateY(2px) scale(1.035, .94); }
}

@media (max-width: 900px) {
  .underwater-2d__swimmer_shark { width: clamp(150px, 28vw, 240px); }
  .underwater-2d__swimmer_puffer { width: clamp(78px, 16vw, 124px); }
  .underwater-2d__swimmer_seahorse { width: clamp(60px, 12vw, 92px); }
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
