import type {AxisKey, QuizConfig, Effects} from "~/utils/quizzes/country/countryFit";
import type {CountryEntity, Vector} from "~/utils/quizzes/country/countries";
import {countries} from "~/utils/quizzes/country/countries";
import type {CountryIndicesBundle} from "~/types/indices";

export type LanguageLevel = "native" | "fluent" | "intermediate" | "basic" | "none";
export type JobType = "remote" | "local" | "mixed";
export type FamilyStatus = "single" | "couple" | "couple_with_kids" | "single_parent";

const toW33 = (v10: number) => ((v10 - 5) / 5) * 3;

export type UserProfile = {
    job: {
        type: JobType;
        regulated?: boolean; // если потом понадобится
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
        includesRent: boolean; // пока просто флаг
    };
};

export type AnswerMap = Record<string /* questionId */, string /* optionId */>;

export type MatchResult = {
    key: string;
    titleKey: string;
    fallbackName: string;
    score: number;
    estimatedMonthlyUSD: number;
    why: string[];
    teleportSlug?: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

const initScores = (axes: AxisKey[]) => Object.fromEntries(axes.map(a => [a, 0])) as Record<AxisKey, number>;

export function buildPreferenceProfile(quiz: QuizConfig, answers: AnswerMap): Record<AxisKey, number> {
    const scores = initScores(quiz.axes);

    for (const q of quiz.questions) {
        const optionId = answers[q.id];
        if (!optionId) continue;

        const opt = q.options.find(o => o.id === optionId);
        if (!opt) continue;

        applyEffects(scores, opt.effects);
    }

    // нормализация (чтобы не улетало слишком высоко): -99..99, но реально у нас будет около 0..~60
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

/**
 * Вектор страны может быть неполный — считаем только по пересечению осей,
 * но при этом добавляем небольшой штраф, чтобы пустые профили не побеждали.
 */
function vectorDistance(preferences: Record<AxisKey, number>, v: Vector): { distance: number; used: number } {
    let dist = 0;
    let used = 0;

    for (const [axis, prefVal] of Object.entries(preferences) as Array<[AxisKey, number]>) {
        const target = v[axis];
        if (typeof target !== "number") continue;

        // preferences у нас примерно -30..30, а страна 0..3
        // приводим preference к 0..3 через сигмоиду/сжатие (простая функция)
        const pref01 = clamp((prefVal + 30) / 60, 0, 1);
        const prefScaled = pref01 * 3;

        dist += Math.abs(prefScaled - target);
        used++;
    }

    return {distance: dist, used};
}

function languagePenalty(user: UserProfile, entity: CountryEntity): { penalty: number; notes: string[] } {
    const ru = levelToNum(user.languages.ru);
    const en = levelToNum(user.languages.en);

    // Если человек не знает английский/местный, то зависим от “noLocalLanguagePenalty” и доступности английского
    const englishOk = entity.languages.english; // 0..3
    const noLocal = entity.languages.noLocalLanguagePenalty; // 0..3

    let penalty = 0;
    const notes: string[] = [];

    // Хотим минимальный барьер: если у пользователя EN низкий, а у страны EN тоже низкий => боль.
    if (en <= 1 && englishOk <= 1 && noLocal <= 1) {
        penalty += 2.5;
        notes.push("С языками может быть тяжело");
    } else if (en <= 1 && englishOk <= 1) {
        penalty += 1.5;
        notes.push("Английского может не хватить");
    }

    // Русский как бонус (не штраф)
    if (ru >= 2 && entity.languages.russian >= 2) {
        notes.push("Русский встречается достаточно часто");
    }

    return {penalty, notes};
}

function workPenalty(user: UserProfile, entity: CountryEntity): { penalty: number; notes: string[] } {
    const notes: string[] = [];
    let penalty = 0;

    if (user.job.type === "remote") {
        // remoteFriendly 0..3: если низко, небольшой штраф
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

    return {penalty, notes};
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
                    vector: {...c.vector, ...(r.override?.vector ?? {})},
                    languages: {...c.languages, ...(r.override?.languages ?? {})},
                    costUSD: r.override?.costUSD ? r.override.costUSD : c.costUSD,
                    work: {...c.work, ...(r.override?.work ?? {})},
                    regions: undefined
                };
                expanded.push(merged);
            }
        }
    }

    return expanded;
}

function groupKey(key: string) {
    return key.endsWith(".city") ? key.slice(0, -5) : key;
}

export type MatchGroup = {
    base: MatchResult;         // штат/страна без города
    city?: MatchResult;        // вариант с городом (Teleport)
    variants?: MatchResult[];        // вариант с городом (Teleport)
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

        // бюджетный фильтр — пока строгий (можешь потом заменить на мягкий штраф)
        if (user.budget.monthlyUSD < needed) continue;

        const {distance, used} = vectorDistance(pref, e.vector);

        const base = used > 0 ? (1 / (1 + distance / used)) : 0.2;
        const sparsityPenalty = used < 12 ? 0.85 : 1;

        const lang = languagePenalty(user, e);
        const work = workPenalty(user, e);

        const bundle = indicesMap[e.key];
        const indices = bundle?.normalized;
        let final = base * sparsityPenalty - (lang.penalty + work.penalty) * 0.05;

        if (indices?.income != null && (pref.income_growth_need ?? 0) > 0) {
            const w = toW33(indices.income); // -3..+3
            // pref.income_growth_need у тебя тоже -30..30, поэтому нормализуем до 0..1
            const importance = clamp((pref.income_growth_need ?? 0) / 30, 0, 1);
            final += w * importance * 0.5; // 0.5 — коэффициент влияния (подкрутишь)
        }

// qualityOfLife: если важнее качество
        if (indices?.qualityOfLife != null && (pref.quality_high_need ?? 0) > 0) {
            const w = toW33(indices.qualityOfLife); // -3..+3
            const importance = clamp((pref.quality_high_need ?? 0) / 30, 0, 1);
            final += w * importance * 0.5;
        }

        const why = [
            ...lang.notes.slice(0, 2),
            ...work.notes.slice(0, 1)
        ].filter(Boolean);

        temp.push({
            key: e.key,
            titleKey: e.titleKey,
            fallbackName: e.fallbackName,
            score: final,
            estimatedMonthlyUSD: needed,
            why,
            teleportSlug: (e as any).teleportSlug // если тип уже расширен — убери any
        });
    }

    // ---- группировка base + city в одну карточку ----
    function isUsVariant(key: string) {
        return key === "countries.usa" || key.startsWith("countries.usa.");
    }

    function baseKeyForResult(key: string) {
        // сводим ".city" к базовому
        if (key.endsWith(".city")) return key.slice(0, -5);

        // все usa.* группируем под countries.usa
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

        // --- США: base = countries.usa, а все штаты -> variants ---
        if (gk === "countries.usa") {
            if (!existing) {
                map.set(gk, { base: r.key === "countries.usa" ? r : { ...r, key: "countries.usa" }, variants: [] });
            }

            const g = map.get(gk)!;

            if (r.key === "countries.usa") {
                g.base = r;
                continue;
            }

            // сюда попадут states и state.city
            // мы хотим variants только для базового штата (без .city),
            // а city оставим для конкретного штата уже в UI (или можно тоже хранить отдельно)
            if (!isCityKey(r.key)) {
                (g.variants ||= []).push(r);
            }

            // можно дополнительно: если хочешь лучший city-результат США — держи его тут:
            // if (isCityKey(r.key) && (!g.city || r.score > g.city.score)) g.city = r;

            continue;
        }

        if (!existing) {
            map.set(gk, isCityKey(r.key) ? { base: { ...r, key: gk }, city: r } : { base: r });
            continue;
        }

        if (isCityKey(r.key)) existing.city = r;
        else existing.base = r;
    }

    const groups = Array.from(map.values()).map(g => {
        if (g.base?.key === "countries.usa" && g.variants?.length) {
            g.variants.sort((a, b) => b.score - a.score);
            g.variants = g.variants.slice(0, 6);
        }
        return g;
    });

// сортировка групп по score
    groups.sort((a, b) => {
        const as = Math.max(a.base.score, a.city?.score ?? -Infinity);
        const bs = Math.max(b.base.score, b.city?.score ?? -Infinity);
        return bs - as;
    });

    return groups.slice(0, limit);
}