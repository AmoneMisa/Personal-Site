export function getCategoryScore(tp: any, key: string): number | null {
    const found = tp?.categories?.find((c: any) => c.key === key);
    return typeof found?.score === "number" ? found.score : null;
}

export function budgetMultiplierFromTeleport(tp: any) {
    const housing = getCategoryScore(tp, "HOUSING");
    const col = getCategoryScore(tp, "COST_OF_LIVING");

    const housingMul = housing != null ? (1 + (housing - 5) * 0.05) : 1;
    const colMul = col != null ? (1 + (col - 5) * 0.04) : 1;

    // защита от абсурда
    const mul = Math.min(1.35, Math.max(0.70, housingMul * colMul));
    return { mul, housing, col };
}