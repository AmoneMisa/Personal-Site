import type {SimpleQuizQuestion} from "~/utils/quizzes/shared/vectorMatch";

export type CareerAxisKey =
    | "analytical"
    | "creative"
    | "social_helping"
    | "technical_it"
    | "hands_on_practical"
    | "leadership_business"
    | "structure_order"
    | "autonomy_flexibility"
    | "physical_active"
    | "caring_healthcare";

export const CAREER_AXES: CareerAxisKey[] = [
    "analytical",
    "creative",
    "social_helping",
    "technical_it",
    "hands_on_practical",
    "leadership_business",
    "structure_order",
    "autonomy_flexibility",
    "physical_active",
    "caring_healthcare"
];

export type CareerQuestion = SimpleQuizQuestion<CareerAxisKey>;

export const CAREER_QUIZ_ID = "career_fit_v1";

export const careerFitQuestions: CareerQuestion[] = [
    {
        id: "c1_energize",
        order: 10,
        titleKey: "quizzes.careerFit.c1.title",
        options: [
            {id: "c1_o1", textKey: "quizzes.careerFit.c1.o1", effects: {analytical: 2}},
            {id: "c1_o2", textKey: "quizzes.careerFit.c1.o2", effects: {social_helping: 2}},
            {id: "c1_o3", textKey: "quizzes.careerFit.c1.o3", effects: {hands_on_practical: 2}}
        ]
    },
    {
        id: "c2_creative",
        order: 20,
        titleKey: "quizzes.careerFit.c2.title",
        options: [
            {id: "c2_o1", textKey: "quizzes.careerFit.c2.o1", effects: {creative: 3}},
            {id: "c2_o2", textKey: "quizzes.careerFit.c2.o2", effects: {creative: 1}},
            {id: "c2_o3", textKey: "quizzes.careerFit.c2.o3", effects: {creative: -1}}
        ]
    },
    {
        id: "c3_tech",
        order: 30,
        titleKey: "quizzes.careerFit.c3.title",
        options: [
            {id: "c3_o1", textKey: "quizzes.careerFit.c3.o1", effects: {technical_it: 3}},
            {id: "c3_o2", textKey: "quizzes.careerFit.c3.o2", effects: {technical_it: 1}},
            {id: "c3_o3", textKey: "quizzes.careerFit.c3.o3", effects: {technical_it: -1, physical_active: 1}}
        ]
    },
    {
        id: "c4_leading",
        order: 40,
        titleKey: "quizzes.careerFit.c4.title",
        options: [
            {id: "c4_o1", textKey: "quizzes.careerFit.c4.o1", effects: {leadership_business: 3}},
            {id: "c4_o2", textKey: "quizzes.careerFit.c4.o2", effects: {leadership_business: 1}},
            {id: "c4_o3", textKey: "quizzes.careerFit.c4.o3", effects: {autonomy_flexibility: 2}}
        ]
    },
    {
        id: "c5_helping",
        order: 50,
        titleKey: "quizzes.careerFit.c5.title",
        options: [
            {id: "c5_o1", textKey: "quizzes.careerFit.c5.o1", effects: {caring_healthcare: 2, social_helping: 2}},
            {id: "c5_o2", textKey: "quizzes.careerFit.c5.o2", effects: {social_helping: 1}},
            {id: "c5_o3", textKey: "quizzes.careerFit.c5.o3", effects: {analytical: 1}}
        ]
    },
    {
        id: "c6_structure",
        order: 60,
        titleKey: "quizzes.careerFit.c6.title",
        options: [
            {id: "c6_o1", textKey: "quizzes.careerFit.c6.o1", effects: {structure_order: 3}},
            {id: "c6_o2", textKey: "quizzes.careerFit.c6.o2", effects: {structure_order: 1}},
            {id: "c6_o3", textKey: "quizzes.careerFit.c6.o3", effects: {autonomy_flexibility: 3}}
        ]
    },
    {
        id: "c7_physical",
        order: 70,
        titleKey: "quizzes.careerFit.c7.title",
        options: [
            {id: "c7_o1", textKey: "quizzes.careerFit.c7.o1", effects: {physical_active: 3}},
            {id: "c7_o2", textKey: "quizzes.careerFit.c7.o2", effects: {physical_active: 1}},
            {id: "c7_o3", textKey: "quizzes.careerFit.c7.o3", effects: {physical_active: -1}}
        ]
    },
    {
        id: "c8_ownBusiness",
        order: 80,
        titleKey: "quizzes.careerFit.c8.title",
        options: [
            {id: "c8_o1", textKey: "quizzes.careerFit.c8.o1", effects: {structure_order: 2}},
            {id: "c8_o2", textKey: "quizzes.careerFit.c8.o2", effects: {leadership_business: 1}},
            {id: "c8_o3", textKey: "quizzes.careerFit.c8.o3", effects: {leadership_business: 2, autonomy_flexibility: 2}}
        ]
    },
    {
        id: "c9_logic",
        order: 90,
        titleKey: "quizzes.careerFit.c9.title",
        options: [
            {id: "c9_o1", textKey: "quizzes.careerFit.c9.o1", effects: {analytical: 3, technical_it: 1}},
            {id: "c9_o2", textKey: "quizzes.careerFit.c9.o2", effects: {analytical: 1}},
            {id: "c9_o3", textKey: "quizzes.careerFit.c9.o3", effects: {social_helping: 1, creative: 1}}
        ]
    },
    {
        id: "c10_handsOn",
        order: 100,
        titleKey: "quizzes.careerFit.c10.title",
        options: [
            {id: "c10_o1", textKey: "quizzes.careerFit.c10.o1", effects: {hands_on_practical: 3}},
            {id: "c10_o2", textKey: "quizzes.careerFit.c10.o2", effects: {hands_on_practical: 1}},
            {id: "c10_o3", textKey: "quizzes.careerFit.c10.o3", effects: {analytical: 1}}
        ]
    },
    {
        id: "c11_persuading",
        order: 110,
        titleKey: "quizzes.careerFit.c11.title",
        options: [
            {id: "c11_o1", textKey: "quizzes.careerFit.c11.o1", effects: {leadership_business: 2, social_helping: 1}},
            {id: "c11_o2", textKey: "quizzes.careerFit.c11.o2", effects: {leadership_business: 1}},
            {id: "c11_o3", textKey: "quizzes.careerFit.c11.o3", effects: {autonomy_flexibility: 1}}
        ]
    },
    {
        id: "c12_health",
        order: 120,
        titleKey: "quizzes.careerFit.c12.title",
        options: [
            {id: "c12_o1", textKey: "quizzes.careerFit.c12.o1", effects: {caring_healthcare: 3}},
            {id: "c12_o2", textKey: "quizzes.careerFit.c12.o2", effects: {}},
            {id: "c12_o3", textKey: "quizzes.careerFit.c12.o3", effects: {analytical: 1}}
        ]
    }
];
