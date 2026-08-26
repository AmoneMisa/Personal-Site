<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

type CreatureKind = "shark" | "seahorse" | "puffer" | "jelly";
type SwimDirection = "ltr" | "rtl";

type CreaturePreset = {
  id: string;
  src: string;
  kind: CreatureKind;
  top: string;
  size: string;
  duration: string;
  delay: string;
  direction: SwimDirection;
  opacity: number;
};

type SteeringProfile = {
  cruiseSpeed: number;
  maxSpeed: number;
  steering: number;
  verticalSpeed: number;
  wanderFrequency: number;
  cursorRadius: number;
  evadeVertical: number;
  evadeForward: number;
  fearBoost: number;
};

type CreatureState = {
  preset: CreaturePreset;
  element: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  homeY: number;
  phase: number;
  fear: number;
  direction: 1 | -1;
};

const creatures: CreaturePreset[] = [
  { id: "shark", src: "/images/ocean-creatures/shark-clean.webp", kind: "shark", top: "18%", size: "clamp(190px, 18vw, 330px)", duration: "34s", delay: "-9s", direction: "rtl", opacity: 0.88 },
  { id: "puffer", src: "/images/ocean-creatures/puffer-clean.webp", kind: "puffer", top: "43%", size: "clamp(94px, 9vw, 158px)", duration: "25s", delay: "-3s", direction: "ltr", opacity: 0.9 },
  { id: "seahorse", src: "/images/ocean-creatures/seahorse-clean.webp", kind: "seahorse", top: "61%", size: "clamp(70px, 5.7vw, 112px)", duration: "39s", delay: "-21s", direction: "rtl", opacity: 0.88 },
  { id: "jelly-blue", src: "/images/ocean-creatures/jelly-blue.webp", kind: "jelly", top: "29%", size: "clamp(82px, 6.5vw, 126px)", duration: "43s", delay: "-28s", direction: "ltr", opacity: 0.7 },
  { id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink.webp", kind: "jelly", top: "72%", size: "clamp(76px, 6vw, 118px)", duration: "47s", delay: "-6s", direction: "rtl", opacity: 0.68 },
];

const steeringProfiles: Record<CreatureKind, SteeringProfile> = {
  shark: {
    cruiseSpeed: 48,
    maxSpeed: 86,
    steering: 1.35,
    verticalSpeed: 13,
    wanderFrequency: 0.62,
    cursorRadius: 280,
    evadeVertical: 112,
    evadeForward: 34,
    fearBoost: 0.42,
  },
  puffer: {
    cruiseSpeed: 31,
    maxSpeed: 62,
    steering: 2.1,
    verticalSpeed: 18,
    wanderFrequency: 0.74,
    cursorRadius: 230,
    evadeVertical: 124,
    evadeForward: 28,
    fearBoost: 0.55,
  },
  seahorse: {
    cruiseSpeed: 22,
    maxSpeed: 46,
    steering: 1.65,
    verticalSpeed: 22,
    wanderFrequency: 0.5,
    cursorRadius: 205,
    evadeVertical: 94,
    evadeForward: 18,
    fearBoost: 0.3,
  },
  jelly: {
    cruiseSpeed: 18,
    maxSpeed: 36,
    steering: 1.05,
    verticalSpeed: 25,
    wanderFrequency: 0.39,
    cursorRadius: 180,
    evadeVertical: 48,
    evadeForward: 8,
    fearBoost: 0.08,
  },
};

const swimmerElements = new Map<string, HTMLElement>();
const creatureStates = new Map<string, CreatureState>();

let viewportWidth = 1;
let viewportHeight = 1;
let pointerX = -10_000;
let pointerY = -10_000;
let pointerActive = false;
let animationRaf = 0;
let lastFrameTime = 0;
let reducedMotion: MediaQueryList | null = null;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function bindSwimmer(id: string, element: unknown) {
  if (element instanceof HTMLElement) swimmerElements.set(id, element);
  else swimmerElements.delete(id);
}

function directionValue(direction: SwimDirection): 1 | -1 {
  return direction === "ltr" ? 1 : -1;
}

function verticalBounds(height: number) {
  const available = Math.max(0, viewportHeight - height);
  const padding = Math.min(60, Math.max(12, available * 0.1));
  return {
    min: padding,
    max: Math.max(padding, available - padding),
  };
}

function homeYFor(preset: CreaturePreset, height: number) {
  const ratio = clamp(Number.parseFloat(preset.top) / 100 || 0.5, 0.08, 0.92);
  const bounds = verticalBounds(height);
  return clamp(viewportHeight * ratio - height * 0.5, bounds.min, bounds.max);
}

function initialProgress(preset: CreaturePreset) {
  const duration = Math.max(1, Math.abs(Number.parseFloat(preset.duration)) || 30);
  const delay = Math.abs(Number.parseFloat(preset.delay)) || 0;
  return (delay % duration) / duration;
}

function measureElement(element: HTMLElement) {
  const width = Math.max(1, element.offsetWidth || element.getBoundingClientRect().width || 1);
  const height = Math.max(1, element.offsetHeight || element.getBoundingClientRect().height || width * 0.55);
  return { width, height };
}

function makeState(preset: CreaturePreset, element: HTMLElement, index: number): CreatureState {
  const { width, height } = measureElement(element);
  const direction = directionValue(preset.direction);
  const margin = Math.max(72, width * 0.45);
  const progress = initialProgress(preset);
  const travel = viewportWidth + width + margin * 2;
  const x = direction > 0
    ? -width - margin + progress * travel
    : viewportWidth + margin - progress * travel;
  const homeY = homeYFor(preset, height);
  const profile = steeringProfiles[preset.kind];

  return {
    preset,
    element,
    x,
    y: homeY,
    vx: direction * profile.cruiseSpeed,
    vy: 0,
    width,
    height,
    homeY,
    phase: index * 1.73 + progress * Math.PI * 2,
    fear: 0,
    direction,
  };
}

function syncViewport() {
  viewportWidth = Math.max(1, window.innerWidth);
  viewportHeight = Math.max(1, window.innerHeight);
}

function refreshCreatureSize(id: string) {
  const state = creatureStates.get(id);
  const element = swimmerElements.get(id);
  if (!element) return;

  const measured = measureElement(element);
  if (!state) return;

  state.width = measured.width;
  state.height = measured.height;
  state.homeY = homeYFor(state.preset, state.height);
  const bounds = verticalBounds(state.height);
  state.y = clamp(state.y, bounds.min, bounds.max);
}

function initializeStates() {
  creatureStates.clear();
  creatures.forEach((preset, index) => {
    const element = swimmerElements.get(preset.id);
    if (!element) return;
    const state = makeState(preset, element, index);
    creatureStates.set(preset.id, state);
    renderState(state);
  });
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function pointerSteering(state: CreatureState, profile: SteeringProfile) {
  if (!pointerActive) return { x: 0, y: 0, fear: 0 };

  const cx = state.x + state.width * 0.5;
  const cy = state.y + state.height * 0.5;
  const dx = cx - pointerX;
  const dy = cy - pointerY;
  const distance = Math.hypot(dx, dy);

  if (!Number.isFinite(distance) || distance >= profile.cursorRadius) {
    return { x: 0, y: 0, fear: 0 };
  }

  const strength = smoothstep(1 - distance / profile.cursorRadius);
  const normal = Math.max(1, distance);
  const awayX = dx / normal;
  const awayY = dy / normal;

  // Prefer a curved pass around the cursor instead of reversing direction.
  // When the pointer is almost level with the creature, the phase provides a
  // stable side choice so it does not jitter between up/down on consecutive frames.
  const side = Math.abs(awayY) > 0.12
    ? Math.sign(awayY)
    : (Math.sin(state.phase) >= 0 ? 1 : -1);

  return {
    x: awayX * profile.evadeForward * strength,
    y: side * profile.evadeVertical * strength,
    fear: strength,
  };
}

function renderState(state: CreatureState) {
  const horizontal = Math.max(1, Math.abs(state.vx));
  const rawAngle = Math.atan2(state.vy, horizontal) * (180 / Math.PI);
  const turnAngle = clamp(rawAngle * state.direction * 0.48, -8, 8);

  state.element.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${turnAngle.toFixed(2)}deg)`;
  state.element.style.opacity = String(state.preset.opacity);
  state.element.style.setProperty("--fear-scale", state.preset.kind === "puffer"
    ? (1 + state.fear * 0.045).toFixed(3)
    : "1");
}

function wrapState(state: CreatureState) {
  const margin = Math.max(90, state.width * 0.55);

  if (state.direction > 0 && state.x > viewportWidth + margin) {
    state.x = -state.width - margin;
    state.y = clamp(state.homeY + Math.sin(state.phase) * 34, ...Object.values(verticalBounds(state.height)) as [number, number]);
    state.phase += 1.17;
  } else if (state.direction < 0 && state.x + state.width < -margin) {
    state.x = viewportWidth + margin;
    state.y = clamp(state.homeY + Math.sin(state.phase) * 34, ...Object.values(verticalBounds(state.height)) as [number, number]);
    state.phase += 1.17;
  }
}

function updateState(state: CreatureState, now: number, dt: number) {
  const profile = steeringProfiles[state.preset.kind];
  const pointer = pointerSteering(state, profile);
  const fearResponse = pointer.fear > state.fear ? 5.2 : 1.45;
  state.fear += (pointer.fear - state.fear) * Math.min(1, dt * fearResponse);

  const time = now / 1000;
  const wander = (
    Math.sin(time * profile.wanderFrequency + state.phase)
    + Math.sin(time * profile.wanderFrequency * 0.43 + state.phase * 1.61) * 0.38
  ) * profile.verticalSpeed;
  const homePull = (state.homeY - state.y) * 0.16;
  const boostedCruise = profile.cruiseSpeed * (1 + state.fear * profile.fearBoost);

  let desiredVx = state.direction * boostedCruise + pointer.x;
  let desiredVy = wander + homePull + pointer.y;

  // Keep the normal travel direction stable. Cursor avoidance should produce a
  // smooth arc, not a sudden sprite flip or a rubber-band reversal.
  if (state.direction > 0) desiredVx = Math.max(profile.cruiseSpeed * 0.28, desiredVx);
  else desiredVx = Math.min(-profile.cruiseSpeed * 0.28, desiredVx);

  const desiredSpeed = Math.hypot(desiredVx, desiredVy);
  if (desiredSpeed > profile.maxSpeed) {
    const scale = profile.maxSpeed / desiredSpeed;
    desiredVx *= scale;
    desiredVy *= scale;
  }

  const steering = Math.min(1, dt * profile.steering);
  state.vx += (desiredVx - state.vx) * steering;
  state.vy += (desiredVy - state.vy) * steering;
  state.x += state.vx * dt;
  state.y += state.vy * dt;

  const bounds = verticalBounds(state.height);
  if (state.y < bounds.min) {
    state.y = bounds.min;
    state.vy = Math.max(0, state.vy * -0.3);
  } else if (state.y > bounds.max) {
    state.y = bounds.max;
    state.vy = Math.min(0, state.vy * -0.3);
  }

  wrapState(state);
  renderState(state);
}

function animate(now: number) {
  if (reducedMotion?.matches) {
    animationRaf = 0;
    return;
  }

  const dt = lastFrameTime ? Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000)) : 1 / 60;
  lastFrameTime = now;

  for (const state of creatureStates.values()) updateState(state, now, dt);
  animationRaf = requestAnimationFrame(animate);
}

function startAnimation() {
  if (animationRaf || reducedMotion?.matches) return;
  lastFrameTime = 0;
  animationRaf = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (animationRaf) cancelAnimationFrame(animationRaf);
  animationRaf = 0;
  lastFrameTime = 0;
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;
  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerActive = true;
}

function handlePointerLeave() {
  pointerActive = false;
  pointerX = -10_000;
  pointerY = -10_000;
}

function handleResize() {
  const oldWidth = viewportWidth;
  syncViewport();
  const widthRatio = oldWidth > 1 ? viewportWidth / oldWidth : 1;

  for (const state of creatureStates.values()) {
    state.x *= widthRatio;
    refreshCreatureSize(state.preset.id);
  }
}

function handleMotionPreference() {
  if (reducedMotion?.matches) {
    stopAnimation();
    for (const state of creatureStates.values()) state.element.style.opacity = "0";
    return;
  }

  initializeStates();
  startAnimation();
}

onMounted(() => {
  syncViewport();
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  initializeStates();

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });
  window.addEventListener("blur", handlePointerLeave, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  reducedMotion.addEventListener?.("change", handleMotionPreference);

  startAnimation();
});

onBeforeUnmount(() => {
  stopAnimation();
  window.removeEventListener("pointermove", handlePointerMove);
  document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
  window.removeEventListener("blur", handlePointerLeave);
  window.removeEventListener("resize", handleResize);
  reducedMotion?.removeEventListener?.("change", handleMotionPreference);
  swimmerElements.clear();
  creatureStates.clear();
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
        '--creature-size': creature.size,
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
              @load="refreshCreatureSize(creature.id)"
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
  --fear-scale: 1;
  position: absolute;
  top: 0;
  left: 0;
  width: var(--creature-size);
  opacity: 0;
  will-change: transform, opacity;
  filter: drop-shadow(0 8px 18px rgba(8, 34, 93, 0.2));
}

.underwater-2d__reaction {
  width: 100%;
  transform-origin: center;
  will-change: transform;
}

.underwater-2d__swimmer_puffer .underwater-2d__reaction {
  transform: scale(var(--fear-scale));
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

@keyframes ocean-creature-bob {
  0% { transform: translate3d(0, -7px, 0) rotate(-1.15deg); }
  100% { transform: translate3d(0, 8px, 0) rotate(1.15deg); }
}

@keyframes ocean-shark-swim {
  0% { transform: skewY(-1.2deg) scaleX(.982) scaleY(1.008) rotate(-.55deg); }
  100% { transform: skewY(1.2deg) scaleX(1.012) scaleY(.994) rotate(.55deg); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: scale(1) rotate(-.4deg); }
  48% { transform: scale(1.035, 1.05) rotate(.45deg); }
}

@keyframes ocean-seahorse-drift {
  0% { transform: rotate(-2.4deg) translateY(-2px); }
  100% { transform: rotate(2.4deg) translateY(2px); }
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
