// ~/composables/useCountryQuizEngine.ts

import type { AxisKey, QuizConfig, Effects } from "~/utils/quizzes/country/countryFit";
import type { CountryEntity, Vector } from "~/utils/quizzes/country/countries";
import { countries } from "~/utils/quizzes/country/countries";
import type { CountryIndicesBundle } from "~/types/indices";

export type LanguageLevel = "native" | "fluent" | "intermediate" | "basic" | "none";
export type JobType = "remote" | "local" | "mixed";
export type FamilyStatus = "single" | "couple" | "couple_with_kids" | "single_parent";

// indices (0..10) -> -3..+3
const toW33 = (v10: number) => ((v10 - 5) / 5) * 3;

export type UserProfile = {
    job: {
        type: JobType;
        regulated?: boolean;
    };
    languages: {
        ru: LanguageLevel;
        en: LanguageLevel;
    };
    family: {
        status: FamilyStatus;
        kidsCount: number;
    };
    budget: {
        monthlyUSD: number;
        includesRent: boolean;
    };
};

export type AnswerMap = Record<string /* questionId */, string /* optionId */>;

export type MatchResult = {
    key: string;
    titleKey: string;
    fallbackName: string;

    // for sorting / internal
    score: number;

    // required by UI
    match100: number; // 0..100 совпадение предпочтений
    live100: number; // 0..100 рейтинг страны для проживания (веса зависят от важности + индексы)

    estimatedMonthlyUSD: number;
    why: string[];
    teleportSlug?: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

const levelToNum = (lvl: LanguageLevel): 0 | 1 | 2 | 3 => {
    switch (lvl) {
        case "none":
            return 0;
        case "basic":
            return 1;
        case "intermediate":
            return 2;
        case "fluent":
        case "native":
            return 3;
    }
};

const initScores = (axes: AxisKey[]) =>
    Object.fromEntries(axes.map((a) => [a, 0])) as Record<AxisKey, number>;

export function buildPreferenceProfile(quiz: QuizConfig, answers: AnswerMap): Record<AxisKey, number> {
    const scores = initScores(quiz.axes);

    for (const q of quiz.questions) {
        const optionId = answers[q.id];
        if (!optionId) continue;

        const opt = q.options.find((o) => o.id === optionId);
        if (!opt) continue;

        applyEffects(scores, opt.effects);
    }

    // -30..30
    for (const k of quiz.axes) scores[k] = clamp(scores[k], -30, 30);

    return scores;
}

function applyEffects(scores: Record<AxisKey, number>, effects: Effects) {
    for (const [k, w] of Object.entries(effects) as Array<[AxisKey, number]>) {
        scores[k] = (scores[k] ?? 0) + w;
    }
}

function calcNeededMonthlyUSD(entity: CountryEntity, user: UserProfile): number {
    const m = entity.costUSD.monthly;
    const kids = Math.max(0, user.family.kidsCount || 0);

    if (user.family.status === "single") return m.single + kids * m.perKid;
    if (user.family.status === "single_parent") return m.single + kids * m.perKid;
    if (user.family.status === "couple") return m.couple + kids * m.perKid;
    return m.couple + kids * m.perKid;
}

// --------------------------------------------
// Preference match (vector) -> match100
// --------------------------------------------

// -30..30 -> 0..3 (same idea as earlier, but explicit)
const prefTo03 = (prefVal: number) => {
    const pref01 = clamp((prefVal + 30) / 60, 0, 1);
    return pref01 * 3;
};

function preferenceMatch100(preferences: Record<AxisKey, number>, v: Vector): { match100: number; used: number } {
    let dist = 0;
    let used = 0;

    for (const [axis, prefValRaw] of Object.entries(preferences) as Array<[AxisKey, number]>) {
        const target03 = v[axis];
        if (typeof target03 !== "number") continue;

        const pref03 = prefTo03(prefValRaw); // 0..3
        dist += Math.abs(pref03 - target03); // 0..3
        used++;
    }

    if (used === 0) return { match100: 20, used };

    const distAvg = dist / used; // 0..3
    let match = (1 - distAvg / 3) * 100;

    // мягкий штраф за “пустоватый” вектор
    const sparsityPenalty = used < 12 ? 0.92 : 1;
    match *= sparsityPenalty;

    return { match100: clamp(match, 0, 100), used };
}

// importance 0..1 from preference axis magnitude
function importance01(prefVal: number | undefined) {
    const v = Math.abs(prefVal ?? 0);
    return clamp(v / 30, 0, 1);
}

// indices boost: -1..+1 (already weighted by importance)
function indicesBoost01(indices: CountryIndicesBundle["normalized"] | undefined, pref: Record<AxisKey, number>) {
    if (!indices) return 0;

    // IMPORTANT:
    // Сейчас у нас в API bundle.normalized есть: income, education, qualityOfLife, safety (0..10)
    // Маппинг индексов на “важности”:
    // - income -> income_growth_need
    // - qualityOfLife + education -> quality_high_need / social_support_need (мягко)
    // - safety -> safety_need
    const terms: Array<{ idx: number | null | undefined; w: number }> = [
        { idx: indices.income, w: importance01(pref.income_growth_need) * 1.0 },
        { idx: indices.qualityOfLife, w: importance01(pref.quality_high_need) * 0.8 },
        { idx: indices.education, w: importance01(pref.social_support_need) * 0.4 },
        { idx: indices.safety, w: importance01(pref.safety_need) * 1.0 },
    ];

    let sum = 0;
    let wsum = 0;

    for (const t of terms) {
        if (t.idx == null) continue;
        if (t.w <= 0) continue;

        const w33 = toW33(t.idx); // -3..+3
        const x = clamp(w33 / 3, -1, 1); // -1..+1

        sum += x * t.w;
        wsum += t.w;
    }

    if (wsum <= 0) return 0;
    return clamp(sum / wsum, -1, 1); // -1..+1
}

// live score 0..100
function liveScore100(match100: number, langPenalty: number, workPenalty: number, idxBoost: number) {
    let score = match100;

    // penalties -> minus points
    score -= (langPenalty + workPenalty) * 6; // 1 penalty ~= -6 pts

    // indices boost -1..+1 -> -20..+20
    score += idxBoost * 20;

    return clamp(score, 0, 100);
}

function languagePenalty(user: UserProfile, entity: CountryEntity): { penalty: number; notes: string[] } {
    const ru = levelToNum(user.languages.ru);
    const en = levelToNum(user.languages.en);

    const englishOk = entity.languages.english; // 0..3
    const noLocal = entity.languages.noLocalLanguagePenalty; // 0..3

    let penalty = 0;
    const notes: string[] = [];

    if (en <= 1 && englishOk <= 1 && noLocal <= 1) {
        penalty += 2.5;
        notes.push("С языками может быть тяжело");
    } else if (en <= 1 && englishOk <= 1) {
        penalty += 1.5;
        notes.push("Английского может не хватить");
    }

    if (ru >= 2 && entity.languages.russian >= 2) {
        notes.push("Русский встречается достаточно часто");
    }

    return { penalty, notes };
}

function workPenalty(user: UserProfile, entity: CountryEntity): { penalty: number; notes: string[] } {
    const notes: string[] = [];
    let penalty = 0;

    if (user.job.type === "remote") {
        if (entity.work.remoteFriendly <= 1) {
            penalty += 1.0;
            notes.push("Удалённая работа может быть неудобна по условиям/инфре");
        } else {
            notes.push("Условия для удалёнки обычно ок");
        }
    }

    if (user.job.type === "local") {
        if (entity.work.localWithoutLocalLanguage <= 1 && levelToNum(user.languages.en) <= 1) {
            penalty += 2.0;
            notes.push("Локальную работу без языка будет сложно найти");
        }
    }

    return { penalty, notes };
}

export function expandEntitiesWithRegions(list: CountryEntity[]): CountryEntity[] {
    const expanded: CountryEntity[] = [];

    for (const c of list) {
        expanded.push(c);

        if (c.regions?.length) {
            for (const r of c.regions) {
                const merged: CountryEntity = {
                    ...c,
                    key: r.key,
                    titleKey: r.titleKey,
                    fallbackName: r.fallbackName,
                    teleportSlug: r.teleportSlug ?? c.teleportSlug,
                    vector: { ...c.vector, ...(r.override?.vector ?? {}) },
                    languages: { ...c.languages, ...(r.override?.languages ?? {}) },
                    costUSD: r.override?.costUSD ? r.override.costUSD : c.costUSD,
                    work: { ...c.work, ...(r.override?.work ?? {}) },
                    regions: undefined,
                };
                expanded.push(merged);
            }
        }
    }

    return expanded;
}

export type MatchGroup = {
    base: MatchResult; // штат/страна без города
    city?: MatchResult; // вариант с городом (Teleport)
    variants?: MatchResult[]; // варианты штатов США
    bestVariant?: MatchResult; // лучший штат США
};

export function matchCountries(
    quiz: QuizConfig,
    answers: AnswerMap,
    user: UserProfile,
    indicesMap: Record<string, CountryIndicesBundle | null>,
    limit = 10
): MatchGroup[] {
    const pref = buildPreferenceProfile(quiz, answers);
    const expanded = expandEntitiesWithRegions(countries);

    const temp: MatchResult[] = [];

    for (const e of expanded) {
        const needed = calcNeededMonthlyUSD(e, user);

        // строгий бюджетный фильтр
        if (user.budget.monthlyUSD < needed) continue;

        const { match100, used } = preferenceMatch100(pref, e.vector);

        // небольшой штраф за “маловато осей” (дополнительно к match100, чтобы пустышки не выигрывали)
        const sparsityPenalty = used < 12 ? 0.85 : 1;

        const lang = languagePenalty(user, e);
        const work = workPenalty(user, e);

        const bundle = indicesMap[e.key];
        const indices = bundle?.normalized;

        const idxBoost = indicesBoost01(indices, pref);
        const live100 = liveScore100(match100, lang.penalty, work.penalty, idxBoost);

        // score: 0..1 for sorting (и применим sparsityPenalty сюда тоже)
        const score = clamp01((live100 / 100) * sparsityPenalty);

        const why = [...lang.notes.slice(0, 2), ...work.notes.slice(0, 1)].filter(Boolean);

        temp.push({
            key: e.key,
            titleKey: e.titleKey,
            fallbackName: e.fallbackName,
            score,
            match100: Math.round(match100),
            live100: Math.round(live100),
            estimatedMonthlyUSD: needed,
            why,
            teleportSlug: (e as any).teleportSlug,
        });
    }

    // ---- группировка base + city + США variants ----

    function baseKeyForResult(key: string) {
        if (key.endsWith(".city")) return key.slice(0, -5);
        if (key.startsWith("countries.usa.")) return "countries.usa";
        return key;
    }

    function isCityKey(key: string) {
        return key.endsWith(".city");
    }

    const map = new Map<string, MatchGroup>();

    for (const r of temp) {
        const gk = baseKeyForResult(r.key);
        const existing = map.get(gk);

        // --- США: одна карточка + варианты штатов внутри ---
        if (gk === "countries.usa") {
            if (!existing) {
                map.set(gk, {
                    base: r.key === "countries.usa" ? r : { ...r, key: "countries.usa" },
                    variants: [],
                });
            }

            const g = map.get(gk)!;

            if (r.key === "countries.usa") {
                g.base = r;
                continue;
            }

            // variants: только базовые штаты без .city
            if (!isCityKey(r.key)) {
                (g.variants ||= []).push(r);
            }

            continue;
        }

        if (!existing) {
            map.set(gk, isCityKey(r.key) ? { base: { ...r, key: gk }, city: r } : { base: r });
            continue;
        }

        if (isCityKey(r.key)) existing.city = r;
        else existing.base = r;
    }

    const groups = Array.from(map.values()).map((g) => {
        if (g.base?.key === "countries.usa" && g.variants?.length) {
            g.variants.sort((a, b) => b.live100 - a.live100);
            g.bestVariant = g.variants[0];
            g.variants = g.variants.slice(0, 6);
        }
        return g;
    });

    // сортировка по live100
    groups.sort((a, b) => {
        const as = Math.max(a.base.live100, a.city?.live100 ?? -Infinity);
        const bs = Math.max(b.base.live100, b.city?.live100 ?? -Infinity);
        return bs - as;
    });

    return groups.slice(0, limit);
}