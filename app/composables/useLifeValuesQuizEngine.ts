import {LIFE_VALUES, lifeValuesQuestions, type LifeValueKey} from "~/utils/quizzes/values/lifeValues";
import {buildAxisProfile, type AnswerMap} from "~/utils/quizzes/shared/vectorMatch";

export type LifeValueResult = {
    key: LifeValueKey;
    score: number;
    // 0..100, relative to this user's own highest-scoring value (a ranking
    // profile, not an absolute measure — there's no universal "100" to hit).
    percent: number;
};

export function scoreLifeValues(answers: AnswerMap): LifeValueResult[] {
    const profile = buildAxisProfile<LifeValueKey>(LIFE_VALUES, lifeValuesQuestions, answers);
    const maxScore = Math.max(1, ...Object.values(profile));

    return LIFE_VALUES
        .map((key) => ({
            key,
            score: profile[key] ?? 0,
            percent: Math.round(Math.max(0, profile[key] ?? 0) / maxScore * 100)
        }))
        .sort((a, b) => b.score - a.score);
}
