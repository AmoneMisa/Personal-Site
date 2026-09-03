<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { FlatMapFeedResult, FlatMapPoint } from "~/types/flats";
import { primaryBoundaryGeometry } from "~/utils/mapBoundaryFocus";
import {
  bearingBetween,
  destinationPoint,
  metresBetween,
  normalizeBearing,
  sectorPolygon,
} from "~/composables/flats/useMetroProximity";
import type * as LeafletNS from "leaflet";

// Bundled from npm (same-origin, cached, no third-party round trip) but imported
// dynamically: Leaflet touches `window` at module-evaluation time, and this file's
// top-level statements still run through Nuxt's SSR module graph even though the
// component itself is client-only, so a static import here would 500 on the server.
let Leaflet: typeof LeafletNS | null = null;
async function loadLeaflet(): Promise<typeof LeafletNS> {
  if (Leaflet) return Leaflet;
  const [mod] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
  Leaflet = mod.default ?? (mod as unknown as typeof LeafletNS);
  return Leaflet;
}

interface FlatPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  priceLabel?: string;
  photo?: string;
  source?: string;
  country?: string;
}

interface MapFocusDetail {
  id: string;
  source?: string;
  country?: string;
  lat: number;
  lng: number;
}

interface FlatMapZone {
  id: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  boundary?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

type ZoneKind = "district" | "microdistrict" | "quartal" | "area" | "metro";

const props = defineProps<{
  points: FlatPoint[];
  drawLabel?: string;
  doneLabel?: string;
  clearLabel?: string;
  drawHint?: string;
  expandLabel?: string;
  collapseLabel?: string;
  scrollHintLabel?: string;
  districtZones?: FlatMapZone[];
  microdistrictMarkers?: FlatMapZone[];
  quartalMarkers?: FlatMapZone[];
  metroStations?: FlatMapZone[];
  universityZones?: FlatMapZone[];
  shoppingMallZones?: FlatMapZone[];
  parkZones?: FlatMapZone[];
  areaZones?: FlatMapZone[];
  cityZone?: FlatMapZone | null;
  selectedDistrict?: string;
  selectedMicrodistrict?: string;
  selectedQuartal?: string;
  selectedArea?: string;
  selectedMetros?: string[];
  selectedMetroRadiusM?: number;
  metroBearingFrom?: number;
  metroBearingTo?: number;
  districtsLabel?: string;
  microdistrictsLabel?: string;
  quartalsLabel?: string;
  metroLabel?: string;
  universitiesLabel?: string;
  shoppingMallsLabel?: string;
  parksLabel?: string;
  areasLabel?: string;
  cityLabel?: string;
  metroRadiusHandleLabel?: string;
  metroArcHandleLabel?: string;
  fitResultsLabel?: string;
}>();

const emit = defineEmits<{
  // The source travels with the id: listing ids are only unique per source, so
  // an id alone can resolve to a different advert than the marker that was clicked.
  (e: "select", identity: { id: string; source?: string }): void;
  (e: "area-change", points: Array<{ lat: number; lng: number }>): void;
  (e: "zone-select", payload: { kind: ZoneKind; name: string; radiusM?: number }): void;
  // Metro is multi-select, so it toggles one station rather than replacing the
  // selection the way the single-value zone kinds do.
  (e: "metro-toggle", name: string): void;
  // Emitted once per drag, on release: dragging re-renders locally at 60fps and
  // only the settled value is worth a feed request.
  (e: "metro-shape", shape: { radiusM: number; bearingFrom?: number; bearingTo?: number }): void;
}>();

const route = useRoute();
const router = useRouter();
const CLUSTER_PX = 38;
// Any cluster with real geographic spread zooms in as far as the map allows before
// falling back to the radial popout — only listings that are still coincident at
// max zoom (same building) can't be separated by zooming and need the popout.
const ZOOM_CLUSTER_THRESHOLD = 1;
const CLUSTER_ZOOM_MAX = 19;
const RADIAL_PAGE_SIZE = 9;
const FOCUS_ZOOM = 18;
// Shown only while no station is chosen, as a hint of the usual walking bands.
// Once a station is picked the shape becomes free-form and these stop mattering.
const METRO_PRESET_RINGS = [[1000, "#8b5cf6", .055], [500, "#22c55e", .08], [200, "#f59e0b", .13]] as const;
const DEFAULT_METRO_RADIUS_M = 500;
// The invisible click disc under each station dot. Sized for a fingertip
// rather than for the 6px the dot itself draws.
const METRO_MARKER_HIT_RADIUS = 14;
const METRO_MIN_RADIUS_M = 100;
const METRO_MAX_RADIUS_M = 5000;
// Query keys that describe *what is open on top of* the results, not which
// results exist. The map feed must ignore them: `adv`/`flat` are written by
// syncListingInUrl every time a listing is opened, and `page` by the infinite
// scroll bookmark, so counting them would refetch and rebuild every marker
// (and flash the layer) on a click that changed no filter at all.
const DETAIL_QUERY_KEYS = new Set(["adv", "flat", "flatSource", "flatCountry", "shared", "page"]);

const el = ref<HTMLElement | null>(null);
const failed = ref(false);
const drawing = ref(false);
const scrollActive = ref(false);
const area = ref<Array<{ lat: number; lng: number }>>([]);
const radial = ref<{ x: number; y: number; items: FlatPoint[]; page: number } | null>(null);
const expanded = ref(false);
const remotePoints = ref<FlatPoint[]>([]);
const focusedPoint = ref<MapFocusDetail | null>(null);
const showDistricts = ref(true);
const showMicrodistricts = ref(false);
const showQuartals = ref(false);
const showMetro = ref(true);
const showUniversities = ref(false);
const showShoppingMalls = ref(false);
const showParks = ref(false);
const showAreas = ref(true);
const showCity = ref(true);
const selectedDistrictName = ref<string | null>(null);
let mapFeedSequence = 0;
let lastMapFeedKey = "";
// Mirrors the feed's own client cache (useFlatFeed): a re-visited filter
// combination -- most commonly a checkbox toggled off and back on -- repaints
// the pins immediately instead of waiting on a network round trip, even though
// the server itself answers it from its own 30s cache.
const MAP_FEED_CACHE_TTL_MS = 60_000;
const MAP_FEED_CACHE_MAX_ENTRIES = 40;
const mapFeedCache = new Map<string, { at: number; points: FlatPoint[] }>();

function readMapFeedCache(key: string): FlatPoint[] | undefined {
  const entry = mapFeedCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > MAP_FEED_CACHE_TTL_MS) {
    mapFeedCache.delete(key);
    return undefined;
  }
  return entry.points;
}

function writeMapFeedCache(key: string, points: FlatPoint[]) {
  mapFeedCache.delete(key);
  mapFeedCache.set(key, { at: Date.now(), points });
  while (mapFeedCache.size > MAP_FEED_CACHE_MAX_ENTRIES) {
    const oldest = mapFeedCache.keys().next().value;
    if (oldest === undefined) break;
    mapFeedCache.delete(oldest);
  }
}

function pointKey(point: Pick<FlatPoint, "id" | "source" | "country">): string {
  return `${point.source || ""}:${point.country || ""}:${point.id}`;
}

function fallbackPriceLabel(point: FlatMapPoint): string | undefined {
  if (point.price == null || !Number.isFinite(Number(point.price))) return undefined;
  const value = Number(point.price).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return point.currency ? `${value} ${point.currency}` : value;
}

function normalizedRouteQuery(): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, raw] of Object.entries(route.query)) {
    if (DETAIL_QUERY_KEYS.has(key)) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value == null || value === "") continue;
    query[key] = String(value);
  }
  return query;
}

function shapeMapPoints(data: FlatMapFeedResult | undefined): FlatPoint[] {
  return (data?.mapPoints || [])
    .filter((point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)))
    .map((point) => ({
      id: String(point.id),
      source: point.source,
      country: point.country,
      lat: Number(point.lat),
      lng: Number(point.lng),
      title: point.title || "",
      priceLabel: fallbackPriceLabel(point),
    }));
}

async function loadFullMapFeed() {
  if (!import.meta.client) return;
  const query = normalizedRouteQuery();
  const key = new URLSearchParams(query).toString();
  if (key === lastMapFeedKey && remotePoints.value.length) return;
  lastMapFeedKey = key;
  const sequence = ++mapFeedSequence;

  const cached = readMapFeedCache(key);
  if (cached) {
    // Paint the held answer now, then quietly confirm it is still current. A
    // network error on the revalidation leaves the cached pins on screen
    // rather than clearing them -- see the catch below.
    remotePoints.value = cached;
  }

  try {
    const data = await $fetch<FlatMapFeedResult>("/flats-map", { query });
    if (sequence !== mapFeedSequence) return;
    const points = shapeMapPoints(data);
    remotePoints.value = points;
    writeMapFeedCache(key, points);
  } catch {
    // The already-loaded page points (or the cached pins painted above) remain
    // a complete fallback when the compact map request is unavailable; never
    // take the map down with the secondary feed.
  }
}

const renderedPoints = computed<FlatPoint[]>(() => {
  const merged = new Map<string, FlatPoint>();
  for (const point of remotePoints.value) merged.set(pointKey(point), point);
  // Loaded cards win: they contain localized titles, converted prices and photos.
  for (const point of props.points) {
    const exactKey = pointKey(point);
    if (point.country || !point.source) {
      merged.set(exactKey, point);
      continue;
    }
    const remote = remotePoints.value.find((candidate) => candidate.id === point.id && candidate.source === point.source);
    merged.set(remote ? pointKey(remote) : exactKey, { ...remote, ...point });
  }
  return [...merged.values()];
});

const radialPageCount = computed(() => {
  const count = radial.value?.items.length ?? 0;
  return Math.max(1, Math.ceil(count / RADIAL_PAGE_SIZE));
});

const visibleRadialItems = computed(() => {
  const current = radial.value;
  if (!current) return [];
  const start = current.page * RADIAL_PAGE_SIZE;
  return current.items.slice(start, start + RADIAL_PAGE_SIZE);
});

const radialPageLabel = computed(() => {
  const current = radial.value;
  if (!current) return "";
  return `${current.page + 1}/${radialPageCount.value}`;
});

const selectedMetros = computed(() => props.selectedMetros || []);

// While a handle is held, the draft values win over the props so the wedge
// tracks the pointer without a round trip through the parent and the feed.
// Cleared on release, which is also when the parent is told the settled shape.
const draftRadiusM = ref<number | null>(null);
const draftBearingFrom = ref<number | null>(null);
const draftBearingTo = ref<number | null>(null);
const shapeRadiusM = computed(() => draftRadiusM.value ?? props.selectedMetroRadiusM ?? DEFAULT_METRO_RADIUS_M);
const shapeBearingFrom = computed(() => draftBearingFrom.value ?? props.metroBearingFrom ?? null);
const shapeBearingTo = computed(() => draftBearingTo.value ?? props.metroBearingTo ?? null);

let map: any = null;
let layer: any = null;
let areaLayer: any = null;
let focusLayer: any = null;
let districtLayer: any = null;
let microdistrictLayer: any = null;
let quartalLayer: any = null;
let metroLayer: any = null;
let universityLayer: any = null;
let shoppingMallLayer: any = null;
let parkLayer: any = null;
let zoneAreaLayer: any = null;
let cityLayer: any = null;
let lastFitSig = "";
let metroShapePath: any = null;
let metroShapeStation: FlatMapZone | null = null;
let metroRadiusHandle: any = null;
let metroFromHandle: any = null;
let metroToHandle: any = null;
let draggingMetroHandle: any = null;

async function setExpanded(value: boolean) {
  expanded.value = value;
  scrollActive.value = false;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  // Wheel-zoom stays off while the map is embedded inline so scrolling the page
  // over it doesn't get hijacked; once expanded to full screen it no longer
  // shares scroll with the page, so the wheel can zoom the map as expected.
  if (value) map?.scrollWheelZoom?.enable();
  else map?.scrollWheelZoom?.disable();
  await nextTick();
  requestAnimationFrame(() => map?.invalidateSize());
  setTimeout(() => map?.invalidateSize(), 260);
  setTimeout(() => map?.invalidateSize(), 600);
}

function toggleExpanded() {
  void setExpanded(!expanded.value);
}

// Inline, scroll-wheel zoom stays off (see setExpanded above) so page-scroll never
// gets hijacked. A click "activates" it for as long as the cursor stays over the
// map, mirroring the pattern embedded map widgets use to stay scroll-friendly
// while still letting an engaged user zoom without reaching for the buttons.
function activateScroll() {
  if (expanded.value || scrollActive.value) return;
  scrollActive.value = true;
  map?.scrollWheelZoom?.enable();
}

function deactivateScroll() {
  if (expanded.value) return;
  scrollActive.value = false;
  map?.scrollWheelZoom?.disable();
}

function closeRadial() {
  radial.value = null;
}

function changeRadialPage(direction: -1 | 1) {
  const current = radial.value;
  if (!current || radialPageCount.value <= 1) return;
  const next = (current.page + direction + radialPageCount.value) % radialPageCount.value;
  radial.value = { ...current, page: next };
}

function onKeydown(event: KeyboardEvent) {
  if (radial.value) {
    if (event.key === "Escape") {
      closeRadial();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      changeRadialPage(event.key === "ArrowRight" ? 1 : -1);
      event.preventDefault();
      return;
    }
  }
  if (event.key === "Escape" && expanded.value) void setExpanded(false);
}

interface Cluster { lat: number; lng: number; items: FlatPoint[] }

function clusterPoints(): Cluster[] {
  // Same greedy "join the first cluster within CLUSTER_PX" rule as before, but
  // candidates come from a CLUSTER_PX grid instead of the whole cluster list.
  // Comparing every point against every cluster made this quadratic, and it runs
  // on every zoomend and every feed change — with a few hundred markers that was
  // the pause you felt after releasing a zoom.
  type Cell = { x: number; y: number; latSum: number; lngSum: number; items: FlatPoint[] };
  const clusters: Cell[] = [];
  const grid = new Map<string, Cell[]>();
  for (const p of renderedPoints.value) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    const cellX = Math.floor(pt.x / CLUSTER_PX);
    const cellY = Math.floor(pt.y / CLUSTER_PX);
    let placed: Cell | undefined;
    // A cluster within CLUSTER_PX can only sit in this cell or one touching it.
    for (let dx = -1; dx <= 1 && !placed; dx++) {
      for (let dy = -1; dy <= 1 && !placed; dy++) {
        for (const c of grid.get(`${cellX + dx}:${cellY + dy}`) || []) {
          const ox = c.x - pt.x;
          const oy = c.y - pt.y;
          if (ox * ox + oy * oy <= CLUSTER_PX * CLUSTER_PX) { placed = c; break; }
        }
      }
    }
    if (placed) {
      placed.items.push(p);
      placed.latSum += p.lat;
      placed.lngSum += p.lng;
      continue;
    }
    const created: Cell = { x: pt.x, y: pt.y, latSum: p.lat, lngSum: p.lng, items: [p] };
    clusters.push(created);
    const key = `${cellX}:${cellY}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(created);
    else grid.set(key, [created]);
  }
  return clusters.map((c) => ({
    lat: c.latSum / c.items.length,
    lng: c.lngSum / c.items.length,
    items: c.items,
  }));
}

function renderMarkers() {
  const L = Leaflet;
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
    marker.on("click", (event: any) => handleLayerClick(event, () => openCluster(c)));
    marker.addTo(layer);
  }
}

function renderFocusedPoint() {
  const L = Leaflet;
  if (!focusLayer || !L) return;
  focusLayer.clearLayers();
  const point = focusedPoint.value;
  if (!point) return;
  L.circleMarker([point.lat, point.lng], {
    radius: 12,
    color: "#ffffff",
    weight: 3,
    fillColor: "#e0679a",
    fillOpacity: 0.95,
  }).addTo(focusLayer);
  L.circleMarker([point.lat, point.lng], {
    radius: 20,
    color: "#e0679a",
    weight: 2,
    opacity: 0.58,
    fillOpacity: 0,
  }).addTo(focusLayer);
}

function focusOnPoint(detail: MapFocusDetail) {
  const lat = Number(detail?.lat);
  const lng = Number(detail?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  focusedPoint.value = { ...detail, lat, lng };
  renderFocusedPoint();

  const shell = el.value?.closest(".flat-map-shell") as HTMLElement | null;
  shell?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!map) return;
  window.setTimeout(() => {
    map?.invalidateSize?.();
    map?.flyTo?.([lat, lng], FOCUS_ZOOM, { animate: true, duration: 0.75 });
    renderFocusedPoint();
  }, 180);
}

function onMapFocus(event: Event) {
  const detail = (event as CustomEvent<MapFocusDetail>).detail;
  if (detail) focusOnPoint(detail);
}

function radialRadius(count: number): number {
  const mobile = window.innerWidth <= 640;
  if (mobile) return count <= 4 ? 72 : 94;
  return count <= 4 ? 112 : 142;
}

function clampRadialCoordinate(value: number, clearance: number, viewport: number): number {
  if (viewport <= clearance * 2) return viewport / 2;
  return Math.min(viewport - clearance, Math.max(clearance, value));
}

function openPoint(point: FlatPoint) {
  closeRadial();
  const loaded = props.points.some((candidate) => candidate.id === point.id && (!point.source || candidate.source === point.source));
  if (loaded) {
    emit("select", { id: point.id, source: point.source });
    return;
  }
  if (!point.source || !point.country) return;
  void router.replace({
    query: {
      ...route.query,
      flat: point.id,
      flatSource: point.source,
      flatCountry: point.country,
    },
  });
}

function openCluster(c: Cluster) {
  const L = Leaflet;
  if (c.items.length === 1) {
    openPoint(c.items[0]);
    return;
  }
  // A formed cluster's on-screen spread is small by construction (that's why the
  // points merged), so checking pixel spread mostly missed genuinely distinct
  // addresses. Checking the real lat/lng bounds instead: if the points aren't all
  // literally the same coordinate, zooming in will keep separating them further.
  const bounds = L.latLngBounds(c.items.map((p) => [p.lat, p.lng]) as [number, number][]);
  const hasRealSpread = !bounds.getNorthEast().equals(bounds.getSouthWest());
  if (c.items.length > ZOOM_CLUSTER_THRESHOLD && hasRealSpread && map.getZoom() < CLUSTER_ZOOM_MAX) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: CLUSTER_ZOOM_MAX });
    return;
  }
  const pt = map.latLngToContainerPoint([c.lat, c.lng]);
  const rect = el.value?.getBoundingClientRect();
  if (!rect) return;

  const count = Math.min(c.items.length, RADIAL_PAGE_SIZE);
  const radius = radialRadius(count);
  const mobile = window.innerWidth <= 640;
  const halfTabWidth = mobile ? 39 : 48;
  const halfTabHeight = mobile ? 33 : 43;
  const rawX = rect.left + pt.x;
  const rawY = rect.top + pt.y;
  const x = clampRadialCoordinate(rawX, radius + halfTabWidth + 8, window.innerWidth);
  const y = clampRadialCoordinate(rawY, radius + halfTabHeight + 8, window.innerHeight);
  radial.value = { x, y, items: [...c.items], page: 0 };
}

function slotStyle(i: number, n: number) {
  const radius = radialRadius(n);
  const angle = (-90 + (360 / Math.max(1, n)) * i) * (Math.PI / 180);
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
    animationDelay: `${i * 22}ms`,
  };
}

function fitToPoints() {
  if (!map || focusedPoint.value) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

/**
 * The manual "frame my results" action behind the toolbar button. Unlike
 * fitToPoints it ignores the signature guard and a focused pin: those exist
 * to stop the *automatic* fit from fighting a deliberate view, which is
 * exactly what someone pressing this is asking to override. Panning away
 * from the results was otherwise one-way -- the automatic fit only runs when
 * the result set itself changes.
 */
function fitToPointsNow() {
  if (!map) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) {
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  }
  if (!bounds.length) return;
  focusedPoint.value = null;
  renderFocusedPoint();
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  // Let the automatic fit run again for the next result set rather than
  // treating this manual framing as the one already applied.
  lastFitSig = "";
}

function renderArea() {
  const L = Leaflet;
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

function eventLatLng(event: any): { lat: number; lng: number } | null {
  const original = event?.originalEvent;
  if (original && map?.mouseEventToLatLng) {
    try {
      const point = map.mouseEventToLatLng(original);
      if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) return { lat: point.lat, lng: point.lng };
    } catch {
      // Fall through to Leaflet's event lat/lng for synthetic and marker events.
    }
  }
  const lat = Number(event?.latlng?.lat);
  const lng = Number(event?.latlng?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function addDrawPoint(event: any): boolean {
  if (!drawing.value) return false;
  const point = eventLatLng(event);
  if (!point) return true;
  area.value = [...area.value, point];
  renderArea();
  emit("area-change", area.value.length >= 3 ? area.value : []);
  return true;
}

function stopLayerClick(event: any) {
  const L = Leaflet;
  const original = event?.originalEvent ?? event;
  if (L && original) L.DomEvent.stopPropagation(original);
}

function handleLayerClick(event: any, action: () => void) {
  activateScroll();
  stopLayerClick(event);
  if (addDrawPoint(event)) return;
  action();
}

function selectedName(kind: ZoneKind): string {
  if (kind === "district") return props.selectedDistrict || "";
  if (kind === "microdistrict") return props.selectedMicrodistrict || "";
  if (kind === "quartal") return props.selectedQuartal || "";
  if (kind === "area") return props.selectedArea || "";
  // Metro is the one multi-select kind. The single name is only what the map
  // focuses and anchors the shared radius/arc shape on: the first chosen station.
  return selectedMetros.value[0] || "";
}

function isZoneSelected(kind: ZoneKind, name: string): boolean {
  if (kind === "metro") return selectedMetros.value.includes(name);
  return selectedName(kind) === name;
}

function emitZoneSelect(kind: ZoneKind, name: string, radiusM?: number) {
  closeRadial();
  const sameZone = isZoneSelected(kind, name);
  const sameRadius = kind !== "metro" || radiusM == null || Number(props.selectedMetroRadiusM) === radiusM;
  const nextName = sameZone && sameRadius ? "" : name;
  if (kind === "district") {
    selectedDistrictName.value = nextName || null;
    renderDistrictZones();
  }
  emit("zone-select", {
    kind,
    name: nextName,
    ...(kind === "metro" && nextName && radiusM != null ? { radiusM } : {}),
  });
}

function selectedZoneFromProps(): { kind: ZoneKind; zone: FlatMapZone } | null {
  const groups: Array<[ZoneKind, FlatMapZone[] | undefined, string | undefined]> = [
    ["metro", props.metroStations, selectedMetros.value[0]],
    ["area", props.areaZones, props.selectedArea],
    ["quartal", props.quartalMarkers, props.selectedQuartal],
    ["microdistrict", props.microdistrictMarkers, props.selectedMicrodistrict],
    ["district", props.districtZones, props.selectedDistrict],
  ];
  for (const [kind, zones, name] of groups) {
    if (!name) continue;
    const zone = (zones || []).find((candidate) => candidate.name === name);
    if (zone) return { kind, zone };
  }
  return null;
}

function enableLayerFor(kind: ZoneKind) {
  if (kind === "district") showDistricts.value = true;
  else if (kind === "microdistrict") showMicrodistricts.value = true;
  else if (kind === "quartal") showQuartals.value = true;
  else if (kind === "area") showAreas.value = true;
  else showMetro.value = true;
}

function syncSelectionFromProps(focus = false) {
  selectedDistrictName.value = props.selectedDistrict || null;
  const selected = selectedZoneFromProps();
  if (selected) enableLayerFor(selected.kind);
  renderAllZoneLayers();
  if (focus && selected) focusZone(selected.zone);
}

function focusZone(zone: FlatMapZone) {
  if (!map) return;
  if (zone.boundary && Leaflet) {
    const focusBoundary = primaryBoundaryGeometry(zone.boundary);
    map.flyToBounds(Leaflet.geoJSON(focusBoundary as any).getBounds(), { padding: [42, 42], maxZoom: 15, duration: 0.65 });
  } else {
    map.flyTo([zone.lat, zone.lng], kindZoom(zone), { animate: true, duration: 0.65 });
  }
}

function kindZoom(zone: FlatMapZone): number {
  return zone.radiusM >= 1200 ? 13 : zone.radiusM >= 500 ? 14 : 15;
}

// Renders a zone as its real boundary polygon when the catalog provides one, falling
// back to an approximated circle (sized upstream to avoid overlap) when it doesn't.
function renderZoneShape(layerGroup: any, zone: FlatMapZone, kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  const selected = isZoneSelected(kind, zone.name);
  const baseWeight = Number(style.weight ?? 2);
  const baseFillOpacity = Number(style.fillOpacity ?? 0.16);
  const selectedStyle = selected
    ? { ...style, weight: baseWeight + 1.25, opacity: 1, fillOpacity: Math.min(.42, baseFillOpacity + .14) }
    : style;
  const onClick = (event: any) => handleLayerClick(event, () => {
    if (!selected) focusZone(zone);
    emitZoneSelect(kind, zone.name);
  });
  if (zone.boundary) {
    const shape = L.geoJSON(zone.boundary as any, { style: () => selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
    shape.on("click", onClick);
    shape.bindTooltip(zone.label, { direction: "top" });
    if (selected) shape.openTooltip?.();
    return shape;
  }
  const circle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, ...selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
  circle.on("click", onClick);
  circle.bindTooltip(zone.label, { direction: "top" });
  if (selected) circle.openTooltip?.();
  return circle;
}

function renderDistrictZones() {
  const L = Leaflet;
  if (!districtLayer || !L) return;
  districtLayer.clearLayers();
  if (!showDistricts.value) return;
  for (const zone of props.districtZones || []) {
    const dimmed = selectedDistrictName.value != null && zone.name !== selectedDistrictName.value;
    const className = `flat-zone-shape${dimmed ? " flat-zone-shape_dim" : ""}`;
    renderZoneShape(districtLayer, zone, "district", { color: zone.color, weight: 2.5, opacity: dimmed ? 0.5 : 0.9, fillColor: zone.color, fillOpacity: dimmed ? 0.08 : 0.22, className });
    const label = L.divIcon({
      className: "flat-zone-label-wrap",
      html: `<span class="flat-zone-label${dimmed ? " flat-zone-label_dim" : ""}" style="border-color:${zone.color}">${zone.label}</span>`,
      iconSize: [0, 0],
    });
    L.marker([zone.lat, zone.lng], { icon: label, interactive: false }).addTo(districtLayer);
  }
}

function renderZoneShapes(layerGroup: any, zones: FlatMapZone[], kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  if (!layerGroup || !L) return;
  layerGroup.clearLayers();
  for (const zone of zones) {
    renderZoneShape(layerGroup, zone, kind, { ...style, color: zone.color, fillColor: zone.color, className: "flat-zone-shape" });
  }
}

function renderMicrodistricts() {
  if (showMicrodistricts.value) renderZoneShapes(microdistrictLayer, props.microdistrictMarkers || [], "microdistrict", { weight: 2, opacity: .9, fillOpacity: .18 });
  else microdistrictLayer?.clearLayers();
}

function renderQuartals() {
  if (showQuartals.value) renderZoneShapes(quartalLayer, props.quartalMarkers || [], "quartal", { weight: 1.5, dashArray: "3 4", opacity: .9, fillOpacity: .16 });
  else quartalLayer?.clearLayers();
}

function nearestMetroStation(point: { lat: number; lng: number }): FlatMapZone | null {
  if (!map) return null;
  let nearest: FlatMapZone | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const station of props.metroStations || []) {
    const distance = map.distance([point.lat, point.lng], [station.lat, station.lng]);
    if (distance <= 1000 && distance < nearestDistance) {
      nearest = station;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function metroToggle(station: FlatMapZone) {
  closeRadial();
  if (!isZoneSelected("metro", station.name)) focusZone(station);
  emit("metro-toggle", station.name);
}

/** The preset rings, drawn only while nothing is selected yet (discovery mode). */
function renderMetroPresetRings(station: FlatMapZone) {
  const L = Leaflet;
  for (const [radius, color, opacity] of METRO_PRESET_RINGS) {
    const ring = L.circle([station.lat, station.lng], {
      radius,
      color,
      weight: 1.25,
      opacity: .75,
      fillColor: color,
      fillOpacity: opacity,
      bubblingMouseEvents: false,
    }).addTo(metroLayer);
    ring.bindTooltip(`${station.label} · ${radius} m`, { direction: "top" });
    ring.on("click", (event: any) => handleLayerClick(event, () => {
      const point = eventLatLng(event);
      const nearest = point ? nearestMetroStation(point) : station;
      if (!nearest) return;
      focusZone(nearest);
      // Clicking a preset ring says both things at once: this station, this far.
      emit("metro-toggle", nearest.name);
      emit("metro-shape", { radiusM: radius });
    }));
  }
}

function metroShapeTooltip(): string {
  const from = shapeBearingFrom.value;
  const to = shapeBearingTo.value;
  const distance = `${Math.round(shapeRadiusM.value)} m`;
  if (from == null || to == null) return distance;
  return `${distance} · ${Math.round(from)}°–${Math.round(to)}°`;
}

/** Where each handle sits: the radius grip on the arc midpoint, the wedge grips on its edges. */
function handleBearing(kind: "radius" | "from" | "to"): number {
  const from = shapeBearingFrom.value;
  const to = shapeBearingTo.value;
  if (from == null || to == null) return kind === "from" ? 270 : kind === "to" ? 90 : 0;
  if (kind === "from") return from;
  if (kind === "to") return to;
  return normalizeBearing(from + normalizeBearing(to - from) / 2);
}

/** Redraws the wedge in place, cheap enough to run on every drag frame. */
function refreshMetroShape() {
  if (!metroShapePath || !metroShapeStation) return;
  const outline = sectorPolygon(
    metroShapeStation,
    shapeRadiusM.value,
    shapeBearingFrom.value ?? undefined,
    shapeBearingTo.value ?? undefined,
  ).map((point) => [point.lat, point.lng]);
  metroShapePath.setLatLngs(outline);
  metroShapePath.setTooltipContent?.(metroShapeTooltip());
  const handles: Array<[any, "radius" | "from" | "to"]> = [
    [metroRadiusHandle, "radius"],
    [metroFromHandle, "from"],
    [metroToHandle, "to"],
  ];
  for (const [handle, kind] of handles) {
    // Never fight the grip the pointer is holding.
    if (!handle || handle === draggingMetroHandle) continue;
    const at = destinationPoint(metroShapeStation, handleBearing(kind), shapeRadiusM.value);
    handle.setLatLng([at.lat, at.lng]);
  }
}

function makeMetroHandle(station: FlatMapZone, kind: "radius" | "from" | "to") {
  const L = Leaflet;
  const at = destinationPoint(station, handleBearing(kind), shapeRadiusM.value);
  const handle = L.marker([at.lat, at.lng], {
    draggable: true,
    keyboard: false,
    zIndexOffset: 600,
    icon: L.divIcon({
      className: "flat-metro-handle-wrap",
      html: `<span class="flat-metro-handle flat-metro-handle_${kind}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  });
  handle.bindTooltip(
    kind === "radius"
      ? props.metroRadiusHandleLabel || "Drag to set distance"
      : props.metroArcHandleLabel || "Drag to set direction",
    { direction: "top" },
  );

  handle.on("dragstart", () => { draggingMetroHandle = handle; });

  handle.on("drag", () => {
    const point = handle.getLatLng();
    const target = { lat: point.lat, lng: point.lng };
    if (kind === "radius") {
      // Snapped to 10 m: the filter itself is exact, but a radius that reads
      // "783 m" in a shared URL is noise dressed up as precision.
      const metres = metresBetween(station, target);
      draftRadiusM.value = Math.max(
        METRO_MIN_RADIUS_M,
        Math.min(METRO_MAX_RADIUS_M, Math.round(metres / 10) * 10),
      );
    } else {
      // Opening the arc from a full circle anchors the opposite edge 180 degrees
      // away, so the first drag yields a half-plane rather than a zero-width
      // sliver that would match nothing.
      const bearing = normalizeBearing(Math.round(bearingBetween(station, target)));
      const from = shapeBearingFrom.value;
      const to = shapeBearingTo.value;
      if (kind === "from") {
        draftBearingFrom.value = bearing;
        draftBearingTo.value = to ?? normalizeBearing(bearing + 180);
      } else {
        draftBearingTo.value = bearing;
        draftBearingFrom.value = from ?? normalizeBearing(bearing - 180);
      }
    }
    refreshMetroShape();
  });

  handle.on("dragend", () => {
    draggingMetroHandle = null;
    // One emit per drag, on release: the shape re-renders locally at pointer
    // speed, but only the settled value is worth a feed request.
    emit("metro-shape", {
      radiusM: shapeRadiusM.value,
      bearingFrom: shapeBearingFrom.value ?? undefined,
      bearingTo: shapeBearingTo.value ?? undefined,
    });
    draftRadiusM.value = null;
    draftBearingFrom.value = null;
    draftBearingTo.value = null;
  });

  handle.addTo(metroLayer);
  return handle;
}

/**
 * The chosen stations share one shape -- same radius, same arc -- because they
 * express a single rule ("within 780 m, west side"), so the drag handles are
 * attached to the first station only. Three grips on every station would be a
 * thicket, and moving one would have to move the rest anyway.
 */
function renderMetroSelection(stations: FlatMapZone[]) {
  const L = Leaflet;
  const primary = stations[0];
  if (!primary) return;
  metroShapeStation = primary;
  for (const station of stations) {
    const outline = L.polygon(
      sectorPolygon(
        station,
        shapeRadiusM.value,
        shapeBearingFrom.value ?? undefined,
        shapeBearingTo.value ?? undefined,
      ).map((point) => [point.lat, point.lng]),
      {
        color: "#e0679a",
        weight: 2,
        opacity: .95,
        fillColor: "#e0679a",
        fillOpacity: .14,
        bubblingMouseEvents: false,
      },
    ).addTo(metroLayer);
    outline.bindTooltip(`${station.label} · ${metroShapeTooltip()}`, { direction: "top" });
    outline.on("click", (event: any) => handleLayerClick(event, () => metroToggle(station)));
    if (station === primary) metroShapePath = outline;
  }
  metroRadiusHandle = makeMetroHandle(primary, "radius");
  metroFromHandle = makeMetroHandle(primary, "from");
  metroToHandle = makeMetroHandle(primary, "to");
}

function renderMetro() {
  const L = Leaflet;
  if (!metroLayer || !L) return;
  metroLayer.clearLayers();
  metroShapePath = null;
  metroShapeStation = null;
  metroRadiusHandle = null;
  metroFromHandle = null;
  metroToHandle = null;
  draggingMetroHandle = null;
  if (!showMetro.value) return;

  const stations = props.metroStations || [];
  const chosen = stations.filter((station) => isZoneSelected("metro", station.name));
  // Every station keeps its dot. It was the three overlapping rings across
  // ~30 stations that made the map unreadable, not the dots -- and drawing
  // only the chosen ones would leave no way to add a second station by
  // clicking the map at all. Unchosen ones just recede.
  const anyChosen = chosen.length > 0;
  if (anyChosen) renderMetroSelection(chosen);

  for (const station of stations) {
    const stationSelected = isZoneSelected("metro", station.name);
    if (!anyChosen) renderMetroPresetRings(station);

    const select = (event: any) => handleLayerClick(event, () => metroToggle(station));
    // A 6px dot is a 6px click target, which on a touch screen is a coin
    // toss. This invisible disc under it takes the click instead, without
    // making the visible marker any bigger.
    const hitTarget = L.circleMarker([station.lat, station.lng], {
      radius: METRO_MARKER_HIT_RADIUS,
      opacity: 0,
      fillOpacity: 0,
      bubblingMouseEvents: false,
    }).addTo(metroLayer);
    hitTarget.on("click", select);

    const marker = L.circleMarker([station.lat, station.lng], {
      radius: stationSelected ? 8 : 6,
      color: "#fff",
      weight: stationSelected ? 3 : 2,
      opacity: anyChosen && !stationSelected ? 0.5 : 1,
      fillColor: stationSelected ? "#e0679a" : "#2563eb",
      fillOpacity: anyChosen && !stationSelected ? 0.45 : 1,
      bubblingMouseEvents: false,
    });
    marker.bindTooltip(
      stationSelected
        ? `${station.label} · ${metroShapeTooltip()}`
        : `${station.label} · 200 / 500 / 1000 m`,
      { direction: "top" },
    );
    if (stationSelected) marker.openTooltip?.();
    marker.on("click", select);
    marker.addTo(metroLayer);
  }
}

function renderAmenityLayer(layerGroup: any, zones: FlatMapZone[], visible: boolean, symbol: string) {
  const L = Leaflet;
  if (!layerGroup || !L) return;
  layerGroup.clearLayers();
  if (!visible) return;
  for (const zone of zones) {
    if (zone.boundary) {
      const shape = L.geoJSON(zone.boundary as any, {
        style: () => ({ color: zone.color, weight: 2, opacity: .95, fillColor: zone.color, fillOpacity: .2, className: "flat-zone-shape" }),
        bubblingMouseEvents: false,
      }).addTo(layerGroup);
      shape.bindTooltip(zone.label, { direction: "top" });
      shape.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));
      continue;
    }
    const icon = L.divIcon({
      className: "flat-amenity-marker-wrap",
      html: `<span class="flat-amenity-marker" style="--amenity-color:${zone.color}">${symbol}</span>`,
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    const marker = L.marker([zone.lat, zone.lng], { icon, bubblingMouseEvents: false });
    marker.bindTooltip(zone.label, { direction: "top", offset: [0, -11] });
    marker.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));
    marker.addTo(layerGroup);
  }
}

function renderAmenities() {
  renderAmenityLayer(universityLayer, props.universityZones || [], showUniversities.value, "U");
  renderAmenityLayer(shoppingMallLayer, props.shoppingMallZones || [], showShoppingMalls.value, "ТЦ");
  renderAmenityLayer(parkLayer, props.parkZones || [], showParks.value, "♣");
}

function renderAreaZones() {
  const L = Leaflet;
  if (!zoneAreaLayer || !L) return;
  zoneAreaLayer.clearLayers();
  if (!showAreas.value) return;
  for (const zone of props.areaZones || []) {
    const shape = renderZoneShape(zoneAreaLayer, zone, "area", { color: zone.color, weight: 2, dashArray: "6 5", fillColor: zone.color, fillOpacity: 0.14 });
    if (!zone.boundary) shape.bindTooltip(zone.label, { direction: "top" });
  }
}

function renderCityZone() {
  const L = Leaflet;
  if (!cityLayer || !L) return;
  cityLayer.clearLayers();
  const zone = props.cityZone;
  if (!showCity.value || !zone?.boundary) return;
  L.geoJSON(zone.boundary as any, {
    style: () => ({ color: zone.color, weight: 2, opacity: 0.55, dashArray: "4 6", fill: false, interactive: false }),
  }).addTo(cityLayer);
}

function renderAllZoneLayers() {
  renderCityZone();
  renderDistrictZones();
  renderMicrodistricts();
  renderQuartals();
  renderMetro();
  renderAmenities();
  renderAreaZones();
}

function toggleDrawing() {
  drawing.value = !drawing.value;
  if (drawing.value) closeRadial();
}

function clearArea() {
  area.value = [];
  renderArea();
  emit("area-change", []);
}

onMounted(async () => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", closeRadial, { passive: true });
  window.addEventListener("flat-map-focus", onMapFocus as EventListener);
  void loadFullMapFeed();
  if (!el.value) return;
  let L: typeof LeafletNS;
  try {
    L = await loadLeaflet();
  } catch {
    failed.value = true;
    return;
  }
  if (!el.value) return;
  try {
    // preferCanvas: the district/microdistrict/quartal/metro/amenity layers can add
    // up to hundreds of vector shapes at once; canvas repaints them far cheaper than
    // SVG DOM nodes while dragging or zooming, which is where panning felt laggiest.
    // zoomSnap below 1 lets flyTo/fitBounds and the +/- controls settle on fractional
    // zoom levels instead of hard integer steps, so zoom transitions read as continuous.
    map = L.map(el.value, {
      scrollWheelZoom: false,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      preferCanvas: true,
    }).setView([41.31, 69.24], 5);
  } catch {
    failed.value = true;
    return;
  }
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxNativeZoom: 19,
    maxZoom: 19,
    detectRetina: true,
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  areaLayer = L.layerGroup().addTo(map);
  focusLayer = L.layerGroup().addTo(map);
  cityLayer = L.layerGroup().addTo(map);
  districtLayer = L.layerGroup().addTo(map);
  microdistrictLayer = L.layerGroup().addTo(map);
  quartalLayer = L.layerGroup().addTo(map);
  zoneAreaLayer = L.layerGroup().addTo(map);
  metroLayer = L.layerGroup().addTo(map);
  universityLayer = L.layerGroup().addTo(map);
  shoppingMallLayer = L.layerGroup().addTo(map);
  parkLayer = L.layerGroup().addTo(map);
  map.on("click", (event: any) => {
    activateScroll();
    if (addDrawPoint(event)) return;
    closeRadial();
  });
  el.value.addEventListener("mouseleave", deactivateScroll);
  map.on("zoomend", renderMarkers);
  map.on("movestart", closeRadial);
  map.on("zoomstart", closeRadial);
  renderMarkers();
  renderFocusedPoint();
  renderAllZoneLayers();
  if (selectedZoneFromProps()) syncSelectionFromProps(true);
  else fitToPoints();
});

// Not deep: renderedPoints rebuilds its array (and so changes identity) whenever
// anything it depends on changes, so a deep traversal of every point on every
// check only costs time.
watch(renderedPoints, () => { renderMarkers(); fitToPoints(); });
// Watched as the normalized key, not the query object: route.query is replaced
// wholesale on navigation, so a deep traversal only added cost, and keying on
// what loadFullMapFeed actually sends means listing-detail params cannot
// trigger a refetch at all.
watch(() => new URLSearchParams(normalizedRouteQuery()).toString(), () => { void loadFullMapFeed(); });
// NOT deep. These props are computeds that rebuild their arrays, so identity is
// already the signal. Traversing them meant walking every coordinate of every
// district, microdistrict and local-area boundary on each reactive tick -- with
// a full city catalog loaded that is hundreds of thousands of nested reads, and
// it blocked the main thread for about a second after every filter change.
watch(() => [props.districtZones, props.microdistrictMarkers, props.quartalMarkers, props.metroStations, props.universityZones, props.shoppingMallZones, props.parkZones, props.areaZones, props.cityZone], () => syncSelectionFromProps(false));
watch(
  () => [props.selectedDistrict, props.selectedMicrodistrict, props.selectedQuartal, props.selectedArea, selectedMetros.value.join(","), props.selectedMetroRadiusM, props.metroBearingFrom, props.metroBearingTo],
  (next, previous) => {
    const changed = next.some((value, index) => value !== previous?.[index]);
    if (changed) syncSelectionFromProps(Boolean(selectedZoneFromProps()));
  },
);
watch([showDistricts, showMicrodistricts, showQuartals, showMetro, showUniversities, showShoppingMalls, showParks, showAreas, showCity], renderAllZoneLayers);
// The callback already compares by id, so nothing here needed a deep traversal
// of the city hull polygon either.
watch(() => props.cityZone, (zone, previous) => {
  if (!zone || zone.id === previous?.id || !map) return;
  focusZone(zone);
});

onBeforeUnmount(() => {
  mapFeedSequence += 1;
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("scroll", closeRadial);
  window.removeEventListener("flat-map-focus", onMapFocus as EventListener);
  el.value?.removeEventListener("mouseleave", deactivateScroll);
  document.body.style.overflow = "";
  map?.remove?.();
  map = null;
  layer = null;
  areaLayer = null;
  focusLayer = null;
  districtLayer = null;
  microdistrictLayer = null;
  quartalLayer = null;
  metroLayer = null;
  universityLayer = null;
  shoppingMallLayer = null;
  parkLayer = null;
  zoneAreaLayer = null;
  cityLayer = null;
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }">
      <div ref="el" class="flat-map" />
      <div v-if="!expanded" v-show="!scrollActive" class="flat-map__scroll-hint">{{ props.scrollHintLabel || "Click the map to zoom" }}</div>

      <div class="flat-map__tools">
        <button
          type="button"
          class="flat-map__tool"
          :class="{ 'flat-map__tool_active': expanded }"
          :aria-label="expanded ? (props.collapseLabel || 'Close map') : (props.expandLabel || 'Full screen')"
          @click="toggleExpanded"
        >
          {{ expanded ? "×" : "⤢" }}
          <span>{{ expanded ? (props.collapseLabel || "Close") : (props.expandLabel || "Full screen") }}</span>
        </button>
        <button v-if="renderedPoints.length" type="button" class="flat-map__tool" @click="fitToPointsNow">
          ⊙
          <span>{{ props.fitResultsLabel || "Frame results" }}</span>
        </button>
        <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': drawing }" @click="toggleDrawing">
          {{ drawing ? "✓" : "⌁" }}
          <span>{{ drawing ? (props.doneLabel || "Done") : (props.drawLabel || "Draw area") }}</span>
        </button>
        <button v-if="area.length" type="button" class="flat-map__tool" @click="clearArea">
          × <span>{{ props.clearLabel || "Clear" }}</span>
        </button>
        <button v-if="cityZone?.boundary" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showCity }" @click="showCity = !showCity">
          <span>{{ props.cityLabel || "City" }}</span>
        </button>
        <button v-if="districtZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showDistricts }" @click="showDistricts = !showDistricts">
          <span>{{ props.districtsLabel || "Districts" }}</span>
        </button>
        <button v-if="microdistrictMarkers?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showMicrodistricts }" @click="showMicrodistricts = !showMicrodistricts">
          <span>{{ props.microdistrictsLabel || "Microdistricts" }}</span>
        </button>
        <button v-if="quartalMarkers?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showQuartals }" @click="showQuartals = !showQuartals">
          <span>{{ props.quartalsLabel || "Quartals" }}</span>
        </button>
        <button v-if="metroStations?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showMetro }" @click="showMetro = !showMetro">
          <span>{{ props.metroLabel || "Metro" }} · 200/500/1000 м</span>
        </button>
        <button v-if="universityZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showUniversities }" @click="showUniversities = !showUniversities"><span>{{ props.universitiesLabel || "Universities" }}</span></button>
        <button v-if="shoppingMallZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showShoppingMalls }" @click="showShoppingMalls = !showShoppingMalls"><span>{{ props.shoppingMallsLabel || "Major malls" }}</span></button>
        <button v-if="parkZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showParks }" @click="showParks = !showParks"><span>{{ props.parksLabel || "Parks" }}</span></button>
        <button v-if="areaZones?.length" type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': showAreas }" @click="showAreas = !showAreas">
          <span>{{ props.areasLabel || "Areas" }}</span>
        </button>
      </div>
      <div v-if="drawing" class="flat-map__hint">{{ props.drawHint || "Click points on the map to outline an area." }}</div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="radial" class="flat-radial" @click.self="closeRadial">
      <div class="flat-radial__anchor" :style="{ left: `${radial.x}px`, top: `${radial.y}px` }">
        <div class="flat-radial__hub" role="group" aria-label="Browse apartment pages in this cluster">
          <button
            type="button"
            class="flat-radial__hub-arrow"
            :disabled="radialPageCount <= 1"
            aria-label="Previous apartment page"
            @click.stop="changeRadialPage(-1)"
          >‹</button>
          <span class="flat-radial__hub-count" :title="`${radial.items.length} apartments`">{{ radialPageLabel }}</span>
          <button
            type="button"
            class="flat-radial__hub-arrow"
            :disabled="radialPageCount <= 1"
            aria-label="Next apartment page"
            @click.stop="changeRadialPage(1)"
          >›</button>
        </div>

        <div
          v-for="(item, i) in visibleRadialItems"
          :key="`${radial.page}:${pointKey(item)}`"
          class="flat-radial__slot"
          :style="slotStyle(i, visibleRadialItems.length)"
        >
          <button type="button" class="flat-radial__tab" @click="openPoint(item)">
            <span class="flat-radial__thumb">
              <img v-if="item.photo" :src="item.photo" :alt="item.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
              <img v-else src="/svg/shark.svg" alt="" class="flat-radial__thumb-empty" loading="lazy" />
            </span>
            <span v-if="item.priceLabel" class="flat-radial__price">{{ item.priceLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.flat-map-shell { position: relative; z-index: 0; isolation: isolate; scroll-margin-block: 24px; }
.flat-map-shell_full {
  position: fixed;
  inset: 0;
  z-index: 3000;
  padding: 12px;
  background: var(--bg-primary, #0b0f2a);
}
.flat-map-shell_full .flat-map { height: 100%; border-radius: 8px; }
// Clicking a district/microdistrict/area shape gives its SVG path DOM focus;
// the browser's default focus outline is a rectangle around the shape's
// bounding box, not its actual outline, which reads as a stray square.
.flat-map :deep(.leaflet-interactive) { outline: none; }
.flat-map :deep(.flat-zone-shape) {
  transition: fill-opacity .15s ease, stroke-opacity .15s ease, stroke-width .15s ease;
  cursor: pointer;
}
.flat-map :deep(.flat-zone-shape:hover) { fill-opacity: .4 !important; stroke-width: 3.5px; }
.flat-map :deep(.flat-zone-shape_dim) { filter: grayscale(0.85); transition: filter .15s ease, fill-opacity .15s ease, stroke-opacity .15s ease; }
.flat-map :deep(.flat-zone-shape_dim:hover) { filter: grayscale(0.4); }
:deep(.flat-zone-label_dim) { opacity: .55; filter: grayscale(0.85); }
.flat-map {
  width: 100%;
  height: 420px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
}
.flat-map__tools {
  position: absolute; z-index: 500; top: 12px; left: 12px; right: 12px;
  display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px;
}
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
.flat-map__scroll-hint {
  position: absolute; z-index: 400; left: 50%; top: 12px; transform: translateX(-50%);
  padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px;
  background: rgba(13,17,40,0.88); color: var(--text-primary); font-size: 12px;
  pointer-events: none; opacity: 0; transition: opacity 0.18s ease;
}
.flat-map-shell:hover .flat-map__scroll-hint { opacity: 1; }

:deep(.flat-cluster) {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  background: #e0679a; border: 2px solid #fff; box-sizing: border-box;
  box-shadow: 0 1px 4px rgba(0,0,0,0.4);
  animation: flat-cluster-in 0.2s ease backwards;
}
:deep(.flat-cluster_multi) {
  width: 32px; height: 32px;
  color: #fff; font-size: 13px; font-weight: 700;
  background: rgba(224,103,154,0.92);
}
@keyframes flat-cluster-in {
  from { opacity: 0; transform: scale(0.45); }
}

/* Drag grips for the metro shape. Sized for a fingertip rather than the 8px the
   dot itself needs: the wrapper is the 18px hit area, the dot inside is what
   you see. */
:deep(.flat-metro-handle-wrap) { cursor: grab; }
:deep(.flat-metro-handle-wrap:active) { cursor: grabbing; }
:deep(.flat-metro-handle) {
  display: block; width: 14px; height: 14px; margin: 2px; border-radius: 50%;
  background: #fff; border: 3px solid #e0679a; box-sizing: border-box;
  box-shadow: 0 1px 5px rgba(0,0,0,0.45);
}
/* The distance grip is round, the two arc grips are diamonds, so which one is
   under the finger is obvious without reading a tooltip. */
:deep(.flat-metro-handle_from), :deep(.flat-metro-handle_to) {
  border-radius: 3px; transform: rotate(45deg); border-color: #8b5cf6;
}
@media (pointer: coarse) {
  :deep(.flat-metro-handle) { width: 18px; height: 18px; margin: 0; }
}

.flat-radial { position: fixed; inset: 0; z-index: 9000; }
.flat-radial__anchor { position: absolute; width: 0; height: 0; }
.flat-radial__hub {
  position: absolute; top: 50%; left: 50%; z-index: 3; transform: translate(-50%, -50%);
  display: grid; grid-template-columns: 19px 26px 19px; align-items: center; justify-content: center;
  width: 64px; height: 64px; border-radius: 50%; overflow: hidden;
  background: var(--accent-pink, #e0679a); color: #fff;
  border: 2px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,0.5);
}
.flat-radial__hub-arrow {
  display: grid; place-items: center; align-self: stretch; width: 100%; padding: 0;
  border: 0; background: transparent; color: #fff; cursor: pointer;
  font-size: 27px; line-height: 1; transition: background-color 120ms ease, transform 120ms ease;
}
.flat-radial__hub-arrow:hover, .flat-radial__hub-arrow:focus-visible { background: rgba(0,0,0,.16); outline: none; }
.flat-radial__hub-arrow:active { transform: scale(.9); }
.flat-radial__hub-arrow:disabled { opacity: .35; cursor: default; }
.flat-radial__hub-count { text-align: center; font-size: 10px; font-weight: 800; line-height: 1; pointer-events: none; }
.flat-radial__slot {
  position: absolute; top: 0; left: 0; z-index: 1;
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

:deep(.flat-zone-label-wrap) { pointer-events: none; }
:deep(.flat-zone-label) {
  display: inline-block; transform: translate(-50%, -50%);
  padding: 3px 8px; border: 1.5px solid; border-radius: 999px;
  background: rgba(13,17,40,0.92); color: var(--text-primary, #fff);
  font-size: 11px; font-weight: 700; white-space: nowrap; pointer-events: none;
}
:deep(.flat-zone-marker) {
  display: block; width: 12px; height: 12px; border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.5); cursor: pointer;
}
:deep(.flat-zone-marker_circle) { border-radius: 50%; }
:deep(.flat-zone-marker_square) { border-radius: 2px; }
:deep(.flat-amenity-marker) {
  display: grid; place-items: center; width: 22px; height: 22px; box-sizing: border-box;
  border: 2px solid #fff; border-radius: 50%; background: var(--amenity-color); color: #fff;
  box-shadow: 0 2px 5px rgba(0,0,0,.5); font-size: 8px; font-weight: 900; line-height: 1;
}

:deep(.leaflet-container) { background: var(--bg-panel); font-family: inherit; }
:deep(.leaflet-popup-content) { font-size: 13px; }

@include bp-down(sm) {
  .flat-map-shell_full { padding: 0; }
  .flat-map-shell_full .flat-map { border: 0; border-radius: 0; }
  .flat-map__tools { top: max(8px, env(safe-area-inset-top)); right: 8px; gap: 5px; }
  .flat-map__tool { min-height: 32px; padding-inline: 8px; font-size: 12px; }
  .flat-radial__hub { width: 52px; height: 52px; grid-template-columns: 15px 22px 15px; }
  .flat-radial__hub-arrow { font-size: 23px; }
  .flat-radial__hub-count { font-size: 9px; }
  .flat-radial__tab { width: 76px; border-radius: 7px; }
  .flat-radial__thumb { height: 46px; }
  .flat-radial__price { padding: 3px 4px; font-size: 10px; }
}
</style>
