<script setup lang="ts">
// Key/value details table used by the flat, vacancy and candidate popups.
// Flat Finder parsing belongs to @whiteslove/parsing-lexicon/backend ingestion;
// this component only presents normalized listing fields.
import { computed, ref } from "vue";
import { localizeJobLanguageList } from "~/utils/jobs/languageLabel";
import { capitalizeFirst } from "~/utils/text";

export interface SpecRow {
  label: string;
  value: string;
  empty?: boolean;
  tone?: "warning";
  group?: string;
  groupLabel?: string;
  column?: 1 | 2 | 3;
  icon?: string;
  /** Multi-item list values (nearby places, shops) wrap instead of being clipped to one line. */
  wrap?: boolean;
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
const isFlatFinder = computed(() => route.path.endsWith("/flat-finder"));
const isJobs = computed(() => route.path.endsWith("/jobs"));

function queryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

type StoredFlat = {
  id?: string;
  source?: string;
  country?: string;
  dealType?: "sale" | "longRent" | "shortRent" | null;
  audienceAlternatives?: Array<"women" | "men" | "family">;
  cadastral?: boolean | null;
  firstRental?: boolean | null;
  potentiallyUnsafe?: boolean;
  vision?: { derivedFields?: string[] };
};

const currentFlatListing = computed<StoredFlat | null>(() => {
  void props.rows.length;
  if (!import.meta.client || !isFlatFinder.value) return null;

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
  [t("flats.specCity"), "city"],
  [t("flats.specDistrict"), "district"],
  [t("flats.specMetro"), "metro"],
  [t("flats.specAddress"), "address"],
  [t("flats.specShops"), "nearbyShops"],
  [t("flats.specNearby"), "nearby"],
]));

// Free-text "meaning" values (as opposed to numbers-with-units, booleans or
// already-translated enum labels) get their first letter capitalized for
// display, since the underlying source text is sometimes all-lowercase.
// Matched by translated label so it works across locales, following the
// same pattern as flatFieldByLabel above.
const freeTextLabels = computed(() => new Set([
  t("flats.specAddress"),
  t("flats.specKvartal"),
  t("flats.specComplex"),
  t("hiring.specEducation"),
  t("hiring.specContactHours"),
  t("jobs.vCompany"),
  t("jobs.vLocation"),
  t("jobs.vCity"),
  t("jobs.vSchedule"),
  t("jobs.vContractType"),
  t("jobs.vEducation"),
  t("jobs.vApplicationLanguage"),
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
  ? "Data obtained with AI vision"
  : "Данные при помощи AI-зрения");

function aiHintForRow(row: SpecRow): string | null {
  const fields = flatVisionDerivedFields.value;
  if (!fields.size) return null;

  if (row.label === t("flats.specAmenities")) {
    return [...visionAmenityFields].some((field) => fields.has(field)) ? aiVisionTitle.value : null;
  }

  const field = flatFieldByLabel.value.get(row.label);
  return field && fields.has(field) ? aiVisionTitle.value : null;
}

function displayLabel(row: SpecRow): string {
  if (!isFlatFinder.value) return row.label;
  const english = String(locale.value).toLowerCase().startsWith("en");
  if (row.label === t("flats.specRooms")) return english ? "Number of rooms" : "Количество комнат";
  if (row.label === t("flats.specBedrooms")) return english ? "Number of bedrooms" : "Количество спален";
  if (row.label === t("flats.specBathrooms")) return english ? "Number of bathrooms" : "Количество с/у";
  return row.label;
}

function withFreeTextCase(row: SpecRow, value: string): string {
  return freeTextLabels.value.has(row.label) ? capitalizeFirst(value) : value;
}

function displayValue(row: SpecRow): string {
  if (!isJobs.value) return withFreeTextCase(row, row.value);

  if (row.label === t("jobs.vLanguages") || row.label === t("jobs.vApplicationLanguage")) {
    return localizeJobLanguageList(row.value, (key) => t(`jobs.${key}`));
  }

  // Older enriched vacancies persisted human-readable English labels instead of
  // enum codes. Localize those legacy values at render time so saved/cache data
  // is fixed immediately without requiring a full jobs re-ingestion.
  const replacements: Array<[RegExp, string]> = [
    [/\bShift work\b/gi, t("jobs.scheduleShift")],
    [/\bFlexible(?: schedule)?\b/gi, t("jobs.scheduleFlexible")],
    [/\bDay shift\b|\bDay\b/gi, t("jobs.scheduleDay")],
    [/\bNight shift\b|\bNight\b/gi, t("jobs.scheduleNight")],
    [/\bRotational(?: schedule)?\b/gi, t("jobs.scheduleRotational")],
    [/\bEmployment contract\b/gi, t("jobs.contractEmployment")],
    [/\bCivil contract\b/gi, t("jobs.contractCivil")],
    [/\bContractor\b/gi, t("jobs.contractContractor")],
    [/\bFreelance\b/gi, t("jobs.contractFreelance")],
    [/\brequired\b/gi, t("jobs.requirementRequired")],
    [/\bpreferred\b/gi, t("jobs.requirementPreferred")],
    [/\bnot required\b|\bnotRequired\b/gi, t("jobs.requirementNotRequired")],
    [/\bPrototyping\b/gi, t("jobs.skillPrototyping")],
  ];

  const localized = replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), row.value);
  return withFreeTextCase(row, localized);
}

const contextualRows = computed<SpecRow[]>(() => {
  const listing = currentFlatListing.value;
  if (!listing) return props.rows;

  const empty = props.emptyValue || t("flats.notSpecified");
  const english = String(locale.value).toLowerCase().startsWith("en");
  const isSale = listing.dealType === "sale";
  const saleHiddenLabels = new Set([t("flats.specAudience"), t("flats.specRoomShare")]);
  const alternatives = new Set(listing.audienceAlternatives || []);
  const mixedAudience = alternatives.has("family") && alternatives.has("women");

  let rows = props.rows
    .filter((row) => !(isSale && saleHiddenLabels.has(row.label)))
    .map((row): SpecRow => {
      if (row.label === t("flats.specAudience") && mixedAudience) {
        return { ...row, value: english ? "Family or women" : "Семья или девушки", empty: false };
      }
      return row;
    });

  const boolValue = (value: boolean | null | undefined) => value === true
    ? t("flats.yes")
    : value === false
      ? t("flats.no")
      : empty;

  if (isSale) {
    const value = listing.cadastral;
    rows = [
      ...rows.slice(0, 4),
      {
        label: english ? "Cadastral documents" : "Есть кадастр",
        value: boolValue(value),
        empty: value == null,
        group: "property",
        groupLabel: t("flats.specGroupProperty"),
        column: 1,
      },
      ...rows.slice(4),
    ];
  } else {
    const value = listing.firstRental;
    rows = [
      ...rows.slice(0, 4),
      {
        label: english ? "First rental" : "Первая сдача",
        value: boolValue(value),
        empty: value == null,
        group: "property",
        groupLabel: t("flats.specGroupProperty"),
        column: 1,
      },
      ...rows.slice(4),
    ];
  }

  if (listing.potentiallyUnsafe) {
    rows.unshift({
      label: english ? "Safety" : "Безопасность",
      value: english ? "Potentially unsafe listing" : "Потенциально опасное объявление",
      tone: "warning",
      group: "advert",
      groupLabel: t("flats.specGroupAdvert"),
      column: 1,
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

const usesGroupedColumns = computed(() => isFlatFinder.value || visibleRows.value.some((row) => row.group && row.column));

const specColumns = computed(() => {
  const columns: Array<Array<{ id: string; label: string; rows: SpecRow[] }>> = [[], [], []];
  for (const row of visibleRows.value) {
    const column = Math.min(3, Math.max(1, Number(row.column) || 1)) - 1;
    const id = row.group || `column-${column + 1}`;
    let section = columns[column]!.find((item) => item.id === id);
    if (!section) {
      section = { id, label: row.groupLabel || "", rows: [] };
      columns[column]!.push(section);
    }
    section.rows.push(row);
  }
  return columns;
});

const flatSpecIconByLabel = computed(() => new Map<string, string>([
  [t("flats.specDeal"), "i-lucide-tag"],
  [t("flats.specType"), "i-lucide-house"],
  [t("flats.specListedBy"), "i-lucide-user-round"],
  [t("flats.specSource"), "i-lucide-external-link"],
  [t("flats.specRooms"), "i-lucide-door-open"],
  [t("flats.specBedrooms"), "i-lucide-bed-double"],
  [t("flats.specBathrooms"), "i-lucide-bath"],
  [t("flats.specArea"), "i-lucide-scan"],
  [t("flats.specFloor"), "i-lucide-layers-3"],
  [t("flats.specYear"), "i-lucide-calendar-days"],
  [t("flats.specNewBuilding"), "i-lucide-building-2"],
  [t("flats.specCondition"), "i-lucide-paint-roller"],
  [t("flats.specComplex"), "i-lucide-building"],
  [t("flats.specCity"), "i-lucide-map"],
  [t("flats.specDistrict"), "i-lucide-map-pinned"],
  [t("flats.specKvartal"), "i-lucide-blocks"],
  [t("flats.specMetro"), "i-lucide-train-front"],
  [t("flats.specAddress"), "i-lucide-map-pin"],
  [t("flats.specParking"), "i-lucide-square-parking"],
  [t("flats.specElevator"), "i-lucide-arrow-up-down"],
  [t("flats.specFurnished"), "i-lucide-armchair"],
  [t("flats.specBalcony"), "i-lucide-panel-top"],
  [t("flats.specAC"), "i-lucide-snowflake"],
  [t("flats.specGas"), "i-lucide-flame"],
  [t("flats.specHeating"), "i-lucide-heater"],
  [t("flats.specHotWater"), "i-lucide-waves"],
  [t("flats.specInternet"), "i-lucide-wifi"],
  [t("flats.specPets"), "i-lucide-paw-print"],
  [t("flats.specChildren"), "i-lucide-baby"],
  [t("flats.specSmoking"), "i-lucide-cigarette"],
  [t("flats.specAudience"), "i-lucide-users-round"],
  [t("flats.specRoomShare"), "i-lucide-user-plus"],
  [t("flats.specNegotiable"), "i-lucide-hand-coins"],
  [t("flats.specDeposit"), "i-lucide-shield-check"],
  [t("flats.specCommission"), "i-lucide-percent"],
  [t("flats.specCommunal"), "i-lucide-receipt-text"],
  [t("flats.specUtilAmount"), "i-lucide-wallet-cards"],
  [t("flats.specMinLease"), "i-lucide-calendar-range"],
  [t("flats.specAvailable"), "i-lucide-calendar-check"],
  [t("flats.specShops"), "i-lucide-shopping-bag"],
  [t("flats.specNearby"), "i-lucide-navigation"],
  [t("flats.specAmenities"), "i-lucide-sparkles"],
]));

function iconForRow(row: SpecRow): string {
  if (row.icon) return row.icon;
  if (row.tone === "warning") return "i-lucide-triangle-alert";
  if (/кадастр|cadastral/i.test(row.label)) return "i-lucide-file-check-2";
  if (/первая сдача|first rental/i.test(row.label)) return "i-lucide-key-round";
  return flatSpecIconByLabel.value.get(row.label) || "i-lucide-info";
}
</script>

<template>
  <div class="spec-table" :class="{ 'spec-table_flat': isFlatFinder }">
    <div v-if="$slots.header || hideEmptyLabel" class="spec-table__head">
      <slot name="header" />
      <label v-if="hideEmptyLabel" class="spec-table__toggle">
        <u-switch v-model="hideEmpty" :aria-label="hideEmptyLabel" />
        <span>{{ hideEmptyLabel }}</span>
      </label>
    </div>

    <div v-if="usesGroupedColumns" class="spec-table__grid" role="list">
      <div v-for="(column, columnIndex) in specColumns" :key="columnIndex" class="spec-table__column">
        <section v-for="section in column" :key="section.id" class="spec-table__section">
          <h3 v-if="section.label" class="spec-table__section-title">{{ section.label }}</h3>
          <div
            v-for="row in section.rows"
            :key="row.label"
            class="spec-table__item"
            :class="{ 'spec-table__row_warning': row.tone === 'warning' }"
            role="listitem"
          >
            <span
              class="spec-table__icon"
              :data-tooltip="displayLabel(row)"
              :aria-label="displayLabel(row)"
              tabindex="0"
            >
              <u-icon :name="iconForRow(row)" />
            </span>
            <span class="spec-table__value" :class="{ 'spec-table__value_wrap': row.wrap }" :title="displayValue(row)">{{ displayValue(row) }}</span>
            <span
              v-if="aiHintForRow(row)"
              class="spec-table__ai-hint spec-table__ai-hint_grid"
              :title="aiHintForRow(row) || undefined"
              :aria-label="aiHintForRow(row) || undefined"
              tabindex="0"
            >(?)</span>
          </div>
        </section>
      </div>
    </div>

    <table v-else class="spec-table__table">
      <tbody>
        <tr v-for="row in visibleRows" :key="row.label" :class="{ 'spec-table__row_warning': row.tone === 'warning' }">
          <th>
            <span>{{ displayLabel(row) }}</span>
            <span
              v-if="aiHintForRow(row)"
              class="spec-table__ai-hint"
              :title="aiHintForRow(row) || undefined"
              :aria-label="aiHintForRow(row) || undefined"
              tabindex="0"
            >(?)</span>
          </th>
          <td>{{ displayValue(row) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.spec-table { display: flex; flex-direction: column; gap: 8px; }
.spec-table__head { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; min-width: 0; }

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
.spec-table_flat .spec-table__toggle { flex: 0 0 auto; margin-left: auto; }
.spec-table__toggle :deep(.u-switch) { vertical-align: middle; }

.spec-table__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  border-top: 1px solid var(--line, #252a4a);
}
.spec-table__column {
  display: flex;
  flex-direction: column;
  align-self: start;
  min-width: 0;
}
.spec-table__column + .spec-table__column { border-left: 1px solid var(--line, #252a4a); }
.spec-table__section-title {
  display: flex;
  align-items: center;
  margin: 0;
  height: 46px;
  padding: 8px 10px;
  overflow: hidden;
  background: var(--bg-panel, #131730);
  border-bottom: 1px solid var(--line, #252a4a);
  color: var(--text-muted, #9ea4c1);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.spec-table__item {
  position: relative;
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 46px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line, #252a4a);
}
.spec-table__icon {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: var(--accent-pink, #e0679a);
  cursor: help;
  outline: none;
}
.spec-table__icon :deep(svg) { width: 17px; height: 17px; }
.spec-table__icon::after {
  content: attr(data-tooltip);
  position: absolute;
  z-index: 20;
  left: 50%;
  bottom: calc(100% + 7px);
  width: max-content;
  max-width: 220px;
  padding: 5px 7px;
  border: 1px solid var(--line, #252a4a);
  border-radius: 6px;
  background: var(--bg-panel, #10152c);
  color: var(--text-primary, #e4e5f0);
  box-shadow: 0 8px 22px rgba(0, 0, 0, .3);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  white-space: normal;
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.spec-table__icon:hover::after,
.spec-table__icon:focus-visible::after { opacity: 1; transform: translate(-50%, 0); }
.spec-table__icon:focus-visible { border-radius: 5px; box-shadow: 0 0 0 1px currentColor; }
.spec-table__value {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary, #e4e5f0);
  font-size: 12.5px;
  line-height: 1.3;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.spec-table__value_wrap {
  overflow: visible;
  white-space: normal;
  overflow-wrap: anywhere;
  text-overflow: clip;
}
.spec-table__ai-hint_grid { margin-left: 0 !important; font-size: 9px !important; }

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
.spec-table__row_warning,
.spec-table__row_warning .spec-table__value,
.spec-table__row_warning .spec-table__icon,
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

@media (max-width: 720px) {
  .spec-table__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .spec-table__column:nth-child(3) {
    grid-column: 1 / -1;
    border-top: 1px solid var(--line, #252a4a);
    border-left: 0;
  }
}
@media (max-width: 640px) {
  .spec-table__table th { white-space: normal; width: 42%; padding-right: 12px; }
}
@media (max-width: 430px) {
  .spec-table__head { align-items: flex-start; gap: 8px 12px; }
}
</style>