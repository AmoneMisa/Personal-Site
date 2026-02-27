export type IndexSource = "worldbank" | "oecd";

export type WBSeriesPoint = {
    date: string;          // "2022"
    value: number | null;  // может быть null
};

export type WBIndicatorResponse = {
    indicator: { id: string; value: string };
    country: { id: string; value: string };
    countryiso3code: string;
    date: string;
    value: number | null;
    unit: string;
    obs_status: string;
    decimal: number;
};

export type WBSeries = {
    indicatorId: string;
    countryIso2: string;
    points: WBSeriesPoint[]; // отсортировано по убыванию года
    latestValue: number | null;
    latestDate: string | null;
};

export type OECDDataResponse = any; // SDMX JSON сложный, парсим отдельно

export type NormalizedIndices = {
    // 0..10 (или 0..100, но лучше 0..10)
    income?: number;
    education?: number;
    safety?: number;
    qualityOfLife?: number;
};

export type CountryIndicesBundle = {
    key: string; // countries.germany / countries.usa.ca / ...
    updatedAtISO: string;

    raw: Partial<{
        worldbank: Record<string, WBSeries>; // indicatorId -> series
        oecd: Record<string, any>;           // datasetKey -> raw
    }>;

    normalized: NormalizedIndices;
};