import type {SimpleQuizQuestion} from "~/utils/quizzes/shared/vectorMatch";

export type LifeValueKey =
    | "security_stability"
    | "freedom_autonomy"
    | "achievement_growth"
    | "relationships_family"
    | "adventure_novelty"
    | "creativity_expression"
    | "wealth_comfort"
    | "health_wellbeing"
    | "community_belonging"
    | "knowledge_growth"
    | "spirituality_meaning"
    | "recognition_influence";

export const LIFE_VALUES: LifeValueKey[] = [
    "security_stability",
    "freedom_autonomy",
    "achievement_growth",
    "relationships_family",
    "adventure_novelty",
    "creativity_expression",
    "wealth_comfort",
    "health_wellbeing",
    "community_belonging",
    "knowledge_growth",
    "spirituality_meaning",
    "recognition_influence"
];

export type LifeValuesQuestion = SimpleQuizQuestion<LifeValueKey>;

export const LIFE_VALUES_QUIZ_ID = "life_values_v1";

export const lifeValuesQuestions: LifeValuesQuestion[] = [
    {
        id: "v1_bigDecision",
        order: 10,
        titleKey: "quizzes.lifeValues.v1.title",
        options: [
            {id: "v1_o1", textKey: "quizzes.lifeValues.v1.o1", effects: {security_stability: 3}},
            {id: "v1_o2", textKey: "quizzes.lifeValues.v1.o2", effects: {adventure_novelty: 2}},
            {id: "v1_o3", textKey: "quizzes.lifeValues.v1.o3", effects: {relationships_family: 2}}
        ]
    },
    {
        id: "v2_routine",
        order: 20,
        titleKey: "quizzes.lifeValues.v2.title",
        options: [
            {id: "v2_o1", textKey: "quizzes.lifeValues.v2.o1", effects: {security_stability: 2}},
            {id: "v2_o2", textKey: "quizzes.lifeValues.v2.o2", effects: {}},
            {id: "v2_o3", textKey: "quizzes.lifeValues.v2.o3", effects: {adventure_novelty: 3}}
        ]
    },
    {
        id: "v3_fulfilled",
        order: 30,
        titleKey: "quizzes.lifeValues.v3.title",
        options: [
            {id: "v3_o1", textKey: "quizzes.lifeValues.v3.o1", effects: {achievement_growth: 2, spirituality_meaning: 1}},
            {id: "v3_o2", textKey: "quizzes.lifeValues.v3.o2", effects: {relationships_family: 3}},
            {id: "v3_o3", textKey: "quizzes.lifeValues.v3.o3", effects: {knowledge_growth: 3}}
        ]
    },
    {
        id: "v4_control",
        order: 40,
        titleKey: "quizzes.lifeValues.v4.title",
        options: [
            {id: "v4_o1", textKey: "quizzes.lifeValues.v4.o1", effects: {freedom_autonomy: 3}},
            {id: "v4_o2", textKey: "quizzes.lifeValues.v4.o2", effects: {freedom_autonomy: 1}},
            {id: "v4_o3", textKey: "quizzes.lifeValues.v4.o3", effects: {security_stability: 1}}
        ]
    },
    {
        id: "v5_money",
        order: 50,
        titleKey: "quizzes.lifeValues.v5.title",
        options: [
            {id: "v5_o1", textKey: "quizzes.lifeValues.v5.o1", effects: {wealth_comfort: 3}},
            {id: "v5_o2", textKey: "quizzes.lifeValues.v5.o2", effects: {wealth_comfort: 1}},
            {id: "v5_o3", textKey: "quizzes.lifeValues.v5.o3", effects: {spirituality_meaning: 1}}
        ]
    },
    {
        id: "v6_creativity",
        order: 60,
        titleKey: "quizzes.lifeValues.v6.title",
        options: [
            {id: "v6_o1", textKey: "quizzes.lifeValues.v6.o1", effects: {creativity_expression: 3}},
            {id: "v6_o2", textKey: "quizzes.lifeValues.v6.o2", effects: {creativity_expression: 1}},
            {id: "v6_o3", textKey: "quizzes.lifeValues.v6.o3", effects: {}}
        ]
    },
    {
        id: "v7_health",
        order: 70,
        titleKey: "quizzes.lifeValues.v7.title",
        options: [
            {id: "v7_o1", textKey: "quizzes.lifeValues.v7.o1", effects: {health_wellbeing: 3}},
            {id: "v7_o2", textKey: "quizzes.lifeValues.v7.o2", effects: {health_wellbeing: 1}},
            {id: "v7_o3", textKey: "quizzes.lifeValues.v7.o3", effects: {}}
        ]
    },
    {
        id: "v8_community",
        order: 80,
        titleKey: "quizzes.lifeValues.v8.title",
        options: [
            {id: "v8_o1", textKey: "quizzes.lifeValues.v8.o1", effects: {community_belonging: 3}},
            {id: "v8_o2", textKey: "quizzes.lifeValues.v8.o2", effects: {community_belonging: 1}},
            {id: "v8_o3", textKey: "quizzes.lifeValues.v8.o3", effects: {freedom_autonomy: 1}}
        ]
    },
    {
        id: "v9_drive",
        order: 90,
        titleKey: "quizzes.lifeValues.v9.title",
        options: [
            {id: "v9_o1", textKey: "quizzes.lifeValues.v9.o1", effects: {recognition_influence: 3}},
            {id: "v9_o2", textKey: "quizzes.lifeValues.v9.o2", effects: {achievement_growth: 2}},
            {id: "v9_o3", textKey: "quizzes.lifeValues.v9.o3", effects: {creativity_expression: 1}}
        ]
    },
    {
        id: "v10_meaning",
        order: 100,
        titleKey: "quizzes.lifeValues.v10.title",
        options: [
            {id: "v10_o1", textKey: "quizzes.lifeValues.v10.o1", effects: {spirituality_meaning: 3}},
            {id: "v10_o2", textKey: "quizzes.lifeValues.v10.o2", effects: {spirituality_meaning: 1}},
            {id: "v10_o3", textKey: "quizzes.lifeValues.v10.o3", effects: {}}
        ]
    },
    {
        id: "v11_freeWeekend",
        order: 110,
        titleKey: "quizzes.lifeValues.v11.title",
        options: [
            {id: "v11_o1", textKey: "quizzes.lifeValues.v11.o1", effects: {adventure_novelty: 3}},
            {id: "v11_o2", textKey: "quizzes.lifeValues.v11.o2", effects: {relationships_family: 2}},
            {id: "v11_o3", textKey: "quizzes.lifeValues.v11.o3", effects: {knowledge_growth: 2}}
        ]
    },
    {
        id: "v12_risk",
        order: 120,
        titleKey: "quizzes.lifeValues.v12.title",
        options: [
            {id: "v12_o1", textKey: "quizzes.lifeValues.v12.o1", effects: {adventure_novelty: 2, freedom_autonomy: 1}},
            {id: "v12_o2", textKey: "quizzes.lifeValues.v12.o2", effects: {achievement_growth: 1}},
            {id: "v12_o3", textKey: "quizzes.lifeValues.v12.o3", effects: {security_stability: 2}}
        ]
    },
    {
        id: "v13_respect",
        order: 130,
        titleKey: "quizzes.lifeValues.v13.title",
        options: [
            {id: "v13_o1", textKey: "quizzes.lifeValues.v13.o1", effects: {recognition_influence: 3}},
            {id: "v13_o2", textKey: "quizzes.lifeValues.v13.o2", effects: {relationships_family: 1, community_belonging: 1}},
            {id: "v13_o3", textKey: "quizzes.lifeValues.v13.o3", effects: {freedom_autonomy: 1}}
        ]
    },
    {
        id: "v14_unlimitedMoney",
        order: 140,
        titleKey: "quizzes.lifeValues.v14.title",
        options: [
            {id: "v14_o1", textKey: "quizzes.lifeValues.v14.o1", effects: {creativity_expression: 3}},
            {id: "v14_o2", textKey: "quizzes.lifeValues.v14.o2", effects: {knowledge_growth: 2}},
            {id: "v14_o3", textKey: "quizzes.lifeValues.v14.o3", effects: {community_belonging: 2}}
        ]
    }
];
