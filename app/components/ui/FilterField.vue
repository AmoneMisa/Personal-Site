<script setup lang="ts">
// A labelled filter control: the uppercase caption above, the control below.
//
// Flat Finder, Job Finder and Hiring each had their own identical copy of this
// (`flats__field`, `jobs__field`, `hiring__field`) with the same CSS, and only
// the Flat Finder copy had the `min-width: 0` that stops a long value from
// blowing out a grid column. Sharing it gives all three that fix.
defineProps<{ label?: string }>();
</script>

<template>
  <label class="filter-field">
    <span v-if="label" class="filter-field__label">{{ label }}</span>
    <slot />
  </label>
</template>

<style scoped>
.filter-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  /* Without this a long option label makes the control overflow its grid
     column instead of ellipsizing inside it. */
  min-width: 0;
}
.filter-field__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  line-height: 1.25;
  overflow-wrap: anywhere;
}
</style>
