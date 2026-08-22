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

const visibleRows = computed(() => {
  if (!props.hideEmptyLabel || !hideEmpty.value || !props.emptyValue) return props.rows;
  const empty = props.emptyValue.trim().toLocaleLowerCase();
  return props.rows.filter((row) => (
    !row.empty && row.value.trim().toLocaleLowerCase() !== empty
  ));
});
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
          <th>{{ row.label }}</th>
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

/* Narrow screens: let the label wrap and take a share of the width instead of
   forcing one long line that squeezes the value column. */
@media (max-width: 640px) {
  .spec-table__table th { white-space: normal; width: 42%; padding-right: 12px; }
}
</style>
