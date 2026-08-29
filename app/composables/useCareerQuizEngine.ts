import {CAREER_AXES, careerFitQuestions, type CareerAxisKey} from "~/utils/quizzes/career/careerFit";
import {professions, type Profession} from "~/utils/quizzes/career/professions";
import {buildAxisProfile, cosineMatch01to100, type AnswerMap} from "~/utils/quizzes/shared/vectorMatch";

export type ProfessionMatch = {
    profession: Profession;
    match100: number;
};

export function matchProfessions(answers: AnswerMap, limit = professions.length): ProfessionMatch[] {
    const profile = buildAxisProfile<CareerAxisKey>(CAREER_AXES, careerFitQuestions, answers);

    return professions
        .map((profession) => ({
            profession,
            match100: cosineMatch01to100(profile, profession.vector)
        }))
        .sort((a, b) => b.match100 - a.match100)
        .slice(0, limit);
}
