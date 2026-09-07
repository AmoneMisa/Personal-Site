from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'app/components/flats/FlatMap.client.vue'
s = PATH.read_text()


def rep(old: str, new: str, label: str) -> None:
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    s = s.replace(old, new, 1)


rep(
    '  boundary?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };',
    '  boundary?: { type: "Polygon" | "MultiPolygon"; coordinates: unknown } | null;',
    'nullable canonical boundary',
)
rep(
    '  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;',
    '  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;',
    'median indexes',
)
rep(
    '  if (colors.length === 1) return colors[0];',
    '  if (colors.length === 1) return colors[0] ?? meta.lineColor;',
    'metro ring color',
)
rep(
    '  if (c.items.length === 1) { openPoint(c.items[0]); return; }',
    '  if (c.items.length === 1) { openPoint(c.items[0]!); return; }',
    'singleton cluster',
)
rep(
    '    const points = area.value.map((point) => [point.lat, point.lng]);',
    '    const points: [number, number][] = area.value.map((point) => [point.lat, point.lng]);',
    'drawn area tuples',
)
rep(
    'function makeMetroHandle(station: FlatMapZone, kind: "radius" | "from" | "to") {\n  const L = Leaflet; const at = destinationPoint(station, handleBearing(kind), shapeRadiusM.value);',
    'function makeMetroHandle(station: FlatMapZone, kind: "radius" | "from" | "to") {\n  const L = Leaflet; if (!L) return null;\n  const at = destinationPoint(station, handleBearing(kind), shapeRadiusM.value);',
    'metro handle Leaflet guard',
)
rep(
    'function renderMetroSelection(stations: FlatMapZone[]) {\n  const L = Leaflet; const primary = stations[0]; if (!primary) return; metroShapeStation = primary;',
    'function renderMetroSelection(stations: FlatMapZone[]) {\n  const L = Leaflet; const primary = stations[0]; if (!L || !primary) return; metroShapeStation = primary;',
    'metro selection Leaflet guard',
)
rep(
    '  return `<svg ${common}>${paths[kind] || paths.building}</svg>`;',
    '  return `<svg ${common}>${paths[kind] ?? paths.building!}</svg>`;',
    'marker svg fallback',
)

# Narrowing a module-level nullable Leaflet variable does not survive nested
# callbacks. Keep a stable local alias inside the two renderers that install
# click handlers.
s = s.replace(
    'function renderTransportStops() {\n  const L = Leaflet; if (!transportStopLayer || !L) return;',
    'function renderTransportStops() {\n  const L = Leaflet; if (!transportStopLayer || !L) return;\n  const leaflet = L;',
)
s = s.replace('L.circle([stop.lat, stop.lng]', 'leaflet.circle([stop.lat, stop.lng]')
s = s.replace('L.divIcon({ className: "flat-transport-marker-wrap"', 'leaflet.divIcon({ className: "flat-transport-marker-wrap"')
s = s.replace('L.marker([stop.lat, stop.lng]', 'leaflet.marker([stop.lat, stop.lng]')

PATH.write_text(s)
print('Tightened redesigned map TypeScript without changing runtime behavior')
