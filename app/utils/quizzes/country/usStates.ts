export type CostTier = "low" | "mid" | "high" | "very_high";

export type MonthlyUSD = {
    single: number;
    couple: number;
    perKid: number;
};

export type USRegion = {
    code: string;
    titleKey: string;
    fallbackName: string;
    teleportSlug?: string;
    tier?: CostTier;
    monthly?: MonthlyUSD;
    prices?: any;
};

export const usRegions: USRegion[] = [
    {
        code: "al", titleKey: "regions.usa.al", fallbackName: "Alabama", teleportSlug: "birmingham-al", tier: "low",
        monthly: {
            single: 1820,
            couple: 2730,
            perKid: 455
        },
        prices: {
            salaryNetMonthly: 3515.53,
            rent1brCenter: 1179.80,
            rent1brOutside: 913.32,
            rent3brCenter: 1829.58,
            rent3brOutside: 1447.95,
            utilities85: 221.39,
            mobilePlan: 60.18,
            internet60: 66.99,
            sqmCenter: 1951.80,
            sqmOutside: 1735.41
        }
    },
    {
        code: "ak", titleKey: "regions.usa.ak", fallbackName: "Alaska", teleportSlug: "anchorage", tier: "mid",
        monthly: {
            single: 2280,
            couple: 3420,
            perKid: 620
        },
        prices: {
            salaryNetMonthly: 4205.31,
            rent1brCenter: 1571.82,
            rent1brOutside: 1339.23,
            rent3brCenter: 2507.15,
            rent3brOutside: 2184.86,
            utilities85: 240.95,
            mobilePlan: 61.02,
            internet60: 79.28,
            sqmCenter: 3571.65,
            sqmOutside: 3042.49
        }
    },
    {
        code: "az", titleKey: "regions.usa.az", fallbackName: "Arizona", teleportSlug: "phoenix", tier: "mid",
        monthly: {
            single: 2400,
            couple: 3600,
            perKid: 700
        },
        prices: {
            salaryNetMonthly: 4205.31,
            rent1brCenter: 1571.82,
            rent1brOutside: 1339.23,
            rent3brCenter: 2507.15,
            rent3brOutside: 2184.86,
            utilities85: 240.95,
            mobilePlan: 61.02,
            internet60: 79.28,
            sqmCenter: 3571.65,
            sqmOutside: 3042.49
        }
    },
    {
        code: "ar", titleKey: "regions.usa.ar", fallbackName: "Arkansas", teleportSlug: "little-rock", tier: "low",
        monthly: {
            single: 2130,
            couple: 3200,
            perKid: 585
        },
        prices: {
            salaryNetMonthly: 3642.93,
            rent1brCenter: 1089.27,
            rent1brOutside: 871.0,
            rent3brCenter: 1651.67,
            rent3brOutside: 1394.52,
            utilities85: 211.61,
            mobilePlan: 57.25,
            internet60: 66.89,
            sqmCenter: 1892.06,
            sqmOutside: 1722.26
        }
    },
    {
        code: "ca",
        titleKey: "regions.usa.ca",
        fallbackName: "California",
        teleportSlug: "san-francisco-bay-area",
        tier: "very_high",
        monthly: {
            single: 3870,
            couple: 5800,
            perKid: 1065
        },
        prices: {
            salaryNetMonthly: 5316.93,
            rent1brCenter: 2432.82,
            rent1brOutside: 2119.97,
            rent3brCenter: 4046.10,
            rent3brOutside: 3533.82,
            utilities85: 246.91,
            mobilePlan: 61.63,
            internet60: 74.67,
            sqmCenter: 6834.69,
            sqmOutside: 6095.06
        }
    },
    {
        code: "co", titleKey: "regions.usa.co", fallbackName: "Colorado", teleportSlug: "denver",
        "tier": "mid",
        "monthly": {
            "single": 2907,
            "couple": 4611,
            "perKid": 2158
        },
        "prices": {
            "salaryNetMonthly": 4464.38,
            "rent1brCenter": 1923.11,
            "rent1brOutside": 1582.63,
            "rent3brCenter": 3033.44,
            "rent3brOutside": 2581.54,
            "utilities85": 194.28,
            "mobilePlan": 72.47,
            "internet60": 75
        }
    },
    {
        code: "ct", titleKey: "regions.usa.ct", fallbackName: "Connecticut", teleportSlug: "hartford", tier: "high",
        monthly: {
            single: 3050,
            couple: 4880,
            perKid: 2090,
        },
        prices: {
            apt1brCityCenter: 2030.06,
            apt1brOutsideCenter: 1688.33,
            basic85m2: 246.08,
            mobilePlan: 62.61,
            internet60mbps: 70.0,
            averageNetMonthly: 4107.58,
        }
    },
    {
        code: "de", titleKey: "regions.usa.de", fallbackName: "Delaware", teleportSlug: "wilmington",
        "tier": "mid",
        "monthly": {
            "single": 2746,
            "couple": 3830,
            "perKid": 1928
        },
        "prices": {
            "salaryNetMonthly": 3883.73,
            "rent1brCenter": 1611.17,
            "rent1brOutside": 1447.58,
            "rent3brCenter": 2333.33,
            "rent3brOutside": 2022.08,
            "utilities85": 255.65,
            "mobilePlan": 64.33,
            "internet60": 85
        }
    },
    {
        code: "fl", titleKey: "regions.usa.fl", fallbackName: "Florida", teleportSlug: "miami",
        "tier": "mid",
        "monthly": {
            "single": 2847,
            "couple": 4600,
            "perKid": 1555
        },
        "prices": {
            "salaryNetMonthly": 3951.53,
            "rent1brCenter": 1971.22,
            "rent1brOutside": 1581.49,
            "rent3brCenter": 3205.27,
            "rent3brOutside": 2648.61,
            "utilities85": 196.33,
            "mobilePlan": 58.92,
            "internet60": 72
        }
    },
    {
        code: "ga", titleKey: "regions.usa.ga", fallbackName: "Georgia", teleportSlug: "atlanta",
        "tier": "mid",
        "monthly": {
            "single": 2567,
            "couple": 3833,
            "perKid": 1617
        },
        "prices": {
            "salaryNetMonthly": 4000.83,
            "rent1brCenter": 1600.06,
            "rent1brOutside": 1342.11,
            "rent3brCenter": 2410.66,
            "rent3brOutside": 2024.95,
            "utilities85": 209.03,
            "mobilePlan": 57.89,
            "internet60": 75.16
        }
    },
    {
        code: "hi", titleKey: "regions.usa.hi", fallbackName: "Hawaii", teleportSlug: "honolulu",
        "tier": "very_high",
        "monthly": {
            "single": 3625,
            "couple": 6350,
            "perKid": 2615
        },
        "prices": {
            "salaryNetMonthly": 4313.63,
            "rent1brCenter": 2401.84,
            "rent1brOutside": 2011.6,
            "rent3brCenter": 4221.9,
            "rent3brOutside": 3744.5,
            "utilities85": 279.12,
            "mobilePlan": 66.06,
            "internet60": 68
        }
    },
    {
        code: "id", titleKey: "regions.usa.id", fallbackName: "Idaho", teleportSlug: "boise",
        "tier": "low",
        "monthly": {
            "single": 2346,
            "couple": 3510,
            "perKid": 1569
        },
        "prices": {
            "salaryNetMonthly": 3790.77,
            "rent1brCenter": 1408.65,
            "rent1brOutside": 1244.84,
            "rent3brCenter": 2185.9,
            "rent3brOutside": 1896.7,
            "utilities85": 186.87,
            "mobilePlan": 56.25,
            "internet60": 73.05
        }
    },
    {
        code: "il", titleKey: "regions.usa.il", fallbackName: "Illinois", teleportSlug: "chicago",
        "tier": "low",
        "monthly": {
            "single": 2356,
            "couple": 3739,
            "perKid": 1717
        },
        "prices": {
            "salaryNetMonthly": 4725.85,
            "rent1brCenter": 1554.38,
            "rent1brOutside": 1184.95,
            "rent3brCenter": 2353.8,
            "rent3brOutside": 1957.47,
            "utilities85": 205.33,
            "mobilePlan": 59.76,
            "internet60": 71.74
        }
    },
    {
        code: "in", titleKey: "regions.usa.in", fallbackName: "Indiana", teleportSlug: "indianapolis",
        "tier": "low",
        "monthly": {
            "single": 2163,
            "couple": 3261,
            "perKid": 2098
        },
        "prices": {
            "salaryNetMonthly": 3792.02,
            "rent1brCenter": 1274.36,
            "rent1brOutside": 1033.35,
            "rent3brCenter": 1927.94,
            "rent3brOutside": 1616.02,
            "utilities85": 234.16,
            "mobilePlan": 62.91,
            "internet60": 72.26
        }
    },
    {
        code: "ia", titleKey: "regions.usa.ia", fallbackName: "Iowa", teleportSlug: "des-moines",
        "tier": "low",
        "monthly": {
            "single": 1867,
            "couple": 2941,
            "perKid": 1371
        },
        "prices": {
            "salaryNetMonthly": 3629.42,
            "rent1brCenter": 1051.51,
            "rent1brOutside": 828.09,
            "rent3brCenter": 1651.67,
            "rent3brOutside": 1379.17,
            "utilities85": 200.38,
            "mobilePlan": 57.9,
            "internet60": 74.29
        }
    },
    {
        code: "ks", titleKey: "regions.usa.ks", fallbackName: "Kansas", teleportSlug: "wichita",
        "tier": "low",
        "monthly": {
            "single": 1887,
            "couple": 3038,
            "perKid": 1169
        },
        "prices": {
            "salaryNetMonthly": 3813.02,
            "rent1brCenter": 958.74,
            "rent1brOutside": 825.39,
            "rent3brCenter": 1623.97,
            "rent3brOutside": 1445.89,
            "utilities85": 241.31,
            "mobilePlan": 58.54,
            "internet60": 62.01
        }
    },
    {
        code: "ky", titleKey: "regions.usa.ky", fallbackName: "Kentucky", teleportSlug: "louisville",
        "tier": "low",
        "monthly": {
            "single": 1903,
            "couple": 3064,
            "perKid": 1740
        },
        "prices": {
            "salaryNetMonthly": 3793.08,
            "rent1brCenter": 1052.66,
            "rent1brOutside": 875.06,
            "rent3brCenter": 1693.85,
            "rent3brOutside": 1522.34,
            "utilities85": 203.81,
            "mobilePlan": 68.94,
            "internet60": 70.98
        }
    },
    {
        code: "la", titleKey: "regions.usa.la", fallbackName: "Louisiana", teleportSlug: "new-orleans",
        "tier": "low",
        "monthly": {
            "single": 2150,
            "couple": 3416,
            "perKid": 1695
        },
        "prices": {
            "salaryNetMonthly": 3547.15,
            "rent1brCenter": 1361.51,
            "rent1brOutside": 1054.44,
            "rent3brCenter": 2023.5,
            "rent3brOutside": 1752.78,
            "utilities85": 190.63,
            "mobilePlan": 63.73,
            "internet60": 69.79
        }
    },
    {
        code: "me", titleKey: "regions.usa.me", fallbackName: "Maine", teleportSlug: "portland-me",
        "tier": "mid",
        "monthly": {
            "single": 2671,
            "couple": 3977,
            "perKid": 888
        },
        "prices": {
            "salaryNetMonthly": 4333.17,
            "rent1brCenter": 1601.25,
            "rent1brOutside": 1370.94,
            "rent3brCenter": 2634.38,
            "rent3brOutside": 2091.33,
            "utilities85": 261.16,
            "mobilePlan": 61.33,
            "internet60": 76.32
        }
    },
    {
        code: "md", titleKey: "regions.usa.md", fallbackName: "Maryland", teleportSlug: "baltimore",
        "tier": "mid",
        "monthly": {
            "single": 2663,
            "couple": 4406,
            "perKid": 2512
        },
        "prices": {
            "salaryNetMonthly": 5413.43,
            "rent1brCenter": 1873.36,
            "rent1brOutside": 1406.71,
            "rent3brCenter": 2892.78,
            "rent3brOutside": 2445.68,
            "utilities85": 204.7,
            "mobilePlan": 56.83,
            "internet60": 78.11
        }
    },
    {
        code: "ma", titleKey: "regions.usa.ma", fallbackName: "Massachusetts", teleportSlug: "boston",
        "tier": "high",
        "monthly": {
            "single": 3500,
            "couple": 5477,
            "perKid": 3295
        },
        "prices": {
            "salaryNetMonthly": 4943.26,
            "rent1brCenter": 2381.39,
            "rent1brOutside": 2028.34,
            "rent3brCenter": 3921.34,
            "rent3brOutside": 3245.27,
            "utilities85": 227.94,
            "mobilePlan": 58.56,
            "internet60": 73.33
        }
    },
    {
        code: "mi", titleKey: "regions.usa.mi", fallbackName: "Michigan", teleportSlug: "detroit",
        "tier": "low",
        "monthly": {
            "single": 2052,
            "couple": 3325,
            "perKid": 1590
        },
        "prices": {
            "salaryNetMonthly": 4172.56,
            "rent1brCenter": 1288.34,
            "rent1brOutside": 1004.96,
            "rent3brCenter": 2153.52,
            "rent3brOutside": 1718.48,
            "utilities85": 188.19,
            "mobilePlan": 53.99,
            "internet60": 65.98
        }
    },
    {
        code: "mn", titleKey: "regions.usa.mn", fallbackName: "Minnesota", teleportSlug: "minneapolis-saint-paul",
        "tier": "low",
        "monthly": {
            "single": 2260,
            "couple": 3648,
            "perKid": 1771
        },
        "prices": {
            "salaryNetMonthly": 4354.5,
            "rent1brCenter": 1394.81,
            "rent1brOutside": 1116.71,
            "rent3brCenter": 2192.28,
            "rent3brOutside": 1873.07,
            "utilities85": 185.33,
            "mobilePlan": 58.45,
            "internet60": 66.93
        }
    },
    {
        code: "ms", titleKey: "regions.usa.ms", fallbackName: "Mississippi", teleportSlug: "jackson-ms",
        "tier": "low",
        "monthly": {
            "single": 1870,
            "couple": 2867,
            "perKid": 809
        },
        "prices": {
            "salaryNetMonthly": 2948.05,
            "rent1brCenter": 1052.2,
            "rent1brOutside": 890.35,
            "rent3brCenter": 1624.68,
            "rent3brOutside": 1408.74,
            "utilities85": 167.5,
            "mobilePlan": 61.82,
            "internet60": 70.48
        }
    },
    {
        code: "mo", titleKey: "regions.usa.mo", fallbackName: "Missouri", teleportSlug: "st-louis",
        "tier": "low",
        "monthly": {
            "single": 1897,
            "couple": 2951,
            "perKid": 1569
        },
        "prices": {
            "salaryNetMonthly": 3751.72,
            "rent1brCenter": 1106.93,
            "rent1brOutside": 877,
            "rent3brCenter": 1716.81,
            "rent3brOutside": 1437.98,
            "utilities85": 200.33,
            "mobilePlan": 58.37,
            "internet60": 73.53
        }
    },
    {
        code: "mt", titleKey: "regions.usa.mt", fallbackName: "Montana", teleportSlug: "billings",
        "tier": "low",
        "monthly": {
            "single": 2393,
            "couple": 3985,
            "perKid": 1590
        },
        "prices": {
            "salaryNetMonthly": 3918.73,
            "rent1brCenter": 1523.84,
            "rent1brOutside": 1288.66,
            "rent3brCenter": 2662.13,
            "rent3brOutside": 2292.81,
            "utilities85": 189.22,
            "mobilePlan": 64.92,
            "internet60": 77.59
        }
    },
    {
        code: "ne", titleKey: "regions.usa.ne", fallbackName: "Nebraska", teleportSlug: "omaha",
        "tier": "low",
        "monthly": {
            "single": 2019,
            "couple": 3231,
            "perKid": 1122
        },
        "prices": {
            "salaryNetMonthly": 3853.57,
            "rent1brCenter": 1189.3,
            "rent1brOutside": 941.18,
            "rent3brCenter": 2234.41,
            "rent3brOutside": 1610.43,
            "utilities85": 222.87,
            "mobilePlan": 59.53,
            "internet60": 65.95
        }
    },
    {
        code: "nv", titleKey: "regions.usa.nv", fallbackName: "Nevada", teleportSlug: "las-vegas",
        "tier": "mid",
        "monthly": {
            "single": 2596,
            "couple": 3995,
            "perKid": 1607
        },
        "prices": {
            "salaryNetMonthly": 4208.76,
            "rent1brCenter": 1551.33,
            "rent1brOutside": 1340.35,
            "rent3brCenter": 2471.89,
            "rent3brOutside": 2122.69,
            "utilities85": 215.36,
            "mobilePlan": 69.8,
            "internet60": 78.54
        }
    },
    {
        code: "nh", titleKey: "regions.usa.nh", fallbackName: "New Hampshire", teleportSlug: "manchester-nh",
        "tier": "mid",
        "monthly": {
            "single": 2793,
            "couple": 4450,
            "perKid": 2503
        },
        "prices": {
            "salaryNetMonthly": 4483.01,
            "rent1brCenter": 1747.83,
            "rent1brOutside": 1488.64,
            "rent3brCenter": 3077.78,
            "rent3brOutside": 2505.37,
            "utilities85": 260.8,
            "mobilePlan": 58.33,
            "internet60": 82.73
        }
    },
    {
        code: "nj", titleKey: "regions.usa.nj", fallbackName: "New Jersey", teleportSlug: "new-york",
        "tier": "high",
        "monthly": {
            "single": 3303,
            "couple": 5244,
            "perKid": 2455
        },
        "prices": {
            "salaryNetMonthly": 5068.81,
            "rent1brCenter": 2344.93,
            "rent1brOutside": 1897.33,
            "rent3brCenter": 3715.11,
            "rent3brOutside": 3077.94,
            "utilities85": 198.83,
            "mobilePlan": 63.29,
            "internet60": 69.32
        }
    },
    {
        code: "nm", titleKey: "regions.usa.nm", fallbackName: "New Mexico", teleportSlug: "albuquerque",
        "tier": "low",
        "monthly": {
            "single": 2180,
            "couple": 3439,
            "perKid": 1673
        },
        "prices": {
            "salaryNetMonthly": 3800.63,
            "rent1brCenter": 1275.97,
            "rent1brOutside": 1113.15,
            "rent3brCenter": 2179.62,
            "rent3brOutside": 1835.17,
            "utilities85": 181.12,
            "mobilePlan": 61.62,
            "internet60": 73.55
        }
    },
    {
        code: "ny", titleKey: "regions.usa.ny", fallbackName: "New York", teleportSlug: "new-york", tier: "very_high",
        monthly: {
            single: 3171,
            couple: 4636,
            perKid: 2576
        },
        prices: {
            salaryNetMonthly: 4081.82,
            rent1brCenter: 2325.75,
            rent1brOutside: 1760.82,
            rent3brCenter: 3710.77,
            rent3brOutside: 2780.82,
            utilities85: 211.64,
            mobilePlan: 60.97,
            internet60: 72.32
        }
    },
    {
        code: "nc", titleKey: "regions.usa.nc", fallbackName: "North Carolina", teleportSlug: "charlotte",
        "tier": "low",
        "monthly": {
            "single": 2285,
            "couple": 3650,
            "perKid": 1626
        },
        "prices": {
            "salaryNetMonthly": 3915.42,
            "rent1brCenter": 1492.37,
            "rent1brOutside": 1179.67,
            "rent3brCenter": 2472.31,
            "rent3brOutside": 1964.86,
            "utilities85": 178.68,
            "mobilePlan": 61.75,
            "internet60": 72.58
        }
    },
    {
        code: "nd", titleKey: "regions.usa.nd", fallbackName: "North Dakota", teleportSlug: "fargo",
        "tier": "low",
        "monthly": {
            "single": 1847,
            "couple": 2964,
            "perKid": 1279
        },
        "prices": {
            "salaryNetMonthly": 3839.18,
            "rent1brCenter": 967.11,
            "rent1brOutside": 770.93,
            "rent3brCenter": 1620.08,
            "rent3brOutside": 1315.08,
            "utilities85": 196.91,
            "mobilePlan": 69.54,
            "internet60": 68.2
        }
    },
    {
        code: "oh", titleKey: "regions.usa.oh", fallbackName: "Ohio", teleportSlug: "columbus",
        "tier": "low",
        "monthly": {
            "single": 2000,
            "couple": 3054,
            "perKid": 1623
        },
        "prices": {
            "salaryNetMonthly": 3536.37,
            "rent1brCenter": 1133.54,
            "rent1brOutside": 938.62,
            "rent3brCenter": 1836.42,
            "rent3brOutside": 1487.42,
            "utilities85": 210.4,
            "mobilePlan": 57.79,
            "internet60": 69.01
        }
    },
    {
        code: "ok", titleKey: "regions.usa.ok", fallbackName: "Oklahoma", teleportSlug: "oklahoma-city",
        "tier": "low",
        "monthly": {
            "single": 1934,
            "couple": 2915,
            "perKid": 1684
        },
        "prices": {
            "salaryNetMonthly": 3598.04,
            "rent1brCenter": 1033.06,
            "rent1brOutside": 835.58,
            "rent3brCenter": 1546.17,
            "rent3brOutside": 1341.76,
            "utilities85": 254.56,
            "mobilePlan": 71.77,
            "internet60": 77.5
        }
    },
    {
        code: "or", titleKey: "regions.usa.or", fallbackName: "Oregon", teleportSlug: "portland-or",
        "tier": "mid",
        "monthly": {
            "single": 2681,
            "couple": 4174,
            "perKid": 1926
        },
        "prices": {
            "salaryNetMonthly": 4177.07,
            "rent1brCenter": 1617.25,
            "rent1brOutside": 1426.68,
            "rent3brCenter": 2666.71,
            "rent3brOutside": 2281.8,
            "utilities85": 207.15,
            "mobilePlan": 64.95,
            "internet60": 69.49
        }
    },
    {
        code: "pa", titleKey: "regions.usa.pa", fallbackName: "Pennsylvania", teleportSlug: "philadelphia",
        "tier": "low",
        "monthly": {
            "single": 2368,
            "couple": 3639,
            "perKid": 2250
        },
        "prices": {
            "salaryNetMonthly": 3869.55,
            "rent1brCenter": 1449.07,
            "rent1brOutside": 1172.57,
            "rent3brCenter": 2274.9,
            "rent3brOutside": 1851.29,
            "utilities85": 220.42,
            "mobilePlan": 56.85,
            "internet60": 72.39
        }
    },
    {
        code: "ri", titleKey: "regions.usa.ri", fallbackName: "Rhode Island", teleportSlug: "providence",
        "tier": "high",
        "monthly": {
            "single": 3345,
            "couple": 4498,
            "perKid": 2383
        },
        "prices": {
            "salaryNetMonthly": 3853,
            "rent1brCenter": 2144.58,
            "rent1brOutside": 1792.73,
            "rent3brCenter": 2846.67,
            "rent3brOutside": 2377.27,
            "utilities85": 334.62,
            "mobilePlan": 71.78,
            "internet60": 71.67
        }
    },
    {
        code: "sc", titleKey: "regions.usa.sc", fallbackName: "South Carolina", teleportSlug: "charleston",
        "tier": "low",
        "monthly": {
            "single": 2337,
            "couple": 3598,
            "perKid": 1653
        },
        "prices": {
            "salaryNetMonthly": 3867.16,
            "rent1brCenter": 1473.68,
            "rent1brOutside": 1172.05,
            "rent3brCenter": 2296.24,
            "rent3brOutside": 1863.45,
            "utilities85": 198.22,
            "mobilePlan": 77.3,
            "internet60": 71.89
        }
    },
    {
        code: "sd", titleKey: "regions.usa.sd", fallbackName: "South Dakota", teleportSlug: "sioux-falls",
        "tier": "low",
        "monthly": {
            "single": 1912,
            "couple": 3013,
            "perKid": 1186
        },
        "prices": {
            "salaryNetMonthly": 3968.76,
            "rent1brCenter": 1173,
            "rent1brOutside": 971.85,
            "rent3brCenter": 1769.92,
            "rent3brOutside": 1599.17,
            "utilities85": 172.55,
            "mobilePlan": 46,
            "internet60": 60.27
        }
    },
    {
        code: "tn", titleKey: "regions.usa.tn", fallbackName: "Tennessee", teleportSlug: "nashville",
        "tier": "low",
        "monthly": {
            "single": 2311,
            "couple": 3572,
            "perKid": 1646
        },
        "prices": {
            "salaryNetMonthly": 3872.3,
            "rent1brCenter": 1398.65,
            "rent1brOutside": 1146.77,
            "rent3brCenter": 2253.7,
            "rent3brOutside": 1848.43,
            "utilities85": 218.89,
            "mobilePlan": 71.59,
            "internet60": 72.2
        }
    },
    {
        code: "tx", titleKey: "regions.usa.tx", fallbackName: "Texas", teleportSlug: "austin",
        "tier": "low",
        "monthly": {
            "single": 2309,
            "couple": 3798,
            "perKid": 1740
        },
        "prices": {
            "salaryNetMonthly": 4177.11,
            "rent1brCenter": 1395.95,
            "rent1brOutside": 1147.11,
            "rent3brCenter": 2440.54,
            "rent3brOutside": 2007.42,
            "utilities85": 211.49,
            "mobilePlan": 61.7,
            "internet60": 71.36
        }
    },
    {
        code: "ut", titleKey: "regions.usa.ut", fallbackName: "Utah", teleportSlug: "salt-lake-city",
        "tier": "low",
        "monthly": {
            "single": 2347,
            "couple": 3655,
            "perKid": 1452
        },
        "prices": {
            "salaryNetMonthly": 3980.56,
            "rent1brCenter": 1406.26,
            "rent1brOutside": 1205.08,
            "rent3brCenter": 2234.57,
            "rent3brOutside": 1907.36,
            "utilities85": 173.93,
            "mobilePlan": 53.21,
            "internet60": 69.7
        }
    },
    {
        code: "vt", titleKey: "regions.usa.vt", fallbackName: "Vermont", teleportSlug: "burlington",
        "tier": "low",
        "monthly": {
            "single": 2373,
            "couple": 3657,
            "perKid": 1755
        },
        "prices": {
            "salaryNetMonthly": 4665.31,
            "rent1brCenter": 1462.79,
            "rent1brOutside": 1259.92,
            "rent3brCenter": 2387.67,
            "rent3brOutside": 1984.75,
            "utilities85": 176.23,
            "mobilePlan": 53,
            "internet60": 72.85
        }
    },
    {
        code: "va", titleKey: "regions.usa.va", fallbackName: "Virginia", teleportSlug: "washington-dc",
        "tier": "mid",
        "monthly": {
            "single": 2585,
            "couple": 4211,
            "perKid": 1871
        },
        "prices": {
            "salaryNetMonthly": 4652.26,
            "rent1brCenter": 1691.68,
            "rent1brOutside": 1344.84,
            "rent3brCenter": 2696.16,
            "rent3brOutside": 2291.74,
            "utilities85": 201.9,
            "mobilePlan": 64.76,
            "internet60": 73.33
        }
    },
    {
        code: "wa", titleKey: "regions.usa.wa", fallbackName: "Washington", teleportSlug: "seattle",
        "tier": "mid",
        "monthly": {
            "single": 2897,
            "couple": 4522,
            "perKid": 2511
        },
        "prices": {
            "salaryNetMonthly": 5008.91,
            "rent1brCenter": 1837.46,
            "rent1brOutside": 1582.35,
            "rent3brCenter": 2905.95,
            "rent3brOutside": 2532.78,
            "utilities85": 204.6,
            "mobilePlan": 65.21,
            "internet60": 76.37
        }
    },
    {
        code: "wv", titleKey: "regions.usa.wv", fallbackName: "West Virginia", teleportSlug: "charleston-wv",
        "tier": "low",
        "monthly": {
            "single": 1875,
            "couple": 2918,
            "perKid": 1170
        },
        "prices": {
            "salaryNetMonthly": 3858.44,
            "rent1brCenter": 957.52,
            "rent1brOutside": 762.1,
            "rent3brCenter": 1538.89,
            "rent3brOutside": 1309.21,
            "utilities85": 277.2,
            "mobilePlan": 69.31,
            "internet60": 78.35
        }
    },
    {
        code: "wi", titleKey: "regions.usa.wi", fallbackName: "Wisconsin", teleportSlug: "milwaukee",
        "tier": "low",
        "monthly": {
            "single": 2217,
            "couple": 3638,
            "perKid": 2128
        },
        "prices": {
            "salaryNetMonthly": 3924.65,
            "rent1brCenter": 1364.13,
            "rent1brOutside": 1108.49,
            "rent3brCenter": 2169.71,
            "rent3brOutside": 1926.95,
            "utilities85": 194.1,
            "mobilePlan": 54.2,
            "internet60": 74.69
        }
    },
    {
        code: "wy", titleKey: "regions.usa.wy", fallbackName: "Wyoming", teleportSlug: "cheyenne",
        "tier": "low",
        "monthly": {
            "single": 2201,
            "couple": 3830,
            "perKid": 1582
        },
        "prices": {
            "salaryNetMonthly": 4439.33,
            "rent1brCenter": 1199.08,
            "rent1brOutside": 1063.22,
            "rent3brCenter": 2236,
            "rent3brOutside": 2008.22,
            "utilities85": 199.28,
            "mobilePlan": 49.33,
            "internet60": 73
        }
    },
    {
        code: "dc", titleKey: "regions.usa.dc", fallbackName: "Washington, D.C.", teleportSlug: "washington-dc",
        "tier": "very_high",
        "monthly": {
            "single": 3680,
            "couple": 7162,
            "perKid": 4038
        },
        "prices": {
            "salaryNetMonthly": 6145.86,
            "rent1brCenter": 2642.32,
            "rent1brOutside": 2109.74,
            "rent3brCenter": 5368,
            "rent3brOutside": 4404.17,
            "utilities85": 199.5,
            "mobilePlan": 66.68,
            "internet60": 70.48
        }
    }
];