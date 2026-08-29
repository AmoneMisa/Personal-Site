// Shared scoring primitives for the simpler (non-country) quizzes: a question
// answer adds weighted "effects" to axes, and profession/value matching reads
// those totals back. Kept separate from useCountryQuizEngine.ts, whose
// distance math is tuned specifically to country/state vectors and sparsity
// handling that these quizzes don't need.

export type Effects<A extends string> = Partial<Record<A, number>>;

export type SimpleQuizOption<A extends string> = {
    id: string;
    textKey: string;
    effects: Effects<A>;
};

export type SimpleQuizQuestion<A extends string> = {
    id: string;
    order: number;
    titleKey: string;
    options: SimpleQuizOption<A>[];
};

export type AnswerMap = Record<string, string>;

export function buildAxisProfile<A extends string>(
    axes: readonly A[],
    questions: SimpleQuizQuestion<A>[],
    answers: AnswerMap
): Record<A, number> {
    const scores = Object.fromEntries(axes.map((a) => [a, 0])) as Record<A, number>;

    for (const q of questions) {
        const optionId = answers[q.id];
        if (!optionId) continue;

        const opt = q.options.find((o) => o.id === optionId);
        if (!opt) continue;

        for (const [axis, weight] of Object.entries(opt.effects) as Array<[A, number]>) {
            scores[axis] = (scores[axis] ?? 0) + (weight ?? 0);
        }
    }

    return scores;
}

// Cosine similarity between the user's profile and a target vector, rescaled
// from [-1, 1] to a 0..100 "match" percentage. Axes absent from the target
// are ignored rather than counted as a mismatch, so a profession/value vector
// only needs to specify the axes it actually cares about.
export function cosineMatch01to100<A extends string>(
    profile: Record<A, number>,
    target: Effects<A>
): number {
    let dot = 0;
    let magProfile = 0;
    let magTarget = 0;

    for (const axis of Object.keys(target) as A[]) {
        const p = profile[axis] ?? 0;
        const t = target[axis] ?? 0;
        dot += p * t;
        magProfile += p * p;
        magTarget += t * t;
    }

    if (!magProfile || !magTarget) return 50;

    const cos = dot / (Math.sqrt(magProfile) * Math.sqrt(magTarget));
    return Math.round(((cos + 1) / 2) * 100);
}
