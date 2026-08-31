type Position = [number, number];
type PolygonCoordinates = Position[][];

export type MapBoundaryGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

function outerRingArea(polygon: PolygonCoordinates): number {
  const ring = polygon[0] || [];
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index]!;
    const [x2, y2] = ring[(index + 1) % ring.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

// A district can contain a remote exclave. Keep the complete MultiPolygon for
// rendering, but focus the map on its largest (primary) territory.
export function primaryBoundaryGeometry(boundary: MapBoundaryGeometry): MapBoundaryGeometry {
  if (boundary.type !== "MultiPolygon") return boundary;
  const polygons = boundary.coordinates as PolygonCoordinates[];
  if (polygons.length < 2) return boundary;
  const primary = polygons.reduce((largest, polygon) => (
    outerRingArea(polygon) > outerRingArea(largest) ? polygon : largest
  ));
  return { type: "Polygon", coordinates: primary };
}
