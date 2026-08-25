<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";

const route = useRoute();

const canvasRef = ref<HTMLCanvasElement | null>(null);

const DESKTOP_MIN_WIDTH = 1440;
const MAX_DPR = 1.5;
const TARGET_BUBBLES = 24;
const TARGET_FISH = 3;
const TWO_PI = Math.PI * 2;

type FishState = "cruise" | "startled" | "glance" | "follow" | "hide";

type Vec2 = { x: number; y: number };

type Bubble = {
  x: number;
  y: number;
  r: number;
  depth: number;
  speed: number;
  drift: number;
  phase: number;
  wobble: number;
  stream: number;
};

type Pop = {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
  sparks: Array<{ angle: number; speed: number; radius: number }>;
};

type Fish = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSpeed: number;
  size: number;
  depth: number;
  phase: number;
  hue: number;
  variant: number;
  direction: 1 | -1;
  state: FishState;
  stateUntil: number;
  followUntil: number;
  hideTarget: Vec2 | null;
  annoyed: number;
};

let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let lastTime = 0;
let width = 0;
let height = 0;
let dpr = 1;
let active = false;
let mediaDesktop: MediaQueryList | null = null;
let mediaMotion: MediaQueryList | null = null;

const bubbles: Bubble[] = [];
const pops: Pop[] = [];
const fish: Fish[] = [];
const pointer = { x: -10_000, y: -10_000, visible: false };

const streamX = [0.08, 0.23, 0.76, 0.92];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function routeAllowsAmbient() {
  return !/(^|\/)cv(\/|$)/i.test(route.path);
}

function shouldRun() {
  return Boolean(
    mediaDesktop?.matches &&
    !mediaMotion?.matches &&
    routeAllowsAmbient()
  );
}

function resizeCanvas() {
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

function makeBubble(fromBottom = false): Bubble {
  const depth = Math.random();
  const stream = Math.floor(Math.random() * streamX.length);
  const baseX = streamX[stream] * width;
  const r = rand(3.5, 10) * (0.55 + depth * 0.85);

  return {
    x: clamp(baseX + rand(-45, 45), 12, Math.max(12, width - 12)),
    y: fromBottom ? height + rand(10, height * 0.22) : rand(0, height),
    r,
    depth,
    speed: rand(18, 42) * (0.72 + depth * 0.62),
    drift: rand(-5, 5),
    phase: rand(0, TWO_PI),
    wobble: rand(8, 26),
    stream,
  };
}

function respawnBubble(bubble: Bubble) {
  Object.assign(bubble, makeBubble(true));
}

function makeFish(index: number): Fish {
  const fromLeft = Math.random() > 0.5;
  const direction: 1 | -1 = fromLeft ? 1 : -1;
  const size = [58, 72, 48][index % 3] * rand(0.9, 1.12);
  const speed = rand(24, 38);

  return {
    x: fromLeft ? -size * 2.4 : width + size * 2.4,
    y: rand(height * 0.16, height * 0.82),
    vx: speed * direction,
    vy: rand(-3, 3),
    baseSpeed: speed,
    size,
    depth: rand(0.35, 0.9),
    phase: rand(0, TWO_PI),
    hue: [195, 320, 268][index % 3],
    variant: index % 3,
    direction,
    state: "cruise",
    stateUntil: 0,
    followUntil: 0,
    hideTarget: null,
    annoyed: 0,
  };
}

function respawnFish(item: Fish, now: number) {
  const fresh = makeFish(item.variant);
  fresh.variant = item.variant;
  fresh.hue = item.hue;
  fresh.stateUntil = now + rand(500, 1500);
  Object.assign(item, fresh);
}

function initScene() {
  bubbles.length = 0;
  pops.length = 0;
  fish.length = 0;

  for (let i = 0; i < TARGET_BUBBLES; i += 1) bubbles.push(makeBubble(false));
  for (let i = 0; i < TARGET_FISH; i += 1) fish.push(makeFish(i));
}

function drawWater(time: number) {
  if (!ctx) return;

  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, "rgba(16, 77, 125, 0.065)");
  g.addColorStop(0.48, "rgba(8, 45, 89, 0.028)");
  g.addColorStop(1, "rgba(2, 18, 48, 0.055)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineWidth = 1.2;

  for (let band = 0; band < 4; band += 1) {
    const baseY = height * (0.09 + band * 0.16);
    ctx.beginPath();
    for (let x = -40; x <= width + 40; x += 22) {
      const y = baseY
        + Math.sin(x * 0.008 + time * 0.00024 + band * 1.7) * (5 + band * 1.3)
        + Math.sin(x * 0.003 - time * 0.00017) * 3;
      if (x === -40) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(102, 194, 255, ${0.018 - band * 0.002})`;
    ctx.stroke();
  }

  const glowX = width * (0.68 + Math.sin(time * 0.00008) * 0.03);
  const glow = ctx.createRadialGradient(glowX, -height * 0.1, 0, glowX, 0, height * 0.58);
  glow.addColorStop(0, "rgba(105, 207, 255, 0.055)");
  glow.addColorStop(1, "rgba(105, 207, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height * 0.68);
  ctx.restore();
}

function drawBubble(b: Bubble, foreground: boolean) {
  if (!ctx) return;
  const isForeground = b.depth >= 0.62;
  if (isForeground !== foreground) return;

  const alpha = 0.16 + b.depth * 0.24;
  ctx.save();
  ctx.translate(b.x, b.y);

  const fill = ctx.createRadialGradient(-b.r * 0.34, -b.r * 0.38, b.r * 0.06, 0, 0, b.r);
  fill.addColorStop(0, `rgba(255,255,255,${alpha * 0.72})`);
  fill.addColorStop(0.16, `rgba(171,226,255,${alpha * 0.16})`);
  fill.addColorStop(0.67, `rgba(74,153,255,${alpha * 0.07})`);
  fill.addColorStop(1, `rgba(183,226,255,${alpha * 0.2})`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, b.r, 0, TWO_PI);
  ctx.fill();

  ctx.strokeStyle = `rgba(214, 240, 255, ${alpha * 0.75})`;
  ctx.lineWidth = Math.max(0.7, b.r * 0.075);
  ctx.beginPath();
  ctx.arc(0, 0, b.r - ctx.lineWidth * 0.5, 0, TWO_PI);
  ctx.stroke();

  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.95})`;
  ctx.lineWidth = Math.max(0.8, b.r * 0.1);
  ctx.beginPath();
  ctx.arc(-b.r * 0.2, -b.r * 0.18, b.r * 0.54, Math.PI * 1.08, Math.PI * 1.52);
  ctx.stroke();

  ctx.restore();
}

function fishTarget(item: Fish, now: number): Vec2 | null {
  if (item.state === "hide" && item.hideTarget) return item.hideTarget;
  if (item.state === "follow" && pointer.visible && now < item.followUntil) {
    const side = pointer.x < width / 2 ? 1 : -1;
    return {
      x: pointer.x + side * (170 + item.size),
      y: pointer.y + Math.sin(now * 0.002 + item.phase) * 55,
    };
  }
  return null;
}

function updateFish(item: Fish, dt: number, now: number) {
  if (item.state === "startled" && now >= item.stateUntil) {
    item.state = "glance";
    item.stateUntil = now + 480;
  } else if (item.state === "glance" && now >= item.stateUntil) {
    item.state = "follow";
    item.followUntil = now + 6500;
  } else if (item.state === "follow" && now >= item.followUntil) {
    item.state = "cruise";
    item.hideTarget = null;
  } else if (item.state === "hide" && now >= item.stateUntil) {
    item.state = "follow";
    item.followUntil = now + 3000;
    item.hideTarget = null;
  }

  if (item.state === "follow" && pointer.visible) {
    const dx = pointer.x - item.x;
    const dy = pointer.y - item.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 125) {
      item.state = "hide";
      item.stateUntil = now + rand(1200, 1900);
      const candidate = bubbles
        .filter((b) => b.depth >= 0.62)
        .sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))[0];
      item.hideTarget = candidate
        ? { x: candidate.x, y: candidate.y + candidate.r * 1.5 }
        : { x: width * streamX[Math.floor(Math.random() * streamX.length)], y: height * rand(0.3, 0.75) };
    }
  }

  const target = fishTarget(item, now);
  if (target) {
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const desired = item.state === "hide" ? item.baseSpeed * 2.1 : item.baseSpeed * 1.18;
    item.vx += ((dx / dist) * desired - item.vx) * Math.min(1, dt * 1.9);
    item.vy += ((dy / dist) * desired - item.vy) * Math.min(1, dt * 1.9);
  } else if (item.state === "cruise") {
    const desiredX = item.baseSpeed * item.direction;
    const desiredY = Math.sin(now * 0.00065 + item.phase) * 9;
    item.vx += (desiredX - item.vx) * Math.min(1, dt * 0.8);
    item.vy += (desiredY - item.vy) * Math.min(1, dt * 0.65);
  } else if (item.state === "glance") {
    item.vx *= Math.pow(0.93, dt * 60);
    item.vy *= Math.pow(0.93, dt * 60);
  }

  const speed = Math.hypot(item.vx, item.vy);
  const maxSpeed = item.baseSpeed * (item.state === "startled" ? 3.2 : 2.25);
  if (speed > maxSpeed) {
    item.vx = item.vx / speed * maxSpeed;
    item.vy = item.vy / speed * maxSpeed;
  }

  if (Math.abs(item.vx) > 2) item.direction = item.vx >= 0 ? 1 : -1;
  item.x += item.vx * dt;
  item.y += item.vy * dt;
  item.y = clamp(item.y, item.size * 0.7, height - item.size * 0.7);
  item.annoyed = Math.max(0, item.annoyed - dt * 0.12);

  const margin = item.size * 3.2;
  if (item.state === "cruise" && (item.x < -margin || item.x > width + margin)) {
    respawnFish(item, now);
  }
}

function drawFish(item: Fish, time: number) {
  if (!ctx) return;

  const angle = Math.atan2(item.vy, Math.abs(item.vx)) * item.direction;
  const tail = Math.sin(time * (item.state === "startled" || item.state === "hide" ? 0.018 : 0.010) + item.phase);
  const bodyW = item.size * (item.variant === 0 ? 1.7 : 1.45);
  const bodyH = item.size * (item.variant === 1 ? 0.78 : 0.62);
  const alpha = (0.42 + item.depth * 0.34) * (item.state === "hide" ? 0.66 : 1);

  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(item.direction, 1);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  const tailX = -bodyW * 0.48;
  ctx.save();
  ctx.translate(tailX, 0);
  ctx.rotate(tail * 0.22);
  ctx.fillStyle = `hsla(${item.hue + 12}, 68%, 55%, 0.9)`;
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.quadraticCurveTo(-item.size * 0.46, -item.size * 0.45, -item.size * 0.62, -item.size * 0.3);
  ctx.quadraticCurveTo(-item.size * 0.48, 0, -item.size * 0.62, item.size * 0.3);
  ctx.quadraticCurveTo(-item.size * 0.42, item.size * 0.43, 2, 0);
  ctx.fill();
  ctx.restore();

  const body = ctx.createLinearGradient(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2);
  body.addColorStop(0, `hsl(${item.hue}, 72%, 68%)`);
  body.addColorStop(0.58, `hsl(${item.hue + 9}, 67%, 53%)`);
  body.addColorStop(1, `hsl(${item.hue + 18}, 64%, 39%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, TWO_PI);
  ctx.fill();

  // Soft belly highlight keeps the procedural fish in the same friendly, rounded mascot language.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.ellipse(bodyW * 0.08, bodyH * 0.16, bodyW * 0.33, bodyH * 0.16, -0.08, 0, TWO_PI);
  ctx.fill();

  ctx.fillStyle = `hsla(${item.hue - 8}, 68%, 48%, 0.88)`;
  ctx.beginPath();
  ctx.moveTo(-bodyW * 0.05, -bodyH * 0.42);
  ctx.quadraticCurveTo(-bodyW * 0.02, -bodyH * 0.88, bodyW * 0.18, -bodyH * 0.38);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  ctx.translate(bodyW * 0.02, bodyH * 0.2);
  ctx.rotate(0.18 + tail * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(item.size * 0.2, item.size * 0.36, item.size * 0.42, item.size * 0.28);
  ctx.quadraticCurveTo(item.size * 0.22, item.size * 0.05, 0, 0);
  ctx.fill();
  ctx.restore();

  const eyeX = bodyW * 0.29;
  const eyeY = -bodyH * 0.1;
  const glance = item.state === "glance" && pointer.visible;
  const pupilShiftX = glance ? clamp((pointer.x - item.x) * item.direction / 160, -2.7, 2.7) : 1.4;
  const pupilShiftY = glance ? clamp((pointer.y - item.y) / 160, -2, 2) : 0;

  ctx.fillStyle = "rgba(248, 252, 255, 0.95)";
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, item.size * 0.095, item.size * (item.annoyed > 0 ? 0.072 : 0.1), -0.06, 0, TWO_PI);
  ctx.fill();

  ctx.fillStyle = "rgba(8, 15, 28, 0.95)";
  ctx.beginPath();
  ctx.arc(eyeX + pupilShiftX, eyeY + pupilShiftY, item.size * 0.038, 0, TWO_PI);
  ctx.fill();

  if (item.annoyed > 0) {
    ctx.strokeStyle = "rgba(26, 22, 39, 0.76)";
    ctx.lineWidth = Math.max(1.2, item.size * 0.026);
    ctx.beginPath();
    ctx.moveTo(eyeX - item.size * 0.08, eyeY - item.size * 0.08);
    ctx.lineTo(eyeX + item.size * 0.08, eyeY - item.size * 0.035);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(23, 24, 43, 0.48)";
  ctx.lineWidth = Math.max(1.1, item.size * 0.018);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(bodyW * 0.36, bodyH * 0.08, item.size * 0.09, 0.2, 1.25);
  ctx.stroke();

  ctx.restore();
}

function drawPop(pop: Pop) {
  if (!ctx) return;
  const p = clamp(pop.age / pop.life, 0, 1);
  const alpha = 1 - p;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(220, 244, 255, 0.78)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(pop.x, pop.y, pop.size * (0.75 + p * 1.45), 0, TWO_PI);
  ctx.stroke();

  ctx.fillStyle = "rgba(206, 239, 255, 0.72)";
  for (const spark of pop.sparks) {
    const distance = spark.speed * p;
    ctx.beginPath();
    ctx.arc(
      pop.x + Math.cos(spark.angle) * distance,
      pop.y + Math.sin(spark.angle) * distance,
      spark.radius * (1 - p * 0.45),
      0,
      TWO_PI,
    );
    ctx.fill();
  }
  ctx.restore();
}

function update(dt: number, now: number) {
  for (const b of bubbles) {
    b.y -= b.speed * dt;
    b.x += (b.drift + Math.sin(now * 0.0011 + b.phase) * b.wobble * 0.13) * dt;
    if (b.y < -b.r * 3 || b.x < -80 || b.x > width + 80) respawnBubble(b);
  }

  for (const item of fish) updateFish(item, dt, now);

  for (let i = pops.length - 1; i >= 0; i -= 1) {
    pops[i].age += dt * 1000;
    if (pops[i].age >= pops[i].life) pops.splice(i, 1);
  }
}

function frame(now: number) {
  if (!active || !ctx) return;
  const dt = Math.min(0.034, Math.max(0.001, (now - (lastTime || now)) / 1000));
  lastTime = now;

  ctx.clearRect(0, 0, width, height);
  drawWater(now);
  update(dt, now);

  for (const b of bubbles) drawBubble(b, false);
  for (const item of fish) drawFish(item, now);
  for (const b of bubbles) drawBubble(b, true);
  for (const pop of pops) drawPop(pop);

  raf = requestAnimationFrame(frame);
}

function start() {
  if (active || !shouldRun()) return;
  active = true;
  resizeCanvas();
  initScene();
  lastTime = performance.now();
  raf = requestAnimationFrame(frame);
}

function stop() {
  active = false;
  cancelAnimationFrame(raf);
  raf = 0;
  const canvas = canvasRef.value;
  if (canvas) {
    const local = canvas.getContext("2d");
    local?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function syncState() {
  if (shouldRun()) start();
  else stop();
}

function handleResize() {
  if (!active) return;
  resizeCanvas();
}

function handlePointerMove(event: PointerEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.visible = true;
}

function handlePointerLeave() {
  pointer.visible = false;
}

function isInteractiveUiTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "a,button,input,select,textarea,summary,[role='button'],[role='link'],[contenteditable='true'],[data-underwater-ignore]",
  ));
}

function popBubbleAt(index: number) {
  const b = bubbles[index];
  pops.push({
    x: b.x,
    y: b.y,
    age: 0,
    life: 410,
    size: b.r,
    sparks: Array.from({ length: 7 }, () => ({
      angle: rand(0, TWO_PI),
      speed: rand(b.r * 1.7, b.r * 3.6),
      radius: rand(0.7, 1.8),
    })),
  });
  respawnBubble(b);
}

function startleFish(item: Fish, x: number, y: number, now: number) {
  let dx = item.x - x;
  let dy = item.y - y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;

  item.state = "startled";
  item.stateUntil = now + 620;
  item.followUntil = 0;
  item.hideTarget = null;
  item.annoyed = 1;
  item.vx = dx * item.baseSpeed * 2.8;
  item.vy = dy * item.baseSpeed * 2.25;
  if (Math.abs(item.vx) < item.baseSpeed * 1.15) item.vx += item.direction * item.baseSpeed * 1.35;
}

function handlePointerDown(event: PointerEvent) {
  if (!active || isInteractiveUiTarget(event.target)) return;
  const x = event.clientX;
  const y = event.clientY;

  let bubbleIndex = -1;
  let bubbleDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < bubbles.length; i += 1) {
    const b = bubbles[i];
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < Math.max(11, b.r * 1.35) && d < bubbleDistance) {
      bubbleIndex = i;
      bubbleDistance = d;
    }
  }
  if (bubbleIndex >= 0) {
    popBubbleAt(bubbleIndex);
    return;
  }

  const now = performance.now();
  for (const item of [...fish].sort((a, b) => b.depth - a.depth)) {
    const rx = item.size * 1.1;
    const ry = item.size * 0.58;
    const dx = (x - item.x) / rx;
    const dy = (y - item.y) / ry;
    if (dx * dx + dy * dy <= 1) {
      startleFish(item, x, y, now);
      return;
    }
  }
}

function handleVisibility() {
  if (document.hidden) stop();
  else syncState();
}

onMounted(() => {
  mediaDesktop = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`);
  mediaMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  mediaDesktop.addEventListener("change", syncState);
  mediaMotion.addEventListener("change", syncState);
  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  window.addEventListener("blur", handlePointerLeave);
  document.addEventListener("visibilitychange", handleVisibility);
  syncState();
});

watch(() => route.path, syncState);

onBeforeUnmount(() => {
  stop();
  mediaDesktop?.removeEventListener("change", syncState);
  mediaMotion?.removeEventListener("change", syncState);
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerdown", handlePointerDown);
  window.removeEventListener("blur", handlePointerLeave);
  document.removeEventListener("visibilitychange", handleVisibility);
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="underwater-ambient"
    aria-hidden="true"
  />
</template>

<style scoped>
.underwater-ambient {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: none;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  user-select: none;
}

@media (min-width: 1440px) and (prefers-reduced-motion: no-preference) {
  .underwater-ambient {
    display: block;
  }
}
</style>
