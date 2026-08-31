<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { nearestBubble, popBubbleAt } from "~/composables/useOceanBubbleField";
import {
  aquariumCreatures as creatures,
  bodyAnimationBase,
  MAX_VISIBLE_PETS,
  steeringProfiles,
  type CreaturePreset,
  type SteeringProfile,
  type SwimDirection,
} from "~/utils/aquariumCreatures";
type PointerMode = "none" | "interest" | "threat" | "panic";

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
  interest: number;
  curiosity: number;
  direction: 1 | -1;
  facing: 1 | -1;
  nextDecisionAt: number;
  turnBoostUntil: number;
  turnLockUntil: number;
  panicUntil: number;
  panicX: number;
  panicY: number;
  inflateStartedAt: number;
  inflatedExit: boolean;
  hiddenUntil: number;
  mood: "sleep" | "play" | "angry" | "none";
  moodUntil: number;
  nextMoodAt: number;
  active: boolean;
  jellyExit: boolean;
  pointerMode: PointerMode;
  /** Rises when a bubble is chased or dodged, decays back to 0. Drives the tell. */
  bubbleFocus: number;
  nextBubblePopAt: number;
  trail: TrailPoint[];
};

type TrailPoint = {
  x: number;
  y: number;
  /** 1 when laid down, fades to 0; the point is dropped when it reaches 0. */
  life: number;
};

type PointerSteering = {
  x: number;
  y: number;
  fear: number;
  interest: number;
  mode: PointerMode;
};

const swimmerElements = new Map<string, HTMLElement>();
const creatureStates = new Map<string, CreatureState>();

let viewportWidth = 1;
let viewportHeight = 1;
let pointerX = -10_000;
let pointerY = -10_000;
let pointerActive = false;
let pointerSpeed = 0;
let pointerLastMoveAt = 0;
let pointerLastSampleAt = 0;
let pointerLastX = -10_000;
let pointerLastY = -10_000;
let animationRaf = 0;
let mountRaf = 0;
let lastFrameTime = 0;
let reducedMotion: MediaQueryList | null = null;
let huntTargetId: string | null = null;
let huntUntil = 0;
let nextHuntAt = 0;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

// ---------------------------------------------------------------- light trails

const trailCanvas = ref<HTMLCanvasElement | null>(null);
let trailCtx: CanvasRenderingContext2D | null = null;
let trailDpr = 1;

const TRAIL_MAX_POINTS = 26;
// Seconds a point stays visible. Short, so the wake reads as disturbed water
// rather than a drawn line following the mascot around.
const TRAIL_LIFETIME = 0.72;
// Below this speed a mascot is hovering, and a wake would look wrong.
const TRAIL_MIN_SPEED = 26;

// Per-kind tint, matching each mascot's own palette so the wake reads as light
// coming off that animal rather than a generic glow.
const trailTints: Record<string, [number, number, number]> = {
  shark: [122, 196, 255],
  puffer: [255, 226, 132],
  fish: [128, 214, 255],
  seahorse: [186, 150, 255],
  jelly: [255, 158, 224],
};

function configureTrailCanvas() {
  const canvas = trailCanvas.value;
  if (!canvas) return;
  trailDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.round(viewportWidth * trailDpr));
  canvas.height = Math.max(1, Math.round(viewportHeight * trailDpr));
  canvas.style.width = `${viewportWidth}px`;
  canvas.style.height = `${viewportHeight}px`;
  trailCtx = canvas.getContext("2d", { alpha: true });
  trailCtx?.setTransform(trailDpr, 0, 0, trailDpr, 0, 0);
}

function recordTrail(state: CreatureState, now: number, dt: number) {
  const points = state.trail;

  for (let i = points.length - 1; i >= 0; i -= 1) {
    const point = points[i]!;
    point.life -= dt / TRAIL_LIFETIME;
    if (point.life <= 0) points.splice(i, 1);
  }

  const visible = state.active && state.hiddenUntil <= now && !state.jellyExit;
  if (!visible) return;
  if (Math.hypot(state.vx, state.vy) < TRAIL_MIN_SPEED) return;

  // Trail from just behind the body, so it emerges from the tail rather than
  // the centre of the sprite.
  const x = state.x + state.width * (0.5 - state.facing * 0.3);
  const y = state.y + state.height * 0.52;
  const head = points[points.length - 1];
  // One point per ~7px of travel keeps the stroke smooth without hoarding
  // points when a mascot is sprinting.
  if (head && Math.hypot(x - head.x, y - head.y) < 7) return;

  points.push({ x, y, life: 1 });
  if (points.length > TRAIL_MAX_POINTS) points.shift();
}

function drawTrails() {
  const ctx = trailCtx;
  if (!ctx) return;

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const state of creatureStates.values()) {
    const points = state.trail;
    if (points.length < 2) continue;
    const tint = trailTints[state.preset.kind] ?? trailTints.fish!;
    const [r, g, b] = tint;
    const width = Math.max(3, state.height * 0.13);

    // Segment by segment, because both the alpha and the width taper along the
    // wake and a single stroked path cannot do that.
    for (let i = 1; i < points.length; i += 1) {
      const from = points[i - 1]!;
      const to = points[i]!;
      // Older points are both fainter and thinner.
      const life = (from.life + to.life) * 0.5;
      const along = i / points.length;
      const alpha = life * life * 0.3 * state.preset.opacity;
      if (alpha < 0.004) continue;
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(4)})`;
      ctx.lineWidth = width * (0.25 + along * 0.75) * life;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  ctx.globalCompositeOperation = "source-over";
}

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
  const phase = index * 1.73 + progress * Math.PI * 2;
  const curiosityVariation = 0.82 + ((index * 37) % 5) * 0.045;

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
    phase,
    fear: 0,
    interest: 0,
    curiosity: clamp(profile.curiosity * curiosityVariation, 0, 1),
    direction,
    facing: direction,
    nextDecisionAt: performance.now() + randomBetween(profile.decisionMin, profile.decisionMax) * 1000,
    turnBoostUntil: 0,
    turnLockUntil: 0,
    panicUntil: 0,
    panicX: -10_000,
    panicY: -10_000,
    inflateStartedAt: 0,
    inflatedExit: false,
    hiddenUntil: 0,
    mood: "none",
    moodUntil: 0,
    nextMoodAt: performance.now() + randomBetween(9000, 18_000),
    active: false,
    jellyExit: false,
    pointerMode: "none",
    bubbleFocus: 0,
    nextBubblePopAt: 0,
    trail: [],
  };
}

function syncViewport() {
  viewportWidth = Math.max(1, window.innerWidth);
  viewportHeight = Math.max(1, window.innerHeight);
}

function refreshCreatureSize(id: string) {
  const state = creatureStates.get(id);
  const element = swimmerElements.get(id);
  if (!element || !state) return;

  const measured = measureElement(element);
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
  });

  const initialGuests = creatures
    .filter((preset) => preset.id !== "shark")
    .slice(0, MAX_VISIBLE_PETS - 1)
    .map((preset) => preset.id);
  for (const state of creatureStates.values()) {
    state.active = state.preset.id === "shark" || initialGuests.includes(state.preset.id);
    renderState(state);
  }
}

function smoothstep(value: number) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function pointerSteering(state: CreatureState, profile: SteeringProfile, now: number): PointerSteering {
  const cx = state.x + state.width * 0.5;
  const cy = state.y + state.height * 0.5;

  if (state.preset.kind === "jelly") {
    return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };
  }

  if (state.panicUntil > now) {
    const dx = cx - state.panicX;
    const dy = cy - state.panicY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const remaining = clamp((state.panicUntil - now) / 1450, 0, 1);
    const panicStrength = 0.45 + remaining * 0.55;

    return {
      x: (dx / distance) * profile.evadeForward * 2.5 * panicStrength,
      y: (dy / distance) * profile.evadeVertical * 1.7 * panicStrength,
      fear: 1,
      interest: 0,
      mode: "panic",
    };
  }

  if (!pointerActive) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };

  const dxAway = cx - pointerX;
  const dyAway = cy - pointerY;
  const distance = Math.hypot(dxAway, dyAway);
  if (!Number.isFinite(distance)) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };

  // The shark is confident: merely entering its personal space makes it look
  // at the pointer with a question, rather than treating a moving cursor as a threat.
  if (state.preset.id === "shark" && distance < profile.interestRadius) {
    const normal = Math.max(1, distance);
    const interest = clamp(1 - distance / profile.interestRadius, 0.35, 1);
    return {
      x: (-dxAway / normal) * profile.cruiseSpeed * 0.35,
      y: (-dyAway / normal) * profile.verticalSpeed * 0.5,
      fear: 0,
      interest,
      mode: "interest",
    };
  }

  const pointerAge = now - pointerLastMoveAt;
  const movingThreat = pointerAge < 240 && pointerSpeed > 90;

  if (movingThreat) {
    if (distance >= profile.cursorRadius) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };

    const strength = smoothstep(1 - distance / profile.cursorRadius);
    const normal = Math.max(1, distance);
    const awayX = dxAway / normal;
    const awayY = dyAway / normal;
    const side = Math.abs(awayY) > 0.12
      ? Math.sign(awayY)
      : (Math.sin(state.phase) >= 0 ? 1 : -1);

    return {
      x: awayX * profile.evadeForward * strength,
      y: side * profile.evadeVertical * strength,
      fear: strength,
      interest: 0,
      mode: "threat",
    };
  }

  if (pointerAge < 620 || distance >= profile.interestRadius || state.curiosity < 0.12) {
    return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };
  }

  const normal = Math.max(1, distance);
  const towardX = -dxAway / normal;
  const towardY = -dyAway / normal;
  const distanceWindow = Math.max(1, profile.interestRadius - profile.interestDistance);
  const interestStrength = clamp(
    (profile.interestRadius - distance) / distanceWindow,
    0.16,
    1,
  ) * state.curiosity;

  if (distance <= profile.interestDistance) {
    const orbitSide = Math.sin(state.phase) >= 0 ? 1 : -1;
    return {
      x: -towardY * profile.cruiseSpeed * 0.42 * orbitSide * state.curiosity,
      y: towardX * profile.verticalSpeed * 0.42 * orbitSide * state.curiosity,
      fear: 0,
      interest: interestStrength,
      mode: "interest",
    };
  }

  return {
    x: towardX * profile.cruiseSpeed * (0.56 + state.curiosity * 0.34),
    y: towardY * profile.verticalSpeed * (0.9 + state.curiosity * 0.55),
    fear: 0,
    interest: interestStrength,
    mode: "interest",
  };
}

function pufferInflation(state: CreatureState, now: number) {
  if (state.preset.kind !== "puffer" || !state.inflatedExit) return 0;
  return smoothstep((now - state.inflateStartedAt) / 380);
}

function renderState(state: CreatureState, now = performance.now()) {
  const horizontal = Math.max(1, Math.abs(state.vx));
  const rawAngle = Math.atan2(state.vy, horizontal) * (180 / Math.PI);
  const turnAngle = clamp(rawAngle * state.facing * 0.48, -8, 8);
  const edgeDistance = Math.min(state.x, viewportWidth - (state.x + state.width));
  const edgeVisibility = smoothstep(edgeDistance / Math.min(52, Math.max(28, state.width * 0.28)));
  const inflation = pufferInflation(state, now);

  if (Math.abs(state.vx) > 4) state.facing = state.vx >= 0 ? 1 : -1;

  state.element.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0) rotate(${turnAngle.toFixed(2)}deg)`;
  // Do not expose a sprite while the viewport is cutting through it. Once the
  // complete mascot is inside, blend it in over a short distance from the edge.
  state.element.style.opacity = String(!state.active || state.hiddenUntil > now ? 0 : state.preset.opacity * edgeVisibility);
  state.element.style.setProperty("--facing-scale", String(state.facing));
  state.element.style.setProperty("--body-duration", `${bodyAnimationBase[state.preset.kind]}s`);
  state.element.style.setProperty("--inflation", inflation.toFixed(3));
  state.element.style.setProperty("--bubble-focus", state.bubbleFocus.toFixed(3));
  state.element.dataset.mood = state.mood;
  state.element.dataset.behavior = state.preset.kind === "jelly"
    ? "cruise"
    : state.inflatedExit
    ? "inflated-exit"
    : state.hiddenUntil > now
      ? "hidden"
      : state.panicUntil > now || state.fear > 0.42
        ? "panic"
      : state.preset.id === "shark" && state.pointerMode === "interest"
        ? "interest"
      : state.preset.id === "shark" && huntTargetId
        ? "hunt"
        : state.preset.id === huntTargetId
          ? "flee"
          : state.interest > 0.2
            ? "interest"
            : "cruise";
}

function rotatePetSlot(leaving: CreatureState, now: number) {
  if (leaving.preset.id === "shark") return false;
  const candidates = [...creatureStates.values()].filter((state) => (
    !state.active && state.preset.id !== "shark"
  ));
  if (!candidates.length) return false;

  const next = candidates[Math.floor(Math.random() * candidates.length)]!;
  leaving.active = false;
  leaving.element.style.opacity = "0";
  if (huntTargetId === leaving.preset.id) huntTargetId = null;

  const margin = Math.max(90, next.width * 0.55);
  const profile = steeringProfiles[next.preset.kind];
  next.active = true;
  next.hiddenUntil = 0;
  next.x = next.direction > 0 ? -next.width - margin : viewportWidth + margin;
  next.y = next.homeY;
  next.vx = next.direction * profile.cruiseSpeed;
  next.vy = 0;
  next.nextDecisionAt = now + randomBetween(profile.decisionMin, profile.decisionMax) * 1000;
  renderState(next, now);
  return true;
}

function updateJellyMood(state: CreatureState, now: number) {
  if (state.preset.kind !== "jelly") return;
  if (state.jellyExit) return;
  if (state.mood !== "none" && now >= state.moodUntil) {
    state.mood = "none";
    state.nextMoodAt = now + randomBetween(8000, 16_000);
  } else if (state.mood === "none" && now >= state.nextMoodAt) {
    state.mood = Math.random() > 0.48 ? "sleep" : "play";
    state.moodUntil = now + randomBetween(2800, 5200);
  }
}

function wrapState(state: CreatureState, now: number) {
  const margin = Math.max(90, state.width * 0.55);
  const leftViewport = state.direction < 0 && state.x + state.width < -margin;
  const rightViewport = state.direction > 0 && state.x > viewportWidth + margin;

  if (state.preset.kind === "puffer" && state.inflatedExit && (leftViewport || rightViewport)) {
    state.inflatedExit = false;
    state.hiddenUntil = now + 2800;
    state.x = state.direction > 0 ? -state.width - margin : viewportWidth + margin;
    state.vx = 0;
    state.vy = 0;
    return;
  }

  if ((leftViewport || rightViewport) && rotatePetSlot(state, now)) return;

  if (rightViewport) {
    const bounds = verticalBounds(state.height);
    state.x = -state.width - margin;
    state.y = clamp(state.homeY + Math.sin(state.phase) * 34, bounds.min, bounds.max);
    state.phase += 1.17;
  } else if (leftViewport) {
    const bounds = verticalBounds(state.height);
    state.x = viewportWidth + margin;
    state.y = clamp(state.homeY + Math.sin(state.phase) * 34, bounds.min, bounds.max);
    state.phase += 1.17;
  }
}

function updateHunt(now: number) {
  if (huntTargetId && now >= huntUntil) huntTargetId = null;
  if (huntTargetId || now < nextHuntAt) return;

  const shark = creatureStates.get("shark");
  const candidates = [
    creatureStates.get("puffer"),
    creatureStates.get("seahorse"),
    creatureStates.get("blue-fish"),
    creatureStates.get("clownfish"),
  ]
    .filter((state): state is CreatureState => Boolean(
      state
      && state.active
      && !state.inflatedExit
      && state.hiddenUntil <= now
      && state.x >= 0
      && state.x + state.width <= viewportWidth,
    ));

  if (!shark || !candidates.length || shark.x < 0 || shark.x + shark.width > viewportWidth) {
    nextHuntAt = now + randomBetween(3500, 7000);
    return;
  }

  const target = candidates[Math.floor(Math.random() * candidates.length)]!;
  huntTargetId = target.preset.id;
  huntUntil = now + randomBetween(4200, 6500);
  nextHuntAt = huntUntil + randomBetween(11_000, 21_000);
}

function relationshipSteering(state: CreatureState, profile: SteeringProfile): PointerSteering {
  if (!huntTargetId) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };
  const shark = creatureStates.get("shark");
  const target = creatureStates.get(huntTargetId);
  if (!shark || !target) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };

  if (state === shark) {
    const dx = target.x + target.width * 0.5 - (state.x + state.width * 0.5);
    const dy = target.y + target.height * 0.5 - (state.y + state.height * 0.5);
    const distance = Math.max(1, Math.hypot(dx, dy));
    state.direction = dx >= 0 ? 1 : -1;
    return {
      x: (dx / distance) * profile.cruiseSpeed * 0.92,
      y: (dy / distance) * profile.verticalSpeed * 1.35,
      fear: 0,
      interest: 0.8,
      mode: "interest",
    };
  }

  if (state !== target) return { x: 0, y: 0, fear: 0, interest: 0, mode: "none" };
  const dx = state.x + state.width * 0.5 - (shark.x + shark.width * 0.5);
  const dy = state.y + state.height * 0.5 - (shark.y + shark.height * 0.5);
  const distance = Math.max(1, Math.hypot(dx, dy));
  state.direction = dx >= 0 ? 1 : -1;
  return {
    x: (dx / distance) * profile.cruiseSpeed * 1.35,
    y: (dy / distance) * profile.verticalSpeed * 1.7,
    fear: 0.9,
    interest: 0,
    mode: "threat",
  };
}

/**
 * Steering toward (or away from) the nearest rising bubble.
 *
 * This is deliberately weaker than pointer and hunt steering: bubbles are
 * scenery, and a mascot that abandoned everything to chase one would read as
 * broken rather than playful. Fish and seahorses drift over and burst them,
 * the puffer flinches away, the shark barely notices, and jellyfish ignore
 * bubbles entirely.
 */
function bubbleSteering(state: CreatureState, profile: SteeringProfile, now: number): PointerSteering {
  const idle = { x: 0, y: 0, fear: 0, interest: 0, mode: "none" as PointerMode };
  if (!profile.bubbleInterest || state.inflatedExit || state.jellyExit) return idle;
  // A mascot already fleeing the cursor or a shark has bigger problems.
  if (state.fear > 0.35 || state.pointerMode === "panic") return idle;

  const cx = state.x + state.width * 0.5;
  const cy = state.y + state.height * 0.5;
  const bubble = nearestBubble(cx, cy, profile.bubbleRadius);
  if (!bubble) return idle;

  const dx = bubble.x - cx;
  const dy = bubble.y - cy;
  const distance = Math.max(1, Math.hypot(dx, dy));
  // Closer bubbles pull harder, so a mascot commits as it arrives instead of
  // being tugged equally by everything in range.
  const proximity = 1 - distance / profile.bubbleRadius;
  const sign = Math.sign(profile.bubbleInterest);
  const strength = Math.abs(profile.bubbleInterest) * proximity;

  if (sign > 0) {
    // Close enough to swallow it. The cooldown stops a mascot sitting inside a
    // bubble stream and clearing the whole screen.
    const reach = Math.max(18, state.width * 0.28);
    if (distance < reach && now >= state.nextBubblePopAt && popBubbleAt(bubble.x, bubble.y, reach)) {
      state.nextBubblePopAt = now + randomBetween(900, 2100);
      state.bubbleFocus = 1;
    }
  }

  state.bubbleFocus = Math.max(state.bubbleFocus, strength * (sign > 0 ? 0.85 : 1));

  return {
    x: (dx / distance) * profile.cruiseSpeed * 0.55 * strength * sign,
    y: (dy / distance) * profile.verticalSpeed * 1.15 * strength * sign,
    fear: 0,
    interest: sign > 0 ? Math.min(0.5, strength) : 0,
    mode: "none",
  };
}

function maybeChooseNewDirection(
  state: CreatureState,
  profile: SteeringProfile,
  now: number,
  pointer: PointerSteering,
) {
  if (now < state.nextDecisionAt) return;

  state.nextDecisionAt = now + randomBetween(profile.decisionMin, profile.decisionMax) * 1000;
  if (pointer.mode !== "none" || state.fear > 0.08 || now < state.turnLockUntil) return;
  if (huntTargetId && (state.preset.id === "shark" || state.preset.id === huntTargetId)) return;
  if (Math.random() >= profile.turnChance) return;

  state.direction = state.direction === 1 ? -1 : 1;
  state.turnBoostUntil = now + 900;
  state.turnLockUntil = now + 2800;

  const bounds = verticalBounds(state.height);
  state.homeY = clamp(
    state.homeY + randomBetween(-Math.min(100, viewportHeight * 0.13), Math.min(100, viewportHeight * 0.13)),
    bounds.min,
    bounds.max,
  );
}

function updateState(state: CreatureState, now: number, dt: number) {
  const profile = steeringProfiles[state.preset.kind];
  if (!state.active) {
    state.element.style.opacity = "0";
    state.element.dataset.behavior = "hidden";
    return;
  }
  updateJellyMood(state, now);
  if (state.hiddenUntil > now) {
    renderState(state, now);
    return;
  }
  if (state.hiddenUntil) {
    const margin = Math.max(90, state.width * 0.55);
    state.hiddenUntil = 0;
    state.x = state.direction > 0 ? -state.width - margin : viewportWidth + margin;
    state.y = state.homeY;
    state.vx = state.direction * profile.cruiseSpeed;
    state.vy = 0;
  }

  if (state.jellyExit) {
    state.vx += (0 - state.vx) * Math.min(1, dt * 3.5);
    state.vy += (-145 - state.vy) * Math.min(1, dt * 4.2);
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    if (state.y + state.height < -36) {
      const margin = Math.max(90, state.width * 0.55);
      state.jellyExit = false;
      state.mood = "none";
      state.hiddenUntil = now + randomBetween(3200, 5200);
      state.x = state.direction > 0 ? -state.width - margin : viewportWidth + margin;
      state.y = state.homeY;
      state.vx = 0;
      state.vy = 0;
    }
    renderState(state, now);
    return;
  }

  const pointer = pointerSteering(state, profile, now);
  state.pointerMode = pointer.mode;
  const social = relationshipSteering(state, profile);
  // Bubbles only get a say when nothing more urgent is steering the mascot.
  const bubble = social.mode === "none" && pointer.mode === "none"
    ? bubbleSteering(state, profile, now)
    : { x: 0, y: 0, fear: 0, interest: 0, mode: "none" as PointerMode };
  state.bubbleFocus = Math.max(0, state.bubbleFocus - dt * 1.1);

  if (pointer.mode === "interest" && now >= state.turnLockUntil) {
    const cx = state.x + state.width * 0.5;
    const horizontalToPointer = pointerX - cx;
    if (Math.abs(horizontalToPointer) > profile.interestDistance * 0.72) {
      const wantedDirection: 1 | -1 = horizontalToPointer >= 0 ? 1 : -1;
      if (wantedDirection !== state.direction && pointer.interest > 0.28) {
        state.direction = wantedDirection;
        state.turnBoostUntil = now + 650;
        state.turnLockUntil = now + 1400;
      }
    }
  }

  maybeChooseNewDirection(state, profile, now, pointer);

  const combinedFear = Math.max(pointer.fear, social.fear);
  const combinedInterest = Math.max(pointer.interest, social.interest, bubble.interest);
  const fearResponse = combinedFear > state.fear ? 6.2 : 1.6;
  const interestResponse = combinedInterest > state.interest ? 1.6 : 2.2;
  state.fear += (combinedFear - state.fear) * Math.min(1, dt * fearResponse);
  state.interest += (combinedInterest - state.interest) * Math.min(1, dt * interestResponse);

  const time = now / 1000;
  const wander = (
    Math.sin(time * profile.wanderFrequency + state.phase)
    + Math.sin(time * profile.wanderFrequency * 0.43 + state.phase * 1.61) * 0.38
  ) * profile.verticalSpeed;
  const homePull = (state.homeY - state.y) * 0.16;
  const boostedCruise = profile.cruiseSpeed * (1 + state.fear * profile.fearBoost);
  const interestedCruise = boostedCruise * (1 - state.interest * 0.56);

  let desiredVx = state.direction * interestedCruise + pointer.x + social.x + bubble.x;
  let desiredVy = wander * (1 - state.interest * 0.35) + homePull + pointer.y + social.y + bubble.y;

  if (state.inflatedExit) {
    desiredVx = state.direction * profile.maxSpeed * 1.45;
    desiredVy *= 0.35;
  }

  if (pointer.mode === "threat" || pointer.mode === "panic") {
    if (state.direction > 0) desiredVx = Math.max(profile.cruiseSpeed * 0.34, desiredVx);
    else desiredVx = Math.min(-profile.cruiseSpeed * 0.34, desiredVx);
  }

  const desiredSpeed = Math.hypot(desiredVx, desiredVy);
  const allowedSpeed = state.inflatedExit ? profile.maxSpeed * 1.5 : profile.maxSpeed;
  if (desiredSpeed > allowedSpeed) {
    const scale = allowedSpeed / desiredSpeed;
    desiredVx *= scale;
    desiredVy *= scale;
  }

  const turnMultiplier = now < state.turnBoostUntil ? 2.15 : 1;
  const steering = Math.min(1, dt * profile.steering * turnMultiplier);
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

  wrapState(state, now);
  renderState(state, now);
}

function animate(now: number) {
  if (reducedMotion?.matches) {
    animationRaf = 0;
    return;
  }

  const dt = lastFrameTime ? Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000)) : 1 / 60;
  lastFrameTime = now;

  if (pointerActive && now - pointerLastMoveAt > 180) {
    pointerSpeed *= Math.exp(-dt * 8);
  }

  updateHunt(now);
  for (const state of creatureStates.values()) {
    updateState(state, now, dt);
    recordTrail(state, now, dt);
  }
  drawTrails();
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
  for (const state of creatureStates.values()) state.trail.length = 0;
  trailCtx?.clearRect(0, 0, viewportWidth, viewportHeight);
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType === "touch") return;

  const now = performance.now();
  if (pointerLastSampleAt > 0) {
    const dt = Math.max(0.008, (now - pointerLastSampleAt) / 1000);
    const dx = event.clientX - pointerLastX;
    const dy = event.clientY - pointerLastY;
    const sampleSpeed = Math.hypot(dx, dy) / dt;
    pointerSpeed = pointerSpeed * 0.58 + sampleSpeed * 0.42;
  }

  pointerX = event.clientX;
  pointerY = event.clientY;
  pointerLastX = pointerX;
  pointerLastY = pointerY;
  pointerLastSampleAt = now;
  pointerLastMoveAt = now;
  pointerActive = true;
}

function handlePointerDown(event: PointerEvent) {
  if (reducedMotion?.matches) return;

  const now = performance.now();
  for (const state of creatureStates.values()) {
    if (!state.active) continue;
    const cx = state.x + state.width * 0.5;
    const cy = state.y + state.height * 0.5;
    const radiusX = Math.max(28, state.width * (state.preset.kind === "puffer" ? 0.62 : 0.48));
    const radiusY = Math.max(22, state.height * (state.preset.kind === "puffer" ? 0.68 : 0.46));
    const nx = (event.clientX - cx) / radiusX;
    const ny = (event.clientY - cy) / radiusY;

    if (nx * nx + ny * ny > 1) continue;

    if (state.preset.kind === "jelly") {
      if (state.mood === "sleep") {
        state.mood = "angry";
        state.jellyExit = true;
        state.vx = 0;
        state.vy = -22;
      }
      continue;
    }

    state.panicX = event.clientX;
    state.panicY = event.clientY;
    state.panicUntil = now + 1500;
    state.fear = 1;
    state.interest = 0;
    state.direction = cx < event.clientX ? -1 : 1;
    state.turnBoostUntil = now + 950;
    state.turnLockUntil = now + 3200;
    state.nextDecisionAt = now + 5000;

    if (state.preset.kind === "puffer") {
      state.inflateStartedAt = now;
      state.inflatedExit = true;
      state.hiddenUntil = 0;
      huntTargetId = null;
      nextHuntAt = now + 9000;
    }
  }
}

function handlePointerLeave() {
  pointerActive = false;
  pointerSpeed = 0;
  pointerX = -10_000;
  pointerY = -10_000;
  pointerLastX = pointerX;
  pointerLastY = pointerY;
  pointerLastMoveAt = 0;
  pointerLastSampleAt = 0;
}

function handleResize() {
  const oldWidth = viewportWidth;
  syncViewport();
  const widthRatio = oldWidth > 1 ? viewportWidth / oldWidth : 1;

  for (const state of creatureStates.values()) {
    state.x *= widthRatio;
    state.trail.length = 0;
    refreshCreatureSize(state.preset.id);
  }

  configureTrailCanvas();
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

onMounted(async () => {
  syncViewport();
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  nextHuntAt = performance.now() + randomBetween(8000, 14_000);

  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });
  window.addEventListener("blur", handlePointerLeave, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  reducedMotion.addEventListener?.("change", handleMotionPreference);

  // Client-only components can finish hydrating before callback refs have
  // populated the map. Initialize on the next painted frame so every mascot
  // has its real dimensions before steering starts.
  await nextTick();
  mountRaf = requestAnimationFrame(() => {
    mountRaf = 0;
    configureTrailCanvas();
    initializeStates();
    startAnimation();
  });
});

onBeforeUnmount(() => {
  if (mountRaf) cancelAnimationFrame(mountRaf);
  stopAnimation();
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerdown", handlePointerDown);
  document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
  window.removeEventListener("blur", handlePointerLeave);
  window.removeEventListener("resize", handleResize);
  reducedMotion?.removeEventListener?.("change", handleMotionPreference);
  swimmerElements.clear();
  creatureStates.clear();
  trailCtx = null;
});
</script>

<template>
  <div class="underwater-2d" aria-hidden="true">
    <canvas ref="trailCanvas" class="underwater-2d__trails" />
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
            <aquarium-pet-sprite
              :creature="creature"
              @loaded="refreshCreatureSize(creature.id)"
            />
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

.underwater-2d__trails {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* Screen keeps the wake reading as light in the water rather than paint on
     top of it, so it disappears against the darker parts of the backdrop. */
  mix-blend-mode: screen;
  opacity: 0.85;
}

.underwater-2d__swimmer {
  --inflation: 0;
  --facing-scale: 1;
  --body-duration: 2.2s;
  --bubble-focus: 0;
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
  /* A mascot that has noticed a bubble catches a little more light and leans
     in. Driven from JS via --bubble-focus, which decays back to 0. */
  transform: scale(calc(1 + var(--bubble-focus) * 0.045));
  filter: brightness(calc(1 + var(--bubble-focus) * 0.16))
    drop-shadow(0 0 calc(var(--bubble-focus) * 12px) rgba(186, 235, 255, calc(var(--bubble-focus) * 0.5)));
}

.underwater-2d__swimmer {
  pointer-events: auto;
  cursor: pointer;
}

.underwater-2d__bob {
  width: 100%;
  will-change: transform;
}

.underwater-2d__facing {
  width: 100%;
  transform: scaleX(var(--facing-scale));
  transform-origin: center;
}

.underwater-2d__swimmer[data-behavior="panic"] .underwater-2d__reaction,
.underwater-2d__swimmer[data-behavior="flee"] .underwater-2d__reaction {
  animation: ocean-startled .34s ease-in-out 2;
}

@keyframes ocean-startled {
  0%, 100% { transform: translateY(0) rotate(0); }
  30% { transform: translateY(-5px) rotate(-3deg); }
  65% { transform: translateY(3px) rotate(2deg); }
}

@media (max-width: 900px) {
  .underwater-2d__swimmer_shark { width: clamp(150px, 28vw, 240px); }
  .underwater-2d__swimmer_puffer { width: clamp(78px, 16vw, 124px); }
  .underwater-2d__swimmer_fish { width: clamp(68px, 14vw, 112px); }
  .underwater-2d__swimmer_seahorse { width: clamp(60px, 12vw, 92px); }
  .underwater-2d__swimmer_jelly { width: clamp(62px, 12vw, 102px); }
}

@media (prefers-reduced-motion: reduce) {
  .underwater-2d__swimmer {
    animation: none !important;
  }

  .underwater-2d__swimmer {
    display: none;
  }
}
</style>
