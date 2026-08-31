<script setup lang="ts">
import { computed } from "vue";
import type { FlatTransportStop } from "~/types/flats";

const props = defineProps<{
  title: string;
  icon: string;
  stops: FlatTransportStop[];
}>();

const orderedStops = computed(() => [...props.stops].sort((left, right) => {
  const distance = Number(left.distanceM || 0) - Number(right.distanceM || 0);
  if (distance !== 0) return distance;
  return String(left.name || "").localeCompare(String(right.name || ""));
}));

function routeRefs(stop: FlatTransportStop): string {
  const refs = (stop.routeRefs || [])
    .map((route) => String(route || "").trim())
    .filter(Boolean);
  return refs.length ? refs.join(", ") : "—";
}

function distanceLabel(stop: FlatTransportStop): string {
  const distance = Number(stop.distanceM);
  return Number.isFinite(distance) && distance >= 0 ? `${Math.round(distance)} m` : "—";
}
</script>

<template>
  <section class="flat-transport-table">
    <h4 class="flat-transport-table__title">
      <u-icon :name="icon" aria-hidden="true" />
      <span>{{ title }}</span>
    </h4>

    <div class="flat-transport-table__rows" role="table" :aria-label="title">
      <div
        v-for="stop in orderedStops"
        :key="`${stop.id}:${stop.distanceM}`"
        class="flat-transport-table__row"
        role="row"
      >
        <span class="flat-transport-table__routes" role="cell" :title="routeRefs(stop)">
          {{ routeRefs(stop) }}
        </span>
        <span class="flat-transport-table__stop" role="cell" :title="stop.name">
          {{ stop.name }}
        </span>
        <span class="flat-transport-table__distance" role="cell">
          <u-icon name="i-lucide-map-pin" aria-hidden="true" />
          {{ distanceLabel(stop) }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.flat-transport-table {
  --transport-row-height: 42px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line, #252a4a);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-panel, #131730) 92%, transparent);
}

.flat-transport-table__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin: 0;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line, #252a4a);
  color: var(--text-primary, #e4e5f0);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.flat-transport-table__title :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--accent-pink, #e0679a);
}

.flat-transport-table__rows {
  min-width: 0;
  max-height: calc(var(--transport-row-height) * 7);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.flat-transport-table__row {
  display: grid;
  grid-template-columns: minmax(34px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: var(--transport-row-height);
  padding: 7px 9px;
  border-bottom: 1px solid var(--line, #252a4a);
}
.flat-transport-table__row:last-child { border-bottom: 0; }

.flat-transport-table__routes {
  min-width: 0;
  max-width: 72px;
  padding: 2px 5px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent-pink, #e0679a) 70%, transparent);
  border-radius: 4px;
  color: var(--accent-pink, #e0679a);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flat-transport-table__stop {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary, #e4e5f0);
  font-size: 11.5px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
.flat-transport-table__distance {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--text-muted, #9ea4c1);
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.flat-transport-table__distance :deep(svg) {
  width: 12px;
  height: 12px;
  color: var(--accent-pink, #e0679a);
}

@media (max-width: 520px) {
  .flat-transport-table__row {
    grid-template-columns: minmax(32px, auto) minmax(0, 1fr);
    align-items: start;
    gap: 4px 6px;
  }
  .flat-transport-table__routes { grid-row: 1 / span 2; }
  .flat-transport-table__distance { grid-column: 2; }
}
</style>
