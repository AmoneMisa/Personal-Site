<script setup lang="ts">
// Client-only Leaflet map for flat listings (OpenStreetMap tiles). `.client`
// suffix keeps it out of SSR. Leaflet is loaded from a CDN at runtime rather than
// bundled, so the site's `npm ci` deploy needs no new dependency / lockfile change.
//
// Nearby listings are clustered by pixel proximity at the current zoom so they
// don't stack into one unreadable blob. Clicking a cluster fans its listings out
// as small "tablet" cards in a radial menu (Sims-style) instead of hiding them
// behind each other; clicking a lone point selects it directly.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface FlatPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  priceLabel?: string;
  photo?: string;
  source?: string;
}
const props = defineProps<{
  points: FlatPoint[];
  drawLabel?: string;
  doneLabel?: string;
  clearLabel?: string;
  drawHint?: string;
  expandLabel?: string;
  collapseLabel?: string;
}>();
const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "area-change", points: Array<{ lat: number; lng: number }>): void;
}>();

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// Listings within this many screen pixels of each other merge into one cluster.
const CLUSTER_PX = 38;
// Max tablets we'll fan out (across concentric rings). Beyond this a cluster
// zooms in instead — but only if its points are actually spread out; a big
// cluster stacked on one spot always fans, since zooming can't separate it.
const MAX_RADIAL = 24;
// Fan out (don't zoom) unless the cluster spans at least this many screen pixels.
const SPREAD_PX = 50;
// Tablets per ring before starting the next, larger ring.
const RING_SIZE = 9;

const el = ref<HTMLElement | null>(null);
const failed = ref(false);
const drawing = ref(false);
const area = ref<Array<{ lat: number; lng: number }>>([]);
const radial = ref<{ x: number; y: number; items: FlatPoint[] } | null>(null);
let map: any = null;
const expanded = ref(false);

// Leaflet caches the container size, so a map that grew to fill the screen
// keeps rendering tiles for the old box until it is told to look again.
async function setExpanded(value: boolean) {
  expanded.value = value;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  await nextTick();
  // Once for the new box, once after the browser has settled: a single late
  // call left a band of unloaded tiles across the map.
  requestAnimationFrame(() => map?.invalidateSize());
  setTimeout(() => map?.invalidateSize(), 260);
  setTimeout(() => map?.invalidateSize(), 600);
}

function toggleExpanded() {
  void setExpanded(!expanded.value);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && expanded.value) void setExpanded(false);
}
let layer: any = null;
let areaLayer: any = null;
let lastFitSig = "";

function loadLeaflet(): Promise<any> {
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).L));
      existing.addEventListener("error", reject);
      if ((window as any).L) resolve((window as any).L);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

interface Cluster { lat: number; lng: number; items: FlatPoint[] }

// Group points whose current screen positions fall within CLUSTER_PX of an
// existing group's anchor. Grouping depends on zoom, so it is recomputed whenever
// the zoom changes (see zoomend below).
function clusterPoints(): Cluster[] {
  const clusters: Array<{ x: number; y: number; latSum: number; lngSum: number; items: FlatPoint[] }> = [];
  for (const p of props.points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    let placed = false;
    for (const c of clusters) {
      const dx = c.x - pt.x;
      const dy = c.y - pt.y;
      if (dx * dx + dy * dy <= CLUSTER_PX * CLUSTER_PX) {
        c.items.push(p);
        c.latSum += p.lat;
        c.lngSum += p.lng;
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ x: pt.x, y: pt.y, latSum: p.lat, lngSum: p.lng, items: [p] });
  }
  return clusters.map((c) => ({ lat: c.latSum / c.items.length, lng: c.lngSum / c.items.length, items: c.items }));
}

function renderMarkers() {
  const L = (window as any).L;
  if (!map || !layer || !L) return;
  layer.clearLayers();
  closeRadial();
  for (const c of clusterPoints()) {
    const count = c.items.length;
    const multi = count > 1;
    const size = multi ? 32 : 16;
    const icon = L.divIcon({
      className: "flat-cluster-wrap",
      html: `<span class="flat-cluster${multi ? " flat-cluster_multi" : ""}">${multi ? count : ""}</span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    const marker = L.marker([c.lat, c.lng], { icon });
    marker.on("click", () => openCluster(c));
    marker.addTo(layer);
  }
}

// Max pixel distance between any two items in the cluster at the current zoom.
// ~0 means they're stacked on one spot (zooming won't separate them).
function clusterSpreadPx(c: Cluster) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of c.items) {
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

function openCluster(c: Cluster) {
  const L = (window as any).L;
  if (c.items.length === 1) {
    emit("select", c.items[0].id);
    return;
  }
  // Only zoom when there are a lot AND they're genuinely spread out enough that
  // zooming will split them. Otherwise fan out (rings) — including big clusters
  // stacked on a single point, which zooming could never separate.
  if (c.items.length > MAX_RADIAL && clusterSpreadPx(c) > SPREAD_PX) {
    const bounds = c.items.map((p) => [p.lat, p.lng]) as [number, number][];
    map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 17 });
    return;
  }
  const pt = map.latLngToContainerPoint([c.lat, c.lng]);
  radial.value = { x: pt.x, y: pt.y, items: c.items.slice(0, MAX_RADIAL) };
}

function closeRadial() {
  radial.value = null;
}

function pick(id: string) {
  closeRadial();
  emit("select", id);
}

// Position each tablet on one of several concentric rings around the center, so
// large clusters (e.g. 13) fan out readably instead of crowding one ring.
function slotStyle(i: number, n: number) {
  const ring = Math.floor(i / RING_SIZE);
  const inRing = i % RING_SIZE;
  const countThisRing = Math.min(RING_SIZE, n - ring * RING_SIZE);
  const radius = 76 + ring * 74;
  const angle = (-90 + (360 / countThisRing) * inRing) * (Math.PI / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
    animationDelay: `${i * 22}ms`,
  };
}

function fitToPoints() {
  const bounds: [number, number][] = [];
  for (const p of props.points) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  const sig = props.points.map((p) => p.id).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function renderArea() {
  const L = (window as any).L;
  if (!areaLayer || !L) return;
  areaLayer.clearLayers();
  if (area.value.length >= 2) {
    const points = area.value.map((point) => [point.lat, point.lng]);
    if (area.value.length >= 3) {
      L.polygon(points, { color: "#e0679a", weight: 2, fillColor: "#e0679a", fillOpacity: 0.16 }).addTo(areaLayer);
    } else {
      L.polyline(points, { color: "#e0679a", weight: 2 }).addTo(areaLayer);
    }
  }
  for (const point of area.value) {
    L.circleMarker([point.lat, point.lng], { radius: 5, color: "#fff", weight: 2, fillColor: "#e0679a", fillOpacity: 1 }).addTo(areaLayer);
  }
}

function toggleDrawing() {
  drawing.value = !drawing.value;
}

function clearArea() {
  area.value = [];
  renderArea();
  emit("area-change", []);
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  if (!el.value) return;
  let L: any;
  try {
    L = await loadLeaflet();
  } catch {
    failed.value = true;
    return;
  }
  if (!el.value) return;
  map = L.map(el.value, { scrollWheelZoom: false }).setView([41.31, 69.24], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  areaLayer = L.layerGroup().addTo(map);
  map.on("click", (event: any) => {
    if (!drawing.value) {
      closeRadial();
      return;
    }
    area.value = [...area.value, { lat: event.latlng.lat, lng: event.latlng.lng }];
    renderArea();
    emit("area-change", area.value.length >= 3 ? area.value : []);
  });
  // Zoom changes the pixel spacing, so clusters must be recomputed. Any pan/zoom
  // also invalidates an open radial menu's screen position — close it.
  map.on("zoomend", renderMarkers);
  map.on("movestart", closeRadial);
  map.on("zoomstart", closeRadial);
  renderMarkers();
  fitToPoints();
});
watch(() => props.points, () => { renderMarkers(); fitToPoints(); }, { deep: true });
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  // Leaving the page while expanded would otherwise leave the body unscrollable.
  document.body.style.overflow = "";
  map?.remove?.();
  map = null;
  layer = null;
  areaLayer = null;
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
  <div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }">
    <div ref="el" class="flat-map" />

    <!-- Radial "Sims menu": tablets fanned around a clicked cluster -->
    <div v-if="radial" class="flat-radial" @click.self="closeRadial">
      <div class="flat-radial__anchor" :style="{ left: `${radial.x}px`, top: `${radial.y}px` }">
        <span class="flat-radial__hub">{{ radial.items.length }}</span>
        <div
            v-for="(item, i) in radial.items"
            :key="item.id"
            class="flat-radial__slot"
            :style="slotStyle(i, radial.items.length)"
        >
          <button type="button" class="flat-radial__tab" @click="pick(item.id)">
            <span class="flat-radial__thumb">
              <img v-if="item.photo" :src="item.photo" :alt="item.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
              <img v-else src="/svg/shark.svg" alt="" class="flat-radial__thumb-empty" loading="lazy" />
            </span>
            <span v-if="item.priceLabel" class="flat-radial__price">{{ item.priceLabel }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flat-map__tools">
      <button
          type="button"
          class="flat-map__tool"
          :class="{ 'flat-map__tool_active': expanded }"
          :aria-label="expanded ? (props.collapseLabel || 'Close map') : (props.expandLabel || 'Full screen')"
          @click="toggleExpanded"
      >
        {{ expanded ? "×" : "⤢" }} <span>{{ expanded ? (props.collapseLabel || "Close") : (props.expandLabel || "Full screen") }}</span>
      </button>
      <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': drawing }" @click="toggleDrawing">
        {{ drawing ? "✓" : "⌁" }} <span>{{ drawing ? (props.doneLabel || "Done") : (props.drawLabel || "Draw area") }}</span>
      </button>
      <button v-if="area.length" type="button" class="flat-map__tool" @click="clearArea">× <span>{{ props.clearLabel || "Clear" }}</span></button>
    </div>
    <div v-if="drawing" class="flat-map__hint">{{ props.drawHint || "Click points on the map to outline an area." }}</div>
  </div>
  </Teleport>
</template>

<style scoped>
.flat-map-shell { position: relative; z-index: 0; isolation: isolate; }
/* Full screen is a fixed overlay rather than the Fullscreen API: the drawing
   tools and the radial picker are ordinary DOM, and the API's stacking context
   would leave them behind the map. */
.flat-map-shell_full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  padding: 12px;
  background: var(--bg-primary, #0b0f2a);
}
.flat-map-shell_full .flat-map { height: 100%; border-radius: 8px; }
.flat-map {
  width: 100%;
  height: 420px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.flat-map__tools { position: absolute; z-index: 500; top: 12px; right: 12px; display: flex; gap: 7px; }
.flat-map__tool {
  min-height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px;
  background: rgba(13,17,40,0.94); color: var(--text-primary); cursor: pointer;
}
.flat-map__tool_active { color: var(--accent-pink); border-color: var(--accent-pink); }
.flat-map__hint {
  position: absolute; z-index: 500; left: 50%; bottom: 12px; transform: translateX(-50%);
  padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: rgba(13,17,40,0.94); color: var(--text-primary); font-size: 12px;
}

/* Cluster / point markers (divIcon HTML lives inside the map container, so :deep
   reaches it through the scoped ancestor attribute). */
:deep(.flat-cluster) {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: #e0679a; border: 2px solid #fff; box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
}
:deep(.flat-cluster_multi) {
  width: 32px; height: 32px;
  color: #fff; font-size: 13px; font-weight: 700;
  background: rgba(224,103,154,0.92);
}

/* Radial menu */
.flat-radial { position: absolute; inset: 0; z-index: 1000; }
.flat-radial__anchor { position: absolute; width: 0; height: 0; }
.flat-radial__hub {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--accent-pink, #e0679a); color: #fff; font-weight: 700; font-size: 13px;
  border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.45);
}
.flat-radial__slot {
  position: absolute; top: 0; left: 0;
  animation: flat-radial-in 0.24s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
@keyframes flat-radial-in {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
}
.flat-radial__tab {
  display: flex; flex-direction: column; width: 92px; padding: 0;
  border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
  background: rgba(13,17,40,0.97); color: var(--text-primary); cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,0.5); transition: transform 0.12s ease, border-color 0.12s ease;
}
.flat-radial__tab:hover { transform: translateY(-2px) scale(1.05); border-color: var(--accent-pink, #e0679a); }
.flat-radial__thumb { display: block; width: 100%; height: 60px; background: rgba(255,255,255,0.05); }
.flat-radial__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.flat-radial__thumb-empty { display: block; width: 60%; height: 60%; margin: 20% auto; object-fit: contain; opacity: 0.4; }
.flat-radial__price { padding: 4px 6px; font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

:deep(.leaflet-container) { background: var(--bg-panel); font-family: inherit; }
:deep(.leaflet-popup-content) { font-size: 13px; }
</style>
