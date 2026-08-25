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

export type FlatAudience = "women" | "men" | "family";

export interface FlatListing {
  id: string;
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
  utilitiesAmount?: number | null;
  minLeaseTerm?: string | null;
  availableFrom?: string | null;
  tags?: string[];
  vision?: FlatVisionResult;
}

export type FlatStatsDealKey = "sale" | "longRent" | "shortRent" | "roomRent" | "unknown";

export interface FlatStatsPriceGroup {
  key: FlatStatsDealKey;
  count: number;
  priceCount: number;
  medianUsd: number | null;
  averageUsd: number | null;
}

export interface FlatStatsGeoRow {
  label: string;
  count: number;
  priceCount: number;
  medianUsd: number | null;
}

export type FlatStatsGeoDimension = "country" | "city" | "district" | "microdistrict" | "metro";

export interface FlatStatistics {
  total: number;
  rawTotal: number;
  currency: "USD";
  dealTypes: FlatStatsPriceGroup[];
  geographies: Partial<Record<FlatStatsGeoDimension, FlatStatsGeoRow[]>>;
  geographiesByDeal?: Partial<Record<FlatStatsDealKey, Partial<Record<FlatStatsGeoDimension, FlatStatsGeoRow[]>>>>;
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
  locations?: Record<string, { districts?: string[]; metro?: string[] }>;
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
  dateLabel: string;
}

export type FlatView = "active" | "favorites" | "recent" | "hidden";
export type FlatSort = "newest" | "oldest" | "priceAsc" | "priceDesc" | "titleAsc" | "titleDesc";