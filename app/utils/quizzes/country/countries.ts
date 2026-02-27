import type { AxisKey } from "./countryFit";
import { usRegions } from "./usStates";

export type LangLevel = 0 | 1 | 2 | 3; // 0..3
export type Vector = Partial<Record<AxisKey, number>>;

export type MonthlyUSD = {
    single: number;   // 1 взрослый
    couple: number;   // 2 взрослых
    perKid: number;   // на ребёнка
};

export type CountryEntity = {
    key: string;              // "countries.germany" или "countries.usa"
    titleKey: string;
    fallbackName: string;
    teleportSlug?: string;
    vector: Vector;

    languages: {
        english: LangLevel; // насколько реально жить на английском
        russian: LangLevel; // насколько встречается русский
        noLocalLanguagePenalty: 0 | 1 | 2 | 3; // 3 = почти можно жить и без местного, 0 = будет боль
    };

    costUSD: {
        tier: "low" | "mid" | "high" | "very_high";
        monthly: MonthlyUSD;
    };

    work: {
        remoteFriendly: 0 | 1 | 2 | 3;
        localWithoutLocalLanguage: 0 | 1 | 2 | 3;
    };

    regions?: Array<{
        key: string;
        titleKey: string;
        fallbackName: string;
        teleportSlug?: string;
        override?: Partial<Pick<CountryEntity, "vector" | "languages" | "costUSD" | "work">>;
    }>;
};

const EU = (key: string, name: string, tier: CountryEntity["costUSD"]["tier"], monthly: MonthlyUSD, vector: Vector = {}): CountryEntity => ({
    key,
    titleKey: key,
    fallbackName: name,
    vector: {
        // базовая “европейская” среда: транспорт/правила/стабильность/соц
        transport_public: 3,
        stability_need: 3,
        rules_ok: 3,
        social_support_need: 3,
        quality_high_need: 3,
        travel_easy: 3,
        society_international: 2,
        geo_continent: 3,
        ...vector
    },
    languages: { english: 2, russian: 0, noLocalLanguagePenalty: 2 },
    costUSD: { tier, monthly },
    work: { remoteFriendly: 3, localWithoutLocalLanguage: 1 }
});

const COUNTRY = (key: string, name: string, tier: CountryEntity["costUSD"]["tier"], monthly: MonthlyUSD, vector: Vector, languages: CountryEntity["languages"], work: CountryEntity["work"]): CountryEntity => ({
    key,
    titleKey: key,
    fallbackName: name,
    vector,
    languages,
    costUSD: { tier, monthly },
    work
});

const usCost = (tier: "very_high" | "high" | "mid" | "low") => {
    switch (tier) {
        case "very_high":
            return { tier, monthly: { single: 3600, couple: 5400, perKid: 900 } };
        case "high":
            return { tier, monthly: { single: 3000, couple: 4500, perKid: 800 } };
        case "mid":
            return { tier, monthly: { single: 2400, couple: 3600, perKid: 700 } };
        case "low":
            return { tier, monthly: { single: 1900, couple: 2850, perKid: 600 } };
    }
};

const US_STATE_COST_GROUPS: Record<string, "very_high" | "high" | "mid" | "low"> = {
    // very high
    ca: "very_high",
    ny: "very_high",
    ma: "very_high",
    wa: "very_high",
    dc: "very_high",

    // high
    nj: "high",
    va: "high",
    co: "high",
    il: "high",
    or: "high",
    md: "high",

    // mid
    tx: "mid",
    fl: "mid",
    nc: "mid",
    ga: "mid",
    az: "mid",
    nv: "mid",
    ut: "mid",
    tn: "mid",

    // low (всё остальное)
};

export const countries: CountryEntity[] = [
    // =========================
    // EU 27
    // =========================
    EU("countries.austria", "Austria", "high", { single: 2600, couple: 3900, perKid: 700 }, { climate_seasons: 3, safety_need: 3 }),
    EU("countries.belgium", "Belgium", "high", { single: 2500, couple: 3800, perKid: 700 }, { climate_seasons: 3 }),
    EU("countries.bulgaria", "Bulgaria", "mid", { single: 1500, couple: 2300, perKid: 450 }, { climate_seasons: 2, cost_low_need: 2 }),
    EU("countries.croatia", "Croatia", "mid", { single: 1700, couple: 2600, perKid: 500 }, { climate_warm: 2, nature_water: 3 }),
    EU("countries.cyprus", "Cyprus", "mid", { single: 1800, couple: 2700, perKid: 500 }, { climate_warm: 3, geo_island: 3, nature_water: 3 }),
    EU("countries.czechia", "Czechia", "mid", { single: 1900, couple: 2900, perKid: 550 }, { climate_seasons: 3 }),
    EU("countries.denmark", "Denmark", "very_high", { single: 3200, couple: 4800, perKid: 900 }, { climate_cold: 2, safety_need: 3 }),
    EU("countries.estonia", "Estonia", "mid", { single: 2000, couple: 3000, perKid: 550 }, { climate_cold: 2, society_international: 2 }),
    EU("countries.finland", "Finland", "very_high", { single: 3000, couple: 4500, perKid: 850 }, { climate_cold: 3, safety_need: 3 }),
    EU("countries.france", "France", "high", { single: 2700, couple: 4100, perKid: 800 }, { climate_seasons: 3, metro_megacity: 2 }),
    EU("countries.germany", "Germany", "high", { single: 2600, couple: 4000, perKid: 750 }, { climate_seasons: 3, stability_need: 3 }),
    EU("countries.greece", "Greece", "mid", { single: 1800, couple: 2700, perKid: 500 }, { climate_warm: 3, nature_water: 3 }),
    EU("countries.hungary", "Hungary", "mid", { single: 1700, couple: 2600, perKid: 500 }, { climate_seasons: 3 }),
    EU("countries.ireland", "Ireland", "very_high", { single: 3300, couple: 5000, perKid: 950 }, { climate_seasons: 2 },),
    EU("countries.italy", "Italy", "high", { single: 2400, couple: 3600, perKid: 700 }, { climate_warm: 2, nature_water: 2 }),
    EU("countries.latvia", "Latvia", "mid", { single: 1900, couple: 2800, perKid: 550 }, { climate_cold: 2 }),
    EU("countries.lithuania", "Lithuania", "mid", { single: 1900, couple: 2800, perKid: 550 }, { climate_cold: 2 }),
    EU("countries.luxembourg", "Luxembourg", "very_high", { single: 3500, couple: 5200, perKid: 1000 }, { safety_need: 3 }),
    EU("countries.malta", "Malta", "high", { single: 2400, couple: 3600, perKid: 700 }, { climate_warm: 3, geo_island: 3 }),
    EU("countries.netherlands", "Netherlands", "very_high", { single: 3200, couple: 4800, perKid: 900 }, { transport_public: 3, metro_midcity: 3 }),
    EU("countries.poland", "Poland", "mid", { single: 1900, couple: 2900, perKid: 550 }, { climate_seasons: 3, cost_low_need: 2 }),
    EU("countries.portugal", "Portugal", "mid", { single: 1900, couple: 2900, perKid: 550 }, { climate_warm: 3, nature_water: 3 }),
    EU("countries.romania", "Romania", "mid", { single: 1600, couple: 2400, perKid: 450 }, { climate_seasons: 3, cost_low_need: 2 }),
    EU("countries.slovakia", "Slovakia", "mid", { single: 1900, couple: 2800, perKid: 550 }, { climate_seasons: 3 }),
    EU("countries.slovenia", "Slovenia", "high", { single: 2200, couple: 3300, perKid: 650 }, { climate_seasons: 3, nature_mountains_forest: 3 }),
    EU("countries.spain", "Spain", "high", { single: 2300, couple: 3500, perKid: 650 }, { climate_warm: 3, nature_water: 2 }),
    EU("countries.sweden", "Sweden", "very_high", { single: 3000, couple: 4500, perKid: 850 }, { climate_cold: 2, safety_need: 3 }),

    // =========================
    // Your list (non-EU)
    // =========================
    COUNTRY(
        "countries.russia",
        "Russia",
        "mid",
        { single: 1200, couple: 1900, perKid: 350 },
        { lang_ru_need: 3, climate_cold: 3, country_large: 3, geo_continent: 3, cost_low_need: 3 },
        { english: 1, russian: 3, noLocalLanguagePenalty: 3 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 2 }
    ),
    COUNTRY(
        "countries.ukraine",
        "Ukraine",
        "low",
        { single: 900, couple: 1500, perKid: 300 },
        { climate_seasons: 3, country_compact: 2, cost_low_need: 3 },
        { english: 1, russian: 2, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 1 }
    ),
    COUNTRY(
        "countries.belarus",
        "Belarus",
        "low",
        { single: 900, couple: 1500, perKid: 300 },
        { climate_seasons: 3, cost_low_need: 3 },
        { english: 0, russian: 3, noLocalLanguagePenalty: 3 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 2 }
    ),

    // UK
    COUNTRY(
        "countries.uk",
        "United Kingdom",
        "very_high",
        { single: 3200, couple: 4800, perKid: 900 },
        { lang_en_need: 3, transport_public: 3, stability_need: 3, quality_high_need: 3, society_international: 3 },
        { english: 3, russian: 1, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 3, localWithoutLocalLanguage: 2 }
    ),

    // Americas
    // USA base + states below
    {
        key: "countries.usa",
        titleKey: "countries.usa",
        fallbackName: "United States",
        vector: {
            lang_en_need: 3,
            country_large: 3,
            geo_continent: 3,
            city_sprawl: 3,
            transport_car: 3,
            income_growth_need: 3,
            freedom_need: 3,
            nature_diversity_need: 3
        },
        languages: { english: 3, russian: 1, noLocalLanguagePenalty: 2 },
        costUSD: { tier: "high", monthly: { single: 2800, couple: 4200, perKid: 900 } },
        work: { remoteFriendly: 3, localWithoutLocalLanguage: 2 },
        regions: usRegions.flatMap(r => {
            const tier = US_STATE_COST_GROUPS[r.code] ?? "low";

            const base = {
                key: `countries.usa.${r.code}`,
                titleKey: r.titleKey,
                fallbackName: r.fallbackName,
                override: {
                    costUSD: usCost(tier),
                    vector: {}
                }
            };

            if (!r.teleportSlug) return [base];

            const city = {
                key: `countries.usa.${r.code}.city`,
                titleKey: `regions.usa.${r.code}.mainCity`,
                fallbackName: `${r.fallbackName} — Main city`,
                teleportSlug: r.teleportSlug,
                override: {
                    costUSD: usCost(tier),
                    vector: {}
                }
            };

            return [base, city];
        })
    },
    COUNTRY(
        "countries.canada",
        "Canada",
        "high",
        { single: 2800, couple: 4200, perKid: 800 },
        {
            climate_cold: 3,
            climate_seasons: 2,
            country_large: 3,
            geo_continent: 3,
            nature_mountains_forest: 3,
            nature_water: 3,
            safety_need: 3,
            stability_need: 3,
            rules_ok: 3,
            quality_high_need: 3,
            society_international: 3,
            worklife_need: 3
        },
        {
            english: 3,
            russian: 1,
            noLocalLanguagePenalty: 2
        },
        {
            remoteFriendly: 3,
            localWithoutLocalLanguage: 2
        }
    ),
    COUNTRY(
        "countries.brazil",
        "Brazil",
        "mid",
        { single: 1400, couple: 2200, perKid: 450 },
        { climate_warm: 3, climate_heat_ok: 3, nature_diversity_need: 3, society_open: 3, culture_change_ok: 3 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.argentina",
        "Argentina",
        "mid",
        { single: 1400, couple: 2200, perKid: 450 },
        { climate_seasons: 2, culture_change_ok: 3 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.peru",
        "Peru",
        "low",
        { single: 1100, couple: 1800, perKid: 350 },
        { climate_warm: 2, nature_mountains_forest: 3 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.chile",
        "Chile",
        "mid",
        { single: 1800, couple: 2700, perKid: 550 },
        { climate_seasons: 2, nature_mountains_forest: 3, safety_need: 2 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),

    // Asia / ME
    COUNTRY(
        "countries.china",
        "China",
        "mid",
        { single: 1600, couple: 2400, perKid: 500 },
        { city_vertical: 3, metro_megacity: 3, transport_public: 3, rules_ok: 3, income_growth_need: 3, culture_change_ok: 3 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 0 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.south_korea",
        "South Korea",
        "high",
        { single: 2400, couple: 3600, perKid: 700 },
        { city_vertical: 3, transport_public: 3, safety_need: 3, rules_ok: 3, culture_change_ok: 3 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 0 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),

    COUNTRY(
        "countries.uzbekistan",
        "Uzbekistan",
        "low",
        { single: 900, couple: 1500, perKid: 300 },
        { cost_low_need: 3, climate_warm: 2 },
        { english: 0, russian: 2, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 1 }
    ),
    COUNTRY(
        "countries.kazakhstan",
        "Kazakhstan",
        "low",
        { single: 1000, couple: 1700, perKid: 320 },
        { climate_cold: 2, cost_low_need: 3, country_large: 2 },
        { english: 0, russian: 2, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 1 }
    ),
    COUNTRY(
        "countries.kyrgyzstan",
        "Kyrgyzstan",
        "low",
        { single: 850, couple: 1400, perKid: 280 },
        { cost_low_need: 3, nature_mountains_forest: 3 },
        { english: 0, russian: 2, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 1 }
    ),

    COUNTRY(
        "countries.turkey",
        "Turkey",
        "mid",
        { single: 1400, couple: 2200, perKid: 450 },
        { climate_warm: 3, nature_water: 2, culture_change_ok: 2 },
        { english: 1, russian: 1, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.egypt",
        "Egypt",
        "low",
        { single: 1100, couple: 1800, perKid: 350 },
        { climate_warm: 3, climate_heat_ok: 3, nature_water: 2 },
        { english: 1, russian: 1, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.uae",
        "UAE",
        "very_high",
        { single: 3200, couple: 4800, perKid: 900 },
        { climate_warm: 3, climate_heat_ok: 3, city_vertical: 3, safety_need: 3, rules_ok: 3, tax_low_need: 3, society_international: 3 },
        { english: 3, russian: 1, noLocalLanguagePenalty: 2 },
        { remoteFriendly: 3, localWithoutLocalLanguage: 2 }
    ),
    COUNTRY(
        "countries.israel",
        "Israel",
        "very_high",
        { single: 3500, couple: 5200, perKid: 1000 },
        { quality_high_need: 3, safety_need: 2, society_international: 2 },
        { english: 2, russian: 2, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 3, localWithoutLocalLanguage: 1 }
    ),
    COUNTRY(
        "countries.jordan",
        "Jordan",
        "mid",
        { single: 1500, couple: 2400, perKid: 450 },
        { climate_warm: 2, rules_ok: 2 },
        { english: 1, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    ),
    COUNTRY(
        "countries.india",
        "India",
        "low",
        { single: 1000, couple: 1700, perKid: 320 },
        { climate_warm: 3, cost_low_need: 3, culture_change_ok: 3 },
        { english: 2, russian: 0, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 1 }
    ),
    COUNTRY(
        "countries.thailand",
        "Thailand",
        "mid",
        { single: 1500, couple: 2400, perKid: 450 },
        { climate_warm: 3, climate_heat_ok: 3, nature_water: 3, culture_change_ok: 3, society_open: 3 },
        { english: 2, russian: 1, noLocalLanguagePenalty: 1 },
        { remoteFriendly: 2, localWithoutLocalLanguage: 0 }
    )
];