<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);

const MIN_WIDTH = 1200;
const MAX_DPR = 1.5;
const BUBBLE_COUNT = 22;
const FISH_COUNT = 3;
const TAU = Math.PI * 2;

type Point = { x: number; y: number };
type FishState = "cruise" | "startled" | "glance" | "follow" | "hide";

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

type Fish = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSpeed: number;
  direction: 1 | -1;
  phase: number;
  depth: number;
  hue: number;
  variant: number;
  state: FishState;
  until: number;
  followUntil: number;
  hideTarget: Point | null;
  annoyed: number;
};

let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let raf = 0;
let running = false;
let last = 0;
let desktopMq: MediaQueryList | null = null;
let motionMq: MediaQueryList | null = null;

const bubbles: Bubble[] = [];
const bursts: Burst[] = [];
const fish: Fish[] = [];
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

function createFish(variant: number, startVisible = true): Fish {
  const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
  const size = [62, 72, 52][variant % 3] * rand(0.92, 1.12);
  const baseSpeed = rand(26, 39);
  const startX = startVisible
    ? rand(width * 0.05, width * 0.95)
    : direction === 1 ? -size * 2.5 : width + size * 2.5;

  return {
    x: startX,
    y: rand(height * 0.16, height * 0.84),
    vx: baseSpeed * direction,
    vy: rand(-4, 4),
    size,
    baseSpeed,
    direction,
    phase: rand(0, TAU),
    depth: rand(0.4, 0.95),
    hue: [196, 322, 270][variant % 3],
    variant,
    state: "cruise",
    until: 0,
    followUntil: 0,
    hideTarget: null,
    annoyed: 0,
  };
}

function resetFish(item: Fish) {
  Object.assign(item, createFish(item.variant, false));
}

function initScene() {
  bubbles.splice(0, bubbles.length, ...Array.from({ length: BUBBLE_COUNT }, () => createBubble(true)));
  fish.splice(0, fish.length, ...Array.from({ length: FISH_COUNT }, (_, i) => createFish(i, true)));
  bursts.length = 0;
}

function drawWater(time: number) {
  if (!ctx) return;

  const haze = ctx.createLinearGradient(0, 0, 0, height);
  haze.addColorStop(0, "rgba(72, 170, 235, .045)");
  haze.addColorStop(.45, "rgba(28, 105, 175, .018)");
  haze.addColorStop(1, "rgba(5, 40, 95, .035)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let band = 0; band < 4; band += 1) {
    ctx.beginPath();
    const baseY = height * (.08 + band * .15);
    for (let x = -30; x <= width + 30; x += 18) {
      const y = baseY
        + Math.sin(x * .007 + time * .00022 + band * 1.35) * (4.5 + band)
        + Math.sin(x * .0027 - time * .00016) * 2.5;
      if (x === -30) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(125, 211, 255, ${.026 - band * .003})`;
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }

  const gx = width * (.66 + Math.sin(time * .00007) * .045);
  const glow = ctx.createRadialGradient(gx, -40, 0, gx, 0, height * .62);
  glow.addColorStop(0, "rgba(120, 220, 255, .065)");
  glow.addColorStop(1, "rgba(120, 220, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height * .7);
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

function nearestForegroundBubble(item: Fish): Point {
  const candidate = bubbles
    .filter((b) => b.depth >= .62)
    .sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))[0];
  return candidate
    ? { x: candidate.x, y: candidate.y + candidate.r * 1.4 }
    : { x: width * streams[Math.floor(Math.random() * streams.length)], y: height * rand(.28, .76) };
}

function updateFish(item: Fish, dt: number, now: number) {
  if (item.state === "startled" && now >= item.until) {
    item.state = "glance";
    item.until = now + 480;
  } else if (item.state === "glance" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 6500;
  } else if (item.state === "follow" && now >= item.followUntil) {
    item.state = "cruise";
  } else if (item.state === "hide" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 3200;
    item.hideTarget = null;
  }

  if (item.state === "follow" && pointer.visible) {
    const dist = Math.hypot(pointer.x - item.x, pointer.y - item.y);
    if (dist < 125) {
      item.state = "hide";
      item.until = now + rand(1200, 1900);
      item.hideTarget = nearestForegroundBubble(item);
    }
  }

  let target: Point | null = null;
  if (item.state === "hide") target = item.hideTarget;
  if (item.state === "follow" && pointer.visible) {
    const side = pointer.x < width / 2 ? 1 : -1;
    target = {
      x: pointer.x + side * (175 + item.size),
      y: pointer.y + Math.sin(now * .002 + item.phase) * 48,
    };
  }

  if (target) {
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = item.baseSpeed * (item.state === "hide" ? 2.1 : 1.2);
    item.vx += ((dx / distance) * desired - item.vx) * Math.min(1, dt * 2);
    item.vy += ((dy / distance) * desired - item.vy) * Math.min(1, dt * 2);
  } else if (item.state === "cruise") {
    item.vx += (item.baseSpeed * item.direction - item.vx) * Math.min(1, dt * .8);
    item.vy += (Math.sin(now * .0007 + item.phase) * 9 - item.vy) * Math.min(1, dt * .7);
  } else if (item.state === "glance") {
    item.vx *= Math.pow(.93, dt * 60);
    item.vy *= Math.pow(.93, dt * 60);
  }

  const speed = Math.hypot(item.vx, item.vy);
  const max = item.baseSpeed * (item.state === "startled" ? 3.2 : 2.25);
  if (speed > max) {
    item.vx = item.vx / speed * max;
    item.vy = item.vy / speed * max;
  }

  if (Math.abs(item.vx) > 2) item.direction = item.vx >= 0 ? 1 : -1;
  item.x += item.vx * dt;
  item.y = clamp(item.y + item.vy * dt, item.size * .65, height - item.size * .65);
  item.annoyed = Math.max(0, item.annoyed - dt * .14);

  const margin = item.size * 3;
  if (item.state === "cruise" && (item.x < -margin || item.x > width + margin)) resetFish(item);
}

function drawFish(item: Fish, now: number) {
  if (!ctx) return;

  const fast = item.state === "startled" || item.state === "hide";
  const tail = Math.sin(now * (fast ? .019 : .011) + item.phase);
  const bodyW = item.size * (item.variant === 0 ? 1.7 : 1.48);
  const bodyH = item.size * (item.variant === 1 ? .78 : .62);
  const angle = Math.atan2(item.vy, Math.abs(item.vx)) * item.direction;

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(item.direction, 1);
  ctx.rotate(angle);
  ctx.globalAlpha = (.66 + item.depth * .25) * (item.state === "hide" ? .7 : 1);

  ctx.save();
  ctx.translate(-bodyW * .47, 0);
  ctx.rotate(tail * .24);
  ctx.fillStyle = `hsl(${item.hue + 12} 68% 55%)`;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.quadraticCurveTo(-item.size * .45, -item.size * .44, -item.size * .65, -item.size * .3);
  ctx.quadraticCurveTo(-item.size * .49, 0, -item.size * .65, item.size * .3);
  ctx.quadraticCurveTo(-item.size * .43, item.size * .44, 3, 0);
  ctx.fill();
  ctx.restore();

  const body = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
  body.addColorStop(0, `hsl(${item.hue} 74% 70%)`);
  body.addColorStop(.58, `hsl(${item.hue + 8} 68% 54%)`);
  body.addColorStop(1, `hsl(${item.hue + 17} 64% 40%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,.14)";
  ctx.beginPath();
  ctx.ellipse(bodyW * .08, bodyH * .16, bodyW * .32, bodyH * .15, -.08, 0, TAU);
  ctx.fill();

  ctx.fillStyle = `hsl(${item.hue - 7} 67% 48%)`;
  ctx.beginPath();
  ctx.moveTo(-bodyW * .04, -bodyH * .4);
  ctx.quadraticCurveTo(0, -bodyH * .88, bodyW * .18, -bodyH * .37);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(bodyW * .02, bodyH * .2);
  ctx.rotate(.18 + tail * .12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(item.size * .2, item.size * .36, item.size * .42, item.size * .27);
  ctx.quadraticCurveTo(item.size * .22, item.size * .04, 0, 0);
  ctx.fill();
  ctx.restore();

  const eyeX = bodyW * .29;
  const eyeY = -bodyH * .1;
  const looking = item.state === "glance" && pointer.visible;
  const px = looking ? clamp((pointer.x - item.x) * item.direction / 150, -3, 3) : 1.4;
  const py = looking ? clamp((pointer.y - item.y) / 150, -2.2, 2.2) : 0;

  ctx.fillStyle = "rgba(250,253,255,.98)";
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, item.size * .098, item.size * (item.annoyed ? .073 : .1), 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(7,13,25,.98)";
  ctx.beginPath();
  ctx.arc(eyeX + px, eyeY + py, item.size * .039, 0, TAU);
  ctx.fill();

  if (item.annoyed) {
    ctx.strokeStyle = "rgba(23,20,38,.8)";
    ctx.lineWidth = Math.max(1.2, item.size * .026);
    ctx.beginPath();
    ctx.moveTo(eyeX - item.size * .08, eyeY - item.size * .08);
    ctx.lineTo(eyeX + item.size * .08, eyeY - item.size * .035);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(20,22,40,.55)";
  ctx.lineWidth = Math.max(1.1, item.size * .018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(bodyW * .36, bodyH * .08, item.size * .09, .2, 1.25);
  ctx.stroke();
  ctx.restore();
}

function updateBursts(dt: number) {
  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    bursts[i].age += dt;
    if (bursts[i].age >= 1) bursts.splice(i, 1);
  }
}

function drawBursts() {
  if (!ctx) return;
  for (const burst of bursts) {
    const p = burst.age;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = "rgba(226,247,255,.9)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, burst.radius * (.8 + p * 1.5), 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "rgba(215,242,255,.85)";
    for (const spark of burst.sparks) {
      ctx.beginPath();
      ctx.arc(
        burst.x + Math.cos(spark.angle) * spark.distance * p,
        burst.y + Math.sin(spark.angle) * spark.distance * p,
        spark.size * (1 - p * .45),
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.restore();
  }
}

function frame(now: number) {
  if (!running || !ctx) return;
  const dt = Math.min(.034, Math.max(.001, (now - (last || now)) / 1000));
  last = now;

  ctx.clearRect(0, 0, width, height);
  drawWater(now);
  updateBubbles(dt, now);
  updateBursts(dt * 2.6);
  for (const b of bubbles) drawBubble(b, false);
  for (const item of fish) {
    updateFish(item, dt, now);
    drawFish(item, now);
  }
  for (const b of bubbles) drawBubble(b, true);
  drawBursts();
  raf = requestAnimationFrame(frame);
}

function start() {
  if (running || !shouldRun()) return;
  running = true;
  resize();
  initScene();
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
  raf = 0;
  const canvas = canvasRef.value;
  if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
}

function sync() {
  if (shouldRun()) start();
  else stop();
}

function isUi(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "a,button,input,select,textarea,summary,[role='button'],[role='link'],[contenteditable='true'],[data-underwater-ignore]",
  ));
}

function onPointerMove(event: PointerEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.visible = true;
}

function onPointerDown(event: PointerEvent) {
  if (!running || isUi(event.target)) return;
  const x = event.clientX;
  const y = event.clientY;

  let bubble: Bubble | null = null;
  let nearest = Infinity;
  for (const b of bubbles) {
    const distance = Math.hypot(x - b.x, y - b.y);
    if (distance <= Math.max(12, b.r * 1.45) && distance < nearest) {
      bubble = b;
      nearest = distance;
    }
  }

  if (bubble) {
    bursts.push({
      x: bubble.x,
      y: bubble.y,
      radius: bubble.r,
      age: 0,
      sparks: Array.from({ length: 7 }, () => ({
        angle: rand(0, TAU),
        distance: rand(bubble!.r * 1.8, bubble!.r * 3.8),
        size: rand(.8, 1.8),
      })),
    });
    resetBubble(bubble);
    return;
  }

  const now = performance.now();
  for (const item of [...fish].sort((a, b) => b.depth - a.depth)) {
    const dx = (x - item.x) / (item.size * 1.15);
    const dy = (y - item.y) / (item.size * .62);
    if (dx * dx + dy * dy > 1) continue;

    let ax = item.x - x;
    let ay = item.y - y;
    const length = Math.hypot(ax, ay) || 1;
    ax /= length;
    ay /= length;
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
  desktopMq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
  motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  desktopMq.addEventListener("change", sync);
  motionMq.addEventListener("change", sync);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("blur", () => { pointer.visible = false; });
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
