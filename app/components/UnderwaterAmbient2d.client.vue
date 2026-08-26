<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted } from "vue";

type CreatureKind = "shark" | "seahorse" | "puffer" | "jelly";
type SwimDirection = "ltr" | "rtl";
type PointerMode = "none" | "interest" | "threat" | "panic";

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
  curiosity: number;
  interestRadius: number;
  interestDistance: number;
  turnChance: number;
  decisionMin: number;
  decisionMax: number;
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
};

type PointerSteering = {
  x: number;
  y: number;
  fear: number;
  interest: number;
  mode: PointerMode;
};

const creatures: CreaturePreset[] = [
  { id: "shark", src: "/images/ocean-creatures/shark-clean.webp", kind: "shark", top: "18%", size: "clamp(190px, 18vw, 330px)", duration: "34s", delay: "-9s", direction: "rtl", opacity: 0.88 },
  { id: "puffer", src: "/images/ocean-creatures/puffer-normal.webp", kind: "puffer", top: "43%", size: "clamp(94px, 9vw, 158px)", duration: "25s", delay: "-3s", direction: "ltr", opacity: 0.9 },
  { id: "seahorse", src: "/images/ocean-creatures/seahorse-clean.webp", kind: "seahorse", top: "61%", size: "clamp(70px, 5.7vw, 112px)", duration: "39s", delay: "-21s", direction: "rtl", opacity: 0.88 },
  { id: "jelly-blue", src: "/images/ocean-creatures/jelly-blue.webp", kind: "jelly", top: "29%", size: "clamp(82px, 6.5vw, 126px)", duration: "43s", delay: "-28s", direction: "ltr", opacity: 0.7 },
  { id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink.webp", kind: "jelly", top: "72%", size: "clamp(76px, 6vw, 118px)", duration: "47s", delay: "-6s", direction: "rtl", opacity: 0.68 },
];

const steeringProfiles: Record<CreatureKind, SteeringProfile> = {
  shark: {
    cruiseSpeed: 48,
    maxSpeed: 94,
    steering: 1.35,
    verticalSpeed: 13,
    wanderFrequency: 0.62,
    cursorRadius: 300,
    evadeVertical: 118,
    evadeForward: 38,
    fearBoost: 0.5,
    curiosity: 0.36,
    interestRadius: 470,
    interestDistance: 170,
    turnChance: 0.18,
    decisionMin: 10,
    decisionMax: 20,
  },
  puffer: {
    cruiseSpeed: 31,
    maxSpeed: 68,
    steering: 2.1,
    verticalSpeed: 18,
    wanderFrequency: 0.74,
    cursorRadius: 250,
    evadeVertical: 132,
    evadeForward: 30,
    fearBoost: 0.62,
    curiosity: 0.72,
    interestRadius: 410,
    interestDistance: 115,
    turnChance: 0.34,
    decisionMin: 7,
    decisionMax: 14,
  },
  seahorse: {
    cruiseSpeed: 22,
    maxSpeed: 50,
    steering: 1.65,
    verticalSpeed: 22,
    wanderFrequency: 0.5,
    cursorRadius: 220,
    evadeVertical: 102,
    evadeForward: 20,
    fearBoost: 0.36,
    curiosity: 0.56,
    interestRadius: 350,
    interestDistance: 105,
    turnChance: 0.16,
    decisionMin: 11,
    decisionMax: 21,
  },
  jelly: {
    cruiseSpeed: 18,
    maxSpeed: 38,
    steering: 1.05,
    verticalSpeed: 25,
    wanderFrequency: 0.39,
    cursorRadius: 190,
    evadeVertical: 54,
    evadeForward: 10,
    fearBoost: 0.12,
    curiosity: 0.18,
    interestRadius: 280,
    interestDistance: 120,
    turnChance: 0.08,
    decisionMin: 15,
    decisionMax: 28,
  },
};

const bodyAnimationBase: Record<CreatureKind, number> = {
  shark: 1.8,
  puffer: 2.4,
  seahorse: 2.2,
  jelly: 2.2,
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
    renderState(state);
  });
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
  const profile = steeringProfiles[state.preset.kind];
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
  state.element.style.opacity = String(state.hiddenUntil > now ? 0 : state.preset.opacity * edgeVisibility);
  state.element.style.setProperty("--facing-scale", String(state.facing));
  state.element.style.setProperty("--body-duration", `${bodyAnimationBase[state.preset.kind]}s`);
  state.element.style.setProperty("--inflation", inflation.toFixed(3));
  state.element.dataset.behavior = state.preset.kind === "jelly"
    ? "cruise"
    : state.inflatedExit
    ? "inflated-exit"
    : state.hiddenUntil > now
      ? "hidden"
      : state.panicUntil > now || state.fear > 0.42
        ? "panic"
      : state.preset.id === "shark" && huntTargetId
        ? "hunt"
        : state.preset.id === huntTargetId
          ? "flee"
          : state.interest > 0.2
            ? "interest"
            : "cruise";
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
  const candidates = [creatureStates.get("puffer"), creatureStates.get("seahorse")]
    .filter((state): state is CreatureState => Boolean(
      state
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

  const pointer = pointerSteering(state, profile, now);
  const social = relationshipSteering(state, profile);

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
  const combinedInterest = Math.max(pointer.interest, social.interest);
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

  let desiredVx = state.direction * interestedCruise + pointer.x + social.x;
  let desiredVy = wander * (1 - state.interest * 0.35) + homePull + pointer.y + social.y;

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

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest("a, button, input, textarea, select, summary, [role='button'], [contenteditable='true']"));
}

function handlePointerDown(event: PointerEvent) {
  if (reducedMotion?.matches) return;

  const now = performance.now();
  const interactiveTarget = isInteractiveTarget(event.target);
  for (const state of creatureStates.values()) {
    if (state.preset.kind === "jelly") continue;
    const cx = state.x + state.width * 0.5;
    const cy = state.y + state.height * 0.5;
    const radiusX = Math.max(28, state.width * (state.preset.kind === "puffer" ? 0.62 : 0.48));
    const radiusY = Math.max(22, state.height * (state.preset.kind === "puffer" ? 0.68 : 0.46));
    const nx = (event.clientX - cx) / radiusX;
    const ny = (event.clientY - cy) / radiusY;

    if (nx * nx + ny * ny > 1) continue;
    if (interactiveTarget && state.preset.kind !== "puffer") continue;

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
            <div class="underwater-2d__stage" :class="`underwater-2d__stage_${creature.kind}`">
              <template v-if="creature.kind === 'puffer'">
                <img
                  class="underwater-2d__creature underwater-2d__puffer-form underwater-2d__puffer-form_normal"
                  :src="creature.src"
                  alt=""
                  draggable="false"
                  @load="refreshCreatureSize(creature.id)"
                >
                <img
                  class="underwater-2d__creature underwater-2d__puffer-form underwater-2d__puffer-form_ball"
                  src="/images/ocean-creatures/puffer-clean.webp"
                  alt=""
                  draggable="false"
                >
              </template>
              <template v-else-if="creature.kind === 'shark'">
                <img
                  class="underwater-2d__creature underwater-2d__expression underwater-2d__expression_default"
                  :src="creature.src"
                  alt=""
                  draggable="false"
                  @load="refreshCreatureSize(creature.id)"
                >
                <img
                  class="underwater-2d__creature underwater-2d__expression underwater-2d__expression_hunt"
                  src="/images/ocean-creatures/shark-hunt.webp"
                  alt=""
                  draggable="false"
                >
              </template>
              <img
                v-else-if="creature.kind !== 'jelly'"
                class="underwater-2d__creature"
                :src="creature.src"
                alt=""
                draggable="false"
                @load="refreshCreatureSize(creature.id)"
              >
              <template v-else>
                <img
                  class="underwater-2d__creature underwater-2d__jelly-bell"
                  :src="creature.src"
                  alt=""
                  draggable="false"
                  @load="refreshCreatureSize(creature.id)"
                >
                <img
                  class="underwater-2d__creature underwater-2d__jelly-tentacles"
                  :src="creature.src"
                  alt=""
                  draggable="false"
                >
              </template>
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
  --inflation: 0;
  --facing-scale: 1;
  --body-duration: 2.2s;
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

.underwater-2d__stage {
  position: relative;
  width: 100%;
  transform-origin: 50% 50%;
  will-change: transform;
}

.underwater-2d__stage_shark { aspect-ratio: 320 / 198; }
.underwater-2d__stage_puffer { aspect-ratio: 240 / 148; }
.underwater-2d__stage_seahorse { aspect-ratio: 140 / 240; }
.underwater-2d__swimmer_jelly-blue .underwater-2d__stage { aspect-ratio: 105 / 120; }
.underwater-2d__swimmer_jelly-pink .underwater-2d__stage { aspect-ratio: 120 / 109; }

.underwater-2d__stage_shark {
  animation: ocean-shark-swim var(--body-duration) cubic-bezier(.45,.05,.55,.95) infinite;
}

.underwater-2d__stage_puffer {
  animation: ocean-puffer-breathe var(--body-duration) ease-in-out infinite;
}

.underwater-2d__stage_seahorse {
  transform-origin: 52% 46%;
  animation: ocean-seahorse-drift var(--body-duration) cubic-bezier(.45,.05,.55,.95) infinite;
}

.underwater-2d__stage_jelly {
  transform-origin: 50% 30%;
  animation: ocean-jelly-body var(--body-duration) ease-in-out infinite;
}

.underwater-2d__creature {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
}

.underwater-2d__puffer-form {
  transition: opacity 180ms ease;
}

.underwater-2d__puffer-form_normal { opacity: calc(1 - var(--inflation)); }
.underwater-2d__puffer-form_ball { opacity: var(--inflation); }

.underwater-2d__expression {
  transition: opacity 180ms ease;
}

.underwater-2d__expression_default { opacity: 1; }
.underwater-2d__expression_hunt { opacity: 0; }
.underwater-2d__swimmer_shark[data-behavior="hunt"] .underwater-2d__expression_default { opacity: 0; }
.underwater-2d__swimmer_shark[data-behavior="hunt"] .underwater-2d__expression_hunt { opacity: 1; }

.underwater-2d__swimmer[data-behavior="panic"] .underwater-2d__reaction,
.underwater-2d__swimmer[data-behavior="flee"] .underwater-2d__reaction {
  animation: ocean-startled .34s ease-in-out 2;
}

.underwater-2d__jelly-bell {
  clip-path: polygon(0 0, 100% 0, 100% 43%, 0 43%);
}

.underwater-2d__jelly-tentacles {
  clip-path: polygon(0 43%, 100% 43%, 100% 100%, 0 100%);
  transform-origin: 50% 43%;
  animation: ocean-tentacle-wave 1.6s cubic-bezier(.45,.05,.55,.95) infinite;
}

@keyframes ocean-tentacle-wave {
  0%, 100% { transform: skewX(-1.5deg) scale(.99, .96); }
  50% { transform: skewX(1.5deg) scale(1.01, 1.04); }
}

@keyframes ocean-startled {
  0%, 100% { transform: translateY(0) rotate(0); }
  30% { transform: translateY(-5px) rotate(-3deg); }
  65% { transform: translateY(3px) rotate(2deg); }
}

@keyframes ocean-shark-swim {
  0%, 100% { transform: translateY(-2px) rotate(-.7deg); }
  50% { transform: translateY(2px) rotate(.7deg); }
}

@keyframes ocean-puffer-breathe {
  0%, 100% { transform: translateY(-2px) skewY(-1.4deg) scale(1) rotate(-1deg); }
  48% { transform: translateY(2px) skewY(1.4deg) scale(1.035, 1.05) rotate(1deg); }
}

@keyframes ocean-seahorse-drift {
  0%, 100% { transform: rotate(-5deg) skewX(-1.8deg) translateY(-4px) scaleY(.985); }
  25% { transform: rotate(0) skewX(0) translateY(0) scaleY(1); }
  50% { transform: rotate(5deg) skewX(1.8deg) translateY(4px) scaleY(1.02); }
  75% { transform: rotate(0) skewX(0) translateY(0) scaleY(1); }
}

@keyframes ocean-jelly-body {
  0%, 100% { transform: translateY(1px) rotate(-.7deg); }
  50% { transform: translateY(-3px) rotate(.7deg); }
}

@media (max-width: 900px) {
  .underwater-2d__swimmer_shark { width: clamp(150px, 28vw, 240px); }
  .underwater-2d__swimmer_puffer { width: clamp(78px, 16vw, 124px); }
  .underwater-2d__swimmer_seahorse { width: clamp(60px, 12vw, 92px); }
  .underwater-2d__swimmer_jelly { width: clamp(62px, 12vw, 102px); }
}

@media (prefers-reduced-motion: reduce) {
  .underwater-2d__swimmer,
  .underwater-2d__stage,
  .underwater-2d__part {
    animation: none !important;
  }

  .underwater-2d__swimmer {
    display: none;
  }
}
</style>
