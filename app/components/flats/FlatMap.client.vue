<script setup lang="ts">
// Client-only Leaflet map for flat listings (OpenStreetMap tiles). `.client`
// suffix keeps it out of SSR. Leaflet is loaded from a CDN at runtime rather than
// bundled, so the site's `npm ci` deploy needs no new dependency / lockfile change.
// Uses circleMarkers so there are no missing default-marker-icon asset issues.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

interface FlatPoint { id: string; lat: number; lng: number; title: string; priceLabel?: string }
const props = defineProps<{ points: FlatPoint[] }>();
const emit = defineEmits<{ (e: "select", id: string): void }>();

const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

const el = ref<HTMLElement | null>(null);
const failed = ref(false);
let map: any = null;
let layer: any = null;

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

function render() {
  const L = (window as any).L;
  if (!map || !layer || !L) return;
  layer.clearLayers();
  const bounds: [number, number][] = [];
  for (const p of props.points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: 7, color: "#e0679a", weight: 2, fillColor: "#e0679a", fillOpacity: 0.6,
    });
    marker.bindPopup(
      `<strong>${escapeHtml(p.title)}</strong>${p.priceLabel ? `<br>${escapeHtml(p.priceLabel)}` : ""}`,
    );
    marker.on("click", () => emit("select", p.id));
    marker.addTo(layer);
    bounds.push([p.lat, p.lng]);
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
}

onMounted(async () => {
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
  render();
});
watch(() => props.points, render, { deep: true });
onBeforeUnmount(() => {
  map?.remove?.();
  map = null;
  layer = null;
});
</script>

<template>
  <div v-show="!failed" ref="el" class="flat-map" />
</template>

<style scoped>
.flat-map {
  width: 100%;
  height: 420px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
}
:deep(.leaflet-container) { background: var(--bg-panel); font-family: inherit; }
:deep(.leaflet-popup-content) { font-size: 13px; }
</style>
