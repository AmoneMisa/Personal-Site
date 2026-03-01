<script setup lang="ts">
type IndicesNormalized = {
  income: number | null;
  education: number | null;
  qualityOfLife: number | null;
  safety: number | null;
  internet?: number | null;
  unemployment?: number | null;
  air?: number | null;
  inequality?: number | null;
  health?: number | null;
  transportPublic?: number | null;
  transportCar?: number | null;
  remoteWork?: number | null;
  commuteTime?: number | null;
  societyInternational?: number | null;
  langBarrier?: number | null;
};

type Prices = Record<string, number | null | undefined>;

type IndicesBundle = {
  key: string;
  updatedAtISO: string;
  normalized: IndicesNormalized;
  prices?: Prices;
};

type Item = {
  key: string;
  titleKey: string;
  fallbackName: string;
  estimatedMonthlyUSD: number;
  why?: string[];
  match100?: number | null;
  live100?: number | null;
};

const props = withDefaults(defineProps<{
  item: Item;
  indices?: IndicesBundle;
  showWhy?: boolean;
  showRatings?: boolean;
  removable?: boolean;
  removeText?: string;
}>(), {
  showWhy: false,
  showRatings: true,
  removable: false,
});

const emit = defineEmits<{ (e: "remove", key: string): void }>();

const {t} = useI18n();

function fmt100(v: number | null | undefined) {
  if (typeof v !== "number") return "—";
  return `${Math.round(v)}/100`;
}

function fmtIndex10(v: number) {
  if (v === 0) return t("common.noData");
  return `${v.toFixed(1)}/10`;
}

function hasAnyIndex(b: IndicesBundle | undefined) {
  const n = b?.normalized;
  if (!n) return false;
  return Object.values(n).some((x) => typeof x === "number" && Number.isFinite(x));
}

type IndexKey = keyof IndicesNormalized;

type IndexDef = {
  key: IndexKey;
  icon: string;
  tKey: string;
};

const INDEX_DEFS: IndexDef[] = [
  {key: "income", icon: "i-lucide-dollar-sign", tKey: "quizzes.countryFit.indices.income"},
  {key: "education", icon: "i-lucide-graduation-cap", tKey: "quizzes.countryFit.indices.education"},
  {key: "qualityOfLife", icon: "i-lucide-sparkles", tKey: "quizzes.countryFit.indices.quality"},
  {key: "safety", icon: "i-lucide-shield", tKey: "quizzes.countryFit.indices.safety"},

  {key: "internet", icon: "i-lucide-wifi", tKey: "quizzes.countryFit.indices.internet"},
  {key: "unemployment", icon: "i-lucide-briefcase", tKey: "quizzes.countryFit.indices.unemployment"},
  {key: "air", icon: "i-lucide-wind", tKey: "quizzes.countryFit.indices.air"},
  {key: "inequality", icon: "i-lucide-scale", tKey: "quizzes.countryFit.indices.inequality"},
  {key: "health", icon: "i-lucide-heart-pulse", tKey: "quizzes.countryFit.indices.health"},

  {key: "transportPublic", icon: "i-lucide-train-front", tKey: "quizzes.countryFit.indices.transportPublic"},
  {key: "transportCar", icon: "i-lucide-car", tKey: "quizzes.countryFit.indices.transportCar"},
  {key: "remoteWork", icon: "i-lucide-laptop", tKey: "quizzes.countryFit.indices.remoteWork"},
  {key: "commuteTime", icon: "i-lucide-timer", tKey: "quizzes.countryFit.indices.commuteTime"},
  {key: "societyInternational", icon: "i-lucide-globe", tKey: "quizzes.countryFit.indices.societyInternational"},
  {key: "langBarrier", icon: "i-lucide-languages", tKey: "quizzes.countryFit.indices.langBarrier"},
];

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

const availableIndices = computed(() => {
  const n = props.indices?.normalized;
  if (!n) return [];

  return INDEX_DEFS
      .map(def => ({def, value: n[def.key]}))
      .filter(x => isNum(x.value));
});

const indexColumns = computed(() => {
  const items = availableIndices.value;

  // правило: "если больше 4-х в столбик" -> делим на 2 или 3 столбика
  // max 4 строки на колонку => колонки = ceil(count / 4), но не больше 3
  const cols = Math.min(3, Math.max(1, Math.ceil(items.length / 4)));

  const out: Array<typeof items> = Array.from({length: cols}, () => []);
  for (let i = 0; i < items.length; i++) out[i % cols].push(items[i]);
  return out;
});

type PriceKey =
    | "salaryNetMonthly"
    | "salary_net_monthly"
    | "averageNetMonthly"
    | "rent1brCenter"
    | "rent_1br_center"
    | "apt1brCityCenter"
    | "rent1brOutside"
    | "rent_1br_outside"
    | "apt1brOutsideCenter"
    | "rent3brCenter"
    | "rent_3br_center"
    | "rent3brOutside"
    | "rent_3br_outside"
    | "utilities85"
    | "utilities_85m2"
    | "basic85m2"
    | "mobilePlan"
    | "mobile_plan"
    | "internet60"
    | "internet_60mbps"
    | "internet60mbps"
    | "sqmCenter"
    | "buy_sqm_center"
    | "sqmOutside"
    | "buy_sqm_outside";

type PriceDef = {
  key: PriceKey;
  icon: string;
  labelKey: string;
  fmt: "usd" | "usd_m2";
};

const PRICE_DEFS: PriceDef[] = [
  {
    key: "salaryNetMonthly",
    icon: "i-lucide-wallet",
    labelKey: "quizzes.countryFit.prices.salaryNetMonthly",
    fmt: "usd"
  },
  {
    key: "averageNetMonthly",
    icon: "i-lucide-wallet",
    labelKey: "quizzes.countryFit.prices.salaryNetMonthly",
    fmt: "usd"
  },
  {key: "rent1brCenter", icon: "i-lucide-home", labelKey: "quizzes.countryFit.prices.rent1brCenter", fmt: "usd"},
  {key: "apt1brCityCenter", icon: "i-lucide-home", labelKey: "quizzes.countryFit.prices.rent1brCenter", fmt: "usd"},
  {
    key: "rent1brOutside",
    icon: "i-lucide-building-2",
    labelKey: "quizzes.countryFit.prices.rent1brOutside",
    fmt: "usd"
  },
  {
    key: "apt1brOutsideCenter",
    icon: "i-lucide-building-2",
    labelKey: "quizzes.countryFit.prices.rent1brOutside",
    fmt: "usd"
  },
  {key: "rent3brCenter", icon: "i-lucide-door-open", labelKey: "quizzes.countryFit.prices.rent3brCenter", fmt: "usd"},
  {key: "rent3brOutside", icon: "i-lucide-warehouse", labelKey: "quizzes.countryFit.prices.rent3brOutside", fmt: "usd"},
  {key: "utilities85", icon: "i-lucide-flame", labelKey: "quizzes.countryFit.prices.utilities85", fmt: "usd"},
  {key: "basic85m2", icon: "i-lucide-flame", labelKey: "quizzes.countryFit.prices.utilities85", fmt: "usd"},
  {key: "mobilePlan", icon: "i-lucide-smartphone", labelKey: "quizzes.countryFit.prices.mobilePlan", fmt: "usd"},
  {key: "internet60", icon: "i-lucide-wifi", labelKey: "quizzes.countryFit.prices.internet60", fmt: "usd"},
  {key: "sqmCenter", icon: "i-lucide-ruler", labelKey: "quizzes.countryFit.prices.sqmCenter", fmt: "usd_m2"},
  {key: "sqmOutside", icon: "i-lucide-ruler", labelKey: "quizzes.countryFit.prices.sqmOutside", fmt: "usd_m2"},
];

function fmtUSD(v: number) {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

function fmtUSDM2(v: number) {
  return `$${Math.round(v).toLocaleString("en-US")} / m²`;
}

function fmtPrice(v: number, fmt: PriceDef["fmt"]) {
  if (!Number.isFinite(v)) return "—";
  return fmt === "usd_m2" ? fmtUSDM2(v) : fmtUSD(v);
}

function hasAnyPrice(b: IndicesBundle | undefined) {
  const p = b?.prices;
  if (!p) return false;
  return Object.values(p).some((x) => typeof x === "number" && Number.isFinite(x));
}

const availablePrices = computed(() => {
  const p = props.indices?.prices;
  if (!p) return [];

  return PRICE_DEFS
      .map(def => ({def, value: p[def.key]}))
      .filter(x => isNum(x.value));
});

const priceColumns = computed(() => {
  const items = availablePrices.value;
  const cols = Math.min(2, Math.max(1, Math.ceil(items.length / 4))); // цены лучше в 1–2 колонки
  const out: Array<typeof items> = Array.from({length: cols}, () => []);
  for (let i = 0; i < items.length; i++) out[i % cols].push(items[i]);
  return out;
});
</script>

<template>
  <div class="p-4 rounded-xl border border-[var(--ui-border)] bg-[rgba(255,255,255,0.03)] result-card">
    <div class="flex items-start justify-between gap-3">
      <div class="font-black">
        {{ t(item.titleKey, item.fallbackName) || item.fallbackName }}
      </div>

      <button
          v-if="removable"
          type="button"
          class="chip"
          @click="emit('remove', item.key)"
      >
        <Icon name="i-lucide-x" class="i-icon"/>
        {{ t("common.remove") }}
      </button>
    </div>

    <div class="text-muted mt-2">
      ~${{ Math.round(item.estimatedMonthlyUSD).toLocaleString("en-US") }} / month
    </div>

    <div v-if="showWhy && item.why?.length" class="text-muted mt-2">
      • {{ item.why.join(" • ") }}
    </div>

    <div v-if="item.match100 != null || item.live100 != null" class="ratings mt-3">
      <div class="rating" v-if="item.match100 != null">
        <div class="rating__label">{{ t("quizzes.countryFit.rating.match") }}</div>
        <div class="rating__val">{{ fmt100(item.match100) }}</div>
      </div>
      <div class="rating" v-if="item.live100 != null">
        <div class="rating__label">{{ t("quizzes.countryFit.rating.live") }}</div>
        <div class="rating__val">{{ fmt100(item.live100) }}</div>
      </div>
    </div>

    <div v-if="hasAnyIndex(indices)" class="indices mt-3">
      <button type="button" class="indices__trigger" :aria-label="t('quizzes.countryFit.indices.aria')">
        <Icon name="i-lucide-info" class="i-icon"/>
        {{ t("quizzes.countryFit.indices.title") }}
      </button>

      <div class="indices__panel" role="tooltip">
        <div class="indices__title">{{ t("quizzes.countryFit.indices.title") }}</div>
        <div class="indices__col" v-for="(col, ci) in indexColumns" :key="ci">
          <div class="indices__row" v-for="x in col" :key="String(x.def.key)">
            <span class="indices__k">
              <Icon :name="x.def.icon" class="i-icon"/>
              {{ t(x.def.tKey) }}
            </span>
            <span class="indices__val">{{ fmtIndex10(x.value) }}</span>
          </div>
        </div>
        <div v-if="hasAnyPrice(indices)" class="indices__title mt-2">
          {{ t("quizzes.countryFit.prices.title") }}
        </div>

        <div v-if="hasAnyPrice(indices)" class="indices__col" v-for="(col, ci) in priceColumns" :key="'p'+ci">
          <div class="indices__row" v-for="x in col" :key="String(x.def.key)">
    <span class="indices__k">
      <Icon :name="x.def.icon" class="i-icon"/>
      {{ t(x.def.labelKey) }}
    </span>
            <span class="indices__val">{{ fmtPrice(x.value, x.def.fmt) }}</span>
          </div>
        </div>
        <div class="indices__meta text-muted" v-if="indices?.updatedAtISO">
          {{ t("quizzes.countryFit.indices.updated") }}: {{ indices!.updatedAtISO.slice(0, 10) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-card {
  position: relative;
}

.ratings {
  display: grid;
  gap: 6px;
  text-align: right;
}

.rating__label {
  font-size: 11px;
  color: var(--text-white);
  line-height: 1;
}

.rating__val {
  font-weight: 900;
  font-size: 13px;
  color: var(--text-white);
  font-variant-numeric: tabular-nums;
}

.i-icon {
  width: 16px;
  height: 16px;
}

.indices {
  position: relative;
  display: inline-block;
}

.indices__trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
  cursor: default;
}

.indices__trigger:focus-visible {
  outline: 2px solid rgba(128, 90, 245, 0.55);
  outline-offset: 2px;
}

.indices__panel {
  position: absolute;
  z-index: 70;
  left: 0;
  top: calc(100% + 10px);
  width: 320px;

  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--ui-border);
  background: rgba(15, 15, 18, 0.92);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);

  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

.indices:hover .indices__panel,
.indices:focus-within .indices__panel {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.indices__title {
  font-weight: 900;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.92);
}

.indices__k {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.indices__val {
  font-variant-numeric: tabular-nums;
  font-weight: 900;
}

.indices__meta {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.25;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--ui-text-muted);
  line-height: 1;
}

.indices__grid {
  display: grid;
  gap: 10px;
}

.indices__grid.cols-1 {
  grid-template-columns: 1fr;
}

.indices__grid.cols-2 {
  grid-template-columns: 1fr 1fr;
}

.indices__grid.cols-3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.indices__col {
  min-width: 0;
}
</style>