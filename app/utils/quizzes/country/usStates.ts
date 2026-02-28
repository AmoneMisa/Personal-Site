export type USRegion = {
    code: string;       // "ca"
    titleKey: string;   // "regions.usa.ca"
    fallbackName: string;
    teleportSlug?: string;
};

export const usRegions: USRegion[] = [
    { code: "al", titleKey: "regions.usa.al", fallbackName: "Alabama", teleportSlug: "birmingham-al" },
    { code: "ak", titleKey: "regions.usa.ak", fallbackName: "Alaska", teleportSlug: "anchorage" },
    { code: "az", titleKey: "regions.usa.az", fallbackName: "Arizona", teleportSlug: "phoenix" },
    { code: "ar", titleKey: "regions.usa.ar", fallbackName: "Arkansas", teleportSlug: "little-rock" },

    // California — можно выбрать одну “главную” агломерацию.
    // Я ставлю Bay Area, потому что Teleport точно её любит.
    { code: "ca", titleKey: "regions.usa.ca", fallbackName: "California", teleportSlug: "san-francisco-bay-area" },

    { code: "co", titleKey: "regions.usa.co", fallbackName: "Colorado", teleportSlug: "denver" },
    { code: "ct", titleKey: "regions.usa.ct", fallbackName: "Connecticut", teleportSlug: "hartford" },
    { code: "de", titleKey: "regions.usa.de", fallbackName: "Delaware", teleportSlug: "wilmington" },
    { code: "fl", titleKey: "regions.usa.fl", fallbackName: "Florida", teleportSlug: "miami" },
    { code: "ga", titleKey: "regions.usa.ga", fallbackName: "Georgia", teleportSlug: "atlanta" },
    { code: "hi", titleKey: "regions.usa.hi", fallbackName: "Hawaii", teleportSlug: "honolulu" },
    { code: "id", titleKey: "regions.usa.id", fallbackName: "Idaho", teleportSlug: "boise" },
    { code: "il", titleKey: "regions.usa.il", fallbackName: "Illinois", teleportSlug: "chicago" },
    { code: "in", titleKey: "regions.usa.in", fallbackName: "Indiana", teleportSlug: "indianapolis" },
    { code: "ia", titleKey: "regions.usa.ia", fallbackName: "Iowa", teleportSlug: "des-moines" },
    { code: "ks", titleKey: "regions.usa.ks", fallbackName: "Kansas", teleportSlug: "wichita" },
    { code: "ky", titleKey: "regions.usa.ky", fallbackName: "Kentucky", teleportSlug: "louisville" },
    { code: "la", titleKey: "regions.usa.la", fallbackName: "Louisiana", teleportSlug: "new-orleans" },
    { code: "me", titleKey: "regions.usa.me", fallbackName: "Maine", teleportSlug: "portland-me" },
    { code: "md", titleKey: "regions.usa.md", fallbackName: "Maryland", teleportSlug: "baltimore" },
    { code: "ma", titleKey: "regions.usa.ma", fallbackName: "Massachusetts", teleportSlug: "boston" },
    { code: "mi", titleKey: "regions.usa.mi", fallbackName: "Michigan", teleportSlug: "detroit" },
    { code: "mn", titleKey: "regions.usa.mn", fallbackName: "Minnesota", teleportSlug: "minneapolis-saint-paul" },
    { code: "ms", titleKey: "regions.usa.ms", fallbackName: "Mississippi", teleportSlug: "jackson-ms" },
    { code: "mo", titleKey: "regions.usa.mo", fallbackName: "Missouri", teleportSlug: "st-louis" },
    { code: "mt", titleKey: "regions.usa.mt", fallbackName: "Montana", teleportSlug: "billings" },
    { code: "ne", titleKey: "regions.usa.ne", fallbackName: "Nebraska", teleportSlug: "omaha" },
    { code: "nv", titleKey: "regions.usa.nv", fallbackName: "Nevada", teleportSlug: "las-vegas" },
    { code: "nh", titleKey: "regions.usa.nh", fallbackName: "New Hampshire", teleportSlug: "manchester-nh" },
    { code: "nj", titleKey: "regions.usa.nj", fallbackName: "New Jersey", teleportSlug: "new-york" }, // NJ “паразитирует” на NY metro
    { code: "nm", titleKey: "regions.usa.nm", fallbackName: "New Mexico", teleportSlug: "albuquerque" },
    { code: "ny", titleKey: "regions.usa.ny", fallbackName: "New York", teleportSlug: "new-york" },
    { code: "nc", titleKey: "regions.usa.nc", fallbackName: "North Carolina", teleportSlug: "charlotte" },
    { code: "nd", titleKey: "regions.usa.nd", fallbackName: "North Dakota", teleportSlug: "fargo" },
    { code: "oh", titleKey: "regions.usa.oh", fallbackName: "Ohio", teleportSlug: "columbus" },
    { code: "ok", titleKey: "regions.usa.ok", fallbackName: "Oklahoma", teleportSlug: "oklahoma-city" },
    { code: "or", titleKey: "regions.usa.or", fallbackName: "Oregon", teleportSlug: "portland-or" },
    { code: "pa", titleKey: "regions.usa.pa", fallbackName: "Pennsylvania", teleportSlug: "philadelphia" },
    { code: "ri", titleKey: "regions.usa.ri", fallbackName: "Rhode Island", teleportSlug: "providence" },
    { code: "sc", titleKey: "regions.usa.sc", fallbackName: "South Carolina", teleportSlug: "charleston" },
    { code: "sd", titleKey: "regions.usa.sd", fallbackName: "South Dakota", teleportSlug: "sioux-falls" },
    { code: "tn", titleKey: "regions.usa.tn", fallbackName: "Tennessee", teleportSlug: "nashville" },

    // Texas — можно выбрать Austin как “тех-столицу” (для удалёнщиков ок)
    { code: "tx", titleKey: "regions.usa.tx", fallbackName: "Texas", teleportSlug: "austin" },

    { code: "ut", titleKey: "regions.usa.ut", fallbackName: "Utah", teleportSlug: "salt-lake-city" },
    { code: "vt", titleKey: "regions.usa.vt", fallbackName: "Vermont", teleportSlug: "burlington" },
    { code: "va", titleKey: "regions.usa.va", fallbackName: "Virginia", teleportSlug: "washington-dc" }, // metro DC
    { code: "wa", titleKey: "regions.usa.wa", fallbackName: "Washington", teleportSlug: "seattle" },
    { code: "wv", titleKey: "regions.usa.wv", fallbackName: "West Virginia", teleportSlug: "charleston-wv" },
    { code: "wi", titleKey: "regions.usa.wi", fallbackName: "Wisconsin", teleportSlug: "milwaukee" },
    { code: "wy", titleKey: "regions.usa.wy", fallbackName: "Wyoming", teleportSlug: "cheyenne" },

    { code: "dc", titleKey: "regions.usa.dc", fallbackName: "Washington, D.C.", teleportSlug: "washington-dc" }
];