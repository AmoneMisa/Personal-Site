<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const backCanvasRef = ref<HTMLCanvasElement | null>(null);
const webglCanvasRef = ref<HTMLCanvasElement | null>(null);
const frontCanvasRef = ref<HTMLCanvasElement | null>(null);

const MIN_WIDTH = 1200;
const MAX_DPR = 1.25;
const BUBBLE_COUNT = 18;
const MAX_ACTIVE_CREATURES = 4;
const TAU = Math.PI * 2;

const THREE_MODULE_URL = "https://esm.sh/three@0.185.1";
const GLTF_LOADER_URL = "https://esm.sh/three@0.185.1/examples/jsm/loaders/GLTFLoader.js";

type Point = { x: number; y: number };
type CreatureKind = "fish" | "shark" | "jelly";
type CreatureState = "cruise" | "startled" | "glance" | "follow" | "hide";
type RouteProfile = "top" | "mid" | "bottom" | "deep" | "shark" | "jelly-left" | "jelly-right";

type Bubble = {
  x: number;
  y: number;
  r: number;
  depth: number;
  speed: number;
  drift: number;
  phase: number;
};

type Burst = {
  x: number;
  y: number;
  radius: number;
  age: number;
  sparks: Array<{ angle: number; distance: number; size: number }>;
};

type Preset = {
  id: string;
  model: string;
  kind: CreatureKind;
  route: RouteProfile;
  size: [number, number];
  speed: [number, number];
  depth: [number, number];
  delay: [number, number];
  forward: 1 | -1;
  initial?: boolean;
};

type Creature = {
  preset: Preset;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSpeed: number;
  direction: 1 | -1;
  phase: number;
  depth: number;
  lane: number;
  state: CreatureState;
  stateUntil: number;
  followUntil: number;
  hideTarget: Point | null;
  nextSpawn: number;
  active: boolean;
  loading: boolean;
  failed: boolean;
  group: any | null;
  visual: any | null;
  mixer: any | null;
  action: any | null;
  baseScale: number;
  axisYaw: number;
};

const PRESETS: Preset[] = [
  {
    id: "cartoon-fish",
    model: "/models/underwater/low_poly_fish_-cartoon_style.glb",
    kind: "fish",
    route: "mid",
    size: [68, 86],
    speed: [30, 42],
    depth: [.42, .72],
    delay: [6500, 12500],
    forward: -1,
    initial: true,
  },
  {
    id: "clown-fish",
    model: "/models/underwater/clown_fish.glb",
    kind: "fish",
    route: "bottom",
    size: [62, 80],
    speed: [28, 39],
    depth: [.48, .78],
    delay: [7200, 13800],
    forward: -1,
  },
  {
    id: "manta",
    model: "/models/underwater/cartoon_manta_ray_animated.glb",
    kind: "fish",
    route: "deep",
    size: [105, 138],
    speed: [22, 31],
    depth: [.56, .86],
    delay: [9000, 16500],
    forward: -1,
    initial: true,
  },
  {
    id: "animated-fish",
    model: "/models/underwater/fish_animated.glb",
    kind: "fish",
    route: "top",
    size: [60, 78],
    speed: [34, 46],
    depth: [.36, .66],
    delay: [7600, 14500],
    forward: -1,
  },
  {
    id: "shark",
    model: "/models/underwater/cartoon_shark_animated.glb",
    kind: "shark",
    route: "shark",
    size: [130, 170],
    speed: [21, 28],
    depth: [.5, .8],
    delay: [14000, 24000],
    forward: -1,
    initial: true,
  },
  {
    id: "jelly-colorful",
    model: "/models/underwater/colorful_jellyfish.glb",
    kind: "jelly",
    route: "jelly-left",
    size: [72, 92],
    speed: [9, 13],
    depth: [.4, .72],
    delay: [9500, 17500],
    forward: 1,
    initial: true,
  },
  {
    id: "jelly-blue",
    model: "/models/underwater/exotic_blue_jellyfish.glb",
    kind: "jelly",
    route: "jelly-right",
    size: [70, 90],
    speed: [9, 13],
    depth: [.46, .78],
    delay: [11000, 19500],
    forward: 1,
  },
];

let backCtx: CanvasRenderingContext2D | null = null;
let frontCtx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let raf = 0;
let last = 0;
let running = false;
let desktopMq: MediaQueryList | null = null;
let motionMq: MediaQueryList | null = null;

let THREE: any = null;
let GLTFLoaderCtor: any = null;
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let runtimePromise: Promise<void> | null = null;

const bubbles: Bubble[] = [];
const bursts: Burst[] = [];
const creatures: Creature[] = [];
const pointer = { x: -9999, y: -9999, visible: false };
const streams = [0.07, 0.21, 0.79, 0.93];
const modelCache = new Map<string, any>();
let nextPresetIndex = 0;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function shouldRun() {
  return Boolean(desktopMq?.matches && !motionMq?.matches && !document.hidden);
}

function configureCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d", { alpha: true });
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  backCtx = configureCanvas(backCanvasRef.value);
  frontCtx = configureCanvas(frontCanvasRef.value);

  if (renderer && camera) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
  }
}

async function ensureRuntime() {
  if (renderer || runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    const [threeModule, loaderModule] = await Promise.all([
      import(/* @vite-ignore */ THREE_MODULE_URL),
      import(/* @vite-ignore */ GLTF_LOADER_URL),
    ]);
    if (!webglCanvasRef.value) return;

    THREE = threeModule;
    GLTFLoaderCtor = loaderModule.GLTFLoader;

    renderer = new THREE.WebGLRenderer({
      canvas: webglCanvasRef.value,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      powerPreference: "low-power",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 2400);
    camera.position.set(0, 0, 1000);

    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x07152c, 1.7));
    const key = new THREE.DirectionalLight(0xc8efff, 1.35);
    key.position.set(-220, 340, 620);
    scene.add(key);
  })().catch((error) => {
    console.warn("[underwater] WebGL runtime unavailable", error);
    renderer = null;
    scene = null;
    camera = null;
  }).finally(() => {
    runtimePromise = null;
  });

  return runtimePromise;
}

function makeBubble(anywhere = false): Bubble {
  const depth = Math.random();
  const stream = streams[Math.floor(Math.random() * streams.length)];
  const r = rand(4, 10) * (.7 + depth * .65);
  return {
    x: clamp(stream * width + rand(-38, 38), 16, width - 16),
    y: anywhere ? rand(0, height) : height + rand(10, height * .18),
    r,
    depth,
    speed: rand(18, 34) * (.82 + depth * .45),
    drift: rand(-3.5, 3.5),
    phase: rand(0, TAU),
  };
}

function resetBubble(bubble: Bubble) {
  Object.assign(bubble, makeBubble(false));
}

function laneFor(route: RouteProfile) {
  if (route === "top") return rand(.16, .31);
  if (route === "mid") return rand(.32, .54);
  if (route === "bottom") return rand(.62, .82);
  if (route === "deep") return rand(.48, .74);
  if (route === "shark") return rand(.22, .48);
  return rand(.28, .78);
}

function makeCreature(preset: Preset, now: number): Creature {
  return {
    preset,
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    size: rand(...preset.size),
    baseSpeed: rand(...preset.speed),
    direction: Math.random() > .5 ? 1 : -1,
    phase: rand(0, TAU),
    depth: rand(...preset.depth),
    lane: laneFor(preset.route),
    state: "cruise",
    stateUntil: 0,
    followUntil: 0,
    hideTarget: null,
    nextSpawn: now,
    active: false,
    loading: false,
    failed: false,
    group: null,
    visual: null,
    mixer: null,
    action: null,
    baseScale: 1,
    axisYaw: 0,
  };
}

function pickAnimation(animations: any[], kind: CreatureKind) {
  if (!animations?.length) return null;
  const rx = kind === "jelly" ? /(idle|float|pulse|swim|move)/i : /(swim|move|idle|loop)/i;
  return animations.find((clip) => rx.test(String(clip?.name || ""))) || animations[0];
}

async function loadAsset(url: string) {
  if (modelCache.has(url)) return modelCache.get(url);
  const loader = new GLTFLoaderCtor();
  const gltf = await loader.loadAsync(url);
  modelCache.set(url, gltf);
  return gltf;
}

function detachCreature(item: Creature) {
  item.action?.stop?.();
  item.mixer?.stopAllAction?.();
  if (item.group && scene) scene.remove(item.group);
  item.group = null;
  item.visual = null;
  item.mixer = null;
  item.action = null;
  item.active = false;
}

async function activateCreature(item: Creature, visible = false) {
  if (!scene || !THREE || !GLTFLoaderCtor || item.loading) return;
  item.loading = true;
  try {
    const gltf = await loadAsset(item.preset.model);
    const model = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    model.position.sub(center);

    model.traverse((node: any) => {
      if (!node?.isMesh) return;
      node.castShadow = false;
      node.receiveShadow = false;
      node.frustumCulled = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        if (item.preset.kind === "jelly") {
          material.transparent = true;
          material.depthWrite = false;
        }
      }
    });

    let axisYaw = 0;
    if (item.preset.kind !== "jelly") {
      if (size.z > size.x * 1.15 && size.z > size.y) axisYaw = Math.PI / 2;
      else if (size.y > Math.max(size.x, size.z) * 1.2) model.rotation.z = -Math.PI / 2;
    }

    const extent = Math.max(size.x, size.y, size.z, .001);
    item.baseScale = item.size / extent;
    item.axisYaw = axisYaw;

    const visual = new THREE.Group();
    visual.add(model);
    const group = new THREE.Group();
    group.add(visual);
    scene.add(group);

    let mixer = null;
    let action = null;
    const clip = pickAnimation(gltf.animations, item.preset.kind);
    if (clip) {
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(clip);
      action.play();
    }

    item.group = group;
    item.visual = visual;
    item.mixer = mixer;
    item.action = action;
    item.failed = false;
    item.active = true;
    item.direction = Math.random() > .5 ? 1 : -1;
    item.lane = laneFor(item.preset.route);
    item.depth = rand(...item.preset.depth);
    item.baseSpeed = rand(...item.preset.speed);

    if (item.preset.kind === "jelly") {
      item.x = item.preset.route === "jelly-left" ? width * rand(.1, .32) : width * rand(.68, .9);
      item.y = visible ? height * rand(.28, .72) : height + item.size * 1.4;
      item.vx = rand(-3, 3);
      item.vy = -item.baseSpeed;
    } else {
      item.x = visible
        ? (item.preset.kind === "shark" ? width * .72 : width * rand(.12, .88))
        : (item.direction === 1 ? -item.size * 1.6 : width + item.size * 1.6);
      item.y = height * item.lane;
      item.vx = item.baseSpeed * item.direction;
      item.vy = 0;
    }
  } catch (error) {
    item.failed = true;
    item.nextSpawn = performance.now() + 15000;
    console.warn(`[underwater] model failed: ${item.preset.id}`, error);
  } finally {
    item.loading = false;
  }
}

function init(now: number) {
  bubbles.splice(0, bubbles.length, ...Array.from({ length: BUBBLE_COUNT }, () => makeBubble(true)));
  bursts.length = 0;
  creatures.length = 0;

  const initial = PRESETS.filter((preset) => preset.initial).slice(0, MAX_ACTIVE_CREATURES);
  for (const preset of initial) {
    const item = makeCreature(preset, now);
    creatures.push(item);
    void activateCreature(item, true);
  }
  nextPresetIndex = 0;
}

function nextPreset() {
  for (let tries = 0; tries < PRESETS.length; tries += 1) {
    const preset = PRESETS[nextPresetIndex % PRESETS.length];
    nextPresetIndex += 1;
    if (!creatures.some((item) => item.active && item.preset.id === preset.id)) return preset;
  }
  return PRESETS[nextPresetIndex++ % PRESETS.length];
}

function routeVelocity(item: Creature, now: number): Point {
  const t = now * .001 + item.phase;
  if (item.preset.route === "top") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .8) * 5 };
  if (item.preset.route === "mid") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .52) * 11 };
  if (item.preset.route === "bottom") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .92) * 8 + Math.sin(t * .32) * 4 };
  if (item.preset.route === "deep") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .4) * 14 };
  if (item.preset.route === "shark") return { x: item.baseSpeed * item.direction, y: Math.sin(t * .31) * 15 };
  if (item.preset.route === "jelly-left") return { x: Math.sin(t * .72) * 5, y: -item.baseSpeed + Math.cos(t * .38) * 3 };
  return { x: -Math.sin(t * .75) * 5, y: -item.baseSpeed + Math.cos(t * .4) * 3 };
}

function nearestFrontBubble(item: Creature): Point {
  const candidate = bubbles
    .filter((bubble) => bubble.depth >= .62)
    .sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))[0];
  return candidate ? { x: candidate.x, y: candidate.y + candidate.r } : { x: width * .88, y: height * .34 };
}

function syncTransform(item: Creature, now: number) {
  if (!item.group || !item.visual) return;
  const depthScale = .72 + item.depth * .42;
  const pulse = item.preset.kind === "jelly" ? 1 + Math.sin(now * .0016 + item.phase) * .035 : 1;
  const scale = item.baseScale * depthScale * pulse;
  const mirrored = item.preset.kind === "jelly" ? 1 : item.direction * item.preset.forward;

  item.group.position.set(item.x - width / 2, height / 2 - item.y, -160 + item.depth * 290);
  item.group.rotation.z = clamp(Math.atan2(-item.vy, Math.max(14, Math.abs(item.vx))) * .34, -.18, .18);
  item.visual.scale.set(scale * mirrored, scale, scale);
  item.visual.rotation.y = item.axisYaw;

  if (item.state === "glance" && pointer.visible) {
    item.visual.rotation.y += clamp((pointer.x - item.x) / 900, -.25, .25);
  }
}

function updateCreature(item: Creature, dt: number, now: number) {
  if (!item.active) {
    if (!item.loading && !item.failed && now >= item.nextSpawn) void activateCreature(item, false);
    return;
  }

  item.mixer?.update?.(dt);
  let velocity = routeVelocity(item, now);

  if (item.state === "startled") {
    velocity = { x: item.vx, y: item.vy };
    if (now >= item.stateUntil) {
      item.state = "glance";
      item.stateUntil = now + 520;
    }
  } else if (item.state === "glance") {
    velocity = { x: item.baseSpeed * item.direction * .5, y: velocity.y * .3 };
    if (now >= item.stateUntil) item.state = "follow";
  } else if (item.state === "follow") {
    const target = pointer.visible ? pointer : { x: width / 2, y: height * item.lane };
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const len = Math.hypot(dx, dy) || 1;
    velocity = { x: dx / len * item.baseSpeed * 1.12, y: dy / len * item.baseSpeed * .72 };
    item.direction = velocity.x >= 0 ? 1 : -1;
    if (now >= item.followUntil) {
      item.state = "hide";
      item.hideTarget = nearestFrontBubble(item);
    }
  } else if (item.state === "hide") {
    const target = item.hideTarget ?? nearestFrontBubble(item);
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const len = Math.hypot(dx, dy) || 1;
    velocity = { x: dx / len * item.baseSpeed * 1.25, y: dy / len * item.baseSpeed };
    item.direction = velocity.x >= 0 ? 1 : -1;
    if (len < Math.max(18, item.size * .18)) {
      item.state = "cruise";
      item.hideTarget = null;
    }
  } else if (item.preset.kind !== "jelly") {
    item.direction = velocity.x >= 0 ? 1 : -1;
  }

  item.vx = velocity.x;
  item.vy = velocity.y;
  item.x += velocity.x * dt;
  item.y += velocity.y * dt;
  if (item.preset.kind !== "jelly") item.y = clamp(item.y, height * .1, height * .9);
  syncTransform(item, now);

  const margin = item.size * 1.8;
  const offscreen = item.preset.kind === "jelly"
    ? item.y < -margin || item.x < -margin || item.x > width + margin
    : item.x < -margin || item.x > width + margin;

  if (offscreen) {
    detachCreature(item);
    item.preset = nextPreset();
    item.size = rand(...item.preset.size);
    item.baseSpeed = rand(...item.preset.speed);
    item.depth = rand(...item.preset.depth);
    item.lane = laneFor(item.preset.route);
    item.failed = false;
    item.nextSpawn = now + rand(...item.preset.delay);
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble) {
  const alpha = .18 + bubble.depth * .25;
  ctx.save();
  ctx.translate(bubble.x, bubble.y);
  const fill = ctx.createRadialGradient(-bubble.r * .32, -bubble.r * .36, bubble.r * .08, 0, 0, bubble.r);
  fill.addColorStop(0, `rgba(255,255,255,${alpha})`);
  fill.addColorStop(.25, `rgba(205,238,255,${alpha * .18})`);
  fill.addColorStop(.72, `rgba(90,158,255,${alpha * .05})`);
  fill.addColorStop(1, `rgba(205,239,255,${alpha * .12})`);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, bubble.r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(223,246,255,${alpha * .85})`;
  ctx.lineWidth = Math.max(.8, bubble.r * .08);
  ctx.beginPath();
  ctx.arc(0, 0, bubble.r - 1, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawBubbles(dt: number) {
  if (!backCtx || !frontCtx) return;
  backCtx.clearRect(0, 0, width, height);
  frontCtx.clearRect(0, 0, width, height);

  for (const bubble of bubbles) drawBubble(bubble.depth < .62 ? backCtx : frontCtx, bubble);

  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const burst = bursts[index];
    burst.age += dt;
    if (burst.age > .42) {
      bursts.splice(index, 1);
      continue;
    }
    const t = burst.age / .42;
    const alpha = 1 - t;
    frontCtx.save();
    frontCtx.translate(burst.x, burst.y);
    frontCtx.strokeStyle = `rgba(225,247,255,${alpha * .8})`;
    frontCtx.beginPath();
    frontCtx.arc(0, 0, burst.radius * (.55 + t), 0, TAU);
    frontCtx.stroke();
    frontCtx.fillStyle = `rgba(255,255,255,${alpha})`;
    for (const spark of burst.sparks) {
      const distance = spark.distance * (.4 + t * 1.25);
      frontCtx.beginPath();
      frontCtx.arc(Math.cos(spark.angle) * distance, Math.sin(spark.angle) * distance, spark.size, 0, TAU);
      frontCtx.fill();
    }
    frontCtx.restore();
  }
}

function updateBubbles(dt: number, now: number) {
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * dt;
    bubble.x += (bubble.drift + Math.sin(now * .001 + bubble.phase) * 3.1) * dt;
    if (bubble.y < -bubble.r * 3 || bubble.x < -60 || bubble.x > width + 60) resetBubble(bubble);
  }
}

function popBubble(x: number, y: number) {
  const bubble = bubbles.find((item) => Math.hypot(item.x - x, item.y - y) <= item.r * 1.2);
  if (!bubble) return false;
  bursts.push({
    x: bubble.x,
    y: bubble.y,
    radius: bubble.r,
    age: 0,
    sparks: Array.from({ length: 7 }, () => ({ angle: rand(0, TAU), distance: rand(bubble.r * .4, bubble.r * 1.4), size: rand(1.2, 2.8) })),
  });
  resetBubble(bubble);
  return true;
}

function creatureAt(x: number, y: number) {
  return [...creatures].reverse().find((item) => item.active && Math.hypot(item.x - x, item.y - y) <= Math.max(32, item.size * .38));
}

function scare(item: Creature, x: number, y: number) {
  const dx = item.x - x;
  const dy = item.y - y;
  const len = Math.hypot(dx, dy) || 1;
  const boost = item.preset.kind === "jelly" ? 1.65 : 2.15;
  item.vx = dx / len * item.baseSpeed * boost;
  item.vy = dy / len * item.baseSpeed * (item.preset.kind === "jelly" ? 1.2 : 1.65);
  item.direction = item.vx >= 0 ? 1 : -1;
  item.state = "startled";
  item.stateUntil = performance.now() + 760;
  item.followUntil = performance.now() + 3600;
  item.hideTarget = nearestFrontBubble(item);
}

function frame(now: number) {
  if (!running) return;
  const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, .033);
  last = now;

  updateBubbles(dt, now);
  creatures.forEach((item) => updateCreature(item, dt, now));
  drawBubbles(dt);
  renderer?.render?.(scene, camera);
  raf = requestAnimationFrame(frame);
}

async function start() {
  if (running) return;
  resize();
  await ensureRuntime();
  if (!renderer) return;
  init(performance.now());
  running = true;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function syncState() {
  if (shouldRun()) void start();
  else stop();
}

function handlePointerMove(event: PointerEvent) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.visible = true;
}

function handlePointerDown(event: PointerEvent) {
  if (!running) return;
  if (popBubble(event.clientX, event.clientY)) return;
  const creature = creatureAt(event.clientX, event.clientY);
  if (creature) scare(creature, event.clientX, event.clientY);
}

onMounted(() => {
  desktopMq = window.matchMedia(`(min-width: ${MIN_WIDTH}px)`);
  motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  desktopMq.addEventListener("change", syncState);
  motionMq.addEventListener("change", syncState);
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerdown", handlePointerDown, { passive: true });
  document.addEventListener("visibilitychange", syncState);
  syncState();
});

onBeforeUnmount(() => {
  stop();
  desktopMq?.removeEventListener("change", syncState);
  motionMq?.removeEventListener("change", syncState);
  window.removeEventListener("resize", resize);
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("visibilitychange", syncState);

  creatures.forEach(detachCreature);
  creatures.length = 0;
  bubbles.length = 0;
  bursts.length = 0;
  modelCache.clear();
  renderer?.dispose?.();
  renderer = null;
  scene = null;
  camera = null;
});
</script>

<template>
  <div class="underwater-glb" aria-hidden="true">
    <canvas ref="backCanvasRef" class="underwater-glb__layer underwater-glb__back" />
    <canvas ref="webglCanvasRef" class="underwater-glb__layer underwater-glb__webgl" />
    <canvas ref="frontCanvasRef" class="underwater-glb__layer underwater-glb__front" />
  </div>
</template>

<style scoped>
.underwater-glb {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  overflow: hidden;
}

.underwater-glb__layer {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.underwater-glb__webgl { z-index: 1; }
.underwater-glb__front { z-index: 2; }

@media (prefers-reduced-motion: reduce) {
  .underwater-glb { display: none; }
}
</style>
