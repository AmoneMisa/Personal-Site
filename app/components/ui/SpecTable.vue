<script setup lang="ts">
// Key/value details table used by the flat, vacancy and candidate popups.
//
// All three had the same markup and the same ~8 CSS rules copied out, and two
// of them also repeated the "hide empty fields" ref + computed. That is now
// owned here: pass the rows, optionally pass the label for the toggle, and the
// filtering happens inside.
import { computed, ref } from "vue";

export interface SpecRow { label: string; value: string; empty?: boolean }

const props = withDefaults(defineProps<{
  rows: SpecRow[];
  /** Renders the toggle when given; omit it to always show every row. */
  hideEmptyLabel?: string;
  /** The rendered text that counts as "no value" (e.g. "Not specified"). */
  emptyValue?: string;
  /** Whether the toggle starts on. */
  hideEmptyDefault?: boolean;
}>(), { hideEmptyDefault: true });

const hideEmpty = ref(props.hideEmptyDefault);
const route = useRoute();
const { t, locale } = useI18n();

const visibleRows = computed(() => {
  if (!props.hideEmptyLabel || !hideEmpty.value || !props.emptyValue) return props.rows;
  const empty = props.emptyValue.trim().toLocaleLowerCase();
  return props.rows.filter((row) => (
    !row.empty && row.value.trim().toLocaleLowerCase() !== empty
  ));
});

function queryString(value: unknown): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

type StoredFlat = {
  id?: string;
  source?: string;
  country?: string;
  vision?: { derivedFields?: string[] };
};

// Flat Finder stores the listing that was just opened in the recent-list cache.
// Read provenance from that same object so this shared table does not need a
// Flat-Finder-specific prop and we do not perform another HTTP request solely to
// paint a tooltip. Other pages using UiSpecTable are unaffected.
const flatVisionDerivedFields = computed(() => {
  // `rows` changes when a modal opens. Touch it so a deep-linked flat whose URL
  // already contained `flat=` still re-reads localStorage after openListing()
  // persists the current listing.
  void props.rows.length;
  if (!import.meta.client || !route.path.endsWith("/flat-finder")) return new Set<string>();

  try {
    const recent = JSON.parse(localStorage.getItem("flats:recent:v1") || "[]") as StoredFlat[];
    if (!Array.isArray(recent) || !recent.length) return new Set<string>();

    const id = queryString(route.query.flat);
    const source = queryString(route.query.flatSource).toLowerCase();
    const country = queryString(route.query.flatCountry).toUpperCase();
    const listing = id
      ? recent.find((item) => {
          if (String(item?.id || "") !== id) return false;
          if (source && String(item?.source || "").toLowerCase() !== source) return false;
          if (country && String(item?.country || "").toUpperCase() !== country) return false;
          return true;
        })
      : recent[0];

    return new Set(
      Array.isArray(listing?.vision?.derivedFields)
        ? listing.vision.derivedFields.map(String)
        : [],
    );
  } catch {
    return new Set<string>();
  }
});

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
  ? "Detected using AI vision"
  : "Распознано при помощи AI-зрения");

function aiHintForRow(row: SpecRow): string | null {
  const fields = flatVisionDerivedFields.value;
  if (!fields.size) return null;

  if (row.label === t("flats.specAmenities")) {
    return [...visionAmenityFields].some((field) => fields.has(field)) ? aiVisionTitle.value : null;
  }

  const field = flatFieldByLabel.value.get(row.label);
  return field && fields.has(field) ? aiVisionTitle.value : null;
}
</script>

<template>
  <div class="spec-table">
    <label v-if="hideEmptyLabel" class="spec-table__toggle">
      <input v-model="hideEmpty" type="checkbox" />
      <span>{{ hideEmptyLabel }}</span>
    </label>
    <table class="spec-table__table">
      <tbody>
        <tr v-for="row in visibleRows" :key="row.label">
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
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted, #9ea4c1);
  cursor: pointer;
  user-select: none;
}

.spec-table__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.spec-table__table tr { border-bottom: 1px solid var(--line, #252a4a); }
.spec-table__table tr:last-child { border-bottom: none; }
/* The label column shrinks to its widest label so values sit right beside it,
   rather than a fixed percentage that leaves a wide empty strip. */
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

/* Narrow screens: let the label wrap and take a share of the width instead of
   forcing one long line that squeezes the value column. */
@media (max-width: 640px) {
  .spec-table__table th { white-space: normal; width: 42%; padding-right: 12px; }
}
</style>
