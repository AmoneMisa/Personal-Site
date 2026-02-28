import type {AxisKey, Effects, QuizConfig} from "~/utils/quizzes/country/countryFit";
import type {CountryEntity, Vector} from "~/utils/quizzes/country/countries";
import {countries} from "~/utils/quizzes/country/countries";
import type {CountryIndicesBundle} from "~/types/indices";
import {usStateVectorOverrides} from "~/composables/usStateVectorOverrides";

export type LanguageLevel = "native" | "fluent" | "intermediate" | "basic" | "none";
export type JobType = "remote" | "local" | "mixed";
export type FamilyStatus = "single" | "couple" | "couple_with_kids" | "single_parent";

export type UserProfile = {
    job: { type: JobType; regulated?: boolean };
    languages: { ru: LanguageLevel; en: LanguageLevel };
    family: { status: FamilyStatus; kidsCount: number };
    budget: { monthlyUSD: number; includesRent: boolean };
};

export type AnswerMap = Record<string, string>;

export type MatchResult = {
    key: string;
    titleKey: string;
    fallbackName: string;
    score: number;       // internal sort score
    match100: number;    // 0..100 preference match
    live100: number;     // 0..100 living score
    estimatedMonthlyUSD: number;
    why: string[];
    teleportSlug?: string;
};

export type MatchGroup = {
    base: MatchResult;
    city?: MatchResult;
    variants?: MatchResult[];
    bestVariant?: MatchResult;
};

export type MatchOptions = {
    selectedUSAStates?: string[];
    selectedCountries?: string[];
    usaVariantsLimit?: number;
};

function normalizeUsStateKey(s: string) {
    const v = String(s || "").trim().toLowerCase();
    if (!v) return "";
    if (v.startsWith("countries.usa.")) return v;
    return `countries.usa.${v}`;
}

function pinUsStateKeys(selectedUSAStates?: string[]) {
    const out = new Set<string>();
    for (const s of selectedUSAStates ?? []) {
        const key = normalizeUsStateKey(s);
        if (key) out.add(key);
    }
    return out;
}

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

const prefToW33 = (prefVal: number) => clamp((prefVal / 30) * 3, -3, 3);              // -30..30 -> -3..3
const countryToW33 = (target03: number) => clamp(((target03 - 1.5) / 1.5) * 3, -3, 3); // 0..3 -> -3..3

function vectorDistance(preferences: Record<AxisKey, number>, v: Vector): { distance: number; used: number } {
    let dist = 0;
    let used = 0;

    for (const [axis, prefValRaw] of Object.entries(preferences) as Array<[AxisKey, number]>) {
        const target03 = v[axis];
        if (typeof target03 !== "number") continue;

        const pref = prefToW33(prefValRaw);
        const target = countryToW33(target03);

        dist += Math.abs(pref - target); // 0..6
        used++;
    }

    return {distance: dist, used};
}

function matchFromDistance(distance: number, used: number) {
    // avg dist: 0..6 => match: 1..0
    if (!used) return 20;
    const avg = distance / used; // 0..6
    const m01 = clamp(1 - (avg / 6), 0, 1);
    return Math.round(m01 * 100);
}

function languagePenalty(user: UserProfile, entity: CountryEntity): { penalty: number; notes: string[] } {
    const ru = levelToNum(user.languages.ru);
    const en = levelToNum(user.languages.en);

    const englishOk = entity.languages.english;
    const noLocal = entity.languages.noLocalLanguagePenalty;

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

    return {penalty, notes};
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
                    vector: {...c.vector, ...(r.override?.vector ?? {}), ...(usStateVectorOverrides[r.key] ?? {})},
                    languages: {...c.languages, ...(r.override?.languages ?? {})},
                    costUSD: r.override?.costUSD ? r.override.costUSD : c.costUSD,
                    work: {...c.work, ...(r.override?.work ?? {})},
                    regions: undefined,
                };
                expanded.push(merged);
            }
        }
    }

    return expanded;
}

// ---------------------
// score helpers
// ---------------------
const to100 = (v01: number) => Math.round(clamp(v01, 0, 1) * 100);

function importance01(prefVal: number | undefined) {
    // pref is -30..30. We treat only positive as "important"
    return clamp((prefVal ?? 0) / 30, 0, 1);
}

function liveScore100(user: UserProfile, pref: Record<AxisKey, number>, indices?: CountryIndicesBundle["normalized"]) {
    // Base = average of available weighted indices
    // We only use indices where we have a clear, non-invented mapping:
    // income_growth_need -> income
    // quality_high_need  -> qualityOfLife
    // safety_need        -> safety
    // remote job         -> internet
    const parts: Array<{ w: number; v: number }> = [];

    if (indices?.income != null) {
        const w = importance01(pref.income_growth_need);
        if (w > 0) parts.push({w, v: indices.income / 10});
    }

    if (indices?.qualityOfLife != null) {
        const w = importance01(pref.quality_high_need);
        if (w > 0) parts.push({w, v: indices.qualityOfLife / 10});
    }

    if (indices?.safety != null) {
        const w = importance01(pref.safety_need);
        if (w > 0) parts.push({w, v: indices.safety / 10});
    }

    if (user.job.type === "remote" && indices?.internet != null) {
        // not preference-based (no axis), but job constraint-based.
        parts.push({w: 0.5, v: indices.internet / 10});
    }

    if (!parts.length) return 50; // neutral if nothing known

    const sumW = parts.reduce((a, p) => a + p.w, 0);
    const sumWV = parts.reduce((a, p) => a + p.w * p.v, 0);
    return to100(sumWV / (sumW || 1));
}

// ---------------------
// grouping helpers
// ---------------------
function baseKeyForResult(key: string) {
    if (key.endsWith(".city")) return key.slice(0, -5);
    if (key.startsWith("countries.usa.")) return "countries.usa";
    return key;
}

function isCityKey(key: string) {
    return key.endsWith(".city");
}

function isUsStateVariantKey(key: string) {
    // countries.usa.xx (NOT .city)
    const parts = key.split(".");
    return parts.length === 3 && parts[0] === "countries" && parts[1] === "usa";
}

export function matchCountries(
    quiz: QuizConfig,
    answers: AnswerMap,
    user: UserProfile,
    indicesMap: Record<string, CountryIndicesBundle | null>,
    limit = 10,
    opts: MatchOptions = {}
): MatchGroup[] {
    const pref = buildPreferenceProfile(quiz, answers);
    const expanded = expandEntitiesWithRegions(countries);

    const temp: MatchResult[] = [];
    const selectedCountrySet = new Set((opts.selectedCountries ?? []).filter(Boolean));
    const pinnedUsStates = pinUsStateKeys(opts.selectedUSAStates);
    const usaVariantsLimit = opts.usaVariantsLimit ?? 6;

    for (const e of expanded) {
        const needed = calcNeededMonthlyUSD(e, user);

        if (user.budget.monthlyUSD < needed) continue;

        const {distance, used} = vectorDistance(pref, e.vector);
        const match100 = matchFromDistance(distance, used);

        const base01 = used > 0 ? (1 / (1 + (distance / used))) : 0.2;
        const sparsityPenalty = used < quiz.axes.length ? 0.85 : 1;

        const lang = languagePenalty(user, e);
        const work = workPenalty(user, e);

        const bundle = indicesMap[e.key];
        const indices = bundle?.normalized;

        let score = base01 * sparsityPenalty - (lang.penalty + work.penalty) * 0.05;

        const live100 = liveScore100(user, pref, indices);

        const why = [...lang.notes.slice(0, 2), ...work.notes.slice(0, 1)].filter(Boolean);

        if (selectedCountrySet.has(e.key)) score += 0.0001;

        temp.push({
            key: e.key,
            titleKey: e.titleKey,
            fallbackName: e.fallbackName,
            score,
            match100,
            live100,
            estimatedMonthlyUSD: needed,
            why,
            teleportSlug: (e as any).teleportSlug,
        });
    }

    const map = new Map<string, MatchGroup>();

    for (const r of temp) {
        const gk = baseKeyForResult(r.key);
        const existing = map.get(gk);

        if (gk === "countries.usa") {
            if (!existing) {
                map.set(gk, {base: r.key === "countries.usa" ? r : {...r, key: "countries.usa"}, variants: []});
            }
            const g = map.get(gk)!;

            if (r.key === "countries.usa") {
                g.base = r;
                continue;
            }

            if (isUsStateVariantKey(r.key)) {
                (g.variants ||= []).push(r);
            }
            continue;
        }

        if (!existing) {
            map.set(gk, isCityKey(r.key) ? {base: {...r, key: gk}, city: r} : {base: r});
            continue;
        }

        if (isCityKey(r.key)) existing.city = r;
        else existing.base = r;
    }

    // finalize groups
    let groups = Array.from(map.values());

    // USA variants: sort, take top N, but ensure pinned states are present
    for (const g of groups) {
        if (g.base.key !== "countries.usa") continue;

        const variants = (g.variants ?? []).slice().sort((a, b) => b.score - a.score);

        const top = variants.slice(0, usaVariantsLimit);
        const topKeys = new Set(top.map(x => x.key));

        // add pinned states (if exist in variants list)
        if (pinnedUsStates.size) {
            for (const v of variants) {
                if (!pinnedUsStates.has(v.key)) continue;
                if (topKeys.has(v.key)) continue;
                top.push(v);
                topKeys.add(v.key);
                if (top.length >= usaVariantsLimit) break; // keep exactly N visible
            }

            // if pinned replaced some, re-sort by score but keep size
            top.sort((a, b) => b.score - a.score);
        }

        g.variants = top.slice(0, usaVariantsLimit);
        g.bestVariant = g.variants[0];
    }

    // Sorting groups: by best internal score
    groups.sort((a, b) => {
        const as = Math.max(a.base.score, a.city?.score ?? -Infinity);
        const bs = Math.max(b.base.score, b.city?.score ?? -Infinity);
        return bs - as;
    });

    // Ensure selected countries appear (pin into output)
    if (selectedCountrySet.size) {
        const existingKeys = new Set(groups.map(g => g.base.key));
        for (const k of selectedCountrySet) {
            if (existingKeys.has(k)) continue;

            // try to find it in map by its baseKey
            const g = map.get(baseKeyForResult(k));
            if (g) {
                groups.unshift(g);
                existingKeys.add(g.base.key);
            }
        }
    }

    return groups.slice(0, limit);
}