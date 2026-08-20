<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <USelect>.
//
// Unlike SelectMenu (custom listbox, multi-select, search) this is a plain
// native <select>: the call sites only need single choice from a short list,
// and the native control gives correct keyboard and mobile behaviour for free.
// Both prop namings used in the app are supported: option-attribute /
// value-attribute and label-key / value-key.
import { computed, useId } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string | number | null;
  items?: any[];
  optionAttribute?: string;
  valueAttribute?: string;
  labelKey?: string;
  valueKey?: string;
  placeholder?: string;
  disabled?: boolean;
  ui?: unknown;
  /**
   * Floating label, matching UInput's. A select always has a value, so unlike
   * an input the label is simply always in its raised position — it never
   * animates. It exists so a select sits in a form beside labelled inputs
   * without one style of caption above the field and another on the border.
   */
  label?: string;
}>(), { items: () => [] });

const inputId = useId();

const emit = defineEmits<{ (e: "update:modelValue", value: string | number): void }>();

const labelProp = computed(() => props.optionAttribute || props.labelKey || "label");
const valueProp = computed(() => props.valueAttribute || props.valueKey || "value");

const options = computed(() =>
  (props.items || []).map((item) =>
    item != null && typeof item === "object"
      ? { label: String(item[labelProp.value] ?? ""), value: item[valueProp.value] }
      : { label: String(item), value: item },
  ),
);
</script>

<template>
  <div class="u-select" :class="[{ 'u-select_floating': label }, $attrs.class]">
    <select
        :id="label ? inputId : ($attrs.id as string | undefined)"
        class="u-select__control ui-control ui-focusable"
        :class="{ 'ui-control_floating': label }"
        :value="modelValue ?? ''"
        :disabled="disabled"
        v-bind="{ ...$attrs, class: undefined, id: undefined }"
        @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="(option, index) in options" :key="String(option.value) + index" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <template v-if="label">
      <label :for="inputId" class="u-select__label">{{ label }}</label>
      <!-- Same notch trick as UInput: only a legend cuts a real gap in a border. -->
      <fieldset class="u-select__outline" aria-hidden="true">
        <legend class="u-select__notch"><span>{{ label }}</span></legend>
      </fieldset>
    </template>
    <UIcon name="i-lucide-chevron-down" class="u-select__chevron" />
  </div>
</template>

<style scoped>
.u-select { position: relative; display: block; min-width: 0; }

/* Base surface comes from .ui-control; only select-specific bits are here. */
.u-select__control {
  /* Room for the chevron drawn on top of the native control. */
  padding-right: 32px;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  /* The open dropdown is painted by the browser, not by this page, and it
     follows the colour scheme rather than our CSS — without this it came up
     white with a blue highlight against the dark field that opened it. */
  color-scheme: dark;
}
/* Belt and braces: engines that do honour option colours get ours. */
.u-select__control option { background: var(--bg-panel, #131730); color: var(--text-primary, #eef0f7); }

.u-select__chevron {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--ui-control-placeholder);
}

/* ---- Floating label -------------------------------------------------------
   Mirrors UInput's, minus the animation: a select is never empty, so the label
   is always up on the border. */

/* The fieldset paints the border; .ui-control's would be a second one. */
.u-select_floating .u-select__control { border-color: transparent; }

.u-select__label {
  position: absolute;
  /* The extra pixel is the control's own border. UInput's label is positioned
     inside a bordered wrapper, so it already clears it; this root has no border,
     and without the offset the label sat 1px left of the value below it. */
  left: calc(var(--ui-control-px) + 1px);
  top: 0;
  /* Centred on the top border, at the same size as UInput's raised label. */
  transform: translateY(-50%) scale(var(--ui-floating-scale));
  transform-origin: left center;
  max-width: calc(100% - var(--ui-control-px) * 2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-control-placeholder);
  font-size: var(--ui-control-font);
  line-height: 1.2;
  pointer-events: none;
  transition: color var(--ui-transition);
}
.u-select_floating:focus-within .u-select__label { color: var(--accent-pink, #e0679a); }

.u-select__outline {
  position: absolute;
  /* Half the legend's height above the box: a fieldset paints its top border
     through the middle of its legend rather than at the edge. */
  /* Flush with the root on three sides: the control's border box already fills
     it, so -1px would draw this a pixel outside the field it is outlining. */
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
/* Focus lives on the outline, so the shared ring does not sit outside it and
   read as a second border. */
.u-select_floating:focus-within { box-shadow: none; }
.u-select_floating:focus-within .u-select__outline {
  border-width: 2px;
  border-color: var(--accent-pink, #e0679a);
}

.u-select__notch {
  padding: 0 5px;
  font-size: calc(var(--ui-control-font) * var(--ui-floating-scale));
  height: var(--ui-notch-h);
  line-height: var(--ui-notch-h);
  white-space: nowrap;
  visibility: hidden;
}
</style>