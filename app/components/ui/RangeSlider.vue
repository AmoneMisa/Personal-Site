<script setup lang="ts">
// Two-thumb range slider built from two stacked native range inputs, so
// keyboard, touch and screen readers work without a custom pointer model.
//
// An unset side (undefined) means "no bound": its thumb rests on the track end,
// and dragging a thumb back onto its end clears that side again instead of
// pinning the filter to today's cheapest or dearest listing.
import { computed } from "vue";

const props = withDefaults(defineProps<{
  min: number;
  max: number;
  from?: number | null;
  to?: number | null;
  step?: number;
  fromLabel?: string;
  toLabel?: string;
  format?: (value: number) => string;
}>(), { step: 1 });

const emit = defineEmits<{
  (e: "update:from" | "update:to", value: number | undefined): void;
  /** Fired once the visitor lets go, not on every pixel of a drag. */
  (e: "change"): void;
}>();

const isSet = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

// A native range input only lands on min + k*step, so with min 120 and step 50
// the top would stop at 4 770. Widen the track to whole steps on both ends.
const lo = computed(() => Math.floor(props.min / props.step) * props.step);
const hi = computed(() => Math.max(lo.value + props.step, Math.ceil(props.max / props.step) * props.step));
const clamp = (value: number) => Math.min(hi.value, Math.max(lo.value, value));

const fromValue = computed(() => (isSet(props.from) ? clamp(props.from) : lo.value));
const toValue = computed(() => (isSet(props.to) ? clamp(props.to) : hi.value));

const span = computed(() => hi.value - lo.value);
const percent = (value: number) => ((value - lo.value) / span.value) * 100;
const fillStyle = computed(() => ({
  left: `${percent(fromValue.value)}%`,
  right: `${100 - percent(toValue.value)}%`,
}));

function onFrom(event: Event) {
  const value = Math.min(Number((event.target as HTMLInputElement).value), toValue.value);
  (event.target as HTMLInputElement).value = String(value);
  emit("update:from", value <= lo.value ? undefined : value);
}
function onTo(event: Event) {
  const value = Math.max(Number((event.target as HTMLInputElement).value), fromValue.value);
  (event.target as HTMLInputElement).value = String(value);
  emit("update:to", value >= hi.value ? undefined : value);
}

// The upper input is stacked on top, so with both thumbs pushed to the right
// end only the upper one could be grabbed. Lift the lower one in that half.
const fromRaised = computed(() => fromValue.value > lo.value + span.value / 2);

const show = (value: number) => (props.format ? props.format(value) : String(value));
</script>

<template>
  <div class="range-slider">
    <div class="range-slider__track">
      <div class="range-slider__fill" :style="fillStyle" />
      <input
          class="range-slider__input"
          type="range"
          :min="lo"
          :max="hi"
          :step="step"
          :value="fromValue"
          :class="{ 'range-slider__input_raised': fromRaised }"
          :aria-label="fromLabel"
          :aria-valuetext="show(fromValue)"
          @input="onFrom"
          @change="emit('change')"
      />
      <input
          class="range-slider__input"
          type="range"
          :min="lo"
          :max="hi"
          :step="step"
          :value="toValue"
          :aria-label="toLabel"
          :aria-valuetext="show(toValue)"
          @input="onTo"
          @change="emit('change')"
      />
    </div>
    <div class="range-slider__bounds" aria-hidden="true">
      <span>{{ show(lo) }}</span>
      <span>{{ show(hi) }}</span>
    </div>
  </div>
</template>

<style scoped>
.range-slider { --thumb: 18px; min-width: 0; padding: 0 calc(var(--thumb) / 2); }
.range-slider__track { position: relative; height: var(--thumb); }
.range-slider__track::before,
.range-slider__fill {
  position: absolute;
  top: 50%;
  height: 4px;
  border-radius: 999px;
  transform: translateY(-50%);
}
.range-slider__track::before { content: ""; left: 0; right: 0; background: var(--line); }
.range-slider__fill { background: rgb(224, 103, 154); }

/* The inputs overhang the track by half a thumb on each side, so a thumb's
   centre lines up with the track's ends rather than its edge. */
.range-slider__input {
  position: absolute;
  inset: 0 calc(var(--thumb) / -2);
  width: calc(100% + var(--thumb));
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  /* The site styles every <input> as a filled field; this one must stay see-through. */
  background: transparent !important;
  box-shadow: none !important;
  pointer-events: none;
  appearance: none;
  -webkit-appearance: none;
}
.range-slider__input_raised { z-index: 1; }
.range-slider__input:focus { outline: none; }
.range-slider__input::-webkit-slider-runnable-track { background: none; border: 0; }
.range-slider__input::-moz-range-track { background: none; border: 0; }
.range-slider__input::-webkit-slider-thumb {
  width: var(--thumb);
  height: var(--thumb);
  border: 2px solid rgb(224, 103, 154);
  border-radius: 50%;
  background: var(--bg-panel-2, #1b1d33);
  cursor: grab;
  pointer-events: auto;
  -webkit-appearance: none;
}
.range-slider__input::-moz-range-thumb {
  width: var(--thumb);
  height: var(--thumb);
  box-sizing: border-box;
  border: 2px solid rgb(224, 103, 154);
  border-radius: 50%;
  background: var(--bg-panel-2, #1b1d33);
  cursor: grab;
  pointer-events: auto;
}
.range-slider__input:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 4px rgba(224, 103, 154, .3); }
.range-slider__input:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 4px rgba(224, 103, 154, .3); }
.range-slider__input:active::-webkit-slider-thumb { cursor: grabbing; }

.range-slider__bounds {
  display: flex;
  justify-content: space-between;
  margin: 2px calc(var(--thumb) / -2) 0;
  color: var(--ui-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
</style>
