export type FlatGeoBoundary = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

export interface FlatGeoZone {
  id: string;
  parentId?: string | null;
  type: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  radiusM: number;
  color: string;
  boundary?: FlatGeoBoundary | null;
  mode?: string;
  routeRefs?: string[];
  lineColor?: string;
  lineColors?: string[];
}

export interface FlatGeoZonesResponse {
  districtZones: FlatGeoZone[];
  regionZones: FlatGeoZone[];
  microdistrictMarkers: FlatGeoZone[];
  mahallaMarkers: FlatGeoZone[];
  quarterMarkers: FlatGeoZone[];
  quartalMarkers: FlatGeoZone[];
  areaZones: FlatGeoZone[];
  zoneMarkers: FlatGeoZone[];
  metroStations: FlatGeoZone[];
  parks: FlatGeoZone[];
  shoppingMalls: FlatGeoZone[];
  universities: FlatGeoZone[];
  schools: FlatGeoZone[];
  residentialComplexes: FlatGeoZone[];
  airports: FlatGeoZone[];
  railwayStations: FlatGeoZone[];
  busStations: FlatGeoZone[];
  transportStops: FlatGeoZone[];
  parkings: FlatGeoZone[];
  cityZone: FlatGeoZone | null;
}
