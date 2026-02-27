export type AxisKey =
    | "lang_ru_need"
    | "lang_en_need"
    | "lang_barrier_tolerance"
    | "climate_warm"
    | "climate_seasons"
    | "climate_cold"
    | "climate_heat_ok"
    | "climate_cold_ok"
    | "nature_water"
    | "nature_mountains_forest"
    | "nature_city_first"
    | "nature_diversity_need"
    | "country_large"
    | "country_compact"
    | "geo_island"
    | "geo_continent"
    | "travel_easy"
    | "isolation_ok"
    | "city_sprawl"
    | "city_vertical"
    | "metro_megacity"
    | "metro_midcity"
    | "metro_smalltown"
    | "transport_public"
    | "transport_car"
    | "safety_need"
    | "stability_need"
    | "rules_ok"
    | "freedom_need"
    | "cost_low_need"
    | "quality_high_need"
    | "tax_low_need"
    | "social_support_need"
    | "income_growth_need"
    | "worklife_need"
    | "society_open"
    | "society_private"
    | "society_international"
    | "mentality_close_need"
    | "culture_change_ok";

export type Effects = Partial<Record<AxisKey, number>>;

export type QuizOption = {
    id: string;
    textKey: string;
    effects: Effects;
};

export type QuizQuestion = {
    id: string;
    order: number;
    titleKey: string;
    descriptionKey: string;
    options: QuizOption[];
};

export type QuizConfig = {
    id: string;
    version: number;
    titleKey: string;
    descriptionKey: string;
    estimateMinutes: number;
    axes: AxisKey[];
    questions: QuizQuestion[];
};

export const countryFitQuiz: QuizConfig = {
    id: "country_fit_v1",
    version: 1,
    titleKey: "quizzes.countryFit.title",
    descriptionKey: "quizzes.countryFit.description",
    estimateMinutes: 6,
    axes: [
        "lang_ru_need",
        "lang_en_need",
        "lang_barrier_tolerance",
        "climate_warm",
        "climate_seasons",
        "climate_cold",
        "climate_heat_ok",
        "climate_cold_ok",
        "nature_water",
        "nature_mountains_forest",
        "nature_city_first",
        "nature_diversity_need",
        "country_large",
        "country_compact",
        "geo_island",
        "geo_continent",
        "travel_easy",
        "isolation_ok",
        "city_sprawl",
        "city_vertical",
        "metro_megacity",
        "metro_midcity",
        "metro_smalltown",
        "transport_public",
        "transport_car",
        "safety_need",
        "stability_need",
        "rules_ok",
        "freedom_need",
        "cost_low_need",
        "quality_high_need",
        "tax_low_need",
        "social_support_need",
        "income_growth_need",
        "worklife_need",
        "society_open",
        "society_private",
        "society_international",
        "mentality_close_need",
        "culture_change_ok"
    ],
    questions: [
        {
            id: "q1_ru_usage",
            order: 10,
            titleKey: "quizzes.countryFit.q1.title",
            descriptionKey: "quizzes.countryFit.q1.desc",
            options: [
                { id: "q1_o1", textKey: "quizzes.countryFit.q1.o1", effects: { lang_ru_need: 3, lang_barrier_tolerance: -1 } },
                { id: "q1_o2", textKey: "quizzes.countryFit.q1.o2", effects: { lang_ru_need: 2 } },
                { id: "q1_o3", textKey: "quizzes.countryFit.q1.o3", effects: { lang_ru_need: 0, lang_barrier_tolerance: 2 } }
            ]
        },
        {
            id: "q2_en_usage",
            order: 20,
            titleKey: "quizzes.countryFit.q2.title",
            descriptionKey: "quizzes.countryFit.q2.desc",
            options: [
                { id: "q2_o1", textKey: "quizzes.countryFit.q2.o1", effects: { lang_en_need: 3 } },
                { id: "q2_o2", textKey: "quizzes.countryFit.q2.o2", effects: { lang_en_need: 2 } },
                { id: "q2_o3", textKey: "quizzes.countryFit.q2.o3", effects: { lang_en_need: 0 } }
            ]
        },
        {
            id: "q3_language_barrier",
            order: 30,
            titleKey: "quizzes.countryFit.q3.title",
            descriptionKey: "quizzes.countryFit.q3.desc",
            options: [
                { id: "q3_o1", textKey: "quizzes.countryFit.q3.o1", effects: { lang_barrier_tolerance: -2 } },
                { id: "q3_o2", textKey: "quizzes.countryFit.q3.o2", effects: { lang_barrier_tolerance: 1 } },
                { id: "q3_o3", textKey: "quizzes.countryFit.q3.o3", effects: { lang_barrier_tolerance: 3 } }
            ]
        },

        {
            id: "q4_climate_type",
            order: 40,
            titleKey: "quizzes.countryFit.q4.title",
            descriptionKey: "quizzes.countryFit.q4.desc",
            options: [
                { id: "q4_o1", textKey: "quizzes.countryFit.q4.o1", effects: { climate_warm: 3 } },
                { id: "q4_o2", textKey: "quizzes.countryFit.q4.o2", effects: { climate_seasons: 3 } },
                { id: "q4_o3", textKey: "quizzes.countryFit.q4.o3", effects: { climate_cold: 3 } }
            ]
        },
        {
            id: "q5_heat_vs_cold",
            order: 50,
            titleKey: "quizzes.countryFit.q5.title",
            descriptionKey: "quizzes.countryFit.q5.desc",
            options: [
                { id: "q5_o1", textKey: "quizzes.countryFit.q5.o1", effects: { climate_heat_ok: 3, climate_cold_ok: -1 } },
                { id: "q5_o2", textKey: "quizzes.countryFit.q5.o2", effects: { climate_cold_ok: 3, climate_heat_ok: -1 } },
                { id: "q5_o3", textKey: "quizzes.countryFit.q5.o3", effects: { climate_heat_ok: 1, climate_cold_ok: 1 } }
            ]
        },

        {
            id: "q6_nature_priority",
            order: 60,
            titleKey: "quizzes.countryFit.q6.title",
            descriptionKey: "quizzes.countryFit.q6.desc",
            options: [
                { id: "q6_o1", textKey: "quizzes.countryFit.q6.o1", effects: { nature_water: 3 } },
                { id: "q6_o2", textKey: "quizzes.countryFit.q6.o2", effects: { nature_mountains_forest: 3 } },
                { id: "q6_o3", textKey: "quizzes.countryFit.q6.o3", effects: { nature_city_first: 3 } }
            ]
        },
        {
            id: "q7_nature_diversity",
            order: 70,
            titleKey: "quizzes.countryFit.q7.title",
            descriptionKey: "quizzes.countryFit.q7.desc",
            options: [
                { id: "q7_o1", textKey: "quizzes.countryFit.q7.o1", effects: { nature_diversity_need: 3 } },
                { id: "q7_o2", textKey: "quizzes.countryFit.q7.o2", effects: { nature_diversity_need: 2 } },
                { id: "q7_o3", textKey: "quizzes.countryFit.q7.o3", effects: { nature_diversity_need: 0 } }
            ]
        },

        {
            id: "q8_country_size",
            order: 80,
            titleKey: "quizzes.countryFit.q8.title",
            descriptionKey: "quizzes.countryFit.q8.desc",
            options: [
                { id: "q8_o1", textKey: "quizzes.countryFit.q8.o1", effects: { country_large: 3, country_compact: -1 } },
                { id: "q8_o2", textKey: "quizzes.countryFit.q8.o2", effects: { country_compact: 3, country_large: -1 } },
                { id: "q8_o3", textKey: "quizzes.countryFit.q8.o3", effects: { country_large: 1, country_compact: 1 } }
            ]
        },
        {
            id: "q9_geo_type",
            order: 90,
            titleKey: "quizzes.countryFit.q9.title",
            descriptionKey: "quizzes.countryFit.q9.desc",
            options: [
                { id: "q9_o1", textKey: "quizzes.countryFit.q9.o1", effects: { geo_continent: 3 } },
                { id: "q9_o2", textKey: "quizzes.countryFit.q9.o2", effects: { geo_island: 2 } },
                { id: "q9_o3", textKey: "quizzes.countryFit.q9.o3", effects: { geo_island: 3 } }
            ]
        },

        {
            id: "q10_distance",
            order: 100,
            titleKey: "quizzes.countryFit.q10.title",
            descriptionKey: "quizzes.countryFit.q10.desc",
            options: [
                { id: "q10_o1", textKey: "quizzes.countryFit.q10.o1", effects: { travel_easy: 3, isolation_ok: -1 } },
                { id: "q10_o2", textKey: "quizzes.countryFit.q10.o2", effects: { travel_easy: 1, isolation_ok: 1 } },
                { id: "q10_o3", textKey: "quizzes.countryFit.q10.o3", effects: { isolation_ok: 3 } }
            ]
        },

        {
            id: "q11_city_shape",
            order: 110,
            titleKey: "quizzes.countryFit.q11.title",
            descriptionKey: "quizzes.countryFit.q11.desc",
            options: [
                { id: "q11_o1", textKey: "quizzes.countryFit.q11.o1", effects: { city_sprawl: 3 } },
                { id: "q11_o2", textKey: "quizzes.countryFit.q11.o2", effects: { city_vertical: 3 } },
                { id: "q11_o3", textKey: "quizzes.countryFit.q11.o3", effects: { city_sprawl: 1, city_vertical: 1 } }
            ]
        },
        {
            id: "q12_city_size",
            order: 120,
            titleKey: "quizzes.countryFit.q12.title",
            descriptionKey: "quizzes.countryFit.q12.desc",
            options: [
                { id: "q12_o1", textKey: "quizzes.countryFit.q12.o1", effects: { metro_megacity: 3 } },
                { id: "q12_o2", textKey: "quizzes.countryFit.q12.o2", effects: { metro_midcity: 3 } },
                { id: "q12_o3", textKey: "quizzes.countryFit.q12.o3", effects: { metro_smalltown: 3 } }
            ]
        },
        {
            id: "q13_transport",
            order: 130,
            titleKey: "quizzes.countryFit.q13.title",
            descriptionKey: "quizzes.countryFit.q13.desc",
            options: [
                { id: "q13_o1", textKey: "quizzes.countryFit.q13.o1", effects: { transport_public: 3 } },
                { id: "q13_o2", textKey: "quizzes.countryFit.q13.o2", effects: { transport_car: 3 } },
                { id: "q13_o3", textKey: "quizzes.countryFit.q13.o3", effects: { transport_public: 1, transport_car: 1 } }
            ]
        },

        {
            id: "q14_safety",
            order: 140,
            titleKey: "quizzes.countryFit.q14.title",
            descriptionKey: "quizzes.countryFit.q14.desc",
            options: [
                { id: "q14_o1", textKey: "quizzes.countryFit.q14.o1", effects: { safety_need: 3 } },
                { id: "q14_o2", textKey: "quizzes.countryFit.q14.o2", effects: { safety_need: 2 } },
                { id: "q14_o3", textKey: "quizzes.countryFit.q14.o3", effects: { safety_need: 1 } }
            ]
        },
        {
            id: "q15_stability",
            order: 150,
            titleKey: "quizzes.countryFit.q15.title",
            descriptionKey: "quizzes.countryFit.q15.desc",
            options: [
                { id: "q15_o1", textKey: "quizzes.countryFit.q15.o1", effects: { stability_need: 3 } },
                { id: "q15_o2", textKey: "quizzes.countryFit.q15.o2", effects: { stability_need: 2 } },
                { id: "q15_o3", textKey: "quizzes.countryFit.q15.o3", effects: { stability_need: 1 } }
            ]
        },
        {
            id: "q16_rules",
            order: 160,
            titleKey: "quizzes.countryFit.q16.title",
            descriptionKey: "quizzes.countryFit.q16.desc",
            options: [
                { id: "q16_o1", textKey: "quizzes.countryFit.q16.o1", effects: { rules_ok: 3, freedom_need: -1 } },
                { id: "q16_o2", textKey: "quizzes.countryFit.q16.o2", effects: { rules_ok: 1, freedom_need: 1 } },
                { id: "q16_o3", textKey: "quizzes.countryFit.q16.o3", effects: { freedom_need: 3, rules_ok: -1 } }
            ]
        },

        {
            id: "q17_cost",
            order: 170,
            titleKey: "quizzes.countryFit.q17.title",
            descriptionKey: "quizzes.countryFit.q17.desc",
            options: [
                { id: "q17_o1", textKey: "quizzes.countryFit.q17.o1", effects: { cost_low_need: 3, quality_high_need: -1 } },
                { id: "q17_o2", textKey: "quizzes.countryFit.q17.o2", effects: { cost_low_need: 1, quality_high_need: 1 } },
                { id: "q17_o3", textKey: "quizzes.countryFit.q17.o3", effects: { quality_high_need: 3, cost_low_need: -1 } }
            ]
        },
        {
            id: "q18_taxes_vs_support",
            order: 180,
            titleKey: "quizzes.countryFit.q18.title",
            descriptionKey: "quizzes.countryFit.q18.desc",
            options: [
                { id: "q18_o1", textKey: "quizzes.countryFit.q18.o1", effects: { tax_low_need: 3, social_support_need: -1 } },
                { id: "q18_o2", textKey: "quizzes.countryFit.q18.o2", effects: { social_support_need: 3, tax_low_need: -1 } },
                { id: "q18_o3", textKey: "quizzes.countryFit.q18.o3", effects: { tax_low_need: 1, social_support_need: 1 } }
            ]
        },
        {
            id: "q19_work_priority",
            order: 190,
            titleKey: "quizzes.countryFit.q19.title",
            descriptionKey: "quizzes.countryFit.q19.desc",
            options: [
                { id: "q19_o1", textKey: "quizzes.countryFit.q19.o1", effects: { income_growth_need: 3 } },
                { id: "q19_o2", textKey: "quizzes.countryFit.q19.o2", effects: { worklife_need: 3 } },
                { id: "q19_o3", textKey: "quizzes.countryFit.q19.o3", effects: { income_growth_need: 1, worklife_need: 1 } }
            ]
        },

        {
            id: "q20_society_type",
            order: 200,
            titleKey: "quizzes.countryFit.q20.title",
            descriptionKey: "quizzes.countryFit.q20.desc",
            options: [
                { id: "q20_o1", textKey: "quizzes.countryFit.q20.o1", effects: { society_private: 3 } },
                { id: "q20_o2", textKey: "quizzes.countryFit.q20.o2", effects: { society_open: 3 } },
                { id: "q20_o3", textKey: "quizzes.countryFit.q20.o3", effects: { society_international: 3 } }
            ]
        },
        {
            id: "q21_culture_gap",
            order: 210,
            titleKey: "quizzes.countryFit.q21.title",
            descriptionKey: "quizzes.countryFit.q21.desc",
            options: [
                { id: "q21_o1", textKey: "quizzes.countryFit.q21.o1", effects: { mentality_close_need: 3, culture_change_ok: -1 } },
                { id: "q21_o2", textKey: "quizzes.countryFit.q21.o2", effects: { culture_change_ok: 2 } },
                { id: "q21_o3", textKey: "quizzes.countryFit.q21.o3", effects: { culture_change_ok: 3, mentality_close_need: -1 } }
            ]
        }
    ]
};