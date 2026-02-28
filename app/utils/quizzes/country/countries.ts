import type {AxisKey} from "./countryFit";
import {usRegions} from "./usStates";
import type {CountryIndicesBundle} from "~/types/indices";

export type LangLevel = 0 | 1 | 2 | 3; // 0..3
export type Vector = Partial<Record<AxisKey, number>>;

export type MonthlyUSD = {
    single: number;   // 1 взрослый
    couple: number;   // 2 взрослых
    perKid: number;   // на ребёнка
};

export type CountryEntity = {
    codes?: {
        wb?: string; // iso2 для WorldBank: "de", "us", "ro"
        oecd?: string; // если понадобится
    };
    key: string;              // "countries.germany" или "countries.usa"
    titleKey: string;
    fallbackName: string;
    teleportSlug?: string;
    vector: Vector;

    indices?: CountryIndicesBundle;

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

const numbeo = (
    qualityOfLifeIndex: number,
    purchasingPowerIndex: number,
    safetyIndex: number,
    healthCareIndex: number,
    costOfLivingIndex: number,
    propertyPriceToIncomeRatio: number,
    trafficCommuteTimeIndex: number,
    pollutionIndex: number,
    climateIndex: number
): CountryIndicesBundle => <CountryIndicesBundle>({
    numbeo: {
        qualityOfLifeIndex,
        purchasingPowerIndex,
        safetyIndex,
        healthCareIndex,
        costOfLivingIndex,
        propertyPriceToIncomeRatio,
        trafficCommuteTimeIndex,
        pollutionIndex,
        climateIndex
    }
});

const EU = (
    key: string,
    name: string,
    tier: CountryEntity["costUSD"]["tier"],
    monthly: MonthlyUSD,
    vector: Vector = {},
    indices?: CountryIndicesBundle
): CountryEntity => ({
    key,
    titleKey: key,
    fallbackName: name,
    vector: {
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
    indices,
    languages: {english: 2, russian: 0, noLocalLanguagePenalty: 2},
    costUSD: {tier, monthly},
    work: {remoteFriendly: 3, localWithoutLocalLanguage: 1}
});

const COUNTRY = (
    key: string,
    name: string,
    tier: CountryEntity["costUSD"]["tier"],
    monthly: MonthlyUSD,
    vector: Vector,
    languages: CountryEntity["languages"],
    work: CountryEntity["work"],
    indices?: CountryIndicesBundle
): CountryEntity => ({
    key,
    titleKey: key,
    fallbackName: name,
    vector,
    indices,
    languages,
    costUSD: {tier, monthly},
    work
});

const usCost = (tier: "very_high" | "high" | "mid" | "low") => {
    switch (tier) {
        case "very_high":
            return {tier, monthly: {single: 3600, couple: 5400, perKid: 900}};
        case "high":
            return {tier, monthly: {single: 3000, couple: 4500, perKid: 800}};
        case "mid":
            return {tier, monthly: {single: 2400, couple: 3600, perKid: 700}};
        case "low":
            return {tier, monthly: {single: 1900, couple: 2850, perKid: 600}};
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
    EU("countries.austria", "Austria", "high", {single: 1485, couple: 2225, perKid: 370}, {
        climate_seasons: 3,
        safety_need: 3
    }, numbeo(199.8, 123.2, 71.5, 78.9, 71.3, 9.9, 23.2, 20.4, 76.6)),
    EU("countries.belgium", "Belgium", "high", {single: 1415, couple: 2125, perKid: 355}, {climate_seasons: 3}, numbeo(175.2, 127.5, 50.8, 76.4, 68.6, 6.1, 32.7, 46.8, 86.5)),
    EU("countries.bulgaria", "Bulgaria", "mid", {single: 670, couple: 1005, perKid: 165}, {
        climate_seasons: 2,
        cost_low_need: 2
    }, numbeo(148.3, 85.9, 64.5, 58.3, 41.6, 8.4, 28.8, 62.6, 81.2)),
    EU("countries.croatia", "Croatia", "mid", {single: 1035, couple: 1550, perKid: 260}, {
        climate_warm: 2,
        nature_water: 3
    }, numbeo(176.6, 88.7, 75.7, 65.1, 52.4, 12.8, 25.0, 31.8, 87.1)),
    EU("countries.cyprus", "Cyprus", "mid", {single: 1305, couple: 1960, perKid: 325}, {
        climate_warm: 3,
        geo_island: 3,
        nature_water: 3
    }, numbeo(159.6, 90.5, 66.7, 56.7, 58.8, 8.1, 25.1, 55.3, 92.3)),
    EU("countries.czechia", "Czechia", "mid", {single: 1215, couple: 1820, perKid: 305}, {climate_seasons: 3}, numbeo(175.3, 94.0, 73.6, 76.0, 53.0, 13.2, 28.7, 33.7, 77.7)),
    EU("countries.denmark", "Denmark", "very_high", {single: 1450, couple: 2170, perKid: 360}, {
        climate_cold: 2,
        safety_need: 3
    }, numbeo(212.2, 150.6, 73.8, 77.2, 78.9, 6.1, 27.5, 22.7, 81.2)),
    EU("countries.estonia", "Estonia", "mid", {single: 1020, couple: 1525, perKid: 255}, {
        climate_cold: 2,
        society_international: 2
    }, numbeo(190.7, 90.3, 76.8, 75.2, 59.7, 10.5, 20.9, 16.1, 71.2)),
    EU("countries.finland", "Finland", "very_high", {single: 1160, couple: 1745, perKid: 290}, {
        climate_cold: 3,
        safety_need: 3
    }, numbeo(204.4, 132.6, 73.5, 77.6, 69.0, 7.2, 25.0, 11.8, 54.4)),
    EU("countries.france", "France", "high", {single: 1195, couple: 1795, perKid: 300}, {
        climate_seasons: 3,
        metro_megacity: 2
    }, numbeo(169.8, 121.5, 44.2, 77.0, 67.7, 8.6, 34.4, 43.5, 89.6)),
    EU("countries.germany", "Germany", "high", {single: 1390, couple: 2085, perKid: 350}, {
        climate_seasons: 3,
        stability_need: 3
    }, numbeo(196.3, 142.0, 61.6, 72.4, 68.7, 7.9, 28.8, 28.2, 82.9)),
    EU("countries.greece", "Greece", "mid", {single: 895, couple: 1340, perKid: 225}, {
        climate_warm: 3,
        nature_water: 3
    }, numbeo(140.8, 65.4, 53.8, 58.9, 54.0, 12.5, 32.3, 49.2, 93.0)),
    EU("countries.hungary", "Hungary", "mid", {single: 800, couple: 1200, perKid: 200}, {climate_seasons: 3}, numbeo(147.6, 80.3, 66.5, 54.2, 46.9, 12.8, 35.4, 46.2, 79.8)),
    EU("countries.ireland", "Ireland", "very_high", {single: 2140, couple: 3205, perKid: 535}, {climate_seasons: 2}, numbeo(167.7, 119.0, 51.0, 51.2, 70.6, 6.9, 37.3, 34.7, 89.5)),
    EU("countries.italy", "Italy", "high", {single: 1130, couple: 1690, perKid: 280}, {
        climate_warm: 2,
        nature_water: 2
    }, numbeo(152.9, 91.4, 52.7, 64.9, 61.4, 8.3, 32.0, 53.1, 89.8)),
    EU("countries.latvia", "Latvia", "mid", {single: 835, couple: 1255, perKid: 210}, {climate_cold: 2}, numbeo(167.3, 79.1, 63.7, 63.6, 52.3, 8.9, 27.6, 29.1, 76.8)),
    EU("countries.lithuania", "Lithuania", "mid", {single: 890, couple: 1340, perKid: 225}, {climate_cold: 2}, numbeo(178.2, 89.7, 66.8, 75.4, 51.2, 11.2, 22.8, 25.2, 69.9)),
    EU("countries.luxembourg", "Luxembourg", "very_high", {single: 2270, couple: 3400, perKid: 565}, {safety_need: 3}, numbeo(211.9, 167.0, 66.8, 74.2, 78.0, 9.4, 26.4, 22.7, 82.6)),
    EU("countries.malta", "Malta", "high", {single: 1375, couple: 2065, perKid: 345}, {
        climate_warm: 3,
        geo_island: 3
    }, numbeo(135.3, 83.9, 57.0, 53.3, 56.8, 10.6, 27.9, 75.7, 97.8)),
    EU("countries.netherlands", "Netherlands", "very_high", {single: 1970, couple: 2955, perKid: 490}, {transport_public: 3, metro_midcity: 3}, numbeo(213.6, 136.6, 74.5, 81.5, 73.4, 7.5, 22.3, 20.9, 86.9)),
    EU("countries.poland", "Poland", "mid", {single: 1110, couple: 1665, perKid: 280}, {
        climate_seasons: 3,
        cost_low_need: 2
    }, numbeo(156.1, 99.8, 71.3, 57.9, 47.3, 10.2, 32.0, 55.5, 75.7)),
    EU("countries.portugal", "Portugal", "mid", {single: 1185, couple: 1780, perKid: 295}, {
        climate_warm: 3,
        nature_water: 3
    }, numbeo(169.5, 68.7, 67.0, 72.0, 48.8, 13.9, 28.5, 29.9, 97.8)),
    EU("countries.romania", "Romania", "mid", {single: 695, couple: 1040, perKid: 175}, {
        climate_seasons: 3,
        cost_low_need: 2
    }, numbeo(143.0, 78.6, 67.2, 56.5, 40.6, 10.5, 33.2, 58.4, 76.3)),
    EU("countries.slovakia", "Slovakia", "mid", {single: 1045, couple: 1570, perKid: 260}, {climate_seasons: 3}, numbeo(158.6, 80.1, 68.9, 58.2, 49.6, 12.6, 27.5, 36.8, 73.9)),
    EU("countries.slovenia", "Slovenia", "high", {single: 1205, couple: 1805, perKid: 300}, {
        climate_seasons: 3,
        nature_mountains_forest: 3
    }, numbeo(181.5, 89.9, 75.5, 66.2, 54.1, 12.5, 25.1, 22.7, 80.6)),
    EU("countries.spain", "Spain", "high", {single: 1160, couple: 1735, perKid: 290}, {
        climate_warm: 3,
        nature_water: 2
    }, numbeo(185.8, 108.0, 62.4, 77.2, 51.6, 8.5, 26.5, 35.3, 92.8)),
    EU("countries.sweden", "Sweden", "very_high", {single: 1240, couple: 1860, perKid: 310}, {
        climate_cold: 2,
        safety_need: 3
    }, numbeo(189.3, 136.9, 52.1, 68.3, 68.0, 7.6, 28.8, 17.6, 65.0)),

    // =========================
    // Your list (non-EU)
    // =========================
    COUNTRY(
        "countries.russia",
        "Russia",
        "mid",
        {single: 610, couple: 915, perKid: 150},
        {lang_ru_need: 3, climate_cold: 3, country_large: 3, geo_continent: 3, cost_low_need: 3},
        {english: 1, russian: 3, noLocalLanguagePenalty: 3},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(115.6, 63.2, 61.8, 61.6, 36.5, 13.7, 43.3, 58.4, 38.0)
    ),
    COUNTRY(
        "countries.ukraine",
        "Ukraine",
        "low",
        {single: 420, couple: 630, perKid: 105},
        {climate_seasons: 3, country_compact: 2, cost_low_need: 3},
        {english: 1, russian: 2, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(117.1, 51.1, 53.1, 55.8, 28.2, 12.8, 37.8, 62.2, 71.3)
    ),
    COUNTRY(
        "countries.belarus",
        "Belarus",
        "low",
        {single: 450, couple: 675, perKid: 115},
        {climate_seasons: 3, cost_low_need: 3},
        {english: 0, russian: 3, noLocalLanguagePenalty: 3},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(135.7, 65.5, 51.5, 49.6, 30.5, 10.7, 31.3, 44.2, 68.5)
    ),

    COUNTRY(
        "countries.uk",
        "United Kingdom",
        "very_high",
        {single: 1725, couple: 2590, perKid: 430},
        {lang_en_need: 3, transport_public: 3, stability_need: 3, quality_high_need: 3, society_international: 3},
        {english: 3, russian: 1, noLocalLanguagePenalty: 2},
        {remoteFriendly: 3, localWithoutLocalLanguage: 2},
        numbeo(175.9, 126.6, 51.7, 72.7, 67.8, 8.0, 34.2, 40.5, 87.8)
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
        languages: {english: 3, russian: 1, noLocalLanguagePenalty: 2},
        indices: numbeo(186.0, 151.6, 50.8, 67.0, 68.8, 3.5, 33.8, 37.2, 75.8),
        costUSD: {tier: "mid", monthly: {single: 1935, couple: 2905, perKid: 485}},
        work: {remoteFriendly: 3, localWithoutLocalLanguage: 2},
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
        {single: 1660, couple: 2490, perKid: 415},
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
        },
        numbeo(172.0, 123.5, 54.4, 68.6, 63.0, 7.5, 33.4, 29.7, 54.9)
    ),
    COUNTRY(
        "countries.brazil",
        "Brazil",
        "mid",
        {single: 485, couple: 725, perKid: 120},
        {climate_warm: 3, climate_heat_ok: 3, nature_diversity_need: 3, society_open: 3, culture_change_ok: 3}, // <- твой vector как был
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(117.8, 47.2, 36.0, 59.3, 30.1, 15.2, 40.4, 52.8, 92.5)
    ),
    COUNTRY(
        "countries.argentina",
        "Argentina",
        "mid",
        {single: 625, couple: 940, perKid: 155},
        {climate_seasons: 2, culture_change_ok: 3},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(123.4, 48.6, 36.8, 67.8, 41.3, 13.7, 43.9, 50.4, 95.4)
    ),
    COUNTRY(
        "countries.peru",
        "Peru",
        "low",
        {single: 500, couple: 750, perKid: 125},
        {climate_warm: 2, nature_mountains_forest: 3},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(92.3, 49.7, 33.1, 56.9, 33.5, 15.0, 50.0, 81.9, 93.3)
    ),
    COUNTRY(
        "countries.chile",
        "Chile",
        "mid",
        {single: 700, couple: 1050, perKid: 175},
        {climate_seasons: 2, nature_mountains_forest: 3, safety_need: 2},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(109.8, 54.0, 39.3, 63.6, 39.0, 15.3, 36.1, 77.3, 95.6)
    ),

    // Asia / ME
    COUNTRY(
        "countries.china",
        "China",
        "mid",
        {single: 400, couple: 600, perKid: 100},
        {
            city_vertical: 3,
            metro_megacity: 3,
            transport_public: 3,
            rules_ok: 3,
            income_growth_need: 3,
            culture_change_ok: 3
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(134.8, 96.4, 76.9, 69.2, 30.5, 21.5, 38.5, 76.2, 74.4)
    ),
    COUNTRY(
        "countries.south_korea",
        "South Korea",
        "high",
        {single: 790, couple: 1185, perKid: 200},
        {city_vertical: 3, transport_public: 3, safety_need: 3, rules_ok: 3, culture_change_ok: 3},
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(150.4, 113.8, 71.0, 82.9, 61.6, 24.1, 39.5, 56.6, 71.9)
    ),

    COUNTRY(
        "countries.uzbekistan",
        "Uzbekistan",
        "low",
        {single: 450, couple: 680, perKid: 115},
        {cost_low_need: 3, climate_warm: 2},
        {english: 0, russian: 2, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(
            126.6, // qualityOfLifeIndex (из QoL таблицы)
            44.2,  // purchasingPowerIndex
            73.8,  // safetyIndex  ← ОБНОВЛЕНО
            56.3,  // healthCareIndex
            33.1,  // costOfLivingIndex
            13.0,  // propertyPriceToIncomeRatio
            37.0,  // trafficCommuteTimeIndex
            60.0,  // pollutionIndex ← ОБНОВЛЕНО
            88.5   // climateIndex
        )
    ),
    COUNTRY(
        "countries.kazakhstan",
        "Kazakhstan",
        "low",
        {single: 485, couple: 725, perKid: 120},
        {climate_cold: 2, cost_low_need: 3, country_large: 2},
        {english: 0, russian: 2, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(107.5, 56.8, 54.8, 60.7, 29.8, 8.9, 35.9, 73.0, 34.8)
    ),
    COUNTRY(
        "countries.kyrgyzstan",
        "Kyrgyzstan",
        "low",
        {single: 850, couple: 1400, perKid: 280},
        {cost_low_need: 3, nature_mountains_forest: 3},
        {english: 0, russian: 2, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(
            0,     // qualityOfLifeIndex — нет данных
            0,     // purchasingPowerIndex
            48.6,  // safetyIndex ← ИЗ СКРИНА
            0,     // healthCareIndex
            0,     // costOfLivingIndex
            0,     // propertyPriceToIncomeRatio
            0,     // trafficCommuteTimeIndex
            72.3,  // pollutionIndex ← ИЗ СКРИНА
            0      // climateIndex
        )
    ),

    COUNTRY(
        "countries.turkey",
        "Turkey",
        "mid",
        {single: 615, couple: 920, perKid: 155},
        {climate_warm: 3, nature_water: 2, culture_change_ok: 2},
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(142.1, 74.7, 58.5, 71.3, 39.2, 7.3, 43.4, 63.9, 90.0)
    ),
    COUNTRY(
        "countries.egypt",
        "Egypt",
        "low",
        {single: 200, couple: 305, perKid: 50},
        {climate_warm: 3, climate_heat_ok: 3, nature_water: 2},
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(81.9, 22.2, 53.6, 47.9, 21.6, 20.4, 47.6, 82.5, 85.3)
    ),
    COUNTRY(
        "countries.uae",
        "UAE",
        "very_high",
        {single: 3200, couple: 4800, perKid: 900},
        {
            climate_warm: 3,
            climate_heat_ok: 3,
            city_vertical: 3,
            safety_need: 3,
            rules_ok: 3,
            tax_low_need: 3,
            society_international: 3
        },
        {english: 3, russian: 1, noLocalLanguagePenalty: 2},
        {remoteFriendly: 3, localWithoutLocalLanguage: 2},
        numbeo(175.5, 131.9, 86.0, 70.8, 55.2, 7.4, 36.0, 48.3, 43.4)
    ),
    COUNTRY(
        "countries.israel",
        "Israel",
        "very_high",
        {single: 1650, couple: 2475, perKid: 410},
        {quality_high_need: 3, safety_need: 2, society_international: 2},
        {english: 2, russian: 2, noLocalLanguagePenalty: 1},
        {remoteFriendly: 3, localWithoutLocalLanguage: 1},
        numbeo(167.7, 123.1, 68.2, 73.4, 79.7, 12.2, 36.8, 56.5, 93.8)
    ),
    COUNTRY(
        "countries.jordan",
        "Jordan",
        "mid",
        {single: 485, couple: 730, perKid: 120},
        {climate_warm: 2, rules_ok: 2},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(125.6, 55.2, 60.3, 65.6, 39.4, 7.5, 40.8, 77.1, 91.2)
    ),
    COUNTRY(
        "countries.india",
        "India",
        "low",
        {single: 200, couple: 300, perKid: 50},
        {climate_warm: 3, cost_low_need: 3, culture_change_ok: 3},
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(122.3, 77.8, 55.8, 65.5, 18.9, 11.0, 46.5, 72.8, 65.2)
    ),
    COUNTRY(
        "countries.thailand",
        "Thailand",
        "mid",
        {single: 530, couple: 795, perKid: 130},
        {climate_warm: 3, climate_heat_ok: 3, nature_water: 3, culture_change_ok: 3, society_open: 3},
        {english: 2, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(106.8, 46.7, 63.4, 77.5, 38.0, 24.0, 38.0, 75.6, 68.0)
    ),
    COUNTRY(
        "countries.oman",
        "Oman",
        "mid",
        {single: 760, couple: 1145, perKid: 190},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 3,
            rules_ok: 3,
            safety_need: 3,
            society_international: 2,
            stability_need: 3,
            tax_low_need: 2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(207.6, 156.3, 81.6, 63.5, 43.6, 3.8, 24.9, 36.5, 71.3)
    ),
    COUNTRY(
        "countries.switzerland",
        "Switzerland",
        "very_high",
        {single: 2485, couple: 3725, perKid: 620},
        {
            climate_seasons: 3,
            cost_low_need: -2,
            country_compact: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 3,
            nature_water: 0,
            quality_high_need: 3,
            rules_ok: 2,
            safety_need: 2,
            society_international: 2,
            stability_need: 3
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(206.2, 176.1, 72.6, 71.2, 110.7, 11.4, 34.5, 24.3, 80.7)
    ),
    COUNTRY(
        "countries.iceland",
        "Iceland",
        "very_high",
        {single: 3400, couple: 5270, perKid: 918},
        {
            climate_cold: 3,
            climate_cold_ok: 2,
            climate_warm: -2,
            cost_low_need: -2,
            culture_change_ok: 2,
            geo_island: 3,
            lang_en_need: 3,
            nature_mountains_forest: 0,
            nature_water: 3,
            quality_high_need: 2,
            rules_ok: 2,
            safety_need: 2,
            society_international: 2,
            stability_need: 2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(195.8, 117.6, 74.5, 69.1, 97.2, 7.7, 20.7, 17.0, 68.8)
    ),
    COUNTRY(
        "countries.norway",
        "Norway",
        "very_high",
        {single: 1740, couple: 2610, perKid: 435},
        {
            climate_cold: 3,
            climate_cold_ok: 2,
            climate_warm: -2,
            cost_low_need: -2,
            country_large: 3,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 3,
            nature_mountains_forest: 0,
            nature_water: 3,
            quality_high_need: 2,
            rules_ok: 2,
            safety_need: 1,
            society_international: 2,
            stability_need: 2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(195.4, 128.0, 66.7, 75.8, 83.7, 8.0, 28.0, 19.0, 70.6)
    ),
    COUNTRY(
        "countries.australia",
        "Australia",
        "high",
        {single: 1745, couple: 2615, perKid: 435},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 0,
            country_large: 3,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 3,
            nature_diversity_need: 3,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 2,
            rules_ok: 1,
            safety_need: 0,
            society_international: 3,
            stability_need: 2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(189.6, 142.0, 52.5, 72.0, 67.9, 8.2, 38.6, 27.9, 91.9)
    ),
    COUNTRY(
        "countries.new_zealand",
        "New Zealand",
        "high",
        {single: 1495, couple: 2240, perKid: 375},
        {
            climate_seasons: 3,
            cost_low_need: 0,
            culture_change_ok: 2,
            geo_island: 3,
            lang_en_need: 3,
            nature_mountains_forest: 3,
            nature_water: 0,
            quality_high_need: 2,
            rules_ok: 1,
            safety_need: 0,
            society_international: 3,
            stability_need: 2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(188.5, 127.7, 51.2, 68.2, 60.3, 8.0, 32.4, 26.5, 97.2)
    ),
    COUNTRY(
        "countries.japan",
        "Japan",
        "mid",
        {single: 735, couple: 1105, perKid: 185},
        {
            climate_seasons: 3,
            cost_low_need: 1,
            culture_change_ok: 2,
            geo_island: 3,
            lang_en_need: 1,
            nature_mountains_forest: 3,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: 2,
            society_international: 2,
            stability_need: 1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(185.6, 121.1, 77.2, 80.1, 47.5, 11.4, 40.1, 37.8, 83.8)
    ),
    COUNTRY(
        "countries.qatar",
        "Qatar",
        "mid",
        {single: 1450, couple: 2175, perKid: 365},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 0,
            country_compact: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 3,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 2,
            rules_ok: 2,
            safety_need: 3,
            society_international: 3,
            stability_need: 2,
            tax_low_need: 2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 3, localWithoutLocalLanguage: 2},
        numbeo(182.7, 160.3, 84.8, 73.6, 50.4, 5.7, 29.0, 60.0, 36.0)
    ),
    COUNTRY(
        "countries.saudi_arabia",
        "Saudi Arabia",
        "mid",
        {single: 790, couple: 1185, perKid: 200},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            country_large: 3,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: 2,
            society_international: 2,
            stability_need: 1,
            tax_low_need: 2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(165.3, 136.0, 76.7, 62.2, 43.9, 4.3, 30.8, 61.7, 38.6)
    ),
    COUNTRY(
        "countries.kuwait",
        "Kuwait",
        "mid",
        {single: 855, couple: 1280, perKid: 215},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            country_compact: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: 1,
            society_international: 2,
            stability_need: 1,
            tax_low_need: 2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(162.7, 182.8, 67.4, 58.6, 42.5, 6.5, 34.7, 69.4, 20.2)
    ),
    COUNTRY(
        "countries.singapore",
        "Singapore",
        "very_high",
        {single: 2520, couple: 3780, perKid: 630},
        {
            city_vertical: 3,
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: -2,
            culture_change_ok: 2,
            geo_island: 3,
            lang_en_need: 3,
            metro_megacity: 3,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: 2,
            society_international: 3,
            stability_need: 1,
            tax_low_need: 2,
            transport_public: 3
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(158.1, 110.6, 77.5, 71.9, 87.7, 22.1, 41.0, 32.2, 57.5)
    ),
    COUNTRY(
        "countries.taiwan",
        "Taiwan",
        "mid",
        {single: 645, couple: 970, perKid: 160},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 0,
            culture_change_ok: 2,
            geo_island: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: 3,
            society_international: 2,
            stability_need: 1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(155.5, 101.1, 83.0, 87.1, 49.7, 25.3, 32.4, 64.1, 83.9)
    ),
    COUNTRY(
        "countries.puerto_rico",
        "Puerto Rico",
        "high",
        {single: 1250, couple: 1875, perKid: 310},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 0,
            culture_change_ok: 1,
            geo_island: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 1,
            rules_ok: 1,
            safety_need: -1,
            society_international: 2,
            stability_need: 1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(153.1, 119.0, 38.6, 59.1, 62.6, 6.7, 32.6, 47.9, 71.2)
    ),
    COUNTRY(
        "countries.south_africa",
        "South Africa",
        "low",
        {single: 760, couple: 1145, perKid: 190},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 2,
            country_large: 3,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 3,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 0,
            rules_ok: 0,
            safety_need: -2,
            society_international: 2,
            stability_need: 0
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(150.9, 112.0, 25.5, 64.0, 37.1, 3.3, 38.4, 56.9, 95.7)
    ),
    COUNTRY(
        "countries.uruguay",
        "Uruguay",
        "mid",
        {single: 920, couple: 1380, perKid: 230},
        {
            climate_seasons: 3,
            cost_low_need: 0,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: 0,
            rules_ok: 0,
            safety_need: 0,
            society_international: 1,
            stability_need: 0
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(139.1, 56.3, 47.5, 68.5, 55.6, 13.3, 40.0, 42.8, 98.3)
    ),
    COUNTRY(
        "countries.bosnia_and_herzegovina",
        "Bosnia And Herzegovina",
        "low",
        {single: 600, couple: 900, perKid: 150},
        {
            climate_seasons: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 0,
            society_international: 0,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(136.5, 68.1, 58.7, 54.6, 38.7, 12.9, 25.9, 59.9, 82.9)
    ),
    COUNTRY(
        "countries.malaysia",
        "Malaysia",
        "low",
        {single: 470, couple: 710, perKid: 120},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 1,
            society_international: 2,
            stability_need: -1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(135.2, 81.8, 52.0, 70.7, 34.0, 8.8, 37.1, 60.6, 58.1)
    ),
    COUNTRY(
        "countries.hong_kong",
        "Hong Kong (China)",
        "very_high",
        {single: 2155, couple: 3230, perKid: 540},
        {
            city_vertical: 3,
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: -2,
            country_compact: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 2,
            metro_megacity: 3,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 2,
            society_international: 3,
            stability_need: -1,
            transport_public: 3
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 3, localWithoutLocalLanguage: 2},
        numbeo(128.7, 96.0, 78.6, 66.5, 75.2, 30.9, 41.9, 66.2, 83.6)
    ),
    COUNTRY(
        "countries.ecuador",
        "Ecuador",
        "low",
        {single: 475, couple: 710, perKid: 120},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: -1,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(128.7, 49.5, 38.1, 77.7, 30.9, 11.6, 37.4, 59.0, 94.5)
    ),
    COUNTRY(
        "countries.serbia",
        "Serbia",
        "mid",
        {single: 760, couple: 1140, perKid: 190},
        {
            climate_seasons: 3,
            cost_low_need: 1,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 1,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(127.6, 64.7, 63.0, 52.1, 42.6, 14.8, 30.6, 65.8, 82.7)
    ),
    COUNTRY(
        "countries.costa_rica",
        "Costa Rica",
        "mid",
        {single: 1045, couple: 1565, perKid: 260},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 0,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 3,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: -1,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(127.3, 50.9, 46.1, 64.8, 52.9, 10.1, 60.0, 41.4, 93.1)
    ),
    COUNTRY(
        "countries.georgia",
        "Georgia",
        "low",
        {single: 545, couple: 820, perKid: 135},
        {
            climate_seasons: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 3,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 2,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(126.6, 44.2, 73.8, 56.3, 33.1, 13.0, 37.0, 67.8, 88.5)
    ),
    COUNTRY(
        "countries.mexico",
        "Mexico",
        "mid",
        {single: 800, couple: 1195, perKid: 200},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 0,
            country_large: 3,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: -1,
            society_international: 2,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(125.3, 49.8, 47.1, 72.3, 42.6, 13.3, 39.2, 58.3, 86.6)
    ),
    COUNTRY(
        "countries.north_macedonia",
        "North Macedonia",
        "low",
        {single: 560, couple: 845, perKid: 140},
        {
            climate_seasons: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 0,
            society_international: 0,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(124.2, 66.1, 58.6, 55.4, 35.5, 11.8, 24.3, 79.2, 79.9)
    ),
    COUNTRY(
        "countries.armenia",
        "Armenia",
        "mid",
        {single: 680, couple: 1015, perKid: 170},
        {
            climate_seasons: 3,
            cost_low_need: 1,
            country_compact: 2,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 2,
            society_international: 0,
            stability_need: -1
        },
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(121.9, 42.5, 77.9, 59.5, 40.9, 19.4, 29.3, 61.3, 63.4)
    ),
    COUNTRY(
        "countries.panama",
        "Panama",
        "mid",
        {single: 1125, couple: 1685, perKid: 280},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            country_compact: 2,
            culture_change_ok: 2,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 0,
            society_international: 2,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(120.4, 45.7, 57.2, 61.2, 45.5, 14.3, 35.2, 55.9, 68.2)
    ),
    COUNTRY(
        "countries.tunisia",
        "Tunisia",
        "low",
        {single: 310, couple: 460, perKid: 75},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 1,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(117.6, 36.3, 55.1, 56.6, 29.1, 12.8, 33.0, 69.5, 94.3)
    ),
    COUNTRY(
        "countries.morocco",
        "Morocco",
        "low",
        {single: 390, couple: 590, perKid: 100},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 2,
            country_large: 3,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 0,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(114.1, 46.5, 53.0, 46.8, 31.4, 13.4, 35.2, 68.6, 90.3)
    ),
    COUNTRY(
        "countries.azerbaijan",
        "Azerbaijan",
        "low",
        {single: 420, couple: 630, perKid: 105},
        {
            climate_seasons: 3,
            cost_low_need: 2,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -1,
            rules_ok: -1,
            safety_need: 2,
            society_international: 1,
            stability_need: -1
        },
        {english: 1, russian: 1, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(111.1, 41.2, 68.4, 49.0, 30.7, 18.3, 40.6, 72.0, 91.4)
    ),
    COUNTRY(
        "countries.colombia",
        "Colombia",
        "low",
        {single: 595, couple: 890, perKid: 150},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 2,
            country_large: 3,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: -1,
            society_international: 1,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(105.9, 41.0, 38.7, 68.9, 31.7, 16.9, 46.5, 62.2, 82.3)
    ),
    COUNTRY(
        "countries.albania",
        "Albania",
        "mid",
        {single: 685, couple: 1025, perKid: 170},
        {
            climate_seasons: 3,
            cost_low_need: 0,
            country_compact: 2,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 0,
            society_international: 0,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(105.6, 46.7, 55.9, 48.1, 45.8, 15.1, 36.0, 77.1, 86.3)
    ),
    COUNTRY(
        "countries.kenya",
        "Kenya",
        "low",
        {single: 325, couple: 485, perKid: 80},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 2,
            country_large: 3,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: -1,
            society_international: 1,
            stability_need: -2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(99.4, 36.7, 44.9, 62.2, 28.9, 17.0, 51.6, 69.0, 87.1)
    ),
    COUNTRY(
        "countries.pakistan",
        "Pakistan",
        "low",
        {single: 255, couple: 380, perKid: 65},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 3,
            country_large: 3,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 0,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(98.3, 29.9, 57.6, 59.5, 19.6, 18.7, 38.2, 73.3, 67.1)
    ),
    COUNTRY(
        "countries.lebanon",
        "Lebanon",
        "mid",
        {single: 720, couple: 1080, perKid: 180},
        {
            climate_cold: -2,
            climate_heat_ok: 2,
            climate_warm: 3,
            cost_low_need: 1,
            country_compact: 2,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 1,
            stability_need: -2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(98.2, 38.4, 53.1, 63.7, 41.7, 17.8, 38.5, 89.3, 94.7)
    ),
    COUNTRY(
        "countries.vietnam",
        "Vietnam",
        "mid",
        {single: 425, couple: 640, perKid: 105},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 1,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(92.5, 43.7, 59.9, 62.2, 26.4, 30.2, 29.5, 83.7, 71.1)
    ),
    COUNTRY(
        "countries.indonesia",
        "Indonesia",
        "mid",
        {single: 340, couple: 510, perKid: 85},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            country_large: 3,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 1,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(91.1, 30.0, 53.6, 61.2, 26.1, 25.0, 43.0, 68.0, 66.5)
    ),
    COUNTRY(
        "countries.iran",
        "Iran",
        "low",
        {single: 260, couple: 385, perKid: 65},
        {
            climate_seasons: 3,
            cost_low_need: 3,
            country_large: 3,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 0,
            society_international: 0,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(88.0, 31.1, 49.2, 52.8, 22.8, 17.2, 47.1, 75.2, 69.0)
    ),
    COUNTRY(
        "countries.philippines",
        "Philippines",
        "low",
        {single: 440, couple: 665, perKid: 110},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 2,
            culture_change_ok: 1,
            geo_island: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 1,
            stability_need: -2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(87.1, 34.6, 56.5, 66.8, 30.1, 32.1, 42.0, 72.5, 68.4)
    ),
    COUNTRY(
        "countries.venezuela",
        "Venezuela",
        "low",
        {single: 430, couple: 645, perKid: 105},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 0,
            country_large: 3,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: -2,
            society_international: 0,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(75.2, 17.7, 19.6, 39.9, 37.7, 15.1, 32.6, 73.6, 79.9)
    ),
    COUNTRY(
        "countries.bangladesh",
        "Bangladesh",
        "low",
        {single: 155, couple: 230, perKid: 40},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 3,
            country_compact: 2,
            culture_change_ok: 0,
            geo_continent: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: -1,
            society_international: 0,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 2, localWithoutLocalLanguage: 0},
        numbeo(73.3, 35.0, 38.4, 42.0, 22.8, 13.9, 55.9, 85.4, 72.9)
    ),
    COUNTRY(
        "countries.sri_lanka",
        "Sri Lanka",
        "mid",
        {single: 335, couple: 500, perKid: 85},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            culture_change_ok: 1,
            geo_island: 3,
            lang_en_need: 1,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: 1,
            society_international: 1,
            stability_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(61.0, 19.3, 57.6, 70.7, 33.9, 56.1, 54.0, 58.0, 64.1)
    ),
    COUNTRY(
        "countries.nigeria",
        "Nigeria",
        "mid",
        {single: 710, couple: 1065, perKid: 175},
        {
            climate_cold: -3,
            climate_heat_ok: 3,
            climate_warm: 3,
            cost_low_need: 1,
            country_large: 3,
            culture_change_ok: 1,
            geo_continent: 3,
            lang_en_need: 2,
            nature_mountains_forest: 0,
            nature_water: 0,
            quality_high_need: -2,
            rules_ok: -2,
            safety_need: -1,
            society_international: 1,
            stability_need: -2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(0.0, 8.7, 33.8, 48.3, 27.7, 93.7, 63.8, 87.1, 70.7)
    ),
    COUNTRY(
        "countries.bermuda",
        "Bermuda",
        "very_high",
        {single: 4400, couple: 6600, perKid: 1100},
        {
            geo_island: 3,
            climate_warm: 2,
            climate_heat_ok: 2,
            nature_water: 3,
            quality_high_need: 2,
            society_international: 2,
            rules_ok: 2,
            stability_need: 2,
            cost_low_need: -3
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 101.3, 0, 0, 135.8, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.cayman_islands",
        "Cayman Islands",
        "very_high",
        {single: 3900, couple: 5850, perKid: 980},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            society_international: 3,
            tax_low_need: 2,
            cost_low_need: -3,
            quality_high_need: 1
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 149.6, 0, 0, 115.6, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.us_virgin_islands",
        "US Virgin Islands",
        "very_high",
        {single: 3800, couple: 5700, perKid: 950},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            travel_easy: 1,
            society_international: 2,
            cost_low_need: -3
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 89.8, 0, 0, 111.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.solomon_islands",
        "Solomon Islands",
        "high",
        {single: 3300, couple: 4950, perKid: 825},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            isolation_ok: 2,
            society_international: -1,
            cost_low_need: -2
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 12.6, 0, 0, 102.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.bahamas",
        "Bahamas",
        "very_high",
        {single: 3500, couple: 5250, perKid: 875},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            society_international: 2,
            cost_low_need: -2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 2, localWithoutLocalLanguage: 2},
        numbeo(0, 57.1, 0, 0, 98.8, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.jersey",
        "Jersey",
        "very_high",
        {single: 2800, couple: 4200, perKid: 700},
        {
            geo_island: 3,
            climate_seasons: 2,
            society_international: 2,
            rules_ok: 2,
            stability_need: 2,
            cost_low_need: -2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 103.4, 0, 0, 88.7, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.guernsey",
        "Guernsey",
        "very_high",
        {single: 2500, couple: 3750, perKid: 625},
        {
            geo_island: 3,
            climate_seasons: 2,
            society_international: 2,
            rules_ok: 2,
            stability_need: 2,
            cost_low_need: -2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 132.8, 0, 0, 73.4, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.isle_of_man",
        "Isle Of Man",
        "very_high",
        {single: 2500, couple: 3750, perKid: 625},
        {
            geo_island: 3,
            climate_seasons: 2,
            society_international: 2,
            rules_ok: 2,
            stability_need: 2,
            cost_low_need: -2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 116.6, 0, 0, 74.7, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.gibraltar",
        "Gibraltar",
        "very_high",
        {single: 2400, couple: 3600, perKid: 600},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_international: 3,
            rules_ok: 2,
            tax_low_need: 2,
            cost_low_need: -2
        },
        {english: 3, russian: 0, noLocalLanguagePenalty: 3},
        {remoteFriendly: 3, localWithoutLocalLanguage: 3},
        numbeo(0, 86.1, 0, 0, 70.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.grenada",
        "Grenada",
        "very_high",
        {single: 2500, couple: 3750, perKid: 625},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            society_international: 1,
            cost_low_need: -2
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 34.6, 0, 0, 76.4, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.seychelles",
        "Seychelles",
        "high",
        {single: 2300, couple: 3450, perKid: 575},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            society_international: 2,
            cost_low_need: -1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 34.3, 0, 0, 64.5, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.maldives",
        "Maldives",
        "mid",
        {single: 2000, couple: 3000, perKid: 500},
        {
            geo_island: 3,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_water: 3,
            society_international: 1,
            cost_low_need: 0
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 46.2, 0, 0, 48.9, 0, 0, 0, 0)
    ),

// --- Microstates / special regions ---
    COUNTRY(
        "countries.andorra",
        "Andorra",
        "high",
        {single: 2100, couple: 3150, perKid: 525},
        {
            country_compact: 3,
            nature_mountains_forest: 3,
            climate_seasons: 2,
            rules_ok: 2,
            stability_need: 2,
            cost_low_need: -1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 126.1, 0, 0, 55.1, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.macao",
        "Macao (China)",
        "high",
        {single: 2200, couple: 3300, perKid: 550},
        {
            city_vertical: 3,
            metro_megacity: 2,
            transport_public: 3,
            climate_warm: 2,
            society_international: 2,
            rules_ok: 1,
            cost_low_need: -1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 85.4, 0, 0, 60.5, 0, 0, 0, 0)
    ),

// --- Americas (new) ---
    COUNTRY(
        "countries.jamaica",
        "Jamaica",
        "mid",
        {single: 2100, couple: 3150, perKid: 525},
        {geo_island: 3, climate_warm: 3, climate_heat_ok: 2, nature_water: 3, society_open: 1, cost_low_need: 0},
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 35.4, 0, 0, 54.5, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.trinidad_and_tobago",
        "Trinidad And Tobago",
        "mid",
        {single: 2040, couple: 3060, perKid: 510},
        {geo_island: 2, climate_warm: 3, climate_heat_ok: 2, nature_water: 2, society_open: 1, cost_low_need: 0},
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 48.6, 0, 0, 52.0, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.guyana",
        "Guyana",
        "mid",
        {single: 2010, couple: 3015, perKid: 505},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_mountains_forest: 2,
            geo_continent: 3,
            society_open: 1,
            cost_low_need: 0
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 1, localWithoutLocalLanguage: 1},
        numbeo(0, 52.1, 0, 0, 50.4, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.belize",
        "Belize",
        "mid",
        {single: 1940, couple: 2910, perKid: 485},
        {climate_warm: 3, climate_heat_ok: 2, nature_water: 3, geo_continent: 3, society_open: 1, cost_low_need: 0},
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 1, localWithoutLocalLanguage: 1},
        numbeo(0, 67.6, 0, 0, 46.9, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.dominican_republic",
        "Dominican Republic",
        "mid",
        {single: 650, couple: 975, perKid: 165},
        {climate_warm: 3, climate_heat_ok: 2, nature_water: 3, society_open: 2, cost_low_need: 1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 38.6, 0, 0, 38.2, 15.6, 0, 0, 0)
    ),
    COUNTRY(
        "countries.honduras",
        "Honduras",
        "mid",
        {single: 1730, couple: 2595, perKid: 433},
        {climate_warm: 3, climate_heat_ok: 2, society_open: 1, cost_low_need: 1, rules_ok: -1, safety_need: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 41.3, 0, 0, 36.6, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.nicaragua",
        "Nicaragua",
        "mid",
        {single: 1680, couple: 2520, perKid: 420},
        {climate_warm: 3, climate_heat_ok: 2, society_open: 1, cost_low_need: 1, rules_ok: -1, safety_need: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 26.2, 0, 0, 34.2, 0, 0, 0, 0)
    ),

// --- Africa (new) ---
    COUNTRY(
        "countries.ghana",
        "Ghana",
        "mid",
        {single: 1680, couple: 2520, perKid: 420},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 1,
            cost_low_need: 1,
            rules_ok: -1,
            safety_need: -1
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 2},
        {remoteFriendly: 1, localWithoutLocalLanguage: 1},
        numbeo(0, 18.1, 0, 0, 33.9, 54.6, 0, 0, 0)
    ),
    COUNTRY(
        "countries.senegal",
        "Senegal",
        "mid",
        {single: 1970, couple: 2955, perKid: 493},
        {climate_warm: 3, climate_heat_ok: 2, geo_continent: 3, society_open: 1, cost_low_need: 0, rules_ok: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 22.2, 0, 0, 48.5, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.ivory_coast",
        "Ivory Coast",
        "mid",
        {single: 1900, couple: 2850, perKid: 475},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 0,
            cost_low_need: 0,
            rules_ok: -2,
            stability_need: -2
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 12.7, 0, 0, 44.8, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.cameroon",
        "Cameroon",
        "mid",
        {single: 1810, couple: 2715, perKid: 453},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 0,
            cost_low_need: 0,
            rules_ok: -2,
            stability_need: -2
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 10.5, 0, 0, 40.7, 45.7, 0, 0, 0)
    ),
    COUNTRY(
        "countries.ethiopia",
        "Ethiopia",
        "mid",
        {single: 1840, couple: 2760, perKid: 460},
        {
            climate_warm: 2,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 0,
            cost_low_need: 0,
            rules_ok: -2,
            stability_need: -2
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 12.5, 0, 0, 41.8, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.angola",
        "Angola",
        "mid",
        {single: 1850, couple: 2775, perKid: 463},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 0,
            cost_low_need: 0,
            rules_ok: -2,
            stability_need: -2
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 200.8, 0, 0, 42.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.mozambique",
        "Mozambique",
        "mid",
        {single: 1740, couple: 2610, perKid: 435},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            society_open: 0,
            cost_low_need: 1,
            rules_ok: -2,
            stability_need: -2
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 30.9, 0, 0, 36.9, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.namibia",
        "Namibia",
        "mid",
        {single: 1730, couple: 2595, perKid: 433},
        {
            climate_warm: 2,
            climate_heat_ok: 2,
            geo_continent: 3,
            nature_diversity_need: 2,
            cost_low_need: 1,
            safety_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 73.4, 0, 0, 36.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.zimbabwe",
        "Zimbabwe",
        "mid",
        {single: 510, couple: 765, perKid: 125},
        {
            climate_warm: 2,
            climate_heat_ok: 2,
            geo_continent: 3,
            cost_low_need: 1,
            rules_ok: -2,
            stability_need: -2,
            safety_need: -1
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 27.6, 0, 0, 35.9, 9.5, 0, 0, 0)
    ),
    COUNTRY(
        "countries.rwanda",
        "Rwanda",
        "low",
        {single: 1500, couple: 2250, perKid: 375},
        {climate_warm: 2, geo_continent: 3, cost_low_need: 2, rules_ok: -1, stability_need: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 26.7, 0, 0, 25.0, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.uganda",
        "Uganda",
        "low",
        {single: 1540, couple: 2310, perKid: 385},
        {climate_warm: 2, geo_continent: 3, cost_low_need: 2, rules_ok: -2, stability_need: -2},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 19.6, 0, 0, 27.0, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.tanzania",
        "Tanzania",
        "low",
        {single: 1530, couple: 2295, perKid: 383},
        {climate_warm: 2, geo_continent: 3, cost_low_need: 2, rules_ok: -2, stability_need: -2},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 26.8, 0, 0, 26.6, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.madagascar",
        "Madagascar",
        "low",
        {single: 1450, couple: 2175, perKid: 363},
        {geo_island: 3, climate_warm: 2, cost_low_need: 2, rules_ok: -2, stability_need: -2},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 13.7, 0, 0, 22.5, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.zambia",
        "Zambia",
        "low",
        {single: 1600, couple: 2400, perKid: 400},
        {climate_warm: 2, geo_continent: 3, cost_low_need: 2, rules_ok: -2, stability_need: -2},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 24.7, 0, 0, 29.9, 0, 0, 0, 0)
    ),

// --- Asia / ME (new) ---
    COUNTRY(
        "countries.bahrain",
        "Bahrain",
        "mid",
        {single: 930, couple: 1395, perKid: 230},
        {
            geo_island: 2,
            climate_warm: 3,
            climate_heat_ok: 3,
            society_international: 2,
            rules_ok: 1,
            tax_low_need: 2,
            cost_low_need: 0
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 119.3, 0, 0, 47.6, 5.2, 0, 0, 0)
    ),
    COUNTRY(
        "countries.palestine",
        "Palestine",
        "mid",
        {single: 1960, couple: 2940, perKid: 490},
        {climate_warm: 2, geo_continent: 3, rules_ok: -1, stability_need: -2, safety_need: -1, cost_low_need: 0},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 49.0, 0, 0, 48.1, 6.5, 0, 0, 0)
    ),
    COUNTRY(
        "countries.yemen",
        "Yemen",
        "mid",
        {single: 2060, couple: 3090, perKid: 515},
        {
            climate_warm: 3,
            climate_heat_ok: 2,
            geo_continent: 3,
            rules_ok: -3,
            stability_need: -3,
            safety_need: -3,
            cost_low_need: 0
        },
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 18.2, 0, 0, 53.1, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.brunei",
        "Brunei",
        "mid",
        {single: 1960, couple: 2940, perKid: 490},
        {
            climate_warm: 3,
            climate_heat_ok: 3,
            geo_continent: 3,
            rules_ok: 2,
            stability_need: 2,
            society_private: 1,
            cost_low_need: 0
        },
        {english: 2, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 134.4, 0, 0, 48.2, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.papua_new_guinea",
        "Papua New Guinea",
        "mid",
        {single: 1950, couple: 2925, perKid: 488},
        {
            geo_island: 2,
            climate_warm: 3,
            climate_heat_ok: 2,
            nature_diversity_need: 2,
            society_international: -1,
            cost_low_need: 0
        },
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 20.2, 0, 0, 47.5, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.nepal",
        "Nepal",
        "low",
        {single: 165, couple: 245, perKid: 40},
        {nature_mountains_forest: 3, climate_seasons: 2, cost_low_need: 2, rules_ok: -1, stability_need: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 29.4, 0, 0, 22.6, 42.4, 0, 0, 0)
    ),
    COUNTRY(
        "countries.myanmar",
        "Myanmar",
        "mid",
        {single: 1760, couple: 2640, perKid: 440},
        {climate_warm: 3, climate_heat_ok: 2, cost_low_need: 1, rules_ok: -2, stability_need: -2},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 19.8, 0, 0, 38.0, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.afghanistan",
        "Afghanistan",
        "low",
        {single: 1420, couple: 2130, perKid: 355},
        {climate_seasons: 2, cost_low_need: 2, rules_ok: -3, stability_need: -3, safety_need: -3},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 40.6, 0, 0, 21.1, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.syria",
        "Syria",
        "low",
        {single: 1400, couple: 2100, perKid: 350},
        {climate_warm: 2, cost_low_need: 2, rules_ok: -3, stability_need: -3, safety_need: -3},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 6.2, 0, 0, 25.0, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.iran",
        "Iran",
        "low",
        {single: 260, couple: 385, perKid: 65},
        {climate_seasons: 2, cost_low_need: 2, rules_ok: -2, stability_need: -2, society_private: 1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 30.3, 0, 0, 22.8, 17.2, 0, 0, 0)
    ),
    COUNTRY(
        "countries.iraq",
        "Iraq",
        "low",
        {single: 445, couple: 670, perKid: 110},
        {climate_warm: 3, climate_heat_ok: 2, cost_low_need: 2, rules_ok: -2, stability_need: -3, safety_need: -2},
        {english: 1, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 58.0, 0, 0, 28.4, 10.1, 0, 0, 0)
    ),
    COUNTRY(
        "countries.libya",
        "Libya",
        "low",
        {single: 1370, couple: 2055, perKid: 343},
        {climate_warm: 3, climate_heat_ok: 2, cost_low_need: 3, rules_ok: -3, stability_need: -3, safety_need: -3},
        {english: 0, russian: 0, noLocalLanguagePenalty: 0},
        {remoteFriendly: 0, localWithoutLocalLanguage: 0},
        numbeo(0, 51.1, 0, 0, 18.3, 0, 0, 0, 0)
    ),
    COUNTRY(
        "countries.moldova",
        "Moldova",
        "mid",
        {single: 725, couple: 1085, perKid: 180},
        {climate_seasons: 3, cost_low_need: 1, geo_continent: 3, rules_ok: -1, stability_need: -1},
        {english: 1, russian: 2, noLocalLanguagePenalty: 2},
        {remoteFriendly: 2, localWithoutLocalLanguage: 1},
        numbeo(0, 54.1, 0, 0, 35.8, 14.1, 0, 0, 0)
    ),
    COUNTRY(
        "countries.paraguay",
        "Paraguay",
        "low",
        {single: 1570, couple: 2355, perKid: 393},
        {climate_warm: 2, climate_heat_ok: 2, cost_low_need: 2, geo_continent: 3, society_open: 1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 49.3, 0, 0, 28.5, 14.1, 0, 0, 0)
    ),
    COUNTRY(
        "countries.kosovo",
        "Kosovo (Disputed Territory)",
        "low",
        {single: 480, couple: 720, perKid: 120},
        {climate_seasons: 2, cost_low_need: 2, geo_continent: 3, rules_ok: -1, stability_need: -1},
        {english: 1, russian: 0, noLocalLanguagePenalty: 1},
        {remoteFriendly: 1, localWithoutLocalLanguage: 0},
        numbeo(0, 60.5, 0, 0, 29.1, 13.8, 0, 0, 0)
    ),
];