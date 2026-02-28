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
    transportPublic?: number | null;
    transportCar?: number | null;
    remoteWork?: number | null;
    commuteTime?: number | null;
    societyInternational?: number | null;
    langBarrier?: number | null;
};
