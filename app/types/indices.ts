export type WBSeriesPoint = {
    date: string;          // "2022"
    value: number | null;  // может быть null
};

export type WBSeries = {
    indicatorId: string;
    countryIso2: string;
    points: WBSeriesPoint[]; // отсортировано по убыванию года
    latestValue: number | null;
    latestDate: string | null;
};

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

    normalized: CountryIndicesNormalized;
};

export type CountryIndicesNormalized = {
    income?: number | null;
    education?: number | null;
    qualityOfLife?: number | null;
    safety?: number | null;

    internet?: number | null;
    unemployment?: number | null;
    air?: number | null;
    inequality?: number | null;
    health?: number | null;
};
