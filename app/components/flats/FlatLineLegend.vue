<script setup lang="ts">
// Legend for the coloured card lines. Sticks to the bottom of the viewport
// while the results scroll past, as in the design.
import { listingLineLegend } from "~/utils/flats/listingLine";

const { locale } = useI18n();
const items = computed(() => listingLineLegend(locale.value));
const label = computed(() => (String(locale.value).startsWith("en") ? "Card lines" : "Цвет рамки"));
</script>

<template>
  <aside class="flat-line-legend" :aria-label="label">
    <ul>
      <li v-for="item in items" :key="item.line" class="flat-line-legend__item">
        <span class="flat-line-legend__swatch" :class="`flat-line-legend__swatch_${item.line}`" aria-hidden="true" />
        <span class="flat-line-legend__title">{{ item.title }}</span>
        <span class="flat-line-legend__hint">{{ item.hint }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped lang="scss">
@use "../../assets/css/mixins/breakpoints" as *;
.flat-line-legend {
  position: sticky;
  z-index: 6;
  bottom: 12px;
  margin-top: 14px;
  padding: 12px 16px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(10, 14, 36, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(6px);
}
.flat-line-legend ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px 14px;
}
.flat-line-legend__item {
  min-width: 0;
  display: grid;
  gap: 3px;
  font-size: 12.5px;
  line-height: 1.3;
}
.flat-line-legend__swatch {
  width: 34px;
  height: 3px;
  border-radius: 3px;
  margin-bottom: 4px;
}
.flat-line-legend__swatch_steady { background: var(--flat-line-steady); }
.flat-line-legend__swatch_check { background: var(--flat-line-check); }
.flat-line-legend__swatch_phantom_risk { background: var(--flat-line-phantom); }
.flat-line-legend__swatch_multi_listing { background: var(--flat-line-multi); }
.flat-line-legend__swatch_none { background: var(--flat-line-none); }
.flat-line-legend__title,
.flat-line-legend__hint {
  /* Five columns on a phone are ~57px wide; long Russian words must wrap. */
  hyphens: auto;
  overflow-wrap: anywhere;
}
.flat-line-legend__title { color: var(--text-primary); }
.flat-line-legend__hint { color: var(--text-muted); font-size: 11.5px; }
@include bp-down(md) {
  .flat-line-legend { bottom: 8px; padding: 10px 12px; }
  .flat-line-legend ul { gap: 8px; }
  .flat-line-legend__item { font-size: 10px; }
  .flat-line-legend__hint { font-size: 9.5px; }
  .flat-line-legend__swatch { width: 26px; }
}
</style>
