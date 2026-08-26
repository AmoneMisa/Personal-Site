<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const canvasRef = ref<HTMLCanvasElement | null>(null);

const TAU = Math.PI * 2;
const MAX_DPR = 1.5;

type Bubble = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
  depth: number;
};

type Burst = {
  x: number;
  y: number;
  age: number;
  ttl: number;
  radius: number;
  seed: number;
};

let ctx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let raf = 0;
let last = 0;
let running = false;
let reducedMotion: MediaQueryList | null = null;
let bubbles: Bubble[] = [];
let bursts: Burst[] = [];

const random = (min: number, max: number) => min + Math.random() * (max - min);

function bubbleCount() {
  if (width < 640) return 18;
  if (width < 1024) return 28;
  return 42;
}

function makeBubble(anywhere = false): Bubble {
  const depth = Math.random();
  const streams = width < 720 ? [0.1, 0.34, 0.68, 0.9] : [0.05, 0.16, 0.31, 0.49, 0.67, 0.82, 0.95];
  const stream = streams[Math.floor(Math.random() * streams.length)] ?? 0.5;
  const radius = random(3.4, 10.5) * (0.72 + depth * 0.58);

  return {
    x: Math.max(radius + 2, Math.min(width - radius - 2, stream * width + random(-46, 46))),
    y: anywhere ? random(-20, height + 20) : height + random(12, Math.max(80, height * 0.22)),
    radius,
    speed: random(15, 34) * (0.72 + depth * 0.58),
    drift: random(7, 19),
    phase: random(0, TAU),
    depth,
  };
}

function resetBubble(bubble: Bubble) {
  Object.assign(bubble, makeBubble(false));
}

function bubbleX(bubble: Bubble, now: number) {
  return bubble.x + Math.sin(now * 0.00072 + bubble.phase) * bubble.drift;
}

function popBubble(bubble: Bubble, now: number) {
  bursts.push({
    x: bubbleX(bubble, now),
    y: bubble.y,
    age: 0,
    ttl: random(0.34, 0.48),
    radius: bubble.radius,
    seed: Math.random() * TAU,
  });
  resetBubble(bubble);
}

function configureCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, Math.round(bounds.width || window.innerWidth));
  height = Math.max(1, Math.round(bounds.height || window.innerHeight));
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx = canvas.getContext("2d", { alpha: true });
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

  const target = bubbleCount();
  if (!bubbles.length) bubbles = Array.from({ length: target }, () => makeBubble(true));
  else if (bubbles.length < target) bubbles.push(...Array.from({ length: target - bubbles.length }, () => makeBubble(true)));
  else if (bubbles.length > target) bubbles.length = target;
}

function drawBubble(bubble: Bubble, now: number) {
  if (!ctx) return;

  const x = bubbleX(bubble, now);
  const r = bubble.radius;
  const alpha = 0.28 + bubble.depth * 0.34;

  ctx.save();
  ctx.translate(x, bubble.y);

  const fill = ctx.createRadialGradient(-r * 0.34, -r * 0.38, r * 0.06, 0, 0, r);
  fill.addColorStop(0, `rgba(255,255,255,${alpha * 0.95})`);
  fill.addColorStop(0.2, `rgba(214,242,255,${alpha * 0.22})`);
  fill.addColorStop(0.68, `rgba(78,160,227,${alpha * 0.045})`);
  fill.addColorStop(1, `rgba(207,241,255,${alpha * 0.12})`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = `rgba(221,246,255,${alpha * 0.72})`;
  ctx.lineWidth = Math.max(0.65, r * 0.075);
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(0.5, r - 0.8), 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.82})`;
  ctx.lineWidth = Math.max(0.6, r * 0.09);
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.08, r * 0.52, Math.PI * 1.06, Math.PI * 1.48);
  ctx.stroke();
  ctx.restore();
}

function drawBurst(burst: Burst) {
  if (!ctx) return;
  const progress = Math.min(1, burst.age / burst.ttl);
  const alpha = 1 - progress;
  const spread = burst.radius * (1.15 + progress * 2.4);

  ctx.save();
  ctx.translate(burst.x, burst.y);
  ctx.strokeStyle = `rgba(224,248,255,${0.8 * alpha})`;
  ctx.lineWidth = Math.max(0.7, burst.radius * 0.1 * alpha);
  ctx.beginPath();
  ctx.arc(0, 0, spread, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = `rgba(235,250,255,${0.78 * alpha})`;
  for (let i = 0; i < 7; i += 1) {
    const angle = burst.seed + (i / 7) * TAU;
    const distance = spread * (0.55 + (i % 3) * 0.16);
    const particleRadius = Math.max(0.7, burst.radius * (0.16 - progress * 0.08));
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, particleRadius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function frame(now: number) {
  if (!running || !ctx) return;

  const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 0.05);
  last = now;
  ctx.clearRect(0, 0, width, height);

  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * dt;
    bubble.x += Math.sin(now * 0.00018 + bubble.phase) * 0.7 * dt;
    if (bubble.y < -bubble.radius * 3) resetBubble(bubble);
    drawBubble(bubble, now);
  }

  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    const burst = bursts[i]!;
    burst.age += dt;
    if (burst.age >= burst.ttl) {
      bursts.splice(i, 1);
      continue;
    }
    drawBurst(burst);
  }

  raf = requestAnimationFrame(frame);
}

function handlePointerDown(event: PointerEvent) {
  if (reducedMotion?.matches) return;
  const now = performance.now();
  let best: Bubble | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const bubble of bubbles) {
    const dx = bubbleX(bubble, now) - event.clientX;
    const dy = bubble.y - event.clientY;
    const distance = Math.hypot(dx, dy);
    const hitRadius = Math.max(13, bubble.radius + 8);
    if (distance <= hitRadius && distance < bestDistance) {
      best = bubble;
      bestDistance = distance;
    }
  }

  if (best) popBubble(best, now);
}

function start() {
  if (running || document.hidden || reducedMotion?.matches) return;
  running = true;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop(clear = false) {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (clear) ctx?.clearRect(0, 0, width, height);
}

function syncState() {
  if (document.hidden || reducedMotion?.matches) stop(true);
  else start();
}

function handleResize() {
  configureCanvas();
  if (!reducedMotion?.matches && !document.hidden) start();
}

onMounted(() => {
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  reducedMotion.addEventListener("change", syncState);
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.addEventListener("visibilitychange", syncState);
  configureCanvas();
  syncState();
});

onBeforeUnmount(() => {
  stop(true);
  reducedMotion?.removeEventListener("change", syncState);
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("visibilitychange", syncState);
  bubbles = [];
  bursts = [];
  ctx = null;
});
</script>

<template>
  <canvas ref="canvasRef" class="ocean-bubbles" aria-hidden="true" />
</template>

<style scoped>
.ocean-bubbles {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.92;
}

@media (max-width: 720px) {
  .ocean-bubbles {
    opacity: 0.8;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ocean-bubbles {
    display: none;
  }
}
</style>
