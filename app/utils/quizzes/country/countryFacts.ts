// Static descriptive facts about each country in countries.ts — geography, the
// majority religion, how many languages daily life realistically runs on, and a
// rough residency-difficulty impression.
//
// Unlike the rest of this quiz's data (vector weights, cost tiers, indices),
// these are NOT sourced from a live API — there is no free, reliable,
// per-country API for "is this seismically active" or "what religion is
// practiced here". They are general-knowledge reference facts (the kind found
// in any standard country almanac), kept deliberately coarse:
//
// - coastline / island / volcanic: objective geography, stable over time.
// - seismicRisk: a rough tier (low/moderate/high), not a hazard-map figure.
// - mainReligion: the single largest reported religious group, as a plain
//   factual label — not a value judgment, and not the only religion practiced.
// - languagesCount: languages realistically encountered in daily/official life
//   (official languages + a widely-used lingua franca), not a linguistic census.
// - residencyDifficulty: a coarse, general impression of how accessible
//   long-term residency/immigration tends to be. This is the softest field
//   here — real difficulty depends enormously on the applicant's nationality,
//   visa category, and current policy, and it changes over time. Treat it as
//   a conversation starter, never as immigration advice.
//
// Only `seismicRisk` and `volcanic` currently feed quiz scoring (the
// disaster_risk_ok axis); everything else is display-only on the result card.

export type SeismicRisk = "low" | "moderate" | "high";
export type ResidencyDifficulty = "easy" | "moderate" | "hard";

export type CountryFacts = {
    coastline: boolean;
    island: boolean;
    seismicRisk: SeismicRisk;
    volcanic: boolean;
    mainReligion: string;
    languagesCount: number;
    residencyDifficulty: ResidencyDifficulty;
};

const f = (
    coastline: boolean,
    island: boolean,
    seismicRisk: SeismicRisk,
    volcanic: boolean,
    mainReligion: string,
    languagesCount: number,
    residencyDifficulty: ResidencyDifficulty,
): CountryFacts => ({coastline, island, seismicRisk, volcanic, mainReligion, languagesCount, residencyDifficulty});

// key (without the "countries." prefix) -> facts
export const COUNTRY_FACTS: Record<string, CountryFacts> = {
    // ---- Post-Soviet / CIS ----
    russia: f(true, false, "moderate", true, "Christian (Orthodox)", 2, "hard"),
    ukraine: f(true, false, "low", false, "Christian (Orthodox)", 2, "moderate"),
    belarus: f(false, false, "low", false, "Christian (Orthodox)", 2, "moderate"),
    moldova: f(false, false, "low", false, "Christian (Orthodox)", 2, "moderate"),
    kazakhstan: f(false, false, "moderate", false, "Muslim (Sunni)", 3, "moderate"),
    uzbekistan: f(false, false, "moderate", false, "Muslim (Sunni)", 3, "moderate"),
    kyrgyzstan: f(false, false, "high", false, "Muslim (Sunni)", 2, "moderate"),
    armenia: f(false, false, "high", false, "Christian (Apostolic)", 2, "moderate"),
    azerbaijan: f(true, false, "moderate", true, "Muslim (Shia)", 2, "hard"),
    georgia: f(true, false, "moderate", false, "Christian (Orthodox)", 2, "easy"),

    // ---- Western / Northern Europe ----
    germany: f(true, false, "low", false, "Christian (mixed Catholic/Protestant)", 2, "moderate"),
    austria: f(false, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    switzerland: f(false, false, "low", false, "Christian (mixed Catholic/Protestant)", 4, "hard"),
    france: f(true, false, "low", true, "Christian (Catholic, largely secular)", 2, "moderate"),
    belgium: f(true, false, "low", false, "Christian (Catholic)", 3, "moderate"),
    netherlands: f(true, false, "low", false, "Christian (largely secular)", 2, "moderate"),
    luxembourg: f(false, false, "low", false, "Christian (Catholic)", 3, "easy"),
    ireland: f(true, true, "low", false, "Christian (Catholic)", 2, "easy"),
    uk: f(true, true, "low", false, "Christian (Anglican/Catholic, largely secular)", 2, "hard"),
    guernsey: f(true, true, "low", false, "Christian (Anglican)", 2, "hard"),
    jersey: f(true, true, "low", false, "Christian (Anglican)", 2, "hard"),
    isle_of_man: f(true, true, "low", false, "Christian (Anglican)", 2, "hard"),
    iceland: f(true, true, "high", true, "Christian (Lutheran)", 2, "moderate"),
    denmark: f(true, true, "low", false, "Christian (Lutheran)", 2, "moderate"),
    norway: f(true, false, "low", false, "Christian (Lutheran)", 2, "hard"),
    sweden: f(true, false, "low", false, "Christian (Lutheran, largely secular)", 2, "moderate"),
    finland: f(true, false, "low", false, "Christian (Lutheran)", 3, "moderate"),
    andorra: f(false, false, "low", false, "Christian (Catholic)", 3, "hard"),
    gibraltar: f(true, false, "low", false, "Christian (Catholic)", 2, "hard"),

    // ---- Southern Europe ----
    spain: f(true, false, "moderate", true, "Christian (Catholic)", 2, "moderate"),
    portugal: f(true, false, "moderate", true, "Christian (Catholic)", 2, "easy"),
    italy: f(true, true, "high", true, "Christian (Catholic)", 2, "moderate"),
    greece: f(true, true, "high", true, "Christian (Orthodox)", 2, "moderate"),
    malta: f(true, true, "low", false, "Christian (Catholic)", 2, "moderate"),
    cyprus: f(true, true, "moderate", false, "Christian (Orthodox)", 2, "moderate"),

    // ---- Central & Eastern Europe / Balkans ----
    poland: f(true, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    czechia: f(false, false, "low", false, "Christian (largely secular)", 2, "moderate"),
    slovakia: f(false, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    hungary: f(false, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    slovenia: f(true, false, "moderate", false, "Christian (Catholic)", 2, "moderate"),
    croatia: f(true, true, "moderate", false, "Christian (Catholic)", 2, "moderate"),
    bosnia_and_herzegovina: f(true, false, "moderate", false, "Muslim (Sunni)", 2, "moderate"),
    serbia: f(false, false, "moderate", false, "Christian (Orthodox)", 2, "moderate"),
    north_macedonia: f(false, false, "moderate", false, "Christian (Orthodox)", 2, "moderate"),
    kosovo: f(false, false, "moderate", false, "Muslim (Sunni)", 2, "moderate"),
    albania: f(true, false, "high", false, "Muslim (Sunni)", 2, "moderate"),
    bulgaria: f(true, false, "moderate", false, "Christian (Orthodox)", 2, "moderate"),
    romania: f(true, false, "moderate", false, "Christian (Orthodox)", 2, "moderate"),
    estonia: f(true, false, "low", false, "Christian (largely secular)", 3, "moderate"),
    latvia: f(true, false, "low", false, "Christian (largely secular)", 3, "moderate"),
    lithuania: f(true, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    turkey: f(true, false, "high", true, "Muslim (Sunni)", 2, "moderate"),

    // ---- North America ----
    usa: f(true, false, "moderate", true, "Christian (Protestant/Catholic)", 2, "hard"),
    canada: f(true, false, "moderate", true, "Christian (Catholic/Protestant)", 2, "moderate"),
    mexico: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),

    // ---- Central America / Caribbean ----
    costa_rica: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    panama: f(true, false, "moderate", true, "Christian (Catholic)", 2, "moderate"),
    honduras: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    nicaragua: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    belize: f(true, false, "low", false, "Christian (Catholic)", 3, "moderate"),
    jamaica: f(true, true, "moderate", false, "Christian (Protestant)", 2, "moderate"),
    bahamas: f(true, true, "low", false, "Christian (Protestant)", 2, "moderate"),
    dominican_republic: f(true, true, "moderate", true, "Christian (Catholic)", 2, "moderate"),
    trinidad_and_tobago: f(true, true, "low", false, "Christian (mixed) / Hindu minority", 2, "moderate"),
    grenada: f(true, true, "low", true, "Christian (Catholic)", 2, "moderate"),
    cayman_islands: f(true, true, "low", false, "Christian (Protestant)", 2, "hard"),
    bermuda: f(true, true, "low", false, "Christian (Protestant)", 2, "hard"),
    us_virgin_islands: f(true, true, "moderate", false, "Christian (Protestant)", 2, "hard"),
    puerto_rico: f(true, true, "moderate", false, "Christian (Catholic)", 2, "moderate"),
    guyana: f(true, false, "low", false, "Christian / Hindu / Muslim (mixed)", 2, "moderate"),

    // ---- South America ----
    brazil: f(true, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    argentina: f(true, false, "moderate", true, "Christian (Catholic)", 2, "moderate"),
    chile: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    colombia: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    peru: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    ecuador: f(true, false, "high", true, "Christian (Catholic)", 2, "moderate"),
    uruguay: f(true, false, "low", false, "Christian (largely secular)", 2, "moderate"),
    paraguay: f(false, false, "low", false, "Christian (Catholic)", 2, "moderate"),
    venezuela: f(true, false, "moderate", true, "Christian (Catholic)", 2, "hard"),

    // ---- Middle East ----
    israel: f(true, false, "moderate", false, "Jewish (majority) / Muslim minority", 2, "hard"),
    palestine: f(true, false, "moderate", false, "Muslim (Sunni)", 2, "hard"),
    lebanon: f(true, false, "high", false, "Muslim/Christian (mixed)", 2, "moderate"),
    jordan: f(false, false, "moderate", false, "Muslim (Sunni)", 2, "moderate"),
    syria: f(true, false, "high", false, "Muslim (Sunni)", 2, "hard"),
    iraq: f(false, false, "moderate", false, "Muslim (Shia/Sunni)", 2, "hard"),
    iran: f(true, false, "high", true, "Muslim (Shia)", 2, "hard"),
    saudi_arabia: f(true, false, "low", true, "Muslim (Sunni)", 2, "hard"),
    uae: f(true, false, "low", false, "Muslim (Sunni)", 2, "moderate"),
    qatar: f(true, false, "low", false, "Muslim (Sunni)", 2, "hard"),
    kuwait: f(true, false, "low", false, "Muslim (Sunni)", 2, "hard"),
    bahrain: f(true, true, "low", false, "Muslim (Shia/Sunni)", 2, "hard"),
    oman: f(true, false, "low", true, "Muslim (Ibadi)", 2, "hard"),
    yemen: f(true, false, "moderate", true, "Muslim (Sunni/Shia)", 2, "hard"),

    // ---- Africa ----
    egypt: f(true, false, "moderate", false, "Muslim (Sunni)", 2, "moderate"),
    morocco: f(true, false, "high", false, "Muslim (Sunni)", 3, "moderate"),
    tunisia: f(true, false, "moderate", false, "Muslim (Sunni)", 2, "moderate"),
    libya: f(true, false, "low", false, "Muslim (Sunni)", 2, "hard"),
    nigeria: f(true, false, "low", true, "Muslim (north) / Christian (south)", 2, "hard"),
    ghana: f(true, false, "low", false, "Christian", 2, "moderate"),
    ivory_coast: f(true, false, "low", false, "Muslim/Christian (mixed)", 2, "moderate"),
    senegal: f(true, false, "low", false, "Muslim (Sunni)", 2, "moderate"),
    cameroon: f(true, false, "low", true, "Christian/Muslim (mixed)", 2, "moderate"),
    kenya: f(true, false, "low", true, "Christian", 2, "moderate"),
    tanzania: f(true, false, "moderate", true, "Christian/Muslim (mixed)", 2, "moderate"),
    uganda: f(false, false, "moderate", true, "Christian", 2, "moderate"),
    rwanda: f(false, false, "low", true, "Christian (Catholic)", 2, "moderate"),
    ethiopia: f(false, false, "moderate", true, "Christian (Orthodox)/Muslim", 2, "hard"),
    madagascar: f(true, true, "low", true, "Christian/traditional beliefs (mixed)", 2, "moderate"),
    zambia: f(false, false, "low", false, "Christian", 2, "moderate"),
    zimbabwe: f(false, false, "low", true, "Christian", 2, "hard"),
    namibia: f(true, false, "low", false, "Christian (Protestant)", 2, "moderate"),
    south_africa: f(true, false, "low", false, "Christian (Protestant)", 3, "moderate"),
    mozambique: f(true, false, "low", true, "Christian/Muslim (mixed)", 2, "moderate"),
    angola: f(true, false, "low", false, "Christian (Catholic)", 2, "hard"),

    // ---- South & Central Asia ----
    india: f(true, false, "moderate", false, "Hindu", 3, "hard"),
    pakistan: f(true, false, "high", false, "Muslim (Sunni)", 2, "hard"),
    bangladesh: f(true, false, "moderate", false, "Muslim (Sunni)", 2, "hard"),
    nepal: f(false, false, "high", false, "Hindu", 2, "moderate"),
    sri_lanka: f(true, true, "low", false, "Buddhist", 2, "moderate"),
    afghanistan: f(false, false, "high", false, "Muslim (Sunni)", 2, "hard"),
    maldives: f(true, true, "low", false, "Muslim (Sunni)", 2, "hard"),

    // ---- East & Southeast Asia ----
    china: f(true, false, "high", true, "Buddhist/folk religion (largely secular)", 2, "hard"),
    japan: f(true, true, "high", true, "Shinto/Buddhist (largely secular)", 2, "hard"),
    south_korea: f(true, false, "moderate", false, "Christian/Buddhist (largely secular)", 2, "hard"),
    taiwan: f(true, true, "high", true, "Buddhist/Taoist", 2, "moderate"),
    hong_kong: f(true, true, "low", false, "Buddhist/Taoist (largely secular)", 2, "moderate"),
    macao: f(true, false, "low", false, "Buddhist/folk religion", 2, "hard"),
    singapore: f(true, true, "low", false, "Buddhist (multi-religious)", 3, "hard"),
    malaysia: f(true, false, "moderate", true, "Muslim (Sunni)", 3, "moderate"),
    indonesia: f(true, true, "high", true, "Muslim (Sunni)", 2, "moderate"),
    philippines: f(true, true, "high", true, "Christian (Catholic)", 2, "moderate"),
    thailand: f(true, false, "low", false, "Buddhist", 2, "moderate"),
    vietnam: f(true, false, "low", false, "Buddhist/folk religion (largely secular)", 2, "moderate"),
    myanmar: f(true, false, "high", true, "Buddhist", 2, "hard"),
    brunei: f(true, false, "low", false, "Muslim (Sunni)", 2, "hard"),
    papua_new_guinea: f(true, true, "high", true, "Christian (Protestant)", 2, "moderate"),
    solomon_islands: f(true, true, "high", true, "Christian (Protestant)", 2, "moderate"),

    // ---- Oceania ----
    australia: f(true, true, "low", false, "Christian (largely secular)", 2, "moderate"),
    new_zealand: f(true, true, "high", true, "Christian (largely secular)", 2, "moderate"),
    seychelles: f(true, true, "low", false, "Christian (Catholic)", 3, "moderate"),
};

export function countryFactsFor(key: string): CountryFacts | null {
    const short = key.startsWith("countries.") ? key.slice("countries.".length) : key;
    // US state variants (countries.usa.tx, .city) share the country-level facts.
    const base = short.split(".")[0]!;
    return COUNTRY_FACTS[base] ?? null;
}
