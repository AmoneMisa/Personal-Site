<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UTextarea>.
import { computed, ref, useId } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string;
  rows?: number;
  disabled?: boolean;
  ui?: unknown;
  /**
   * Floating label, matching UInput's. Given one, the textarea gains a wrapper
   * so the label and the notched outline have something to position against;
   * without one it stays the bare element it has always been, so existing call
   * sites keep the same root node.
   */
  label?: string;
}>(), { rows: 4 });

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}

const inputId = useId();
const focused = ref(false);
const floating = computed(() => Boolean(props.label));
const floated = computed(() => floating.value && (focused.value || (props.modelValue ?? "") !== ""));
</script>

<template>
  <!-- No label: unchanged, the textarea is its own root. -->
  <textarea
      v-if="!floating"
      class="u-textarea ui-control ui-focusable"
      :class="$attrs.class"
      :value="modelValue ?? ''"
      :rows="rows"
      :disabled="disabled"
      v-bind="{ ...$attrs, class: undefined }"
      @input="onInput"
  />

  <div
      v-else
      class="u-textarea-field ui-focusable"
      :class="[{ 'u-textarea-field_floated': floated }, $attrs.class]"
  >
    <textarea
        :id="inputId"
        class="u-textarea u-textarea_floating ui-control"
        :value="modelValue ?? ''"
        :rows="rows"
        :disabled="disabled"
        v-bind="{ ...$attrs, class: undefined, id: undefined }"
        @input="onInput"
        @focus="focused = true"
        @blur="focused = false"
    />
    <label :for="inputId" class="u-textarea__label">{{ label }}</label>
    <!-- Same trick as UInput: only a legend cuts a real gap in a border. -->
    <fieldset class="u-textarea__outline" aria-hidden="true">
      <legend class="u-textarea__notch"><span>{{ label }}</span></legend>
    </fieldset>
  </div>
</template>

<style scoped>
/* Base surface comes from .ui-control; a textarea only differs in that it grows
   vertically and aligns its text to the top. */
.u-textarea {
  display: block;
  align-items: stretch;
  padding-block: 9px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
}
.u-textarea::placeholder { color: var(--ui-control-placeholder); }

/* ---- Floating label -------------------------------------------------------
   The label rests on the first text line rather than mid-box, because that is
   where a textarea's own placeholder would be. */

.u-textarea-field { position: relative; display: block; border-radius: var(--ui-control-radius); }
/* The fieldset paints the border; two would be one too many. */
.u-textarea_floating { border-color: transparent; }

.u-textarea__label {
  position: absolute;
  left: var(--ui-control-px);
  /* Matches .u-textarea's padding-block, and the shared line-height puts the
     label's text on exactly the same baseline as the first row of the value. */
  top: 9px;
  max-width: calc(100% - var(--ui-control-px) * 2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-control-placeholder);
  font-size: var(--ui-control-font);
  line-height: 1.5;
  transform-origin: left center;
  pointer-events: none;
  transition: transform var(--ui-transition), color var(--ui-transition);
}
/* Lift the label's centre onto the border: 1px of border plus 9px of padding
   above the text, plus half a line to reach that text's centre. */
.u-textarea-field_floated .u-textarea__label {
  transform: translateY(calc(-10px - 0.75em)) scale(var(--ui-floating-scale));
}
.u-textarea-field:focus-within .u-textarea__label { color: var(--accent-pink, #e0679a); }

.u-textarea__outline {
  position: absolute;
  /* Shifted up by half the legend, for the same reason as UInput's: a fieldset
     paints its top border through the middle of its legend, not at its edge. */
  top: calc(var(--ui-notch-h) / -2);
  right: 0;
  bottom: 0;
  left: 0;
  margin: 0;
  padding: 0 calc(var(--ui-control-px) - 5px);
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  min-inline-size: 0;
  pointer-events: none;
  transition: border-color var(--ui-transition);
}
/* Same as UInput: the outline carries the focus state on its own, because the
   shared box-shadow ring sits outside it and reads as a second border. */
.u-textarea-field:focus-within { box-shadow: none; }
.u-textarea-field:focus-within .u-textarea__outline {
  border-width: 2px;
  border-color: var(--accent-pink, #e0679a);
}

.u-textarea__notch {
  padding: 0;
  font-size: calc(var(--ui-control-font) * var(--ui-floating-scale));
  height: var(--ui-notch-h);
  line-height: var(--ui-notch-h);
  max-width: 0.01px;
  white-space: nowrap;
  visibility: hidden;
  transition: max-width var(--ui-transition);
}
.u-textarea-field_floated .u-textarea__notch { max-width: 100%; padding: 0 5px; }

.u-textarea_floating::placeholder { opacity: 0; transition: opacity var(--ui-transition); }
.u-textarea-field_floated .u-textarea_floating::placeholder { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .u-textarea__label,
  .u-textarea__notch,
  .u-textarea__outline { transition: none; }
}
</style>
