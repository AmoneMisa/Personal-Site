<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

type CrabPhase = "normal" | "fleeing" | "falling" | "cooldown";

const CRAB_FALL_CHANCE = 0.08;

const crab = ref<HTMLElement | null>(null);
const phase = ref<CrabPhase>("normal");
const fleeOriginX = ref("0px");
const fleeOriginY = ref("0px");
let phaseTimer = 0;

function setPhaseLater(next: CrabPhase, delay: number) {
  window.clearTimeout(phaseTimer);
  phaseTimer = window.setTimeout(() => {
    phase.value = next;
    if (next === "cooldown") setPhaseLater("normal", 5200);
  }, delay);
}

function handlePointerDown(event: PointerEvent) {
  const element = crab.value;
  if (!element || phase.value !== "normal" || Number(getComputedStyle(element).opacity) < 0.35) return;
  const rect = element.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;

  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
  fleeOriginX.value = `${matrix.m41}px`;
  fleeOriginY.value = `${matrix.m42}px`;
  const falls = Math.random() < CRAB_FALL_CHANCE;
  phase.value = falls ? "falling" : "fleeing";
  setPhaseLater("cooldown", falls ? 1180 : 820);
}

onMounted(() => window.addEventListener("pointerdown", handlePointerDown, { passive: true }));
onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handlePointerDown);
  window.clearTimeout(phaseTimer);
});
</script>

<template>
  <div
    ref="crab"
    class="header-crab"
    :class="`header-crab_${phase}`"
    :style="{ '--crab-x': fleeOriginX, '--crab-y': fleeOriginY }"
    :data-state="phase"
    aria-hidden="true"
  >
    <img
      class="header-crab__sprite"
      :src="phase === 'fleeing' || phase === 'falling' ? '/images/ocean-creatures/header-crab-surprised.webp' : '/images/ocean-creatures/header-crab.webp'"
      alt=""
      draggable="false"
    >
  </div>
</template>

<style scoped>
.header-crab {
  position: fixed;
  z-index: 4;
  top: clamp(58px, 5.5vw, 78px);
  left: 0;
  width: clamp(78px, 7vw, 120px);
  aspect-ratio: 220 / 160;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(-130%, -42%, 0) rotate(180deg);
  transform-origin: center;
  will-change: transform, opacity;
}

.header-crab_normal { animation: header-crab-scamper 26s linear 3s infinite; }
.header-crab_fleeing { animation: header-crab-flee-left .82s cubic-bezier(.55,.02,.9,.45) forwards; }
.header-crab_falling { animation: header-crab-fall 1.18s cubic-bezier(.32,.02,.82,.42) forwards; }
.header-crab_cooldown { opacity: 0; animation: none; }

.header-crab__sprite {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 12px rgba(0, 7, 27, .32));
  animation: header-crab-scuttle .2s ease-in-out infinite alternate;
}

@keyframes header-crab-scamper {
  0%, 15% { opacity: 0; transform: translate3d(-130%, -42%, 0) rotate(180deg); }
  18% { opacity: .94; transform: translate3d(3vw, -42%, 0) rotate(180deg); }
  29% { opacity: .94; transform: translate3d(30vw, -42%, 0) rotate(180deg); }
  40% { opacity: .94; transform: translate3d(59vw, -42%, 0) rotate(180deg); }
  51% { opacity: .94; transform: translate3d(88vw, -42%, 0) rotate(180deg); }
  54%, 100% { opacity: 0; transform: translate3d(112vw, -42%, 0) rotate(180deg); }
}

@keyframes header-crab-flee-left {
  from { opacity: .98; transform: translate3d(var(--crab-x), var(--crab-y), 0) rotate(180deg); }
  18% { opacity: .98; transform: translate3d(calc(var(--crab-x) + 8px), calc(var(--crab-y) - 5px), 0) rotate(180deg); }
  to { opacity: 0; transform: translate3d(-145%, -42%, 0) rotate(180deg); }
}

@keyframes header-crab-fall {
  0% { opacity: .98; transform: translate3d(var(--crab-x), var(--crab-y), 0) rotate(180deg); }
  12% { opacity: .98; transform: translate3d(calc(var(--crab-x) - 7px), calc(var(--crab-y) - 12px), 0) rotate(164deg); }
  42% { opacity: .98; transform: translate3d(calc(var(--crab-x) + 18px), calc(var(--crab-y) + 24vh), 0) rotate(302deg); }
  76% { opacity: .94; transform: translate3d(calc(var(--crab-x) - 12px), calc(var(--crab-y) + 68vh), 0) rotate(472deg); }
  100% { opacity: 0; transform: translate3d(calc(var(--crab-x) + 28px), calc(100vh + 170px), 0) rotate(620deg); }
}

@keyframes header-crab-scuttle {
  from { transform: translateY(-1px) scaleX(.985); }
  to { transform: translateY(1px) scaleX(1.015); }
}

@media (prefers-reduced-motion: reduce) {
  .header-crab { display: none; }
}
</style>
