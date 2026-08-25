<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

const backCanvasRef = ref<HTMLCanvasElement | null>(null);
const webglCanvasRef = ref<HTMLCanvasElement | null>(null);
const frontCanvasRef = ref<HTMLCanvasElement | null>(null);

const MIN_WIDTH = 1200;
const MAX_DPR = 1.5;
const BUBBLE_COUNT = 22;
const MAX_ACTIVE_CREATURES = 5;
const TAU = Math.PI * 2;

// Three is loaded only on desktop pages that actually mount this component.
// The GLB assets themselves stay local to the site. Keeping the runtime import
// here avoids adding ~3D code to every Nuxt page and makes failure non-fatal to UI.
const THREE_MODULE_URL = "https://esm.sh/three@0.185.1";
const GLTF_LOADER_URL = "https://esm.sh/three@0.185.1/examples/jsm/loaders/GLTFLoader.js";

type Point = { x: number; y: number };
type CreatureKind = "fish" | "shark" | "jelly";
type CreatureState = "cruise" | "startled" | "glance" | "follow" | "hide";
type RouteProfile =
  | "top-glide"
  | "mid-arc"
  | "bottom-wander"
  | "deep-curve"
  | "shark-sweep"
  | "shark-deep"
  | "jelly-left"
  | "jelly-right";

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
  id: string;
  model: string;
  kind: CreatureKind;
  route: RouteProfile;
  size: [number, number];
  speed: [number, number];
  depth: [number, number];
  spawnDelay: [number, number];
  initialDelay: number;
  initialVisible?: boolean;
  forward?: 1 | -1;
  viewYaw?: number;
  animationSpeed?: number;
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
  nextSpawn: number;
  lane: number;
  active: boolean;
  hasSpawned: boolean;
  loading: boolean;
  loaded: boolean;
  failed: boolean;
  group: any | null;
  visual: any | null;
  model: any | null;
  mixer: any | null;
  action: any | null;
  baseScale: number;
  axisYaw: number;
};

const PRESETS: CreaturePreset[] = [
  {
    id: "fish-animated",
    model: "/models/underwater/fish_animated.glb",
    kind: "fish",
    route: "mid-arc",
    size: [64, 82],
    speed: [32, 43],
    depth: [.42, .72],
    spawnDelay: [6500, 13000],
    initialDelay: 100,
    initialVisible: true,
    viewYaw: .08,
    animationSpeed: 1.0,
  },
  {
    id: "stylized-fish",
    model: "/models/underwater/stylized_fish.glb",
    kind: "fish",
    route: "top-glide",
    size: [60, 76],
    speed: [35, 49],
    depth: [.36, .68],
    spawnDelay: [7000, 14500],
    initialDelay: 2800,
    viewYaw: -.1,
    animationSpeed: 1.08,
  },
  {
    id: "clown-fish",
    model: "/models/underwater/clown_fish.glb",
    kind: "fish",
    route: "bottom-wander",
    size: [58, 72],
    speed: [28, 40],
    depth: [.5, .8],
    spawnDelay: [7500, 15000],
    initialDelay: 5600,
    viewYaw: .12,
    animationSpeed: .96,
  },
  {
    id: "alien-fish",
    model: "/models/underwater/tropical_alien_fish_animated.glb",
    kind: "fish",
    route: "deep-curve",
    size: [68, 88],
    speed: [24, 34],
    depth: [.58, .9],
    spawnDelay: [9500, 18000],
    initialDelay: 9000,
    viewYaw: -.08,
    animationSpeed: .9,
  },
  {
    id: "shark-wide",
    model: "/models/underwater/cartoon_shark_animated.glb",
    kind: "shark",
    route: "shark-sweep",
    size: [125, 165],
    speed: [20, 27],
    depth: [.48, .78],
    spawnDelay: [18000, 32000],
    initialDelay: 4300,
    viewYaw: .06,
    animationSpeed: .82,
  },
  {
    id: "shark-deep",
    model: "/models/underwater/cartoon_shark_animated.glb",
    kind: "shark",
    route: "shark-deep",
    size: [96, 128],
    speed: [23, 31],
    depth: [.66, .94],
    spawnDelay: [22000, 39000],
    initialDelay: 16500,
    viewYaw: -.11,
    animationSpeed: .94,
  },
  {
    id: "jelly-colorful",
    model: "/models/underwater/colorful_jellyfish.glb",
    kind: "jelly",
    route: "jelly-left",
    size: [76, 96],
    speed: [10, 14],
    depth: [.38, .7],
    spawnDelay: [9000, 18000],
    initialDelay: 900,
    initialVisible: true,
    animationSpeed: .72,
  },
  {
    id: "jelly-blue",
    model: "/models/underwater/exotic_blue_jellyfish.glb",
    kind: "jelly",
    route: "jelly-right",
    size: [72, 92],
    speed: [9, 13],
    depth: [.46, .78],
    spawnDelay: [11000, 22000],
    initialDelay: 7800,
    animationSpeed: .68,
  },
];

let backCtx: CanvasRenderingContext2D | null = null;
let frontCtx: CanvasRenderingContext2D | null = null;
let width = 0;
let height = 0;
let dpr = 1;
let raf = 0;
let running = false;
let initialized = false;
let last = 0;
let desktopMq: MediaQueryList | null = null;
let motionMq: MediaQueryList | null = null;

let THREE: any = null;
let GLTFLoaderCtor: any = null;
let renderer: any = null;
let scene: any = null;
let camera: any = null;
let threePromise: Promise<void> | null = null;

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

function configureCanvas(canvas: HTMLCanvasElement | null) {
  if (!canvas) return null;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d", { alpha: true });
  context?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
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

async function ensureThree() {
  if (renderer || threePromise) return threePromise;

  threePromise = (async () => {
    try {
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
        antialias: true,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(
        -width / 2,
        width / 2,
        height / 2,
        -height / 2,
        1,
        2400,
      );
      camera.position.set(0, 0, 1000);

      const hemi = new THREE.HemisphereLight(0xb8e6ff, 0x07152c, 2.15);
      scene.add(hemi);

      const key = new THREE.DirectionalLight(0xbdeaff, 2.15);
      key.position.set(-260, 420, 720);
      scene.add(key);

      const fill = new THREE.DirectionalLight(0x708dff, .75);
      fill.position.set(480, -180, 430);
      scene.add(fill);
    } catch (error) {
      console.warn("[underwater] Three.js runtime could not be loaded", error);
      renderer = null;
      scene = null;
      camera = null;
      THREE = null;
      GLTFLoaderCtor = null;
    }
  })().finally(() => {
    threePromise = null;
  });

  return threePromise;
}

function createBubble(startAnywhere = false): Bubble {
  const depth = Math.random();
  const stream = Math.floor(Math.random() * streams.length);
  const r = rand(4, 11) * (0.65 + depth * 0.75);
  return {
    x: clamp(streams[stream] * width + rand(-42, 42), 16, width - 16),
    y: startAnywhere ? rand(0, height) : height + rand(8, height * .22),
    r,
    depth,
    speed: rand(18, 40) * (.8 + depth * .55),
    drift: rand(-4, 4),
    phase: rand(0, TAU),
    stream,
  };
}

function resetBubble(bubble: Bubble) {
  Object.assign(bubble, createBubble(false));
}

function routeLane(route: RouteProfile) {
  if (route === "top-glide") return rand(.15, .3);
  if (route === "mid-arc") return rand(.31, .53);
  if (route === "bottom-wander") return rand(.64, .82);
  if (route === "deep-curve") return rand(.48, .74);
  if (route === "shark-sweep") return rand(.2, .47);
  if (route === "shark-deep") return rand(.58, .78);
  return rand(.28, .78);
}

function makeCreature(preset: CreaturePreset, now: number): Creature {
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
    state: "cruise",
    until: 0,
    followUntil: 0,
    hideTarget: null,
    nextSpawn: now + preset.initialDelay,
    lane: routeLane(preset.route),
    active: false,
    hasSpawned: false,
    loading: false,
    loaded: false,
    failed: false,
    group: null,
    visual: null,
    model: null,
    mixer: null,
    action: null,
    baseScale: 1,
    axisYaw: 0,
  };
}

function initScene(now: number) {
  bubbles.splice(0, bubbles.length, ...Array.from({ length: BUBBLE_COUNT }, () => createBubble(true)));
  bursts.length = 0;
  creatures.splice(0, creatures.length, ...PRESETS.map((preset) => makeCreature(preset, now)));
}

function chooseAnimation(animations: any[], kind: CreatureKind) {
  if (!animations?.length) return null;
  const preferred = kind === "jelly"
    ? /(idle|float|pulse|swim|move)/i
    : /(swim|move|idle|loop)/i;
  return animations.find((clip) => preferred.test(String(clip?.name || ""))) || animations[0];
}

function prepareMaterials(root: any, kind: CreatureKind) {
  root.traverse?.((node: any) => {
    if (!node?.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
    node.frustumCulled = true;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if ("envMapIntensity" in material) material.envMapIntensity = .2;
      if (kind === "jelly") {
        material.transparent = true;
        material.depthWrite = false;
      }
      material.needsUpdate = true;
    }
  });
}

async function loadCreature(item: Creature) {
  if (item.loading || item.loaded || item.failed) return;
  item.loading = true;

  try {
    await ensureThree();
    if (!THREE || !GLTFLoaderCtor || !scene) throw new Error("Three.js runtime unavailable");

    const loader = new GLTFLoaderCtor();
    const gltf = await loader.loadAsync(item.preset.model);
    const model = gltf.scene;
    prepareMaterials(model, item.preset.kind);

    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const modelSize = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const extent = Math.max(modelSize.x, modelSize.y, modelSize.z, .001);

    const visual = new THREE.Group();
    const group = new THREE.Group();
    model.position.sub(center);
    visual.add(model);
    group.add(visual);
    scene.add(group);

    // Bring models whose long axis is Z into the screen plane automatically.
    // Jellyfish stay upright; fish/sharks are treated as horizontal swimmers.
    let axisYaw = 0;
    if (item.preset.kind !== "jelly") {
      if (modelSize.z > modelSize.x * 1.15 && modelSize.z > modelSize.y) {
        axisYaw = Math.PI / 2;
      } else if (modelSize.y > Math.max(modelSize.x, modelSize.z) * 1.2) {
        model.rotation.z = -Math.PI / 2;
      }
    }

    const clip = chooseAnimation(gltf.animations, item.preset.kind);
    let mixer = null;
    let action = null;
    if (clip) {
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
    }

    group.visible = false;
    item.group = group;
    item.visual = visual;
    item.model = model;
    item.mixer = mixer;
    item.action = action;
    item.baseScale = item.size / extent;
    item.axisYaw = axisYaw;
    item.loaded = true;
  } catch (error) {
    item.failed = true;
    item.nextSpawn = Number.POSITIVE_INFINITY;
    console.warn(`[underwater] model failed: ${item.preset.id}`, error);
  } finally {
    item.loading = false;
  }
}

function activeCreatureCount() {
  return creatures.reduce((count, item) => count + (item.active ? 1 : 0), 0);
}

function anotherSharkActive(except: Creature) {
  return creatures.some((item) => item !== except && item.active && item.preset.kind === "shark");
}

function spawnCreature(item: Creature, now: number) {
  if (!item.loaded || !item.group) return;

  item.active = true;
  item.group.visible = true;
  item.state = "cruise";
  item.until = 0;
  item.followUntil = 0;
  item.hideTarget = null;
  item.direction = Math.random() > .5 ? 1 : -1;
  item.size = rand(...item.preset.size);
  item.baseSpeed = rand(...item.preset.speed);
  item.depth = rand(...item.preset.depth);
  item.lane = routeLane(item.preset.route);
  item.phase = rand(0, TAU);

  const firstVisible = !item.hasSpawned && item.preset.initialVisible;
  item.hasSpawned = true;

  if (item.preset.kind === "jelly") {
    item.x = item.preset.route === "jelly-left" ? width * rand(.08, .29) : width * rand(.7, .92);
    item.y = firstVisible ? height * rand(.34, .78) : height + item.size * 1.5;
    item.vx = rand(-2.5, 2.5);
    item.vy = -item.baseSpeed;
  } else {
    item.x = firstVisible
      ? (item.direction === 1 ? width * rand(.05, .18) : width * rand(.82, .95))
      : (item.direction === 1 ? -item.size * 2 : width + item.size * 2);
    item.y = height * item.lane;
    item.vx = item.baseSpeed * item.direction;
    item.vy = rand(-2, 2);
  }

  item.nextSpawn = now;
}

function despawnCreature(item: Creature, now: number) {
  item.active = false;
  if (item.group) item.group.visible = false;
  item.state = "cruise";
  item.hideTarget = null;
  item.nextSpawn = now + rand(...item.preset.spawnDelay);
}

function nearestForegroundBubble(item: Creature): Point {
  const candidate = bubbles
    .filter((bubble) => bubble.depth >= .62)
    .sort((a, b) => Math.hypot(a.x - item.x, a.y - item.y) - Math.hypot(b.x - item.x, b.y - item.y))[0];
  return candidate
    ? { x: candidate.x, y: candidate.y + candidate.r * 1.6 }
    : { x: width * streams[Math.floor(Math.random() * streams.length)], y: height * rand(.3, .74) };
}

function routeTargetY(item: Creature, now: number) {
  const t = now * .001 + item.phase;
  const laneY = height * item.lane;

  switch (item.preset.route) {
    case "top-glide": return laneY + Math.sin(t * .72) * 18;
    case "mid-arc": return laneY + Math.sin(t * .44) * 42;
    case "bottom-wander": return laneY + Math.sin(t * .91) * 24 + Math.sin(t * .31) * 14;
    case "deep-curve": return laneY + Math.sin(t * .34) * 54;
    case "shark-sweep": return laneY + Math.sin(t * .27) * 32;
    case "shark-deep": return laneY + Math.sin(t * .22) * 46;
    default: return laneY;
  }
}

function updateCreature(item: Creature, dt: number, now: number) {
  if (!item.active) {
    if (now < item.nextSpawn || item.failed) return;

    if (!item.loaded) {
      void loadCreature(item);
      item.nextSpawn = now + 700;
      return;
    }

    if (activeCreatureCount() >= MAX_ACTIVE_CREATURES) {
      item.nextSpawn = now + rand(1300, 3200);
      return;
    }

    if (item.preset.kind === "shark" && anotherSharkActive(item) && Math.random() < .78) {
      item.nextSpawn = now + rand(5000, 9000);
      return;
    }

    spawnCreature(item, now);
    return;
  }

  if (item.state === "startled" && now >= item.until) {
    if (item.preset.kind === "jelly") {
      item.state = "cruise";
    } else {
      item.state = "glance";
      item.until = now + 460;
    }
  } else if (item.state === "glance" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 5200;
  } else if (item.state === "follow" && now >= item.followUntil) {
    item.state = "cruise";
    item.hideTarget = null;
  } else if (item.state === "hide" && now >= item.until) {
    item.state = "follow";
    item.followUntil = now + 2600;
    item.hideTarget = null;
  }

  if (item.state === "follow" && pointer.visible) {
    const distance = Math.hypot(pointer.x - item.x, pointer.y - item.y);
    if (distance < Math.max(115, item.size * .9)) {
      item.state = "hide";
      item.until = now + rand(1050, 1650);
      item.hideTarget = nearestForegroundBubble(item);
    }
  }

  let target: Point | null = null;
  if (item.state === "hide") target = item.hideTarget;
  if (item.state === "follow" && pointer.visible) {
    const side = pointer.x < width / 2 ? 1 : -1;
    target = {
      x: pointer.x + side * (160 + item.size * .75),
      y: pointer.y + Math.sin(now * .0019 + item.phase) * 45,
    };
  }

  if (target) {
    const dx = target.x - item.x;
    const dy = target.y - item.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = item.baseSpeed * (item.state === "hide" ? 2.15 : 1.18);
    item.vx += ((dx / distance) * desired - item.vx) * Math.min(1, dt * 2.25);
    item.vy += ((dy / distance) * desired - item.vy) * Math.min(1, dt * 2.25);
  } else if (item.preset.kind === "jelly") {
    const targetVy = item.state === "startled" ? -item.baseSpeed * 2.4 : -item.baseSpeed;
    item.vy += (targetVy - item.vy) * Math.min(1, dt * 1.2);
    item.vx += (Math.sin(now * .00075 + item.phase) * 5 - item.vx) * Math.min(1, dt * .8);
  } else if (item.state === "cruise") {
    const targetY = routeTargetY(item, now);
    const targetVy = clamp((targetY - item.y) * .52, -18, 18);
    item.vx += (item.baseSpeed * item.direction - item.vx) * Math.min(1, dt * .85);
    item.vy += (targetVy - item.vy) * Math.min(1, dt * .85);
  } else if (item.state === "glance") {
    item.vx *= Math.pow(.94, dt * 60);
    item.vy *= Math.pow(.94, dt * 60);
  }

  const speed = Math.hypot(item.vx, item.vy);
  const speedLimit = item.baseSpeed * (item.state === "startled" ? 3.1 : 2.2);
  if (speed > speedLimit) {
    item.vx = item.vx / speed * speedLimit;
    item.vy = item.vy / speed * speedLimit;
  }

  if (item.preset.kind !== "jelly" && Math.abs(item.vx) > 2) {
    item.direction = item.vx >= 0 ? 1 : -1;
  }

  item.x += item.vx * dt;
  item.y += item.vy * dt;

  if (item.preset.kind === "jelly") {
    if (item.y < -item.size * 1.8 || item.x < -item.size * 2 || item.x > width + item.size * 2) {
      despawnCreature(item, now);
    }
  } else {
    item.y = clamp(item.y, item.size * .55, height - item.size * .55);
    const margin = item.size * 2.6;
    if (item.state === "cruise" && (item.x < -margin || item.x > width + margin)) {
      despawnCreature(item, now);
    }
  }

  if (item.mixer) {
    const stateRate = item.state === "startled" || item.state === "hide" ? 1.7 : item.state === "glance" ? .72 : 1;
    item.mixer.update(dt * (item.preset.animationSpeed ?? 1) * stateRate);
  }
}

function syncCreatureVisual(item: Creature, now: number) {
  if (!item.active || !item.group || !item.visual) return;

  const depthScale = .7 + item.depth * .48;
  const pulse = item.preset.kind === "jelly" ? 1 + Math.sin(now * .002 + item.phase) * .045 : 1;
  const scale = item.baseScale * depthScale * pulse;
  const forward = item.preset.forward ?? 1;
  const mirrored = item.preset.kind === "jelly" ? 1 : item.direction * forward;

  item.group.position.set(
    item.x - width / 2,
    height / 2 - item.y,
    -170 + item.depth * 300,
  );

  const velocityAngle = Math.atan2(-item.vy, Math.max(16, Math.abs(item.vx)));
  item.group.rotation.z = clamp(velocityAngle * .38, -.2, .2);

  item.visual.scale.set(scale * mirrored, scale, scale);
  item.visual.rotation.y = item.axisYaw + (item.preset.viewYaw ?? 0);
  item.visual.rotation.x = item.preset.kind === "jelly"
    ? Math.sin(now * .0009 + item.phase) * .07
    : Math.sin(now * .00055 + item.phase) * .025;

  if (item.state === "glance") {
    item.visual.rotation.y += item.direction * .42;
    item.visual.rotation.x += .07;
  }
}

function updateBubbles(dt: number, now: number) {
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * dt;
    bubble.x += (bubble.drift + Math.sin(now * .001 + bubble.phase) * 3.8) * dt;
    if (bubble.y < -bubble.r * 3 || bubble.x < -60 || bubble.x > width + 60) resetBubble(bubble);
  }
}

function drawBubble(context: CanvasRenderingContext2D, bubble: Bubble) {
  const alpha = .22 + bubble.depth * .31;
  context.save();
  context.translate(bubble.x, bubble.y);

  const fill = context.createRadialGradient(-bubble.r * .32, -bubble.r * .38, bubble.r * .05, 0, 0, bubble.r);
  fill.addColorStop(0, `rgba(255,255,255,${alpha * .9})`);
  fill.addColorStop(.18, `rgba(190,235,255,${alpha * .15})`);
  fill.addColorStop(.68, `rgba(80,160,255,${alpha * .055})`);
  fill.addColorStop(1, `rgba(205,239,255,${alpha * .18})`);
  context.fillStyle = fill;
  context.beginPath();
  context.arc(0, 0, bubble.r, 0, TAU);
  context.fill();

  context.strokeStyle = `rgba(220,245,255,${alpha * .86})`;
  context.lineWidth = Math.max(.8, bubble.r * .075);
  context.beginPath();
  context.arc(0, 0, bubble.r - 1, 0, TAU);
  context.stroke();

  context.strokeStyle = `rgba(255,255,255,${alpha})`;
  context.lineWidth = Math.max(.8, bubble.r * .1);
  context.beginPath();
  context.arc(-bubble.r * .18, -bubble.r * .2, bubble.r * .5, Math.PI * 1.05, Math.PI * 1.48);
  context.stroke();
  context.restore();
}

function drawBurst(context: CanvasRenderingContext2D, burst: Burst) {
  const progress = clamp(burst.age / 410, 0, 1);
  const alpha = 1 - progress;
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = "rgba(220,244,255,.82)";
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(burst.x, burst.y, burst.radius * (.8 + progress * 1.5), 0, TAU);
  context.stroke();
  context.fillStyle = "rgba(210,241,255,.76)";
  for (const spark of burst.sparks) {
    context.beginPath();
    context.arc(
      burst.x + Math.cos(spark.angle) * spark.distance * progress,
      burst.y + Math.sin(spark.angle) * spark.distance * progress,
      spark.size * (1 - progress * .5),
      0,
      TAU,
    );
    context.fill();
  }
  context.restore();
}

function render2D() {
  if (!backCtx || !frontCtx) return;
  backCtx.clearRect(0, 0, width, height);
  frontCtx.clearRect(0, 0, width, height);

  for (const bubble of bubbles) {
    drawBubble(bubble.depth < .62 ? backCtx : frontCtx, bubble);
  }
  for (const burst of bursts) drawBurst(frontCtx, burst);
}

function updateBursts(dt: number) {
  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    bursts[index].age += dt * 1000;
    if (bursts[index].age >= 410) bursts.splice(index, 1);
  }
}

function frame(now: number) {
  if (!running) return;
  const dt = Math.min(.034, Math.max(.001, (now - (last || now)) / 1000));
  last = now;

  updateBubbles(dt, now);
  updateBursts(dt);

  for (const item of creatures) {
    updateCreature(item, dt, now);
    syncCreatureVisual(item, now);
  }

  render2D();
  if (renderer && scene && camera) renderer.render(scene, camera);
  raf = requestAnimationFrame(frame);
}

function start() {
  if (running || !shouldRun()) return;
  running = true;
  resize();
  const now = performance.now();
  if (!initialized) {
    initScene(now);
    initialized = true;
  }
  last = now;
  void ensureThree();
  raf = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  cancelAnimationFrame(raf);
  raf = 0;
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

function isInteractiveUiTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    "a,button,input,select,textarea,summary,[role='button'],[role='link'],[contenteditable='true'],[data-underwater-ignore]",
  ));
}

function popBubble(index: number) {
  const bubble = bubbles[index];
  bursts.push({
    x: bubble.x,
    y: bubble.y,
    radius: bubble.r,
    age: 0,
    sparks: Array.from({ length: 7 }, () => ({
      angle: rand(0, TAU),
      distance: rand(bubble.r * 1.8, bubble.r * 3.7),
      size: rand(.8, 1.9),
    })),
  });
  resetBubble(bubble);
}

function startleCreature(item: Creature, x: number, y: number, now: number) {
  let dx = item.x - x;
  let dy = item.y - y;
  const distance = Math.hypot(dx, dy) || 1;
  dx /= distance;
  dy /= distance;

  item.state = "startled";
  item.until = now + (item.preset.kind === "jelly" ? 900 : 620);
  item.followUntil = 0;
  item.hideTarget = null;

  if (item.preset.kind === "jelly") {
    item.vx = dx * item.baseSpeed * 1.7;
    item.vy = -item.baseSpeed * 2.45 + dy * item.baseSpeed;
  } else {
    item.vx = dx * item.baseSpeed * 2.85 + item.direction * item.baseSpeed * .75;
    item.vy = dy * item.baseSpeed * 2.15;
  }
}

function onPointerDown(event: PointerEvent) {
  if (!running || isInteractiveUiTarget(event.target)) return;
  const x = event.clientX;
  const y = event.clientY;

  let bubbleIndex = -1;
  let bubbleDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < bubbles.length; index += 1) {
    const bubble = bubbles[index];
    const distance = Math.hypot(x - bubble.x, y - bubble.y);
    if (distance < Math.max(12, bubble.r * 1.45) && distance < bubbleDistance) {
      bubbleIndex = index;
      bubbleDistance = distance;
    }
  }
  if (bubbleIndex >= 0) {
    popBubble(bubbleIndex);
    return;
  }

  const now = performance.now();
  const hitCandidates = creatures
    .filter((item) => item.active && item.loaded)
    .sort((a, b) => b.depth - a.depth);

  for (const item of hitCandidates) {
    const rx = item.size * (item.preset.kind === "shark" ? .82 : .7);
    const ry = item.size * (item.preset.kind === "jelly" ? .72 : .47);
    const dx = (x - item.x) / rx;
    const dy = (y - item.y) / ry;
    if (dx * dx + dy * dy <= 1) {
      startleCreature(item, x, y, now);
      return;
    }
  }
}

function disposeThree() {
  for (const item of creatures) {
    item.mixer?.stopAllAction?.();
    item.model?.traverse?.((node: any) => {
      if (!node?.isMesh) return;
      node.geometry?.dispose?.();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        if (!material) continue;
        for (const key of Object.keys(material)) {
          const value = material[key];
          if (value?.isTexture) value.dispose?.();
        }
        material.dispose?.();
      }
    });
  }

  renderer?.dispose?.();
  renderer = null;
  scene = null;
  camera = null;
  THREE = null;
  GLTFLoaderCtor = null;
}

onMounted(() => {
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
  disposeThree();
});
</script>

<template>
  <div class="underwater-ambient" aria-hidden="true">
    <canvas ref="backCanvasRef" class="underwater-ambient__layer underwater-ambient__bubbles-back" />
    <canvas ref="webglCanvasRef" class="underwater-ambient__layer underwater-ambient__creatures" />
    <canvas ref="frontCanvasRef" class="underwater-ambient__layer underwater-ambient__bubbles-front" />
  </div>
</template>

<style scoped>
.underwater-ambient {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: none;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.underwater-ambient__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.underwater-ambient__bubbles-back { z-index: 0; }
.underwater-ambient__creatures { z-index: 1; }
.underwater-ambient__bubbles-front { z-index: 2; }

@media (min-width: 1200px) and (prefers-reduced-motion: no-preference) {
  .underwater-ambient {
    display: block;
  }
}
</style>
