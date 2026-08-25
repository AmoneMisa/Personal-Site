<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);

const MIN_WIDTH = 1200;
const MAX_DPR = 1.5;
const BUBBLE_COUNT = 22;
const TAU = Math.PI * 2;
const SPRITE_W = 256;
const SPRITE_H = 128;

type Point = { x: number; y: number };
type CreatureKind = "fish" | "shark" | "jelly";
type CreatureState = "cruise" | "startled" | "glance" | "follow" | "hide";
type RouteProfile = "top-glide" | "mid-arc" | "bottom-wander" | "deep-curve" | "shark-sweep" | "shark-deep" | "jelly-left" | "jelly-right";

type Bubble = {
  x: number;
  y: number;
  r: number;
  depth: number;
  speed: number;
  drift: number;
  phase: number;
  stream: number;
};

type Burst = {
  x: number;
  y: number;
  radius: number;
  age: number;
  sparks: Array<{ angle: number; distance: number; size: number }>;
};

type CreaturePreset = {
  sprite: number;
  kind: CreatureKind;
  route: RouteProfile;
  size: [number, number];
  speed: [number, number];
  depth: [number, number];
  spawnDelay: [number, number];
};

type Creature = {
  preset: CreaturePreset;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSpeed: number;
  direction: 1 | -1;
  phase: number;
  depth: number;
  state: CreatureState;
  until: number;
  followUntil: number;
  hideTarget: Point | null;
  annoyed: number;
  nextSpawn: number;
  lane: number;
};

const PRESETS: CreaturePreset[] = [
  { sprite: 0, kind: "fish", route: "top-glide", size: [46, 62], speed: [34, 48], depth: [.42, .72], spawnDelay: [4500, 11000] },
  { sprite: 1, kind: "fish", route: "mid-arc", size: [52, 68], speed: [27, 38], depth: [.5, .82], spawnDelay: [5500, 12500] },
  { sprite: 2, kind: "fish", route: "bottom-wander", size: [44, 58], speed: [30, 44], depth: [.38, .68], spawnDelay: [4000, 10000] },
  { sprite: 3, kind: "fish", route: "deep-curve", size: [50, 66], speed: [22, 34], depth: [.58, .9], spawnDelay: [6500, 14000] },
  { sprite: 4, kind: "shark", route: "shark-sweep", size: [92, 118], speed: [20, 28], depth: [.48, .78], spawnDelay: [12000, 26000] },
  { sprite: 5, kind: "shark", route: "shark-deep", size: [76, 98], speed: [24, 32], depth: [.62, .92], spawnDelay: [16000, 30000] },
  { sprite: 6, kind: "jelly", route: "jelly-left", size: [62, 78], speed: [10, 15], depth: [.36, .7], spawnDelay: [7000, 16000] },
  { sprite: 7, kind: "jelly", route: "jelly-right", size: [58, 74], speed: [9, 14], depth: [.44, .76], spawnDelay: [9000, 18000] },
];

let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let raf = 0;
let running = false;
let last = 0;
let desktopMq: MediaQueryList | null = null;
let motionMq: MediaQueryList | null = null;
let spriteAtlas: HTMLImageElement | null = null;
let spriteReady = false;

const bubbles: Bubble[] = [];
const bursts: Burst[] = [];
const creatures: Creature[] = [];
const pointer = { x: -9999, y: -9999, visible: false };
const streams = [0.07, 0.2, 0.79, 0.93];

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function shouldRun() {
  return Boolean(desktopMq?.matches && !motionMq?.matches && !document.hidden);
}

function resize() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx = canvas.getContext("2d", { alpha: true });
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createBubble(startAnywhere = false): Bubble {
  const depth = Math.random();
  const stream = Math.floor(Math.random() * streams.length);
  const r = rand(4, 11) * (0.65 + depth * 0.75);
  return {
    x: clamp(streams[stream] * width + rand(-42, 42), 16, width - 16),
    y: startAnywhere ? rand(0, height) : height + rand(8, height * 0.22),
    r,
    depth,
    speed: rand(18, 40) * (0.8 + depth * 0.55),
    drift: rand(-4, 4),
    phase: rand(0, TAU),
    stream,
  };
}

function resetBubble(bubble: Bubble) {
  Object.assign(bubble, createBubble(false));
}

function routeLane(route: RouteProfile) {
  if (route === "top-glide") return rand(.16, .34);
  if (route === "mid-arc") return rand(.32, .56);
  if (route === "bottom-wander") return rand(.62, .84);
  if (route === "deep-curve") return rand(.48, .76);
  if (route === "shark-sweep") return rand(.22, .52);
  if (route === "shark-deep") return rand(.58, .8);
  return rand(.3, .78);
}

function createCreature(preset: CreaturePreset, now: number, visible = false): Creature {
  const direction: 1 | -1 = Math.random() > .5 ? 1 : -1;
  const size = rand(...preset.size);
  const baseSpeed = rand(...preset.speed);
  const lane = routeLane(preset.route);
  const isJelly = preset.kind === "jelly";

  let x = direction === 1 ? -size * 2.4 : width + size * 2.4;
  let y = height * lane;

  if (isJelly) {
    x = preset.route === "jelly-left" ? width * rand(.08, .32) : width * rand(.68, .92);
    y = visible ? height * rand(.25, .78) : height + size * 1.8;
  } else if (visible) {
    x = rand(width * .04, width * .96);
  }

  return {
    preset,
    x,
    y,
    vx: isJelly ? rand(-3, 3) : baseSpeed * direction,
    vy: isJelly ? -baseSpeed : rand(-2, 2),
    size,
    baseSpeed,
    direction,
    phase: rand(0, TAU),
    depth: rand(...preset.depth),
    state: "cruise",
    until: 0,
    followUntil: 0,
    hideTarget: null,
    annoyed: 0,
    nextSpawn: visible ? now : now + rand(...preset.spawnDelay),
    lane,
  };
}

function resetCreature(item: Creature, now: number) {
  Object.assign(item, createCreature(item.preset, now, false));
}

function initScene(now: number) {
  bubbles.splice(0, bubbles.length, ...Array.from({ length: BUBBLE_COUNT }, () => createBubble(true)));
  bursts.length = 0;
  creatures.splice(0, creatures.length, ...PRESETS.map((preset, index) => createCreature(preset, now, index < 5)));

  creatures.forEach((item, index) => {
    if (index < 5 && item.preset.kind !== "jelly") {
      item.x = width * [.12, .34, .62, .83, .48][index];
      item.y = height * item.lane;
    }
  });
}

function drawWater(time: number) {
  if (!ctx) return;

  const haze = ctx.createLinearGradient(0, 0, 0, height);
  haze.addColorStop(0, "rgba(80, 180, 240, .04)");
  haze.addColorStop(.46, "rgba(28, 105, 175, .014)");
  haze.addColorStop(1, "rgba(4, 35, 85, .03)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const drift = Math.sin(time * .00009) * width * .025;
  const shafts = [
    { x: .08, w: .11, a: .026, tilt: .11 },
    { x: .27, w: .085, a: .02, tilt: .08 },
    { x: .51, w: .13, a: .024, tilt: .12 },
    { x: .76, w: .095, a: .019, tilt: .09 },
  ];

  for (const shaft of shafts) {
    const topX = width * shaft.x + drift;
    const bottomX = topX + height * shaft.tilt;
    const half = width * shaft.w * .5;
    const gradient = ctx.createLinearGradient(topX - half, 0, topX + half, 0);
    gradient.addColorStop(0, "rgba(126, 215, 255, 0)");
    gradient.addColorStop(.48, `rgba(126, 215, 255, ${shaft.a})`);
    gradient.addColorStop(1, "rgba(126, 215, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(topX - half, -20);
    ctx.lineTo(topX + half, -20);
    ctx.lineTo(bottomX + half * 1.45, height * .82);
    ctx.lineTo(bottomX - half * 1.45, height * .82);
    ctx.closePath();
    ctx.fill();
  }

  ctx.lineCap = "round";
  for (let row = 0; row < 5; row += 1) {
    const y = height * (.07 + row * .11);
    const rowShift = Math.sin(time * .00018 + row * .9) * 26;
    for (let x = -80; x < width + 120; x += 150) {
      const wobble = Math.sin((x + row * 47) * .011 + time * .00034) * 13;
      ctx.strokeStyle = `rgba(145, 224, 255, ${.018 - row * .0018})`;
      ctx.lineWidth = 2.2 + row * .15;
      ctx.beginPath();
      ctx.moveTo(x + rowShift, y + wobble);
      ctx.bezierCurveTo(
        x + 28 + rowShift, y - 9 + wobble,
        x + 55 + rowShift, y + 10 + wobble,
        x + 82 + rowShift, y + 2 + wobble,
      );
      ctx.stroke();
    }
  }

  ctx.restore();
}

function updateBubbles(dt: number, now: number) {
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.x += (b.drift + Math.sin(now * .001 + b.phase) * 3.8) * dt;
    if (b.y < -b.r * 3 || b.x < -60 || b.x > width + 60) resetBubble(b);
  }
}

function drawBubble(b: Bubble, foreground: boolean) {
  if (!ctx || (b.depth >= .62) !== foreground) return;
  const alpha = .23 + b.depth * .32;

  ctx.save();
  ctx.translate(b.x, b.y);

  const fill = ctx.createRadialGradient(-b.r * .32, -b.r * .38, b.r * .05, 0, 0, b.r);
  fill.addColorStop(0, `rgba(255,255,255,${alpha * .9})`);
  fill.addColorStop(.18, `rgba(190,235,255,${alpha * .16})`);
  fill.addColorStop(.68, `rgba(80,160,255,${alpha * .06})`);
  fill.addColorStop(1, `rgba(205,239,255,${alpha * .18})`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = `rgba(220,245,255,${alpha * .88})`;
  ctx.lineWidth = Math.max(.8, b.r * .075);
  ctx.beginPath();
  ctx.arc(0, 0, b.r - 1, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = Math.max(.8, b.r * .1);
  ctx.beginPath();
  ctx.arc(-b.r * .18, -b.r * .2, b.r * .5, Math.PI * 1.05, Math.PI * 1.48);
  ctx.stroke();
  ctx.restore();
}

function nearestForegroundBubble(item: Creature): Point {
  const candidate = bubbles
    .filter((b) => b.depth >= .62)
    .sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))[0];
  return candidate
    ? { x: candidate.x, y: candidate.y + candidate.r * 1.4 }
    : { x: width * streams[Math.floor(Math.random() * streams.length)], y: height * rand(.28, .76) };
}

function routeVelocity(item: Creature, now: number): Point {
  const route = item.preset.route;
  const t = now * .001 + item.phase;

  if (route === "top-glide") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .72) * 5.5 };
  if (route === "mid-arc") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .45) * 12 };
  if (route === "bottom-wander") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .92) * 8 + Math.sin(t * .31) * 4 };
  if (route === "deep-curve") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .34) * 15 };
  if (route === "shark-sweep") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .22) * 7 };
  if (route === "shark-deep") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .3) * 9 };
  return { x: Math.sin(t * .35) * 4, y: -item.baseSpeed + Math.sin(t * .5) * 2.2 };
}

function updateCreature(item: Creature, dt: number, now: number) {
  if (now < item.nextSpawn) return;

  if (item.state === "startled" && now >= item.until) {
    item.state = "glance";
    item.until = now + 520;
  } else if (item.state === "glance" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 6200;
  } else if (item.state === "follow" && now >= item.followUntil) {
    item.state = "cruise";
  } else if (item.state === "hide" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 2900;
    item.hideTarget = null;
  }

  if (item.preset.kind !== "jelly" && item.state === "follow" && pointer.visible) {
    const dist = Math.hypot(pointer.x - item.x, pointer.y - item.y);
    if (dist < 130) {
      item.state = "hide";
      item.until = now + rand(1250, 1900);
      item.hideTarget = nearestForegroundBubble(item);
    }
  }

  let target: Point | null = null;
  if (item.state === "hide") target = item.hideTarget;
  if (item.state === "follow" && pointer.visible && item.preset.kind !== "jelly") {
    const side = pointer.x < width / 2 ? 1 : -1;
    target = {
      x: pointer.x + side * (190 + item.size),
      y: pointer.y + Math.sin(now * .002 + item.phase) * 52,
    };
  }

  if (target) {
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = item.baseSpeed * (item.state === "hide" ? 2.1 : 1.18);
    item.vx += ((dx / distance) * desired - item.vx) * Math.min(1, dt * 2);
    item.vy += ((dy / distance) * desired - item.vy) * Math.min(1, dt * 2);
  } else if (item.state === "cruise") {
    const desired = routeVelocity(item, now);
    const response = item.preset.kind === "jelly" ? .45 : .72;
    item.vx += (desired.x - item.vx) * Math.min(1, dt * response);
    item.vy += (desired.y - item.vy) * Math.min(1, dt * response);
  } else if (item.state === "glance") {
    item.vx *= Math.pow(.93, dt * 60);
    item.vy *= Math.pow(.93, dt * 60);
  }

  const speed = Math.hypot(item.vx, item.vy);
  const max = item.baseSpeed * (item.state === "startled" ? 3.1 : 2.2);
  if (speed > max) {
    item.vx = item.vx / speed * max;
    item.vy = item.vy / speed * max;
  }

  if (item.preset.kind !== "jelly" && Math.abs(item.vx) > 2) item.direction = item.vx >= 0 ? 1 : -1;
  item.x += item.vx * dt;
  item.y += item.vy * dt;
  item.annoyed = Math.max(0, item.annoyed - dt * .14);

  if (item.preset.kind === "jelly") {
    if (item.y < -item.size * 1.7) resetCreature(item, now);
    item.x = clamp(item.x, item.size * .7, width - item.size * .7);
    return;
  }

  item.y = clamp(item.y, item.size * .6, height - item.size * .6);
  const margin = item.size * 3.1;
  if (item.state === "cruise" && (item.x < -margin || item.x > width + margin)) resetCreature(item, now);
}

function drawCreature(item: Creature, now: number) {
  if (!ctx || !spriteAtlas || !spriteReady || now < item.nextSpawn) return;

  const fast = item.state === "startled" || item.state === "hide";
  const frameRate = item.preset.kind === "jelly" ? 430 : fast ? 90 : item.preset.kind === "shark" ? 260 : 180;
  const frame = Math.floor((now + item.phase * 1000) / frameRate) % 2;
  const sx = item.preset.sprite * SPRITE_W;
  const sy = frame * SPRITE_H;
  const aspect = SPRITE_W / SPRITE_H;
  const drawH = item.size;
  const drawW = drawH * aspect;
  const angle = item.preset.kind === "jelly" ? Math.sin(now * .0007 + item.phase) * .04 : Math.atan2(item.vy, Math.max(10, Math.abs(item.vx))) * item.direction;
  const pulse = item.preset.kind === "jelly" ? 1 + Math.sin(now * .004 + item.phase) * .035 : 1;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(angle);
  if (item.preset.kind !== "jelly") ctx.scale(item.direction, 1);
  ctx.scale(1, pulse);
  ctx.globalAlpha = (.58 + item.depth * .34) * (item.state === "hide" ? .68 : 1);
  ctx.drawImage(spriteAtlas, sx, sy, SPRITE_W, SPRITE_H, -drawW / 2, -drawH / 2, drawW, drawH);

  if (item.annoyed > 0 && item.preset.kind !== "jelly") {
    ctx.strokeStyle = "rgba(24, 24, 42, .72)";
    ctx.lineWidth = Math.max(1.4, item.size * .022);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(drawW * .2, -drawH * .17);
    ctx.lineTo(drawW * .3, -drawH * .12);
    ctx.stroke();
  }

  ctx.restore();
}

function updateBursts(dt: number) {
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    bursts[i].age += dt * 1000;
    if (bursts[i].age > 420) bursts.splice(i, 1);
  }
}

function drawBurst(b: Burst) {
  if (!ctx) return;
  const p = clamp(b.age / 420, 0, 1);
  ctx.save();
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = "rgba(225,246,255,.85)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius * (.8 + p * 1.45), 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(210,240,255,.78)";
  for (const spark of b.sparks) {
    ctx.beginPath();
    ctx.arc(
      b.x + Math.cos(spark.angle) * spark.distance * p,
      b.y + Math.sin(spark.angle) * spark.distance * p,
      spark.size * (1 - p * .45),
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
}

function render(now: number) {
  if (!running || !ctx) return;
  const dt = Math.min(.034, Math.max(.001, (now - (last || now)) / 1000));
  last = now;

  ctx.clearRect(0, 0, width, height);
  drawWater(now);
  updateBubbles(dt, now);
  updateBursts(dt);
  for (const item of creatures) updateCreature(item, dt, now);

  for (const b of bubbles) drawBubble(b, false);
  for (const item of creatures.filter((c) => c.depth < .62)) drawCreature(item, now);
  for (const item of creatures.filter((c) => c.depth >= .62)) drawCreature(item, now);
  for (const b of bubbles) drawBubble(b, true);
  for (const b of bursts) drawBurst(b);

  raf = requestAnimationFrame(render);
}

function start() {
  if (running || !shouldRun()) return;
  running = true;
  resize();
  const now = performance.now();
  initScene(now);
  last = now;
  raf = requestAnimationFrame(render);
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
  raf = 0;
  const canvas = canvasRef.value;
  const local = canvas?.getContext("2d");
  if (canvas && local) local.clearRect(0, 0, canvas.width, canvas.height);
}

function sync() {
  if (shouldRun()) start();
  else stop();
}

function onPointerMove(event: PointerEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.visible = true;
}

function onPointerLeave() {
  pointer.visible = false;
}

function isUiTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "a,button,input,select,textarea,summary,[role='button'],[role='link'],[contenteditable='true'],[data-underwater-ignore]",
  ));
}

function onPointerDown(event: PointerEvent) {
  if (!running || isUiTarget(event.target)) return;
  const x = event.clientX;
  const y = event.clientY;

  let bubbleIndex = -1;
  let bestBubble = Infinity;
  bubbles.forEach((b, i) => {
    const d = Math.hypot(x - b.x, y - b.y);
    if (d <= Math.max(11, b.r * 1.4) && d < bestBubble) {
      bestBubble = d;
      bubbleIndex = i;
    }
  });

  if (bubbleIndex >= 0) {
    const b = bubbles[bubbleIndex];
    bursts.push({
      x: b.x,
      y: b.y,
      radius: b.r,
      age: 0,
      sparks: Array.from({ length: 7 }, () => ({ angle: rand(0, TAU), distance: rand(b.r * 1.7, b.r * 3.7), size: rand(.7, 1.8) })),
    });
    resetBubble(b);
    return;
  }

  const now = performance.now();
  const candidates = [...creatures]
    .filter((item) => now >= item.nextSpawn)
    .sort((a, b) => b.depth - a.depth);

  for (const item of candidates) {
    const rx = item.size * (item.preset.kind === "jelly" ? .95 : 1.45);
    const ry = item.size * (item.preset.kind === "jelly" ? .8 : .62);
    const dx = (x - item.x) / rx;
    const dy = (y - item.y) / ry;
    if (dx * dx + dy * dy > 1) continue;

    let ax = item.x - x;
    let ay = item.y - y;
    const len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;

    if (item.preset.kind === "jelly") {
      item.vx += ax * item.baseSpeed * 1.5;
      item.vy = -item.baseSpeed * 1.9 + ay * item.baseSpeed;
      item.annoyed = 1;
      return;
    }

    item.state = "startled";
    item.until = now + 620;
    item.annoyed = 1;
    item.hideTarget = null;
    item.vx = ax * item.baseSpeed * 2.9 + item.direction * item.baseSpeed;
    item.vy = ay * item.baseSpeed * 2.2;
    return;
  }
}

onMounted(() => {
  spriteAtlas = new Image();
  spriteAtlas.decoding = "async";
  spriteAtlas.src = "/images/easter-eggs/underwater-creatures.svg";
  spriteAtlas.onload = () => { spriteReady = true; };

  desktopMq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
  motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  desktopMq.addEventListener("change", sync);
  motionMq.addEventListener("change", sync);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("blur", onPointerLeave);
  document.addEventListener("visibilitychange", sync);
  sync();
});

onBeforeUnmount(() => {
  stop();
  desktopMq?.removeEventListener("change", sync);
  motionMq?.removeEventListener("change", sync);
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("blur", onPointerLeave);
  document.removeEventListener("visibilitychange", sync);
});
</script>

<template>
  <canvas ref="canvasRef" class="underwater-ambient" aria-hidden="true" />
</template>

<style scoped>
.underwater-ambient {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: none;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  user-select: none;
}

@media (min-width: 1200px) and (prefers-reduced-motion: no-preference) {
  .underwater-ambient { display: block; }
}
</style>
