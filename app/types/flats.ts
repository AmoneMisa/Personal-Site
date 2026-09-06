export interface FlatVisionEvidence {
  value?: boolean | number | string | null;
  confidence?: number;
  evidence?: string[];
}

export interface FlatVisionResult {
  provider?: string | null;
  analyzedAt?: string | null;
  derivedFields?: string[];
  data?: Record<string, FlatVisionEvidence>;
}

export interface FlatMarketComparison {
  goodPrice: boolean;
  medianUsd: number | null;
  comparableCount: number;
  priceUsd?: number | null;
  priceRatio?: number | null;
}

export type FlatAudience = "women" | "men" | "family";

export interface FlatMoneyAmount {
  amount: number;
  currency: string | null;
  approximate?: boolean;
}

export interface FlatTransportStop {
  id: string;
  name: string;
  mode: string;
  distanceM: number;
  walkingDistanceM?: number | null;
  walkingDurationMin?: number | null;
  routeRefs: string[];
  geoEntityId?: string | null;
  osm?: { type?: string; id?: number } | null;
  source?: string | null;
  walkingSource?: string | null;
}

export interface FlatPerPersonPrice extends FlatMoneyAmount {
  scope: "person";
}

export interface FlatListing {
  id: string;
  publicId?: number | null;
  source: string;
  country: string;
  title: string;
  propertyType: "flat" | "house";
  byAgency: boolean;
  price: number | null;
  currency: string;
  rooms: number | null;
  areaSqm: number | null;
  city: string;
  district?: string | null;
  region?: string | null;
  microdistrict?: string | null;
  metro?: string | null;
  metroWalkingDistanceM?: number | null;
  metroWalkingDurationMin?: number | null;
  nearbyMetro?: FlatTransportStop[];
  nearbyTransport?: FlatTransportStop[];
  address?: string | null;
  roomOnly?: boolean;
  lat: number | null;
  lng: number | null;
  photo: string | null;
  photos: string[];
  url: string;
  createdAt: string | null;
  description: string;
  dealType: "sale" | "longRent" | "shortRent" | null;
  floor?: number | null;
  totalFloors?: number | null;
  buildingYear?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balcony?: boolean | null;
  terrace?: boolean | null;
  privateYard?: boolean | null;
  dishwasher?: boolean | null;
  airConditioner?: boolean | null;
  tv?: boolean | null;
  microwave?: boolean | null;
  oven?: boolean | null;
  bidet?: boolean | null;
  walkInCloset?: boolean | null;
  bathtub?: boolean | null;
  shower?: boolean | null;
  euroLayout?: boolean | null;
  gas?: boolean | null;
  newBuilding?: boolean | null;
  cadastral?: boolean | null;
  firstRental?: boolean | null;
  potentiallyUnsafe?: boolean;
  communalSeparated?: boolean | null;
  kvartal?: string | null;
  area?: string | null;
  areaAmbiguous?: boolean;
  locationConfidence?: number | null;
  requireExactAddress?: boolean;
  nearbyShops?: string[];
  nearby?: string[];
  residenceComplex?: string | null;
  petsAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  audience?: FlatAudience | null;
  audienceAlternatives?: FlatAudience[];
  deposit?: boolean | null;
  depositAmount?: number | null;
  depositCurrency?: string | null;
  commission?: boolean | null;
  commissionPercent?: number | null;
  commissionAmount?: FlatMoneyAmount | null;
  studentTarget?: boolean | null;
  landlordPresent?: boolean | null;
  priceScope?: "person" | null;
  perPersonPrice?: FlatPerPersonPrice | null;
  transitRoutes?: string[];
  furnished?: boolean | null;
  condition?: "needs_renovation" | "basic" | "good" | "modern" | "luxury" | null;
  amenities?: string[];
  parking?: boolean | null;
  elevator?: boolean | null;
  heating?: boolean | null;
  hotWater?: boolean | null;
  internet?: boolean | null;
  smokingAllowed?: boolean | null;
  negotiable?: boolean | null;
  utilitiesAmount?: FlatMoneyAmount | null;
  minLeaseTerm?: string | null;
  availableFrom?: string | null;
  tags?: string[];
  vision?: FlatVisionResult;
  marketComparison?: FlatMarketComparison;
}

export interface FlatMapPoint {
  id: string;
  source: string;
  country: string;
  lat: number;
  lng: number;
  title?: string;
  price?: number | null;
  currency?: string;
}

export interface FlatMapFeedResult {
  count: number;
  mapPoints: FlatMapPoint[];
  mapPointsTruncated?: boolean;
  mapPointLimit?: number | null;
  queryMs?: number;
  stale?: boolean;
  error?: string;
}

export type FlatStatsDealKey = "sale" | "longRent" | "shortRent" | "roomRent" | "unknown";
export type FlatPriceBandKey = "green" | "blue" | "pink" | "orange" | "yellow" | "red";

export interface FlatStatsPriceBand {
  key: FlatPriceBandKey;
  count: number;
}

export interface FlatStatsPriceGroup {
  key: FlatStatsDealKey;
  count: number;
  priceCount: number;
  medianUsd: number | null;
  averageUsd: number | null;
  minUsd?: number | null;
  maxUsd?: number | null;
}

export interface FlatStatsGeoRow {
  label: string;
  count: number;
  priceCount: number;
  medianUsd: number | null;
  minUsd?: number | null;
  maxUsd?: number | null;
}

export type FlatStatsGeoDimension = "country" | "city" | "district" | "microdistrict" | "metro";

export interface FlatStatistics {
  total: number;
  rawTotal: number;
  currency: "USD";
  dealTypes: FlatStatsPriceGroup[];
  geographies: Partial<Record<FlatStatsGeoDimension, FlatStatsGeoRow[]>>;
  geographiesByDeal?: Partial<Record<FlatStatsDealKey, Partial<Record<FlatStatsGeoDimension, FlatStatsGeoRow[]>>>>;
  priceBandsByDeal?: Partial<Record<FlatStatsDealKey, FlatStatsPriceBand[]>>;
  priceBandSamplesByDeal?: Partial<Record<FlatStatsDealKey, number>>;
  ownership: {
    owners: number;
    agencies: number;
    commission: number;
    noCommission: number;
  };
  activity: Array<{ date: string; count: number }>;
  quality: {
    duplicatesRejected: number;
    suspectedFake: number;
  };
}

export interface FlatFeedResult {
  count: number;
  listings: FlatListing[];
  warming?: boolean;
  sourceCounts?: Record<string, number>;
  sourceErrors?: Array<{ source?: string; country?: string; error?: string }>;
  nextCursor?: string | null;
  queryMs?: number;
  error?: string;
  exactListingFallback?: "source" | "source-inactive" | string;
  statistics?: FlatStatistics;
  availabilityFiltered?: number;
  availabilityChecked?: string[];
}

export interface FlatTranslationResult {
  status: "pending" | "completed" | "failed" | "disabled" | "not_found";
  key?: string;
  data?: { translatedText?: string; sourceLanguage?: string | null };
  confidence?: number;
}

export interface FlatCountryMeta {
  code: string;
  name: string;
  currency: string;
  cities?: string[];
  cityLabels?: Record<string, string>;
  locations?: Record<string, {
    districts?: string[];
    districtLabels?: Record<string, string>;
    metro?: string[];
    metroLabels?: Record<string, string>;
    microdistricts?: string[];
    microdistrictLabels?: Record<string, string>;
    quartals?: string[];
    quartalLabels?: Record<string, string>;
    areas?: string[];
    areaLabels?: Record<string, string>;
  }>;
}

export interface FlatCardPresentation {
  title: string;
  price: string;
  convertedPrice: string | null;
  specification: string;
  location: string;
  dealLabel: string;
  dealTone: "sale" | "rent" | "room" | "short" | "";
  badges: string[];
  visionBadgeLabels: string[];
  goodPrice: boolean;
  goodPriceMedianUsd: number | null;
  goodPriceComparableCount: number;
  dateLabel: string;
}

export type FlatView = "active" | "favorites" | "recent" | "hidden";
export type FlatSort = "newest" | "oldest" | "priceAsc" | "priceDesc" | "titleAsc" | "titleDesc";
