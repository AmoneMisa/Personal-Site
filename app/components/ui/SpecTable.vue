<script setup lang="ts">
// Key/value details table used by the flat, vacancy and candidate popups.
import { computed, ref } from "vue";

export interface SpecRow {
  label: string;
  value: string;
  empty?: boolean;
  tone?: "warning";
}

const props = withDefaults(defineProps<{
  rows: SpecRow[];
  /** Renders the toggle when given; omit it to always show every row. */
  hideEmptyLabel?: string;
  /** The rendered text that counts as "no value" (e.g. "Not specified"). */
  emptyValue?: string;
  /** Whether the toggle starts on. */
  hideEmptyDefault?: boolean;
  /** Explicit provenance from the currently opened flat. */
  visionDerivedFields?: string[];
}>(), { hideEmptyDefault: true, visionDerivedFields: () => [] });

const hideEmpty = ref(props.hideEmptyDefault);
const route = useRoute();
const { t, locale } = useI18n();

function queryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

type StoredFlat = {
  id?: string;
  source?: string;
  country?: string;
  dealType?: "sale" | "longRent" | "shortRent" | null;
  description?: string;
  rooms?: number | null;
  areaSqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor?: number | null;
  totalFloors?: number | null;
  address?: string | null;
  audience?: "women" | "men" | "family" | null;
  audienceAlternatives?: Array<"women" | "men" | "family">;
  commission?: boolean | null;
  commissionPercent?: number | null;
  cadastral?: boolean | null;
  firstRental?: boolean | null;
  potentiallyUnsafe?: boolean;
  roomOnly?: boolean;
  price?: number | null;
  currency?: string;
  vision?: { derivedFields?: string[] };
};

const currentFlatListing = computed<StoredFlat | null>(() => {
  void props.rows.length;
  if (!import.meta.client || !route.path.endsWith("/flat-finder")) return null;

  try {
    const recent = JSON.parse(localStorage.getItem("flats:recent:v1") || "[]") as StoredFlat[];
    if (!Array.isArray(recent) || !recent.length) return null;

    const id = queryString(route.query.flat);
    const source = queryString(route.query.flatSource).toLowerCase();
    const country = queryString(route.query.flatCountry).toUpperCase();
    return (id
      ? recent.find((item) => {
          if (String(item?.id || "") !== id) return false;
          if (source && String(item?.source || "").toLowerCase() !== source) return false;
          if (country && String(item?.country || "").toUpperCase() !== country) return false;
          return true;
        })
      : recent[0]) || null;
  } catch {
    return null;
  }
});

function parsedCount(text: string, labels: string, max = 12): number | null {
  const after = text.match(new RegExp(`(?:${labels})\\s*[:=\\-–—]?\\s*(\\d{1,2})`, "iu"));
  const before = text.match(new RegExp(`(\\d{1,2})\\s*(?:${labels})`, "iu"));
  const n = Number(after?.[1] ?? before?.[1]);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

function parsedBedrooms(text: string): number | null {
  return parsedCount(text, "спальн(?:я|и|ь|ых|ые|ю)?|спалень|bedrooms?|yotoq\\s*xona(?:si|lari)?|yotoqxona(?:si|lari)?|ётоқхона(?:си|лари)?");
}

function parsedBathrooms(text: string): number | null {
  return parsedCount(text, "сан\\s*уз(?:ел|ла|лов|лы)?|с\\s*[/\\\\]\\s*у|bathrooms?|sanuzel(?:lar)?|hammom(?:lar)?|hojatxona(?:lar)?");
}

function parsedCompactLayout(text: string): { rooms: number; floor: number; total: number } | null {
  const match = text.match(/(?:^|[^\d])(\d{1,2})\s*[\/\\]{1,2}\s*(\d{1,2})\s*[\/\\]{1,2}\s*(\d{1,2})(?=\s*[\/\\]*[^\d]|$)/u);
  const rooms = Number(match?.[1]);
  const floor = Number(match?.[2]);
  const total = Number(match?.[3]);
  return Number.isInteger(rooms) && rooms >= 1 && rooms <= 12
    && Number.isInteger(floor) && Number.isInteger(total)
    && floor >= 0 && floor <= total && total <= 40
    ? { rooms, floor, total }
    : null;
}

function parsedArea(text: string): number | null {
  const explicit = text.match(/(?:площад(?:ь|и)|метраж|area|maydon|майдон)\s*[:=\-–—]?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:м\s*[²2]|m\s*[²2]|кв\.?\s*м|kv\.?\s*m)?/iu)
    || text.match(/(?:^|[^\d])(\d{1,3}(?:[.,]\d+)?)\s*(?:м\s*[²2]|m\s*[²2]|кв\.?\s*м|kv\.?\s*m)(?=$|[\s,.;:\/\\])/iu);
  const shorthand = explicit ? null : text.match(/(?:^|[^\d])(\d{2,3})\s*(?:кв|kv)(?=$|[\s,.;:\/\\])/iu);
  const n = Number(String(explicit?.[1] ?? shorthand?.[1] ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= (explicit ? 5 : 15) && n <= (explicit ? 1000 : 500) ? n : null;
}

function parsedFloor(text: string): { floor: number; total: number } | null {
  const compact = parsedCompactLayout(text);
  if (compact) return { floor: compact.floor, total: compact.total };
  const match = text.match(/(?:этаж|эт\.|поверх|qavat|қабат|floor)[^\d\r\n]{0,8}(\d{1,2})\s*[\/\\]\s*(\d{1,2})|(?:^|[\r\n;|])\s*(\d{1,2})\s*[\/\\]\s*(\d{1,2})\s*(?=$|[\r\n;|])/imu);
  const floor = Number(match?.[1] ?? match?.[3]);
  const total = Number(match?.[2] ?? match?.[4]);
  return Number.isInteger(floor) && Number.isInteger(total) && floor >= 0 && floor <= total && total <= 40
    ? { floor, total }
    : null;
}

function parsedCommission(text: string): number | null {
  const broker = "(?:комисси[а-яёіїґ]*|комісі[а-яіїґ]*|commission|comision|komissiya|макл(?:ер[а-яё]*)?|makler|ри[еэ]лтор[а-яё]*|рієлтор[а-яіїґ]*|rieltor|realtor|broker|agent|vositachi|делдал)";
  const direct = text.match(new RegExp(`${broker}[^\\d%\\r\\n]{0,24}(\\d{1,3})\\s*%`, "iu"));
  const reverse = text.match(new RegExp(`(\\d{1,3})\\s*%[^\\r\\n]{0,24}${broker}`, "iu"));
  const ratio = text.match(new RegExp(`${broker}[^\\d\\r\\n]{0,24}(\\d{1,3})\\s*[/\\\\]\\s*(?:50|100)`, "iu"));
  const n = Number(direct?.[1] ?? reverse?.[1] ?? ratio?.[1]);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function phoneLike(value: string): boolean {
  return /\+?\d[\d\s().-]{7,}\d/.test(value) && value.replace(/\D/g, "").length >= 9;
}

function parsedCadastral(text: string): boolean | null {
  if (!/(?:кадастр|кадастров|kadastr|cadastr)/iu.test(text)) return null;
  if (/(?:без\s+кадастр|кадастр(?:а|овый\s+документ)?\s*(?:нет|отсутств)|kadastr\s*yo['’`]?q|fara\s+cadastr)/iu.test(text)) return false;
  return true;
}

function parsedFirstRental(text: string): boolean | null {
  if (/(?:не\s+первая\s+сдача|не\s+впервые\s+сда[её]тся|not\s+first\s+(?:rent|rental))/iu.test(text)) return false;
  if (/(?:первая\s+сдача|впервые\s+сда[её]тся|сда[её]тся\s+впервые|first\s+(?:rent|rental)|birinchi\s+(?:marta\s+)?ijara|ilk\s+ijara)/iu.test(text)) return true;
  return null;
}

function parsedMixedAudience(text: string): boolean {
  const family = /(?:семь[яеию]|семейн[а-яё]*|family|oila(?:ga|lar|li)?|оилага|оелага|oelaga)/iu.test(text);
  const women = /(?:девушк[а-яё]*|женщин[а-яё]*|girls?|women|qiz(?:lar)?(?:ga)?|киз(?:лар)?(?:га)?|қиз(?:лар)?(?:га)?)/iu.test(text);
  return family && women;
}

function clientPotentiallyUnsafe(listing: StoredFlat, text: string): boolean {
  if (listing.potentiallyUnsafe) return true;
  const singleWoman = /(?:только|нужн[а-яё]*|ищ[еу][а-яё]*|подсел[а-яё]*)[^\r\n.!?]{0,24}(?:одн(?:а|ой|у)|1)\s+(?:девушк[а-яё]*|женщин[а-яё]*)|(?:faqat\s+)?(?:1|bitta)\s+(?:qiz|ayol)(?:\s+(?:kerak|uchun))?/iu.test(text);
  if (!listing.roomOnly || !singleWoman) return false;
  const thresholds: Record<string, number> = { USD: 120, EUR: 110, UZS: 1_500_000, KZT: 55_000, UAH: 4_500, RON: 500 };
  const limit = thresholds[String(listing.currency || "").toUpperCase()];
  const price = Number(listing.price);
  return limit != null && Number.isFinite(price) && price > 0 && price <= limit;
}

const flatVisionDerivedFields = computed(() => new Set(
  props.visionDerivedFields.length
    ? props.visionDerivedFields.map(String)
    : Array.isArray(currentFlatListing.value?.vision?.derivedFields)
      ? currentFlatListing.value!.vision!.derivedFields!.map(String)
      : [],
));

const flatFieldByLabel = computed(() => new Map<string, string>([
  [t("flats.specBedrooms"), "bedrooms"],
  [t("flats.specBathrooms"), "bathrooms"],
  [t("flats.specCondition"), "condition"],
  [t("flats.specParking"), "parking"],
  [t("flats.specElevator"), "elevator"],
  [t("flats.specFurnished"), "furnished"],
  [t("flats.specBalcony"), "balcony"],
  [t("flats.specAC"), "airConditioner"],
]));

const visionAmenityFields = new Set([
  "closedYard",
  "kitchen",
  "washingMachine",
  "dishwasher",
  "tv",
  "gasWaterHeater",
  "waterBoiler",
]);

const aiVisionTitle = computed(() => locale.value.startsWith("en")
  ? "Data from AI Vision"
  : "Данные из AI-Vision");

function aiHintForRow(row: SpecRow): string | null {
  const fields = flatVisionDerivedFields.value;
  if (!fields.size) return null;

  if (row.label === t("flats.specAmenities")) {
    return [...visionAmenityFields].some((field) => fields.has(field)) ? aiVisionTitle.value : null;
  }

  const field = flatFieldByLabel.value.get(row.label);
  return field && fields.has(field) ? aiVisionTitle.value : null;
}

const contextualRows = computed<SpecRow[]>(() => {
  const listing = currentFlatListing.value;
  if (!listing) return props.rows;

  const empty = props.emptyValue || t("flats.notSpecified");
  const text = String(listing.description || "");
  const compact = parsedCompactLayout(text);
  const roomCount = listing.rooms ?? compact?.rooms ?? null;
  const areaSqm = listing.areaSqm ?? parsedArea(text);
  const bedroomCount = listing.bedrooms ?? parsedBedrooms(text);
  const bathroomCount = listing.bathrooms ?? parsedBathrooms(text);
  const floor = (listing.floor == null || listing.totalFloors == null) ? parsedFloor(text) : null;
  const commission = listing.commissionPercent ?? parsedCommission(text);
  const isSale = listing.dealType === "sale";
  const saleHiddenLabels = new Set([t("flats.specAudience"), t("flats.specRoomShare")]);
  const alternatives = new Set(listing.audienceAlternatives || []);
  const mixedAudience = (alternatives.has("family") && alternatives.has("women")) || parsedMixedAudience(text);

  let rows = props.rows
    .filter((row) => !(isSale && saleHiddenLabels.has(row.label)))
    .map((row): SpecRow => {
      if (row.label === t("flats.specRooms") && roomCount != null) return { ...row, value: String(roomCount), empty: false };
      if (row.label === t("flats.specArea") && areaSqm != null) return { ...row, value: `${areaSqm} ${t("flats.sqm")}`, empty: false };
      if (row.label === t("flats.specBedrooms") && bedroomCount != null) return { ...row, value: String(bedroomCount), empty: false };
      if (row.label === t("flats.specBathrooms") && bathroomCount != null) return { ...row, value: String(bathroomCount), empty: false };
      if (row.label === t("flats.specFloor") && floor) return { ...row, value: `${floor.floor} / ${floor.total}`, empty: false };
      if (row.label === t("flats.specCommission") && commission != null) return { ...row, value: `${commission}%`, empty: false };
      if (row.label === t("flats.specAudience") && mixedAudience) return { ...row, value: locale.value.startsWith("en") ? "Family or women" : "Семья или девушки", empty: false };
      if (row.label === t("flats.specAddress") && phoneLike(row.value)) return { ...row, value: empty, empty: true };
      return row;
    });

  const ru = String(locale.value).startsWith("ru");
  const boolValue = (value: boolean | null | undefined) => value === true ? t("flats.yes") : value === false ? t("flats.no") : empty;

  if (isSale) {
    const value = listing.cadastral ?? parsedCadastral(text);
    rows = [
      ...rows.slice(0, 4),
      { label: ru ? "Есть кадастр" : "Cadastral documents", value: boolValue(value), empty: value == null },
      ...rows.slice(4),
    ];
  } else {
    const value = listing.firstRental ?? parsedFirstRental(text);
    rows = [
      ...rows.slice(0, 4),
      { label: ru ? "Первая сдача" : "First rental", value: boolValue(value), empty: value == null },
      ...rows.slice(4),
    ];
  }

  if (!isSale && clientPotentiallyUnsafe(listing, text)) {
    rows.unshift({
      label: ru ? "Безопасность" : "Safety",
      value: ru ? "Потенциально опасное объявление" : "Potentially unsafe listing",
      tone: "warning",
    });
  }

  return rows;
});

const visibleRows = computed(() => {
  if (!props.hideEmptyLabel || !hideEmpty.value || !props.emptyValue) return contextualRows.value;
  const empty = props.emptyValue.trim().toLocaleLowerCase();
  return contextualRows.value.filter((row) => (
    !row.empty && row.value.trim().toLocaleLowerCase() !== empty
  ));
});
</script>

<template>
  <div class="spec-table">
    <label v-if="hideEmptyLabel" class="spec-table__toggle">
      <u-switch v-model="hideEmpty" :aria-label="hideEmptyLabel" />
      <span>{{ hideEmptyLabel }}</span>
    </label>
    <table class="spec-table__table">
      <tbody>
        <tr v-for="row in visibleRows" :key="row.label" :class="{ 'spec-table__row_warning': row.tone === 'warning' }">
          <th>
            <span>{{ row.label }}</span>
            <span
              v-if="aiHintForRow(row)"
              class="spec-table__ai-hint"
              :title="aiHintForRow(row) || undefined"
              :aria-label="aiHintForRow(row) || undefined"
              tabindex="0"
            >(?)</span>
          </th>
          <td>{{ row.value }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.spec-table { display: flex; flex-direction: column; gap: 8px; }

.spec-table__toggle {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 9px;
  min-height: 24px;
  font-size: 12px;
  color: var(--text-muted, #9ea4c1);
  cursor: pointer;
  user-select: none;
}
.spec-table__toggle :deep(.u-switch) { vertical-align: middle; }

.spec-table__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.spec-table__table tr { border-bottom: 1px solid var(--line, #252a4a); }
.spec-table__table tr:last-child { border-bottom: none; }
.spec-table__table th {
  width: 1%;
  white-space: nowrap;
  text-align: left;
  font-weight: 600;
  padding: 7px 24px 7px 0;
  color: var(--text-muted, #9ea4c1);
  opacity: 0.75;
  vertical-align: top;
}
.spec-table__table td { padding: 7px 0; vertical-align: top; overflow-wrap: anywhere; }
.spec-table__row_warning th,
.spec-table__row_warning td { color: #f2b86b; opacity: 1; font-weight: 700; }
.spec-table__ai-hint {
  display: inline-block;
  margin-left: 5px;
  color: var(--accent-pink, #e0679a);
  font-size: 11px;
  font-weight: 700;
  cursor: help;
  opacity: 1;
}
.spec-table__ai-hint:focus-visible {
  outline: 1px solid currentColor;
  outline-offset: 2px;
  border-radius: 2px;
}

@media (max-width: 640px) {
  .spec-table__table th { white-space: normal; width: 42%; padding-right: 12px; }
}
</style>