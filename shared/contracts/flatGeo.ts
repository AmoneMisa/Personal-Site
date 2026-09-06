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
}

export interface FlatGeoZonesResponse {
  districtZones: FlatGeoZone[];
  microdistrictMarkers: FlatGeoZone[];
  quartalMarkers: FlatGeoZone[];
  areaZones: FlatGeoZone[];
  metroStations: FlatGeoZone[];
  parks: FlatGeoZone[];
  shoppingMalls: FlatGeoZone[];
  universities: FlatGeoZone[];
  cityZone: FlatGeoZone | null;
}
