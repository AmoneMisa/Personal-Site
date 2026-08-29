import type {CareerAxisKey} from "~/utils/quizzes/career/careerFit";
import type {Effects} from "~/utils/quizzes/shared/vectorMatch";

export type Profession = {
    key: string;
    titleKey: string;
    descriptionKey: string;
    vector: Effects<CareerAxisKey>;
    // Free-text query for /jobs?q=<jobsQuery>. Omitted for roles this site's
    // job boards don't really carry (e.g. "founder" isn't a job listing).
    jobsQuery?: string;
};

export const professions: Profession[] = [
    {
        key: "professions.developer",
        titleKey: "quizzes.careerFit.professions.developer.title",
        descriptionKey: "quizzes.careerFit.professions.developer.desc",
        vector: {technical_it: 3, analytical: 2, autonomy_flexibility: 2},
        jobsQuery: "developer"
    },
    {
        key: "professions.dataAnalyst",
        titleKey: "quizzes.careerFit.professions.dataAnalyst.title",
        descriptionKey: "quizzes.careerFit.professions.dataAnalyst.desc",
        vector: {analytical: 3, technical_it: 2},
        jobsQuery: "data analyst"
    },
    {
        key: "professions.uxDesigner",
        titleKey: "quizzes.careerFit.professions.uxDesigner.title",
        descriptionKey: "quizzes.careerFit.professions.uxDesigner.desc",
        vector: {creative: 3, technical_it: 1, analytical: 1},
        jobsQuery: "ux designer"
    },
    {
        key: "professions.graphicDesigner",
        titleKey: "quizzes.careerFit.professions.graphicDesigner.title",
        descriptionKey: "quizzes.careerFit.professions.graphicDesigner.desc",
        vector: {creative: 3},
        jobsQuery: "graphic designer"
    },
    {
        key: "professions.marketer",
        titleKey: "quizzes.careerFit.professions.marketer.title",
        descriptionKey: "quizzes.careerFit.professions.marketer.desc",
        vector: {creative: 2, social_helping: 1, leadership_business: 1},
        jobsQuery: "marketing"
    },
    {
        key: "professions.salesManager",
        titleKey: "quizzes.careerFit.professions.salesManager.title",
        descriptionKey: "quizzes.careerFit.professions.salesManager.desc",
        vector: {leadership_business: 3, social_helping: 2},
        jobsQuery: "sales manager"
    },
    {
        key: "professions.projectManager",
        titleKey: "quizzes.careerFit.professions.projectManager.title",
        descriptionKey: "quizzes.careerFit.professions.projectManager.desc",
        vector: {leadership_business: 2, structure_order: 3},
        jobsQuery: "project manager"
    },
    {
        key: "professions.accountant",
        titleKey: "quizzes.careerFit.professions.accountant.title",
        descriptionKey: "quizzes.careerFit.professions.accountant.desc",
        vector: {structure_order: 3, analytical: 2},
        jobsQuery: "accountant"
    },
    {
        key: "professions.lawyer",
        titleKey: "quizzes.careerFit.professions.lawyer.title",
        descriptionKey: "quizzes.careerFit.professions.lawyer.desc",
        vector: {analytical: 2, structure_order: 2, leadership_business: 1},
        jobsQuery: "lawyer"
    },
    {
        key: "professions.teacher",
        titleKey: "quizzes.careerFit.professions.teacher.title",
        descriptionKey: "quizzes.careerFit.professions.teacher.desc",
        vector: {social_helping: 3, caring_healthcare: 1},
        jobsQuery: "teacher"
    },
    {
        key: "professions.nurse",
        titleKey: "quizzes.careerFit.professions.nurse.title",
        descriptionKey: "quizzes.careerFit.professions.nurse.desc",
        vector: {caring_healthcare: 3, social_helping: 2},
        jobsQuery: "nurse"
    },
    {
        key: "professions.psychologist",
        titleKey: "quizzes.careerFit.professions.psychologist.title",
        descriptionKey: "quizzes.careerFit.professions.psychologist.desc",
        vector: {social_helping: 3, caring_healthcare: 1, analytical: 1},
        jobsQuery: "psychologist"
    },
    {
        key: "professions.engineer",
        titleKey: "quizzes.careerFit.professions.engineer.title",
        descriptionKey: "quizzes.careerFit.professions.engineer.desc",
        vector: {technical_it: 2, hands_on_practical: 2, analytical: 2},
        jobsQuery: "engineer"
    },
    {
        key: "professions.electrician",
        titleKey: "quizzes.careerFit.professions.electrician.title",
        descriptionKey: "quizzes.careerFit.professions.electrician.desc",
        vector: {hands_on_practical: 3, technical_it: 1},
        jobsQuery: "electrician"
    },
    {
        key: "professions.chef",
        titleKey: "quizzes.careerFit.professions.chef.title",
        descriptionKey: "quizzes.careerFit.professions.chef.desc",
        vector: {hands_on_practical: 2, creative: 2, physical_active: 1},
        jobsQuery: "chef"
    },
    {
        key: "professions.fitnessTrainer",
        titleKey: "quizzes.careerFit.professions.fitnessTrainer.title",
        descriptionKey: "quizzes.careerFit.professions.fitnessTrainer.desc",
        vector: {physical_active: 3, social_helping: 1, caring_healthcare: 1},
        jobsQuery: "fitness trainer"
    },
    {
        key: "professions.entrepreneur",
        titleKey: "quizzes.careerFit.professions.entrepreneur.title",
        descriptionKey: "quizzes.careerFit.professions.entrepreneur.desc",
        vector: {leadership_business: 3, autonomy_flexibility: 2, creative: 1}
    },
    {
        key: "professions.writer",
        titleKey: "quizzes.careerFit.professions.writer.title",
        descriptionKey: "quizzes.careerFit.professions.writer.desc",
        vector: {creative: 3, autonomy_flexibility: 2},
        jobsQuery: "content writer"
    }
];
