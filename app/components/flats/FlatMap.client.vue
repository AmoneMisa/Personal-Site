<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { FlatMapFeedResult, FlatMapPoint } from "~/types/flats";
import { primaryBoundaryGeometry } from "~/utils/mapBoundaryFocus";
import { priceToneFromRatio, type FlatPriceTone } from "~/utils/flats/priceTone";
import {
  bearingBetween,
  destinationPoint,
  metresBetween,
  normalizeBearing,
  sectorPolygon,
} from "~/composables/flats/useMetroProximity";
import type * as LeafletNS from "leaflet";

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
  district?: string | null;
  price?: number | null;
  currency?: string;
  priceRatio?: number | null;
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
  parentId?: string | null;
  type?: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  mode?: string;
  routeRefs?: string[];
  lineColor?: string;
  lineColors?: string[];
  boundary?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

interface ExtraGeoEntity {
  id: string;
  parentId?: string | null;
  type: string;
  canonicalName: string;
  label?: string;
  center: { lat: number; lng: number };
  accuracyM?: number;
  boundary?: FlatMapZone["boundary"];
  color?: string;
  mode?: string;
  routeRefs?: string[];
  lineColor?: string;
  lineColors?: string[];
}

interface ExtraGeoResponse {
  descendants?: ExtraGeoEntity[];
}

type ZoneKind = "district" | "microdistrict" | "quartal" | "area" | "metro";
type MenuKind = "territories" | "transport" | "poi";
type TransportMode = "bus" | "tram" | "trolleybus" | "minibus" | "funicular";

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
  (e: "select", identity: { id: string; source?: string }): void;
  (e: "area-change", points: Array<{ lat: number; lng: number }>): void;
  (e: "zone-select", payload: { kind: ZoneKind; name: string; radiusM?: number }): void;
  (e: "metro-toggle", name: string): void;
  (e: "metro-shape", shape: { radiusM: number; bearingFrom?: number; bearingTo?: number }): void;
}>();

const route = useRoute();
const router = useRouter();
const CLUSTER_PX = 38;
const ZOOM_CLUSTER_THRESHOLD = 1;
const CLUSTER_ZOOM_MAX = 19;
const RADIAL_PAGE_SIZE = 9;
const FOCUS_ZOOM = 18;
const DEFAULT_METRO_RADIUS_M = 500;
const METRO_MARKER_HIT_RADIUS = 16;
const METRO_MIN_RADIUS_M = 100;
const METRO_MAX_RADIUS_M = 5000;
const DETAIL_QUERY_KEYS = new Set(["adv", "flat", "flatSource", "flatCountry", "shared", "page"]);
const RADIUS_OPTIONS = [200, 500, 1000] as const;

const el = ref<HTMLElement | null>(null);
const failed = ref(false);
const drawing = ref(false);
const scrollActive = ref(false);
const area = ref<Array<{ lat: number; lng: number }>>([]);
const radial = ref<{ x: number; y: number; items: FlatPoint[]; page: number } | null>(null);
const expanded = ref(false);
const remotePoints = ref<FlatPoint[]>([]);
const focusedPoint = ref<MapFocusDetail | null>(null);
const menuOpen = ref<MenuKind | null>(null);
const language = ref("ru");

const showDistricts = ref(true);
const showMicrodistricts = ref(false);
const showQuartals = ref(false);
const showAreas = ref(true);
const showCity = ref(true);

const showMetro = ref(true);
const showBus = ref(false);
const showTram = ref(false);
const showTrolleybus = ref(false);
const showMinibus = ref(false);
const showFunicular = ref(false);
const busRadiusM = ref(500);
const tramRadiusM = ref(500);
const trolleybusRadiusM = ref(500);
const minibusRadiusM = ref(500);

const showUniversities = ref(false);
const showShoppingMalls = ref(false);
const showParks = ref(false);
const showSchools = ref(false);
const showResidentialComplexes = ref(false);
const showParkings = ref(false);
const showAirports = ref(false);
const showRailwayStations = ref(false);
const showBusStations = ref(false);
const schoolRadiusM = ref(300);
const mallRadiusM = ref(500);
const parkRadiusM = ref(500);
const universityRadiusM = ref(500);
const parkingRadiusM = ref(300);
const airportRadiusM = ref(2000);
const railwayRadiusM = ref(1000);
const busStationRadiusM = ref(1000);

const selectedDistrictName = ref<string | null>(null);
const extraGeo = ref<ExtraGeoEntity[]>([]);
let extraGeoSequence = 0;
let lastExtraGeoKey = "";
let mapFeedSequence = 0;
let lastMapFeedKey = "";
const MAP_FEED_CACHE_TTL_MS = 60_000;
const MAP_FEED_CACHE_MAX_ENTRIES = 40;
const mapFeedCache = new Map<string, { at: number; points: FlatPoint[] }>();

const ui = computed(() => {
  const ru = language.value.toLowerCase().startsWith("ru");
  return ru ? {
    territories: "Территории",
    transport: "Транспорт",
    poi: "Объекты и сервисы",
    city: "Граница города",
    districts: "Районы",
    microdistricts: "Микрорайоны",
    mahallas: "Махалли / кварталы",
    areas: "Области / зоны",
    metro: "Метро",
    bus: "Автобус",
    tram: "Трамвай",
    trolleybus: "Троллейбус",
    minibus: "Маршрутки",
    funicular: "Фуникулёр",
    noData: "нет данных",
    radius: "Радиус",
    residential: "ЖК",
    schools: "Школы",
    malls: "ТРЦ и ТЦ",
    parks: "Парки",
    universities: "Университеты",
    parking: "Парковки и паркинги",
    airport: "Аэропорт",
    railway: "Ж/д вокзал",
    busStation: "Автовокзалы",
    priceLegend: "Цена относительно медианы",
    districtListings: "объявлений на карте",
    median: "медиана",
    bestOffer: "Лучшее предложение по фильтрам",
    cheaper: "дешевле медианы",
    pricier: "дороже медианы",
    medianPrice: "около медианы",
  } : {
    territories: "Territories",
    transport: "Transport",
    poi: "Places & services",
    city: "City boundary",
    districts: "Districts",
    microdistricts: "Microdistricts",
    mahallas: "Mahallas / quarters",
    areas: "Areas / zones",
    metro: "Metro",
    bus: "Bus",
    tram: "Tram",
    trolleybus: "Trolleybus",
    minibus: "Minibuses",
    funicular: "Funicular",
    noData: "no data",
    radius: "Radius",
    residential: "Residential complexes",
    schools: "Schools",
    malls: "Malls",
    parks: "Parks",
    universities: "Universities",
    parking: "Parking",
    airport: "Airport",
    railway: "Railway station",
    busStation: "Bus stations",
    priceLegend: "Price vs median",
    districtListings: "listings on map",
    median: "median",
    bestOffer: "Best offer for current filters",
    cheaper: "below median",
    pricier: "above median",
    medianPrice: "near median",
  };
});

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
    .map((point) => {
      const raw = point as FlatMapPoint & {
        district?: string | null;
        photo?: string | null;
        priceRatio?: number | null;
        marketComparison?: { priceRatio?: number | null };
      };
      const ratio = Number(raw.priceRatio ?? raw.marketComparison?.priceRatio);
      return {
        id: String(point.id),
        source: point.source,
        country: point.country,
        lat: Number(point.lat),
        lng: Number(point.lng),
        title: point.title || "",
        priceLabel: fallbackPriceLabel(point),
        photo: raw.photo || undefined,
        district: raw.district || null,
        price: point.price == null ? null : Number(point.price),
        currency: point.currency || undefined,
        priceRatio: Number.isFinite(ratio) && ratio > 0 ? ratio : null,
      };
    });
}

async function loadFullMapFeed() {
  if (!import.meta.client) return;
  const query = normalizedRouteQuery();
  const key = new URLSearchParams(query).toString();
  if (key === lastMapFeedKey && remotePoints.value.length) return;
  lastMapFeedKey = key;
  const sequence = ++mapFeedSequence;
  const cached = readMapFeedCache(key);
  if (cached) remotePoints.value = cached;
  try {
    const data = await $fetch<FlatMapFeedResult>("/flats-map", { query });
    if (sequence !== mapFeedSequence) return;
    const points = shapeMapPoints(data);
    remotePoints.value = points;
    writeMapFeedCache(key, points);
  } catch {
    // Keep the already-loaded page points/cached map feed as fallback.
  }
}

function geoScope() {
  const query = normalizedRouteQuery();
  const country = String(query.countries || query.country || "").split(",")[0]?.trim().toUpperCase();
  const city = String(query.city || "").trim();
  return { country, city };
}

async function loadExtraGeo() {
  if (!import.meta.client) return;
  const { country, city } = geoScope();
  if (!country || !city) {
    extraGeo.value = [];
    lastExtraGeoKey = "";
    return;
  }
  const key = `${country}:${city}:${language.value}`;
  if (key === lastExtraGeoKey && extraGeo.value.length) return;
  lastExtraGeoKey = key;
  const sequence = ++extraGeoSequence;
  try {
    const data = await $fetch<ExtraGeoResponse>("/flats-geo-city", {
      params: { country, city, locale: language.value },
      timeout: 15_000,
    });
    if (sequence !== extraGeoSequence) return;
    extraGeo.value = Array.isArray(data?.descendants) ? data.descendants : [];
  } catch {
    if (sequence === extraGeoSequence) extraGeo.value = [];
  }
}

function safeColor(value: string | undefined, fallback: string): string {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}

function zoneFromExtra(entity: ExtraGeoEntity, fallback: string): FlatMapZone {
  return {
    id: entity.id,
    parentId: entity.parentId ?? null,
    type: entity.type,
    name: entity.canonicalName,
    label: entity.label || entity.canonicalName,
    lat: Number(entity.center.lat),
    lng: Number(entity.center.lng),
    radiusM: Number(entity.accuracyM) || 200,
    color: safeColor(entity.color, fallback),
    mode: entity.mode,
    routeRefs: entity.routeRefs,
    lineColor: entity.lineColor,
    lineColors: entity.lineColors,
    boundary: entity.boundary,
  };
}

function extraByType(type: string, fallback: string): FlatMapZone[] {
  return extraGeo.value
    .filter((entity) => entity.type === type && Number.isFinite(Number(entity.center?.lat)) && Number.isFinite(Number(entity.center?.lng)))
    .map((entity) => zoneFromExtra(entity, fallback));
}

const schoolZones = computed(() => extraByType("poi.school", "#ec4899"));
const residentialComplexZones = computed(() => extraByType("residential_complex", "#14b8a6"));
const airportZones = computed(() => extraByType("poi.airport", "#0ea5e9"));
const railwayStationZones = computed(() => extraByType("poi.railway_station", "#64748b"));
const busStationZones = computed(() => extraByType("poi.bus_station", "#2563eb"));
const parkingZones = computed(() => extraByType("poi.parking", "#64748b"));
const transportStopZones = computed(() => extraByType("transport_stop", "#2563eb"));
const metroMetaById = computed(() => new Map(
  extraGeo.value
    .filter((entity) => entity.type === "metro")
    .map((entity) => [entity.id, entity] as const),
));

const renderedPoints = computed<FlatPoint[]>(() => {
  const merged = new Map<string, FlatPoint>();
  for (const point of remotePoints.value) merged.set(pointKey(point), point);
  for (const point of props.points) {
    const exactKey = pointKey(point);
    const remote = remotePoints.value.find((candidate) => candidate.id === point.id && (!point.source || candidate.source === point.source));
    merged.set(remote ? pointKey(remote) : exactKey, { ...remote, ...point });
  }
  return [...merged.values()];
});

function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const priceBaselines = computed(() => {
  const buckets = new Map<string, number[]>();
  for (const point of renderedPoints.value) {
    const price = Number(point.price);
    const currency = String(point.currency || "").toUpperCase();
    if (!Number.isFinite(price) || price <= 0 || !currency) continue;
    const district = String(point.district || "").trim().toLocaleLowerCase();
    for (const key of [`${currency}:*`, `${currency}:${district}`]) {
      const list = buckets.get(key);
      if (list) list.push(price);
      else buckets.set(key, [price]);
    }
  }
  return new Map([...buckets].map(([key, values]) => [key, median(values)]));
});

function dominantCurrency(items: FlatPoint[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const currency = String(item.currency || "").toUpperCase();
    if (!currency || !Number.isFinite(Number(item.price))) continue;
    counts.set(currency, (counts.get(currency) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function priceToneForItems(items: FlatPoint[]): FlatPriceTone {
  const ratios = items.map((item) => Number(item.priceRatio)).filter((value) => Number.isFinite(value) && value > 0);
  const directRatio = median(ratios);
  if (directRatio != null) return priceToneFromRatio(directRatio);

  const currency = dominantCurrency(items);
  if (!currency) return "pink";
  const prices = items
    .filter((item) => String(item.currency || "").toUpperCase() === currency)
    .map((item) => Number(item.price))
    .filter((value) => Number.isFinite(value) && value > 0);
  const itemMedian = median(prices);
  if (itemMedian == null) return "pink";
  const districts = [...new Set(items.map((item) => String(item.district || "").trim().toLocaleLowerCase()).filter(Boolean))];
  const district = districts.length === 1 ? districts[0] : "*";
  const baseline = priceBaselines.value.get(`${currency}:${district}`) ?? priceBaselines.value.get(`${currency}:*`) ?? null;
  if (baseline == null || baseline <= 0) return "pink";
  return priceToneFromRatio(itemMedian / baseline);
}

function toneCss(tone: FlatPriceTone): string {
  return `var(--flat-tone-${tone})`;
}

const radialPageCount = computed(() => Math.max(1, Math.ceil((radial.value?.items.length ?? 0) / RADIAL_PAGE_SIZE)));
const visibleRadialItems = computed(() => {
  const current = radial.value;
  if (!current) return [];
  const start = current.page * RADIAL_PAGE_SIZE;
  return current.items.slice(start, start + RADIAL_PAGE_SIZE);
});
const radialPageLabel = computed(() => radial.value ? `${radial.value.page + 1}/${radialPageCount.value}` : "");
const selectedMetros = computed(() => props.selectedMetros || []);

const draftRadiusM = ref<number | null>(null);
const draftBearingFrom = ref<number | null>(null);
const draftBearingTo = ref<number | null>(null);
const shapeRadiusM = computed(() => draftRadiusM.value ?? props.selectedMetroRadiusM ?? DEFAULT_METRO_RADIUS_M);
const shapeBearingFrom = computed(() => draftBearingFrom.value ?? props.metroBearingFrom ?? null);
const shapeBearingTo = computed(() => draftBearingTo.value ?? props.metroBearingTo ?? null);

const districtPanel = computed(() => {
  const name = props.selectedDistrict || selectedDistrictName.value;
  if (!name) return null;
  const zone = (props.districtZones || []).find((candidate) => candidate.name === name);
  const normalized = name.trim().toLocaleLowerCase();
  const points = renderedPoints.value.filter((point) => String(point.district || "").trim().toLocaleLowerCase() === normalized);
  const currency = dominantCurrency(points);
  const priced = points.filter((point) => String(point.currency || "").toUpperCase() === currency && Number.isFinite(Number(point.price)) && Number(point.price) > 0);
  const districtMedian = median(priced.map((point) => Number(point.price)));
  let best: FlatPoint | null = null;
  let bestRatio = Number.POSITIVE_INFINITY;
  for (const point of priced) {
    const direct = Number(point.priceRatio);
    const ratio = Number.isFinite(direct) && direct > 0
      ? direct
      : districtMedian && districtMedian > 0 ? Number(point.price) / districtMedian : Number.POSITIVE_INFINITY;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = point;
    }
  }
  return {
    name: zone?.label || name,
    count: points.length,
    currency,
    median: districtMedian,
    best,
    bestRatio: Number.isFinite(bestRatio) ? bestRatio : null,
  };
});

function formatMoney(value: number | null, currency: string): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString()}${currency ? ` ${currency}` : ""}`;
}

function bestDeltaLabel(ratio: number | null): string {
  if (ratio == null) return ui.value.medianPrice;
  const delta = Math.round((ratio - 1) * 100);
  if (Math.abs(delta) <= 1) return ui.value.medianPrice;
  return `${Math.abs(delta)}% ${delta < 0 ? ui.value.cheaper : ui.value.pricier}`;
}

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
let schoolLayer: any = null;
let residentialLayer: any = null;
let airportLayer: any = null;
let railwayLayer: any = null;
let busStationLayer: any = null;
let parkingLayer: any = null;
let transportStopLayer: any = null;
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
  menuOpen.value = null;
  scrollActive.value = false;
  if (import.meta.client) document.body.style.overflow = value ? "hidden" : "";
  if (value) map?.scrollWheelZoom?.enable();
  else map?.scrollWheelZoom?.disable();
  await nextTick();
  requestAnimationFrame(() => map?.invalidateSize());
  setTimeout(() => map?.invalidateSize(), 260);
  setTimeout(() => map?.invalidateSize(), 600);
}

function toggleExpanded() { void setExpanded(!expanded.value); }
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
function closeRadial() { radial.value = null; }
function toggleMenu(kind: MenuKind) { menuOpen.value = menuOpen.value === kind ? null : kind; }
function closeMenus() { menuOpen.value = null; }

function changeRadialPage(direction: -1 | 1) {
  const current = radial.value;
  if (!current || radialPageCount.value <= 1) return;
  const next = (current.page + direction + radialPageCount.value) % radialPageCount.value;
  radial.value = { ...current, page: next };
}

function onKeydown(event: KeyboardEvent) {
  if (menuOpen.value && event.key === "Escape") {
    menuOpen.value = null;
    event.preventDefault();
    return;
  }
  if (radial.value) {
    if (event.key === "Escape") { closeRadial(); event.preventDefault(); return; }
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
  type Cell = { x: number; y: number; latSum: number; lngSum: number; items: FlatPoint[] };
  const clusters: Cell[] = [];
  const grid = new Map<string, Cell[]>();
  for (const p of renderedPoints.value) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const pt = map.latLngToContainerPoint([p.lat, p.lng]);
    const cellX = Math.floor(pt.x / CLUSTER_PX);
    const cellY = Math.floor(pt.y / CLUSTER_PX);
    let placed: Cell | undefined;
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
    if (bucket) bucket.push(created); else grid.set(key, [created]);
  }
  return clusters.map((c) => ({ lat: c.latSum / c.items.length, lng: c.lngSum / c.items.length, items: c.items }));
}

function renderMarkers() {
  const L = Leaflet;
  if (!map || !layer || !L) return;
  layer.clearLayers();
  closeRadial();
  for (const c of clusterPoints()) {
    const count = c.items.length;
    const multi = count > 1;
    const size = multi ? (count >= 100 ? 36 : 32) : 16;
    const tone = priceToneForItems(c.items);
    const icon = L.divIcon({
      className: "flat-cluster-wrap",
      html: `<span class="flat-cluster${multi ? " flat-cluster_multi" : ""}" style="--cluster-tone:${toneCss(tone)}">${multi ? count : ""}</span>`,
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
  L.circleMarker([point.lat, point.lng], { radius: 11, color: "#fff", weight: 2, fillColor: "#e0679a", fillOpacity: .95 }).addTo(focusLayer);
  L.circleMarker([point.lat, point.lng], { radius: 18, color: "#e0679a", weight: 1.5, opacity: .5, fillOpacity: 0 }).addTo(focusLayer);
}

function focusOnPoint(detail: MapFocusDetail) {
  const lat = Number(detail?.lat); const lng = Number(detail?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  focusedPoint.value = { ...detail, lat, lng };
  renderFocusedPoint();
  const shell = el.value?.closest(".flat-map-shell") as HTMLElement | null;
  shell?.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!map) return;
  window.setTimeout(() => {
    map?.invalidateSize?.();
    map?.flyTo?.([lat, lng], FOCUS_ZOOM, { animate: true, duration: .75 });
    renderFocusedPoint();
  }, 180);
}
function onMapFocus(event: Event) { const detail = (event as CustomEvent<MapFocusDetail>).detail; if (detail) focusOnPoint(detail); }

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
  if (loaded) { emit("select", { id: point.id, source: point.source }); return; }
  if (!point.source || !point.country) return;
  void router.replace({ query: { ...route.query, flat: point.id, flatSource: point.source, flatCountry: point.country } });
}

function openCluster(c: Cluster) {
  const L = Leaflet;
  if (c.items.length === 1) { openPoint(c.items[0]); return; }
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
  const x = clampRadialCoordinate(rect.left + pt.x, radius + halfTabWidth + 8, window.innerWidth);
  const y = clampRadialCoordinate(rect.top + pt.y, radius + halfTabHeight + 8, window.innerHeight);
  radial.value = { x, y, items: [...c.items], page: 0 };
}

function slotStyle(i: number, n: number) {
  const radius = radialRadius(n);
  const angle = (-90 + (360 / Math.max(1, n)) * i) * (Math.PI / 180);
  return { transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`, animationDelay: `${i * 22}ms` };
}

function fitToPoints() {
  if (!map || focusedPoint.value) return;
  const bounds: [number, number][] = [];
  for (const p of renderedPoints.value) if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) bounds.push([p.lat, p.lng]);
  const sig = renderedPoints.value.map(pointKey).sort().join(",");
  if (bounds.length && sig !== lastFitSig) {
    lastFitSig = sig;
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

function renderArea() {
  const L = Leaflet;
  if (!areaLayer || !L) return;
  areaLayer.clearLayers();
  if (area.value.length >= 2) {
    const points = area.value.map((point) => [point.lat, point.lng]);
    if (area.value.length >= 3) L.polygon(points, { color: "#e0679a", weight: 2, fillColor: "#e0679a", fillOpacity: .16 }).addTo(areaLayer);
    else L.polyline(points, { color: "#e0679a", weight: 2 }).addTo(areaLayer);
  }
  for (const point of area.value) L.circleMarker([point.lat, point.lng], { radius: 5, color: "#fff", weight: 2, fillColor: "#e0679a", fillOpacity: 1 }).addTo(areaLayer);
}

function eventLatLng(event: any): { lat: number; lng: number } | null {
  const original = event?.originalEvent;
  if (original && map?.mouseEventToLatLng) {
    try {
      const point = map.mouseEventToLatLng(original);
      if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) return { lat: point.lat, lng: point.lng };
    } catch { /* use Leaflet event position below */ }
  }
  const lat = Number(event?.latlng?.lat); const lng = Number(event?.latlng?.lng);
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
  const L = Leaflet; const original = event?.originalEvent ?? event;
  if (L && original) L.DomEvent.stopPropagation(original);
}
function handleLayerClick(event: any, action: () => void) {
  activateScroll(); stopLayerClick(event); if (addDrawPoint(event)) return; action();
}

function selectedName(kind: ZoneKind): string {
  if (kind === "district") return props.selectedDistrict || "";
  if (kind === "microdistrict") return props.selectedMicrodistrict || "";
  if (kind === "quartal") return props.selectedQuartal || "";
  if (kind === "area") return props.selectedArea || "";
  return selectedMetros.value[0] || "";
}
function isZoneSelected(kind: ZoneKind, name: string): boolean {
  return kind === "metro" ? selectedMetros.value.includes(name) : selectedName(kind) === name;
}
function emitZoneSelect(kind: ZoneKind, name: string, radiusM?: number) {
  closeRadial();
  const sameZone = isZoneSelected(kind, name);
  const sameRadius = kind !== "metro" || radiusM == null || Number(props.selectedMetroRadiusM) === radiusM;
  const nextName = sameZone && sameRadius ? "" : name;
  if (kind === "district") { selectedDistrictName.value = nextName || null; renderDistrictZones(); }
  emit("zone-select", { kind, name: nextName, ...(kind === "metro" && nextName && radiusM != null ? { radiusM } : {}) });
}

function selectedZoneFromProps(): { kind: ZoneKind; zone: FlatMapZone } | null {
  const groups: Array<[ZoneKind, FlatMapZone[] | undefined, string | undefined]> = [
    ["metro", props.metroStations, selectedMetros.value[0]], ["area", props.areaZones, props.selectedArea],
    ["quartal", props.quartalMarkers, props.selectedQuartal], ["microdistrict", props.microdistrictMarkers, props.selectedMicrodistrict],
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
    map.flyToBounds(Leaflet.geoJSON(focusBoundary as any).getBounds(), { padding: [42, 42], maxZoom: 15, duration: .65 });
  } else map.flyTo([zone.lat, zone.lng], kindZoom(zone), { animate: true, duration: .65 });
}
function kindZoom(zone: FlatMapZone): number { return zone.radiusM >= 1200 ? 13 : zone.radiusM >= 500 ? 14 : 15; }

function renderZoneShape(layerGroup: any, zone: FlatMapZone, kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet;
  const selected = isZoneSelected(kind, zone.name);
  const baseWeight = Number(style.weight ?? 2); const baseFillOpacity = Number(style.fillOpacity ?? .16);
  const selectedStyle = selected ? { ...style, weight: baseWeight + 1.25, opacity: 1, fillOpacity: Math.min(.42, baseFillOpacity + .14) } : style;
  const onClick = (event: any) => handleLayerClick(event, () => { if (!selected) focusZone(zone); emitZoneSelect(kind, zone.name); });
  if (zone.boundary) {
    const shape = L.geoJSON(zone.boundary as any, { style: () => selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
    shape.on("click", onClick); shape.bindTooltip(zone.label, { direction: "top" }); if (selected) shape.openTooltip?.(); return shape;
  }
  const circle = L.circle([zone.lat, zone.lng], { radius: zone.radiusM, ...selectedStyle, bubblingMouseEvents: false }).addTo(layerGroup);
  circle.on("click", onClick); circle.bindTooltip(zone.label, { direction: "top" }); if (selected) circle.openTooltip?.(); return circle;
}

function renderDistrictZones() {
  const L = Leaflet;
  if (!districtLayer || !L) return;
  districtLayer.clearLayers();
  if (!showDistricts.value) return;
  for (const zone of props.districtZones || []) {
    const dimmed = selectedDistrictName.value != null && zone.name !== selectedDistrictName.value;
    const className = `flat-zone-shape${dimmed ? " flat-zone-shape_dim" : ""}`;
    renderZoneShape(districtLayer, zone, "district", { color: zone.color, weight: 2.5, opacity: dimmed ? .5 : .9, fillColor: zone.color, fillOpacity: dimmed ? .08 : .22, className });
    const label = L.divIcon({ className: "flat-zone-label-wrap", html: `<span class="flat-zone-label${dimmed ? " flat-zone-label_dim" : ""}" style="border-color:${safeColor(zone.color, "#e0679a")}">${zone.label}</span>`, iconSize: [0, 0] });
    L.marker([zone.lat, zone.lng], { icon: label, interactive: false }).addTo(districtLayer);
  }
}
function renderZoneShapes(layerGroup: any, zones: FlatMapZone[], kind: ZoneKind, style: Record<string, unknown>) {
  const L = Leaflet; if (!layerGroup || !L) return; layerGroup.clearLayers();
  for (const zone of zones) renderZoneShape(layerGroup, zone, kind, { ...style, color: zone.color, fillColor: zone.color, className: "flat-zone-shape" });
}
function renderMicrodistricts() { if (showMicrodistricts.value) renderZoneShapes(microdistrictLayer, props.microdistrictMarkers || [], "microdistrict", { weight: 2, opacity: .9, fillOpacity: .18 }); else microdistrictLayer?.clearLayers(); }
function renderQuartals() { if (showQuartals.value) renderZoneShapes(quartalLayer, props.quartalMarkers || [], "quartal", { weight: 1.5, dashArray: "3 4", opacity: .9, fillOpacity: .16 }); else quartalLayer?.clearLayers(); }

function nearestMetroStation(point: { lat: number; lng: number }): FlatMapZone | null {
  if (!map) return null;
  let nearest: FlatMapZone | null = null; let nearestDistance = Number.POSITIVE_INFINITY;
  for (const station of props.metroStations || []) {
    const distance = map.distance([point.lat, point.lng], [station.lat, station.lng]);
    if (distance <= 1000 && distance < nearestDistance) { nearest = station; nearestDistance = distance; }
  }
  return nearest;
}
function metroToggle(station: FlatMapZone) { closeRadial(); if (!isZoneSelected("metro", station.name)) focusZone(station); emit("metro-toggle", station.name); }
function stationMeta(station: FlatMapZone) {
  const extra = metroMetaById.value.get(station.id);
  return {
    routeRefs: extra?.routeRefs || station.routeRefs || [],
    lineColor: safeColor(extra?.lineColor || station.lineColor, "#2563eb"),
    lineColors: (extra?.lineColors || station.lineColors || []).map((color) => safeColor(color, "#2563eb")),
  };
}
function metroRing(station: FlatMapZone): string {
  const meta = stationMeta(station);
  const colors = meta.lineColors.length ? meta.lineColors : [meta.lineColor];
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  return `conic-gradient(${colors.map((color, index) => `${color} ${index * step}% ${(index + 1) * step}%`).join(",")})`;
}
function metroShapeTooltip(): string {
  const from = shapeBearingFrom.value; const to = shapeBearingTo.value; const distance = `${Math.round(shapeRadiusM.value)} m`;
  return from == null || to == null ? distance : `${distance} · ${Math.round(from)}°–${Math.round(to)}°`;
}
function handleBearing(kind: "radius" | "from" | "to"): number {
  const from = shapeBearingFrom.value; const to = shapeBearingTo.value;
  if (from == null || to == null) return kind === "from" ? 270 : kind === "to" ? 90 : 0;
  if (kind === "from") return from; if (kind === "to") return to;
  return normalizeBearing(from + normalizeBearing(to - from) / 2);
}
function refreshMetroShape() {
  if (!metroShapePath || !metroShapeStation) return;
  const outline = sectorPolygon(metroShapeStation, shapeRadiusM.value, shapeBearingFrom.value ?? undefined, shapeBearingTo.value ?? undefined).map((point) => [point.lat, point.lng]);
  metroShapePath.setLatLngs(outline); metroShapePath.setTooltipContent?.(metroShapeTooltip());
  const handles: Array<[any, "radius" | "from" | "to"]> = [[metroRadiusHandle, "radius"], [metroFromHandle, "from"], [metroToHandle, "to"]];
  for (const [handle, kind] of handles) {
    if (!handle || handle === draggingMetroHandle) continue;
    const at = destinationPoint(metroShapeStation, handleBearing(kind), shapeRadiusM.value); handle.setLatLng([at.lat, at.lng]);
  }
}
function makeMetroHandle(station: FlatMapZone, kind: "radius" | "from" | "to") {
  const L = Leaflet; const at = destinationPoint(station, handleBearing(kind), shapeRadiusM.value);
  const handle = L.marker([at.lat, at.lng], { draggable: true, keyboard: false, zIndexOffset: 600, icon: L.divIcon({ className: "flat-metro-handle-wrap", html: `<span class="flat-metro-handle flat-metro-handle_${kind}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }) });
  handle.bindTooltip(kind === "radius" ? props.metroRadiusHandleLabel || "Drag to set distance" : props.metroArcHandleLabel || "Drag to set direction", { direction: "top" });
  handle.on("dragstart", () => { draggingMetroHandle = handle; });
  handle.on("drag", () => {
    const point = handle.getLatLng(); const target = { lat: point.lat, lng: point.lng };
    if (kind === "radius") {
      const metres = metresBetween(station, target);
      draftRadiusM.value = Math.max(METRO_MIN_RADIUS_M, Math.min(METRO_MAX_RADIUS_M, Math.round(metres / 10) * 10));
    } else {
      const bearing = normalizeBearing(Math.round(bearingBetween(station, target)));
      const from = shapeBearingFrom.value; const to = shapeBearingTo.value;
      if (kind === "from") { draftBearingFrom.value = bearing; draftBearingTo.value = to ?? normalizeBearing(bearing + 180); }
      else { draftBearingTo.value = bearing; draftBearingFrom.value = from ?? normalizeBearing(bearing - 180); }
    }
    refreshMetroShape();
  });
  handle.on("dragend", () => {
    draggingMetroHandle = null;
    emit("metro-shape", { radiusM: shapeRadiusM.value, bearingFrom: shapeBearingFrom.value ?? undefined, bearingTo: shapeBearingTo.value ?? undefined });
    draftRadiusM.value = null; draftBearingFrom.value = null; draftBearingTo.value = null;
  });
  handle.addTo(metroLayer); return handle;
}
function renderMetroSelection(stations: FlatMapZone[]) {
  const L = Leaflet; const primary = stations[0]; if (!primary) return; metroShapeStation = primary;
  for (const station of stations) {
    const color = stationMeta(station).lineColor;
    const outline = L.polygon(sectorPolygon(station, shapeRadiusM.value, shapeBearingFrom.value ?? undefined, shapeBearingTo.value ?? undefined).map((point) => [point.lat, point.lng]), {
      color, weight: 2, opacity: .9, fillColor: color, fillOpacity: .11, bubblingMouseEvents: false,
    }).addTo(metroLayer);
    outline.bindTooltip(`${station.label} · ${metroShapeTooltip()}`, { direction: "top" });
    outline.on("click", (event: any) => handleLayerClick(event, () => metroToggle(station)));
    if (station === primary) metroShapePath = outline;
  }
  metroRadiusHandle = makeMetroHandle(primary, "radius"); metroFromHandle = makeMetroHandle(primary, "from"); metroToHandle = makeMetroHandle(primary, "to");
}
function renderMetro() {
  const L = Leaflet; if (!metroLayer || !L) return;
  metroLayer.clearLayers(); metroShapePath = null; metroShapeStation = null; metroRadiusHandle = null; metroFromHandle = null; metroToHandle = null; draggingMetroHandle = null;
  if (!showMetro.value) return;
  const stations = props.metroStations || []; const chosen = stations.filter((station) => isZoneSelected("metro", station.name)); const anyChosen = chosen.length > 0;
  if (anyChosen) renderMetroSelection(chosen);
  for (const station of stations) {
    const stationSelected = isZoneSelected("metro", station.name); const meta = stationMeta(station);
    const select = (event: any) => handleLayerClick(event, () => metroToggle(station));
    const hitTarget = L.circleMarker([station.lat, station.lng], { radius: METRO_MARKER_HIT_RADIUS, opacity: 0, fillOpacity: 0, bubblingMouseEvents: false }).addTo(metroLayer); hitTarget.on("click", select);
    const icon = L.divIcon({
      className: "flat-metro-marker-wrap",
      html: `<span class="flat-metro-marker${stationSelected ? " flat-metro-marker_selected" : ""}${anyChosen && !stationSelected ? " flat-metro-marker_dim" : ""}" style="--metro-ring:${metroRing(station)}"><span>M</span></span>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    const marker = L.marker([station.lat, station.lng], { icon, bubblingMouseEvents: false });
    const line = meta.routeRefs.length ? ` · ${meta.routeRefs.join(" / ")}` : "";
    marker.bindTooltip(`${ui.value.metro} · ${station.label}${line}${stationSelected ? ` · ${metroShapeTooltip()}` : ""}`, { direction: "top", offset: [0, -13] });
    if (stationSelected) marker.openTooltip?.(); marker.on("click", select); marker.addTo(metroLayer);
  }
}
function onMetroRadiusSelect(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value);
  if (!Number.isFinite(value)) return;
  emit("metro-shape", { radiusM: value, bearingFrom: shapeBearingFrom.value ?? undefined, bearingTo: shapeBearingTo.value ?? undefined });
}

function markerSvg(kind: string): string {
  const common = `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
  const paths: Record<string, string> = {
    school: '<path d="m3 10 9-5 9 5"/><path d="M5 9v10h14V9"/><path d="M9 19v-6h6v6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2"/>',
    mall: '<path d="M6 8h12l1 13H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    park: '<path d="m12 3-5 8h3l-3 5h10l-3-5h3l-5-8Z"/><path d="M12 16v5"/>',
    university: '<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    airport: '<path d="M22 2 9 15"/><path d="m15 3-3 7-7 3-3 3 9-2-2 8 3-3 3-7 7-7Z"/>',
    train: '<rect x="6" y="3" width="12" height="15" rx="3"/><path d="M8 21l2-3M16 18l2 3M8 8h8M9 13h.01M15 13h.01"/>',
    bus: '<rect x="5" y="3" width="14" height="16" rx="2"/><path d="M7 8h10M8 19v2M16 19v2M8 15h.01M16 15h.01"/>',
    tram: '<rect x="6" y="4" width="12" height="14" rx="2"/><path d="m9 2 3 2 3-2M8 9h8M9 14h.01M15 14h.01M9 21l3-3 3 3"/>',
  };
  return `<svg ${common}>${paths[kind] || paths.building}</svg>`;
}

function renderAmenityLayer(layerGroup: any, zones: FlatMapZone[], visible: boolean, iconKind: string, radiusM = 0) {
  const L = Leaflet; if (!layerGroup || !L) return; layerGroup.clearLayers(); if (!visible) return;
  for (const zone of zones) {
    const color = safeColor(zone.color, "#e0679a");
    if (radiusM > 0) L.circle([zone.lat, zone.lng], { radius: radiusM, color, weight: 1.25, opacity: .55, dashArray: "5 5", fillColor: color, fillOpacity: .035, interactive: false }).addTo(layerGroup);
    if (zone.boundary) {
      const shape = L.geoJSON(zone.boundary as any, { style: () => ({ color, weight: 1.8, opacity: .85, fillColor: color, fillOpacity: .13, className: "flat-zone-shape" }), bubblingMouseEvents: false }).addTo(layerGroup);
      shape.bindTooltip(zone.label, { direction: "top" }); shape.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone)));
    }
    const icon = L.divIcon({ className: "flat-amenity-marker-wrap", html: `<span class="flat-amenity-marker" style="--amenity-color:${color}">${markerSvg(iconKind)}</span>`, iconSize: [27, 27], iconAnchor: [13.5, 13.5] });
    const marker = L.marker([zone.lat, zone.lng], { icon, bubblingMouseEvents: false });
    marker.bindTooltip(zone.label, { direction: "top", offset: [0, -12] }); marker.on("click", (event: any) => handleLayerClick(event, () => focusZone(zone))); marker.addTo(layerGroup);
  }
}

function modeVisible(mode: string): boolean {
  if (mode === "bus") return showBus.value;
  if (mode === "tram") return showTram.value;
  if (mode === "trolleybus") return showTrolleybus.value;
  if (mode === "minibus") return showMinibus.value;
  return false;
}
function modeRadius(mode: string): number {
  if (mode === "bus") return busRadiusM.value;
  if (mode === "tram") return tramRadiusM.value;
  if (mode === "trolleybus") return trolleybusRadiusM.value;
  if (mode === "minibus") return minibusRadiusM.value;
  return 0;
}
function transportAvailable(mode: TransportMode): boolean {
  if (mode === "funicular") return false;
  return transportStopZones.value.some((zone) => zone.mode === mode);
}
function renderTransportStops() {
  const L = Leaflet; if (!transportStopLayer || !L) return; transportStopLayer.clearLayers();
  for (const stop of transportStopZones.value) {
    if (!modeVisible(stop.mode || "")) continue;
    const color = safeColor(stop.color, "#2563eb"); const radius = modeRadius(stop.mode || "");
    if (radius > 0) L.circle([stop.lat, stop.lng], { radius, color, weight: 1.1, opacity: .45, fillColor: color, fillOpacity: .025, interactive: false }).addTo(transportStopLayer);
    const kind = stop.mode === "tram" ? "tram" : "bus";
    const icon = L.divIcon({ className: "flat-transport-marker-wrap", html: `<span class="flat-transport-marker" style="--transport-color:${color}">${markerSvg(kind)}</span>`, iconSize: [25, 25], iconAnchor: [12.5, 12.5] });
    const marker = L.marker([stop.lat, stop.lng], { icon, bubblingMouseEvents: false });
    const refs = stop.routeRefs?.length ? ` · ${stop.routeRefs.join(", ")}` : "";
    marker.bindTooltip(`${stop.label}${refs}`, { direction: "top", offset: [0, -11] }); marker.addTo(transportStopLayer);
  }
}

function renderAmenities() {
  renderAmenityLayer(universityLayer, props.universityZones || [], showUniversities.value, "university", universityRadiusM.value);
  renderAmenityLayer(shoppingMallLayer, props.shoppingMallZones || [], showShoppingMalls.value, "mall", mallRadiusM.value);
  renderAmenityLayer(parkLayer, props.parkZones || [], showParks.value, "park", parkRadiusM.value);
  renderAmenityLayer(schoolLayer, schoolZones.value, showSchools.value, "school", schoolRadiusM.value);
  renderAmenityLayer(residentialLayer, residentialComplexZones.value, showResidentialComplexes.value, "building", 0);
  renderAmenityLayer(airportLayer, airportZones.value, showAirports.value, "airport", airportRadiusM.value);
  renderAmenityLayer(railwayLayer, railwayStationZones.value, showRailwayStations.value, "train", railwayRadiusM.value);
  renderAmenityLayer(busStationLayer, busStationZones.value, showBusStations.value, "bus", busStationRadiusM.value);
  renderAmenityLayer(parkingLayer, parkingZones.value, showParkings.value, "parking", parkingRadiusM.value);
}

function renderAreaZones() {
  const L = Leaflet; if (!zoneAreaLayer || !L) return; zoneAreaLayer.clearLayers(); if (!showAreas.value) return;
  for (const zone of props.areaZones || []) renderZoneShape(zoneAreaLayer, zone, "area", { color: zone.color, weight: 2, dashArray: "6 5", fillColor: zone.color, fillOpacity: .14 });
}
function renderCityZone() {
  const L = Leaflet; if (!cityLayer || !L) return; cityLayer.clearLayers(); const zone = props.cityZone;
  if (!showCity.value || !zone?.boundary) return;
  L.geoJSON(zone.boundary as any, { style: () => ({ color: zone.color, weight: 2, opacity: .55, dashArray: "4 6", fill: false, interactive: false }) }).addTo(cityLayer);
}
function renderAllZoneLayers() {
  renderCityZone(); renderDistrictZones(); renderMicrodistricts(); renderQuartals(); renderMetro(); renderTransportStops(); renderAmenities(); renderAreaZones();
}
function toggleDrawing() { drawing.value = !drawing.value; menuOpen.value = null; if (drawing.value) closeRadial(); }
function clearArea() { area.value = []; renderArea(); emit("area-change", []); }

onMounted(async () => {
  language.value = document.documentElement.lang || navigator.language || "ru";
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("scroll", closeRadial, { passive: true });
  window.addEventListener("flat-map-focus", onMapFocus as EventListener);
  document.addEventListener("click", closeMenus);
  void loadFullMapFeed();
  void loadExtraGeo();
  if (!el.value) return;
  let L: typeof LeafletNS;
  try { L = await loadLeaflet(); } catch { failed.value = true; return; }
  if (!el.value) return;
  try {
    map = L.map(el.value, { scrollWheelZoom: false, zoomSnap: .25, zoomDelta: .5, preferCanvas: true }).setView([41.31, 69.24], 5);
  } catch { failed.value = true; return; }
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxNativeZoom: 19, maxZoom: 19, detectRetina: true }).addTo(map);
  layer = L.layerGroup().addTo(map); areaLayer = L.layerGroup().addTo(map); focusLayer = L.layerGroup().addTo(map); cityLayer = L.layerGroup().addTo(map);
  districtLayer = L.layerGroup().addTo(map); microdistrictLayer = L.layerGroup().addTo(map); quartalLayer = L.layerGroup().addTo(map); zoneAreaLayer = L.layerGroup().addTo(map);
  metroLayer = L.layerGroup().addTo(map); transportStopLayer = L.layerGroup().addTo(map);
  universityLayer = L.layerGroup().addTo(map); shoppingMallLayer = L.layerGroup().addTo(map); parkLayer = L.layerGroup().addTo(map); schoolLayer = L.layerGroup().addTo(map);
  residentialLayer = L.layerGroup().addTo(map); airportLayer = L.layerGroup().addTo(map); railwayLayer = L.layerGroup().addTo(map); busStationLayer = L.layerGroup().addTo(map); parkingLayer = L.layerGroup().addTo(map);
  map.on("click", (event: any) => { activateScroll(); closeMenus(); if (addDrawPoint(event)) return; closeRadial(); });
  el.value.addEventListener("mouseleave", deactivateScroll);
  map.on("zoomend", renderMarkers); map.on("movestart", closeRadial); map.on("zoomstart", closeRadial);
  renderMarkers(); renderFocusedPoint(); renderAllZoneLayers();
  if (selectedZoneFromProps()) syncSelectionFromProps(true); else fitToPoints();
});

watch(renderedPoints, () => { renderMarkers(); fitToPoints(); });
watch(() => new URLSearchParams(normalizedRouteQuery()).toString(), () => { void loadFullMapFeed(); void loadExtraGeo(); });
watch(() => [props.districtZones, props.microdistrictMarkers, props.quartalMarkers, props.metroStations, props.universityZones, props.shoppingMallZones, props.parkZones, props.areaZones, props.cityZone], () => syncSelectionFromProps(false));
watch(() => [props.selectedDistrict, props.selectedMicrodistrict, props.selectedQuartal, props.selectedArea, selectedMetros.value.join(","), props.selectedMetroRadiusM, props.metroBearingFrom, props.metroBearingTo], (next, previous) => {
  if (next.some((value, index) => value !== previous?.[index])) syncSelectionFromProps(Boolean(selectedZoneFromProps()));
});
watch([showDistricts, showMicrodistricts, showQuartals, showMetro, showBus, showTram, showTrolleybus, showMinibus, showUniversities, showShoppingMalls, showParks, showSchools, showResidentialComplexes, showParkings, showAirports, showRailwayStations, showBusStations, showAreas, showCity], renderAllZoneLayers);
watch([busRadiusM, tramRadiusM, trolleybusRadiusM, minibusRadiusM], renderTransportStops);
watch([schoolRadiusM, mallRadiusM, parkRadiusM, universityRadiusM, parkingRadiusM, airportRadiusM, railwayRadiusM, busStationRadiusM], renderAmenities);
watch(extraGeo, () => { renderMetro(); renderTransportStops(); renderAmenities(); });
watch(language, () => { void loadExtraGeo(); });
watch(() => props.cityZone, (zone, previous) => { if (zone && zone.id !== previous?.id && map) focusZone(zone); });

onBeforeUnmount(() => {
  mapFeedSequence += 1; extraGeoSequence += 1;
  window.removeEventListener("keydown", onKeydown); window.removeEventListener("scroll", closeRadial); window.removeEventListener("flat-map-focus", onMapFocus as EventListener);
  document.removeEventListener("click", closeMenus); el.value?.removeEventListener("mouseleave", deactivateScroll); document.body.style.overflow = "";
  map?.remove?.(); map = null;
  layer = areaLayer = focusLayer = districtLayer = microdistrictLayer = quartalLayer = metroLayer = universityLayer = shoppingMallLayer = parkLayer = schoolLayer = residentialLayer = airportLayer = railwayLayer = busStationLayer = parkingLayer = transportStopLayer = zoneAreaLayer = cityLayer = null;
});
</script>

<template>
  <Teleport to="body" :disabled="!expanded">
    <div v-show="!failed" class="flat-map-shell" :class="{ 'flat-map-shell_full': expanded }" @click.stop>
      <div ref="el" class="flat-map" />
      <div v-if="!expanded" v-show="!scrollActive" class="flat-map__scroll-hint">{{ props.scrollHintLabel || "Click the map to zoom" }}</div>

      <div class="flat-map__tools" @click.stop>
        <div class="flat-map__tool-wrap">
          <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': menuOpen === 'territories' }" :aria-label="ui.territories" @click="toggleMenu('territories')">
            <u-icon name="i-lucide-layers-3" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ ui.territories }}</span><u-icon name="i-lucide-chevron-down" class="flat-map__chevron" />
          </button>
          <div v-if="menuOpen === 'territories'" class="flat-map__menu flat-map__menu_territories" @click.stop>
            <strong class="flat-map__menu-title">{{ ui.territories }}</strong>
            <label v-if="cityZone?.boundary" class="flat-map__menu-row"><input v-model="showCity" type="checkbox" /><span>{{ props.cityLabel || ui.city }}</span></label>
            <label v-if="districtZones?.length" class="flat-map__menu-row"><input v-model="showDistricts" type="checkbox" /><span>{{ props.districtsLabel || ui.districts }}</span></label>
            <label v-if="microdistrictMarkers?.length" class="flat-map__menu-row"><input v-model="showMicrodistricts" type="checkbox" /><span>{{ props.microdistrictsLabel || ui.microdistricts }}</span></label>
            <label v-if="quartalMarkers?.length" class="flat-map__menu-row"><input v-model="showQuartals" type="checkbox" /><span>{{ ui.mahallas }}</span></label>
            <label v-if="areaZones?.length" class="flat-map__menu-row"><input v-model="showAreas" type="checkbox" /><span>{{ props.areasLabel || ui.areas }}</span></label>
          </div>
        </div>

        <div class="flat-map__tool-wrap">
          <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': menuOpen === 'transport' || showMetro || showBus || showTram || showTrolleybus || showMinibus }" :aria-label="ui.transport" @click="toggleMenu('transport')">
            <u-icon name="i-lucide-train-front" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ ui.transport }}</span><u-icon name="i-lucide-chevron-down" class="flat-map__chevron" />
          </button>
          <div v-if="menuOpen === 'transport'" class="flat-map__menu flat-map__menu_transport" @click.stop>
            <strong class="flat-map__menu-title">{{ ui.transport }}</strong>
            <div v-if="metroStations?.length" class="flat-map__filter-block">
              <label class="flat-map__menu-row"><input v-model="showMetro" type="checkbox" /><span class="flat-map__row-icon flat-map__row-icon_metro">M</span><span>{{ props.metroLabel || ui.metro }}</span></label>
              <label v-if="showMetro" class="flat-map__radius-select"><span>{{ ui.radius }}</span><select :value="Math.round(shapeRadiusM)" @change="onMetroRadiusSelect"><option v-for="radius in RADIUS_OPTIONS" :key="radius" :value="radius">{{ radius }} м</option></select></label>
            </div>
            <div v-for="item in [
              { mode: 'bus', label: ui.bus, model: showBus, radius: busRadiusM },
              { mode: 'tram', label: ui.tram, model: showTram, radius: tramRadiusM },
              { mode: 'trolleybus', label: ui.trolleybus, model: showTrolleybus, radius: trolleybusRadiusM },
              { mode: 'minibus', label: ui.minibus, model: showMinibus, radius: minibusRadiusM },
            ]" :key="item.mode" class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !transportAvailable(item.mode as TransportMode) }">
                <input v-model="item.model" type="checkbox" :disabled="!transportAvailable(item.mode as TransportMode)" />
                <u-icon :name="item.mode === 'tram' ? 'i-lucide-tram-front' : 'i-lucide-bus-front'" class="flat-map__row-icon" />
                <span>{{ item.label }}</span><small v-if="!transportAvailable(item.mode as TransportMode)">{{ ui.noData }}</small>
              </label>
              <label v-if="item.model && transportAvailable(item.mode as TransportMode)" class="flat-map__radius-select"><span>{{ ui.radius }}</span><select v-model.number="item.radius"><option v-for="radius in RADIUS_OPTIONS" :key="radius" :value="radius">{{ radius }} м</option></select></label>
            </div>
            <label class="flat-map__menu-row flat-map__menu-row_disabled"><input v-model="showFunicular" type="checkbox" disabled /><u-icon name="i-lucide-cable-car" class="flat-map__row-icon" /><span>{{ ui.funicular }}</span><small>{{ ui.noData }}</small></label>
          </div>
        </div>

        <div class="flat-map__tool-wrap">
          <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': menuOpen === 'poi' || showUniversities || showShoppingMalls || showParks || showSchools || showResidentialComplexes || showParkings || showAirports || showRailwayStations || showBusStations }" :aria-label="ui.poi" @click="toggleMenu('poi')">
            <u-icon name="i-lucide-map-pin" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ ui.poi }}</span><u-icon name="i-lucide-chevron-down" class="flat-map__chevron" />
          </button>
          <div v-if="menuOpen === 'poi'" class="flat-map__menu flat-map__menu_poi" @click.stop>
            <strong class="flat-map__menu-title">{{ ui.poi }}</strong>

            <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !residentialComplexZones.length }"><input v-model="showResidentialComplexes" type="checkbox" :disabled="!residentialComplexZones.length" /><u-icon name="i-lucide-building-2" class="flat-map__row-icon" /><span>{{ ui.residential }}</span><small v-if="!residentialComplexZones.length">{{ ui.noData }}</small></label>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !schoolZones.length }"><input v-model="showSchools" type="checkbox" :disabled="!schoolZones.length" /><u-icon name="i-lucide-school" class="flat-map__row-icon" /><span>{{ ui.schools }}</span><small v-if="!schoolZones.length">{{ ui.noData }}</small></label>
              <div v-if="showSchools && schoolZones.length" class="flat-map__radius-control"><input v-model.number="schoolRadiusM" type="range" min="100" max="2000" step="50" /><label><input v-model.number="schoolRadiusM" type="number" min="100" max="5000" step="50" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !shoppingMallZones?.length }"><input v-model="showShoppingMalls" type="checkbox" :disabled="!shoppingMallZones?.length" /><u-icon name="i-lucide-shopping-bag" class="flat-map__row-icon" /><span>{{ props.shoppingMallsLabel || ui.malls }}</span></label>
              <div v-if="showShoppingMalls && shoppingMallZones?.length" class="flat-map__radius-control"><input v-model.number="mallRadiusM" type="range" min="100" max="3000" step="100" /><label><input v-model.number="mallRadiusM" type="number" min="100" max="5000" step="100" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !parkZones?.length }"><input v-model="showParks" type="checkbox" :disabled="!parkZones?.length" /><u-icon name="i-lucide-tree-pine" class="flat-map__row-icon" /><span>{{ props.parksLabel || ui.parks }}</span></label>
              <div v-if="showParks && parkZones?.length" class="flat-map__radius-control"><input v-model.number="parkRadiusM" type="range" min="100" max="3000" step="100" /><label><input v-model.number="parkRadiusM" type="number" min="100" max="5000" step="100" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !universityZones?.length }"><input v-model="showUniversities" type="checkbox" :disabled="!universityZones?.length" /><u-icon name="i-lucide-graduation-cap" class="flat-map__row-icon" /><span>{{ props.universitiesLabel || ui.universities }}</span></label>
              <div v-if="showUniversities && universityZones?.length" class="flat-map__radius-control"><input v-model.number="universityRadiusM" type="range" min="100" max="3000" step="100" /><label><input v-model.number="universityRadiusM" type="number" min="100" max="5000" step="100" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !parkingZones.length }"><input v-model="showParkings" type="checkbox" :disabled="!parkingZones.length" /><u-icon name="i-lucide-square-parking" class="flat-map__row-icon" /><span>{{ ui.parking }}</span><small v-if="!parkingZones.length">{{ ui.noData }}</small></label>
              <div v-if="showParkings && parkingZones.length" class="flat-map__radius-control"><input v-model.number="parkingRadiusM" type="range" min="100" max="2000" step="50" /><label><input v-model.number="parkingRadiusM" type="number" min="100" max="5000" step="50" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !airportZones.length }"><input v-model="showAirports" type="checkbox" :disabled="!airportZones.length" /><u-icon name="i-lucide-plane" class="flat-map__row-icon" /><span>{{ ui.airport }}</span><small v-if="!airportZones.length">{{ ui.noData }}</small></label>
              <div v-if="showAirports && airportZones.length" class="flat-map__radius-control"><input v-model.number="airportRadiusM" type="range" min="500" max="5000" step="250" /><label><input v-model.number="airportRadiusM" type="number" min="100" max="10000" step="100" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !railwayStationZones.length }"><input v-model="showRailwayStations" type="checkbox" :disabled="!railwayStationZones.length" /><u-icon name="i-lucide-train-front" class="flat-map__row-icon" /><span>{{ ui.railway }}</span><small v-if="!railwayStationZones.length">{{ ui.noData }}</small></label>
              <div v-if="showRailwayStations && railwayStationZones.length" class="flat-map__radius-control"><input v-model.number="railwayRadiusM" type="range" min="200" max="5000" step="100" /><label><input v-model.number="railwayRadiusM" type="number" min="100" max="10000" step="100" /><span>м</span></label></div>
            </div>

            <div class="flat-map__filter-block">
              <label class="flat-map__menu-row" :class="{ 'flat-map__menu-row_disabled': !busStationZones.length }"><input v-model="showBusStations" type="checkbox" :disabled="!busStationZones.length" /><u-icon name="i-lucide-bus-front" class="flat-map__row-icon" /><span>{{ ui.busStation }}</span><small v-if="!busStationZones.length">{{ ui.noData }}</small></label>
              <div v-if="showBusStations && busStationZones.length" class="flat-map__radius-control"><input v-model.number="busStationRadiusM" type="range" min="200" max="5000" step="100" /><label><input v-model.number="busStationRadiusM" type="number" min="100" max="10000" step="100" /><span>м</span></label></div>
            </div>
          </div>
        </div>

        <button type="button" class="flat-map__tool" :class="{ 'flat-map__tool_active': drawing }" :aria-label="drawing ? (props.doneLabel || 'Done') : (props.drawLabel || 'Draw area')" @click="toggleDrawing">
          <u-icon :name="drawing ? 'i-lucide-check' : 'i-lucide-scan'" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ drawing ? (props.doneLabel || "Done") : (props.drawLabel || "Draw area") }}</span>
        </button>
        <button v-if="area.length" type="button" class="flat-map__tool" :aria-label="props.clearLabel || 'Clear area'" @click="clearArea"><u-icon name="i-lucide-trash-2" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ props.clearLabel || "Clear" }}</span></button>

        <span class="flat-map__tools-spacer" />
        <button v-if="!expanded" type="button" class="flat-map__tool" :aria-label="props.expandLabel || 'Full screen'" @click="toggleExpanded"><u-icon name="i-lucide-maximize-2" class="flat-map__tool-icon" /><span class="flat-map__tool-label">{{ props.expandLabel || "Full screen" }}</span></button>
        <button v-else type="button" class="flat-map__tool flat-map__tool_close" :aria-label="props.collapseLabel || 'Close map'" @click="toggleExpanded"><u-icon name="i-lucide-x" class="flat-map__tool-icon" /></button>
      </div>

      <aside v-if="expanded" class="flat-map__price-legend">
        <strong>{{ ui.priceLegend }}</strong>
        <span><i class="tone tone_red" />+45% и выше</span>
        <span><i class="tone tone_yellow" />+31–44%</span>
        <span><i class="tone tone_orange" />+16–30%</span>
        <span><i class="tone tone_pink" />±15%</span>
        <span><i class="tone tone_blue" />−16–30%</span>
        <span><i class="tone tone_green" />−31% и ниже</span>
      </aside>

      <aside v-if="expanded && districtPanel" class="flat-map__district-card">
        <header><div><strong>{{ districtPanel.name }}</strong><small>{{ districtPanel.count }} {{ ui.districtListings }}</small></div></header>
        <div class="flat-map__district-stats">
          <span><b>{{ districtPanel.count }}</b><small>{{ ui.districtListings }}</small></span>
          <span><b>{{ formatMoney(districtPanel.median, districtPanel.currency) }}</b><small>{{ ui.median }}</small></span>
        </div>
        <section v-if="districtPanel.best" class="flat-map__best-offer">
          <strong>{{ ui.bestOffer }}</strong>
          <button type="button" @click="openPoint(districtPanel.best)">
            <span class="flat-map__best-thumb"><img v-if="districtPanel.best.photo" :src="districtPanel.best.photo" :alt="districtPanel.best.title" /><img v-else src="/svg/shark.svg" alt="" /></span>
            <span class="flat-map__best-copy"><b>{{ districtPanel.best.priceLabel || formatMoney(Number(districtPanel.best.price), districtPanel.best.currency || '') }}</b><small>{{ districtPanel.best.title }}</small><em :style="{ color: toneCss(priceToneForItems([districtPanel.best])) }">{{ bestDeltaLabel(districtPanel.bestRatio) }}</em></span>
            <u-icon name="i-lucide-chevron-right" />
          </button>
        </section>
      </aside>

      <div v-if="drawing" class="flat-map__hint">{{ props.drawHint || "Click points on the map to outline an area." }}</div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div v-if="radial" class="flat-radial" @click.self="closeRadial">
      <div class="flat-radial__anchor" :style="{ left: `${radial.x}px`, top: `${radial.y}px` }">
        <div class="flat-radial__hub" role="group" aria-label="Browse apartment pages in this cluster">
          <button type="button" class="flat-radial__hub-arrow" :disabled="radialPageCount <= 1" aria-label="Previous apartment page" @click.stop="changeRadialPage(-1)">‹</button>
          <span class="flat-radial__hub-count" :title="`${radial.items.length} apartments`">{{ radialPageLabel }}</span>
          <button type="button" class="flat-radial__hub-arrow" :disabled="radialPageCount <= 1" aria-label="Next apartment page" @click.stop="changeRadialPage(1)">›</button>
        </div>
        <div v-for="(item, i) in visibleRadialItems" :key="`${radial.page}:${pointKey(item)}`" class="flat-radial__slot" :style="slotStyle(i, visibleRadialItems.length)">
          <button type="button" class="flat-radial__tab" @click="openPoint(item)">
            <span class="flat-radial__thumb"><img v-if="item.photo" :src="item.photo" :alt="item.title" loading="lazy" decoding="async" referrerpolicy="no-referrer" /><img v-else src="/svg/shark.svg" alt="" class="flat-radial__thumb-empty" loading="lazy" /></span>
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
.flat-map-shell_full { position: fixed; inset: 0; z-index: 3000; padding: 10px; background: var(--bg-primary, #0b0f2a); }
.flat-map-shell_full .flat-map { height: 100%; border-radius: 8px; }
.flat-map { width: 100%; height: 420px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
.flat-map :deep(.leaflet-interactive) { outline: none; }
.flat-map :deep(.flat-zone-shape) { transition: fill-opacity .15s ease, stroke-opacity .15s ease, stroke-width .15s ease; cursor: pointer; }
.flat-map :deep(.flat-zone-shape:hover) { fill-opacity: .34 !important; stroke-width: 3px; }
.flat-map :deep(.flat-zone-shape_dim) { filter: grayscale(.85); }
:deep(.flat-zone-label_dim) { opacity: .55; filter: grayscale(.85); }

.flat-map__tools { position: absolute; z-index: 700; top: 10px; left: 52px; right: 10px; display: flex; align-items: flex-start; gap: 6px; pointer-events: none; }
.flat-map__tool-wrap { position: relative; pointer-events: auto; }
.flat-map__tool { pointer-events: auto; display: inline-flex; align-items: center; justify-content: center; gap: 0; height: 36px; min-width: 36px; padding: 0 9px; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: rgba(10,15,35,.94); color: var(--text-primary); cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.24); backdrop-filter: blur(10px); transition: border-color .15s ease, background .15s ease, color .15s ease; }
.flat-map__tool:hover, .flat-map__tool:focus-visible { border-color: rgba(224,103,154,.55); color: #fff; outline: none; }
.flat-map__tool_active { color: var(--accent-pink); border-color: rgba(224,103,154,.65); background: rgba(27,20,49,.96); }
.flat-map__tool-icon { flex: 0 0 auto; width: 17px; height: 17px; }
.flat-map__chevron { width: 13px; height: 13px; margin-left: 3px; opacity: .7; }
.flat-map__tool-label { display: inline-block; max-width: 0; margin-left: 0; overflow: hidden; opacity: 0; white-space: nowrap; transition: max-width .2s ease, opacity .15s ease, margin-left .2s ease; }
.flat-map__tool:hover .flat-map__tool-label, .flat-map__tool:focus-visible .flat-map__tool-label, .flat-map__tool_active .flat-map__tool-label { max-width: 180px; margin-left: 7px; opacity: 1; }
.flat-map__tools-spacer { flex: 1 1 auto; }
.flat-map__tool_close { width: 36px; padding: 0; color: #fff; }
.flat-map__tool_close .flat-map__tool-label { display: none; }

.flat-map__menu { position: absolute; top: 43px; left: 0; width: 286px; max-height: min(70vh, 590px); overflow: auto; padding: 11px; border: 1px solid rgba(255,255,255,.12); border-radius: 10px; background: rgba(10,15,35,.97); box-shadow: 0 14px 34px rgba(0,0,0,.38); color: var(--text-primary); backdrop-filter: blur(14px); }
.flat-map__menu_poi { width: 318px; }
.flat-map__menu-title { display: block; padding: 4px 7px 8px; font-size: 13px; }
.flat-map__menu-row { display: flex; align-items: center; gap: 9px; min-height: 34px; padding: 6px 7px; border-radius: 7px; font-size: 13px; cursor: pointer; }
.flat-map__menu-row:hover { background: rgba(255,255,255,.05); }
.flat-map__menu-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--accent-pink); }
.flat-map__menu-row small { margin-left: auto; color: var(--text-muted); font-size: 10px; }
.flat-map__menu-row_disabled { opacity: .48; cursor: default; }
.flat-map__row-icon { width: 17px; height: 17px; color: #c9d3ef; }
.flat-map__row-icon_metro { display: grid; place-items: center; width: 19px; height: 19px; border: 2px solid #2563eb; border-radius: 50%; color: #fff; font-size: 10px; font-weight: 900; }
.flat-map__filter-block + .flat-map__filter-block, .flat-map__filter-block + .flat-map__menu-row, .flat-map__menu-row + .flat-map__filter-block { border-top: 1px solid rgba(255,255,255,.06); }
.flat-map__radius-select { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 1px 7px 8px 40px; color: var(--text-muted); font-size: 11px; }
.flat-map__radius-select select, .flat-map__radius-control input[type="number"] { min-height: 28px; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; background: #11172f; color: #fff; }
.flat-map__radius-select select { padding: 0 7px; }
.flat-map__radius-control { display: grid; grid-template-columns: minmax(0,1fr) 86px; align-items: center; gap: 8px; padding: 0 7px 8px 40px; }
.flat-map__radius-control > input[type="range"] { width: 100%; accent-color: var(--accent-pink); }
.flat-map__radius-control label { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: 10px; }
.flat-map__radius-control input[type="number"] { width: 64px; padding: 0 5px; }

.flat-map__hint { position: absolute; z-index: 650; left: 50%; bottom: 12px; transform: translateX(-50%); padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: rgba(13,17,40,.94); color: var(--text-primary); font-size: 12px; }
.flat-map__scroll-hint { position: absolute; z-index: 400; left: 50%; top: 12px; transform: translateX(-50%); padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: rgba(13,17,40,.88); color: var(--text-primary); font-size: 12px; pointer-events: none; opacity: 0; transition: opacity .18s ease; }
.flat-map-shell:hover .flat-map__scroll-hint { opacity: 1; }

:deep(.flat-cluster) { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 50%; background: rgba(12,18,39,.94); border: 2px solid var(--cluster-tone, var(--flat-tone-pink)); box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,.38), 0 0 0 1px rgba(255,255,255,.72); animation: flat-cluster-in .2s ease backwards; }
:deep(.flat-cluster_multi) { width: 32px; height: 32px; color: #fff; font-size: 12px; font-weight: 800; background: rgba(12,18,39,.94); }
@keyframes flat-cluster-in { from { opacity: 0; transform: scale(.45); } }

:deep(.flat-metro-marker) { display: grid; place-items: center; width: 28px; height: 28px; padding: 2.5px; border-radius: 50%; background: var(--metro-ring, #2563eb); box-sizing: border-box; box-shadow: 0 2px 6px rgba(0,0,0,.35); transition: opacity .15s ease, transform .15s ease; }
:deep(.flat-metro-marker > span) { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: #11172f; color: #fff; font-size: 11px; font-weight: 900; border: 1px solid rgba(255,255,255,.7); }
:deep(.flat-metro-marker_selected) { transform: scale(1.12); }
:deep(.flat-metro-marker_dim) { opacity: .52; }
:deep(.flat-metro-marker-wrap), :deep(.flat-amenity-marker-wrap), :deep(.flat-transport-marker-wrap) { background: none; border: 0; }

:deep(.flat-metro-handle-wrap) { cursor: grab; }
:deep(.flat-metro-handle-wrap:active) { cursor: grabbing; }
:deep(.flat-metro-handle) { display: block; width: 14px; height: 14px; margin: 2px; border-radius: 50%; background: #fff; border: 3px solid #e0679a; box-sizing: border-box; box-shadow: 0 1px 5px rgba(0,0,0,.45); }
:deep(.flat-metro-handle_from), :deep(.flat-metro-handle_to) { border-radius: 3px; transform: rotate(45deg); border-color: #8b5cf6; }
@media (pointer: coarse) { :deep(.flat-metro-handle) { width: 18px; height: 18px; margin: 0; } }

:deep(.flat-zone-label-wrap) { pointer-events: none; }
:deep(.flat-zone-label) { display: inline-block; transform: translate(-50%, -50%); padding: 3px 8px; border: 1.5px solid; border-radius: 999px; background: rgba(13,17,40,.92); color: var(--text-primary,#fff); font-size: 11px; font-weight: 700; white-space: nowrap; pointer-events: none; }
:deep(.flat-amenity-marker), :deep(.flat-transport-marker) { display: grid; place-items: center; width: 25px; height: 25px; box-sizing: border-box; border: 2px solid #fff; border-radius: 50%; background: var(--amenity-color, var(--transport-color, #2563eb)); color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,.42); }
:deep(.flat-amenity-marker svg), :deep(.flat-transport-marker svg) { width: 13px; height: 13px; }

.flat-map__price-legend { position: absolute; z-index: 620; left: 16px; bottom: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 7px 16px; width: 330px; padding: 13px 14px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: rgba(10,15,35,.94); color: var(--text-primary); box-shadow: 0 8px 24px rgba(0,0,0,.3); backdrop-filter: blur(12px); }
.flat-map__price-legend strong { grid-column: 1/-1; margin-bottom: 2px; font-size: 12px; }
.flat-map__price-legend span { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--text-soft); }
.tone { width: 10px; height: 10px; border-radius: 50%; }
.tone_red { background: var(--flat-tone-red); }.tone_yellow { background: var(--flat-tone-yellow); }.tone_orange { background: var(--flat-tone-orange); }.tone_pink { background: var(--flat-tone-pink); }.tone_blue { background: var(--flat-tone-blue); }.tone_green { background: var(--flat-tone-green); }

.flat-map__district-card { position: absolute; z-index: 620; top: 62px; right: 16px; width: min(340px, calc(100vw - 32px)); padding: 14px; border: 1px solid rgba(255,255,255,.11); border-radius: 11px; background: rgba(10,15,35,.96); color: var(--text-primary); box-shadow: 0 10px 30px rgba(0,0,0,.34); backdrop-filter: blur(12px); }
.flat-map__district-card header > div { display: grid; gap: 2px; }
.flat-map__district-card header strong { font-size: 17px; }
.flat-map__district-card header small { color: var(--text-muted); font-size: 11px; }
.flat-map__district-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
.flat-map__district-stats span { display: grid; gap: 2px; padding: 9px; border: 1px solid rgba(255,255,255,.07); border-radius: 8px; background: rgba(255,255,255,.035); }
.flat-map__district-stats b { font-size: 14px; }.flat-map__district-stats small { color: var(--text-muted); font-size: 9px; }
.flat-map__best-offer { display: grid; gap: 8px; margin-top: 12px; }.flat-map__best-offer > strong { font-size: 11px; }
.flat-map__best-offer button { display: grid; grid-template-columns: 64px minmax(0,1fr) 18px; align-items: center; gap: 9px; width: 100%; padding: 7px; border: 1px solid rgba(255,255,255,.09); border-radius: 8px; background: rgba(255,255,255,.035); color: inherit; text-align: left; cursor: pointer; }
.flat-map__best-offer button:hover { border-color: rgba(224,103,154,.45); }
.flat-map__best-thumb { width: 64px; height: 50px; overflow: hidden; border-radius: 6px; background: rgba(255,255,255,.05); }.flat-map__best-thumb img { width: 100%; height: 100%; object-fit: cover; }
.flat-map__best-copy { display: grid; min-width: 0; gap: 2px; }.flat-map__best-copy b { font-size: 13px; }.flat-map__best-copy small { overflow: hidden; color: var(--text-muted); font-size: 10px; white-space: nowrap; text-overflow: ellipsis; }.flat-map__best-copy em { font-style: normal; font-size: 10px; font-weight: 700; }

.flat-radial { position: fixed; inset: 0; z-index: 9000; }.flat-radial__anchor { position: absolute; width: 0; height: 0; }
.flat-radial__hub { position: absolute; top: 50%; left: 50%; z-index: 3; transform: translate(-50%,-50%); display: grid; grid-template-columns: 19px 26px 19px; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: var(--accent-pink,#e0679a); color: #fff; border: 2px solid #fff; box-shadow: 0 3px 12px rgba(0,0,0,.5); }
.flat-radial__hub-arrow { display: grid; place-items: center; align-self: stretch; width: 100%; padding: 0; border: 0; background: transparent; color: #fff; cursor: pointer; font-size: 27px; line-height: 1; }.flat-radial__hub-arrow:disabled { opacity: .35; cursor: default; }.flat-radial__hub-count { text-align: center; font-size: 10px; font-weight: 800; line-height: 1; pointer-events: none; }
.flat-radial__slot { position: absolute; top: 0; left: 0; z-index: 1; animation: flat-radial-in .24s cubic-bezier(.34,1.56,.64,1) backwards; }@keyframes flat-radial-in { from { opacity: 0; transform: translate(-50%,-50%) scale(.3); } }
.flat-radial__tab { display: flex; flex-direction: column; width: 92px; padding: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: rgba(13,17,40,.97); color: var(--text-primary); cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.5); transition: transform .12s ease,border-color .12s ease; }.flat-radial__tab:hover { transform: translateY(-2px) scale(1.05); border-color: var(--accent-pink,#e0679a); }
.flat-radial__thumb { display: block; width: 100%; height: 60px; background: rgba(255,255,255,.05); }.flat-radial__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }.flat-radial__thumb-empty { display: block; width: 60%; height: 60%; margin: 20% auto; object-fit: contain; opacity: .4; }.flat-radial__price { padding: 4px 6px; font-size: 12px; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
:deep(.leaflet-container) { background: var(--bg-panel); font-family: inherit; }

@include bp-down(sm) {
  .flat-map-shell_full { padding: 0; }.flat-map-shell_full .flat-map { border: 0; border-radius: 0; }
  .flat-map__tools { top: max(8px, env(safe-area-inset-top)); left: 48px; right: 8px; gap: 4px; }
  .flat-map__tool { height: 34px; min-width: 34px; padding-inline: 8px; }.flat-map__tool:hover .flat-map__tool-label, .flat-map__tool:focus-visible .flat-map__tool-label, .flat-map__tool_active .flat-map__tool-label { max-width: 0; margin-left: 0; opacity: 0; }
  .flat-map__menu { position: fixed; top: 52px; left: 8px; right: 8px; width: auto; max-height: 68vh; }
  .flat-map__price-legend { left: 8px; right: 8px; bottom: max(8px, env(safe-area-inset-bottom)); width: auto; }
  .flat-map__district-card { display: none; }
  .flat-radial__hub { width: 52px; height: 52px; grid-template-columns: 15px 22px 15px; }.flat-radial__hub-arrow { font-size: 23px; }.flat-radial__hub-count { font-size: 9px; }.flat-radial__tab { width: 76px; border-radius: 7px; }.flat-radial__thumb { height: 46px; }.flat-radial__price { padding: 3px 4px; font-size: 10px; }
}
</style>
