<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UInput>.
//
// Keeps v-model working with both `v-model` and `v-model.number` (the .number
// modifier is applied by Vue on the parent side, so we simply emit the raw
// value and let it convert). Attributes such as type/min/max/inputmode/
// placeholder fall through to the native input.
import { computed, ref, useId } from "vue";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string | number | null;
  icon?: string;
  trailingIcon?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  // Nuxt UI's style-override object. We honour the class hooks (`base`/`root`)
  // because pages use them as styling handles — the price row, for instance,
  // strips this control's border through `.price-number-input` so the field can
  // sit inside its own bordered wrapper without drawing a second box.
  ui?: { base?: string; root?: string };
  /** Show a clear (x) button while the field has a value. */
  clearable?: boolean;
  /** Accessible name for that button. */
  clearLabel?: string;
  /**
   * Floating label. Sits inside the field like a placeholder while it is empty
   * and unfocused, then rises onto the top border — which opens a notch to make
   * room for it — once there is something to read below. Opt in per field: the
   * filter panels deliberately keep their caption above the control.
   */
  label?: string;
}>(), { size: "md" });

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number): void;
  (e: "clear"): void;
}>();

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}

const hasValue = computed(() => props.modelValue != null && String(props.modelValue) !== "");

function clear() {
  emit("update:modelValue", "");
  emit("clear");
}

// Floating label state. The label lifts while the field is focused or holds a
// value; a browser-autofilled field counts as holding one, which is why the
// :autofill rule in the stylesheet lifts it too.
const inputId = useId();
const focused = ref(false);
const floating = computed(() => Boolean(props.label));
const floated = computed(() => floating.value && (focused.value || hasValue.value));
</script>

<template>
  <div
      class="u-input ui-control ui-focusable"
      :class="[
        `ui-control_${size}`,
        {
          'ui-control_disabled': disabled,
          'ui-control_floating': floating,
          'u-input_floating': floating,
          'u-input_floated': floated,
          'u-input_with-icon': floating && icon,
        },
        props.ui?.root,
        props.ui?.base,
        $attrs.class,
      ]"
  >
    <UIcon v-if="icon" :name="icon" class="u-input__icon" />
    <input
        v-bind="{ ...$attrs, class: undefined }"
        :id="floating ? inputId : ($attrs.id as string | undefined)"
        :value="modelValue ?? ''"
        :disabled="disabled"
        class="u-input__field"
        @input="onInput"
        @focus="focused = true"
        @blur="focused = false"
    />
    <label v-if="floating" :for="inputId" class="u-input__label">{{ label }}</label>
    <!-- The border is drawn by this fieldset rather than by .ui-control, because
         a legend is the one thing that cuts a real gap in a border for the label
         to sit in. Hidden from the accessibility tree: the <label> above already
         names the field. -->
    <fieldset v-if="floating" class="u-input__outline" aria-hidden="true">
      <legend class="u-input__notch"><span>{{ label }}</span></legend>
    </fieldset>
    <button
        v-if="clearable && hasValue && !disabled"
        type="button"
        class="u-input__clear"
        :aria-label="clearLabel || 'Clear'"
        @click="clear"
    >
      <UIcon name="i-lucide-x" />
    </button>
    <UIcon v-if="trailingIcon" :name="trailingIcon" class="u-input__icon" />
  </div>
</template>

<style scoped>
/* Layout and colours come from .ui-control (assets/css/ui.css). Only the parts
   specific to a text input live here. */
.u-input__field {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: var(--ui-control-font);
  line-height: 1.2;
  padding: 0;
}
.u-input__field::placeholder { color: var(--ui-control-placeholder); }
/* Number inputs keep their own alignment but lose the spinners, which look
   broken against a transparent field. */
.u-input__field[type="number"] { appearance: textfield; -moz-appearance: textfield; }
.u-input__field[type="number"]::-webkit-outer-spin-button,
.u-input__field[type="number"]::-webkit-inner-spin-button { appearance: none; margin: 0; }

.u-input__icon { color: var(--ui-control-placeholder); font-size: 1.05em; }

/* Clear button: sits inside the field, only while there is something to clear. */
.u-input__clear {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ui-control-placeholder);
  line-height: 1;
  cursor: pointer;
  transition: color var(--ui-transition), background-color var(--ui-transition);
}
.u-input__clear:hover { color: var(--text-primary); background: rgba(255, 255, 255, 0.1); }
.u-input__clear:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }

/* ---- Floating label -------------------------------------------------------
   Only the label and the notch move, and both move by transform alone, so the
   animation never reflows the field or the form around it. */

.u-input_floating { position: relative; }
/* The fieldset paints the border now; leaving .ui-control's on as well would
   draw two. Kept transparent rather than removed so the box size is unchanged. */
.u-input.u-input_floating { border-color: transparent; }

.u-input__label {
  position: absolute;
  left: var(--ui-control-px);
  top: 50%;
  transform: translateY(-50%);
  transform-origin: left center;
  max-width: calc(100% - var(--ui-control-px) * 2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ui-control-placeholder);
  font-size: var(--ui-control-font);
  line-height: 1.2;
  /* Clicks belong to the input underneath; `for` still associates the two. */
  pointer-events: none;
  transition: transform var(--ui-transition), color var(--ui-transition);
}
/* A leading icon pushes the resting label clear of it. Expressed as a transform
   so that lifting the label interpolates from here in one motion. */
.u-input_with-icon .u-input__label { transform: translate(calc(1.05em + 7px), -50%); }

/* Lifted: centre the label on the top border and shrink it. Scaling about the
   left edge keeps it anchored where the notch opens. */
.u-input_floated .u-input__label {
  transform: translateY(calc(-50% - var(--ui-floating-h-md) / 2)) scale(var(--ui-floating-scale));
}
.u-input_floating.ui-control_sm .u-input__label { --ui-floating-h-md: var(--ui-floating-h-sm); }
.u-input_floating.ui-control_lg .u-input__label { --ui-floating-h-md: var(--ui-floating-h-lg); }
.u-input_floating:focus-within .u-input__label { color: var(--accent-pink, #e0679a); }

.u-input__outline {
  position: absolute;
  /* -1px on every side so the fieldset's border box lands exactly where
     .ui-control's border would have been. */
  inset: -1px;
  margin: 0;
  padding: 0 calc(var(--ui-control-px) - 5px);
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  /* Fieldsets default to min-inline-size: min-content, which would stop the
     outline shrinking with a narrow field. */
  min-inline-size: 0;
  pointer-events: none;
  transition: border-color var(--ui-transition);
}
/* Focus is shown by the outline itself. .ui-control's shared ring is a box-shadow
   drawn outside the wrapper, so on this variant it landed just beyond the
   fieldset's border and read as a second, detached outline. */
.u-input.u-input_floating:focus-within { box-shadow: none; }
.u-input_floating:focus-within .u-input__outline {
  /* Absolutely positioned, so the extra width grows inward and moves nothing. */
  border-width: 2px;
  border-color: var(--accent-pink, #e0679a);
}

.u-input__notch {
  padding: 0;
  /* Matches the lifted label's size so the gap is neither tight nor loose. */
  font-size: calc(var(--ui-control-font) * var(--ui-floating-scale));
  line-height: 1;
  /* Collapsed while the label is down: not 0, because a zero-width legend still
     cuts a hairline out of the border in some engines. */
  max-width: 0.01px;
  white-space: nowrap;
  /* The text only reserves the width; the visible copy is the <label>. */
  visibility: hidden;
  transition: max-width var(--ui-transition);
}
.u-input_floated .u-input__notch {
  max-width: 100%;
  padding: 0 5px;
}

/* A field filled by the browser never fires input, so the component's own state
   does not know it holds a value; without this the label would sit on top of the
   autofilled text. Kept in rules of their own: grouping :autofill with the rules
   above would take those down with it wherever the selector is unsupported. */
.u-input_floating:has(.u-input__field:autofill) .u-input__label {
  transform: translateY(calc(-50% - var(--ui-floating-h-md) / 2)) scale(var(--ui-floating-scale));
}
.u-input_floating:has(.u-input__field:autofill) .u-input__notch {
  max-width: 100%;
  padding: 0 5px;
}

/* The placeholder would otherwise sit behind the resting label and read as
   doubled text. It appears as the label leaves. */
.u-input_floating .u-input__field::placeholder {
  opacity: 0;
  transition: opacity var(--ui-transition);
}
.u-input_floated .u-input__field::placeholder { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .u-input__label,
  .u-input__notch,
  .u-input__outline { transition: none; }
}
</style>
