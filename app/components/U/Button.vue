<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UButton>, supporting the props actually
// used across the app: variant, color, size, icon, trailing-icon, loading,
// disabled, type. Renders an <a> when `to`/`href` is given, otherwise a button.
import { computed } from "vue";

const props = withDefaults(defineProps<{
  variant?: "solid" | "outline" | "ghost" | "link" | "soft";
  color?: "primary" | "neutral" | "error" | "success";
  size?: "xs" | "sm" | "md" | "lg";
  icon?: string;
  trailingIcon?: string;
  loading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  to?: string;
  href?: string;
  block?: boolean;
  square?: boolean;
  ui?: unknown; // accepted and ignored (Nuxt UI style override)
}>(), {
  variant: "solid",
  color: "primary",
  size: "md",
  type: "button",
});

const tag = computed(() => (props.to || props.href ? "a" : "button"));
const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <component
      :is="tag"
      class="u-button ui-focusable"
      :class="[`u-button_${variant}`, `u-button_${color}`, `u-button_${size}`, { 'u-button_block': block, 'u-button_square': square, 'u-button_loading': loading }]"
      :type="tag === 'button' ? type : undefined"
      :href="to || href"
      :disabled="tag === 'button' ? isDisabled : undefined"
      :aria-busy="loading || undefined"
      :aria-disabled="tag === 'a' && isDisabled ? 'true' : undefined"
  >
    <!-- The spinner replaces the leading icon so the label never shifts. -->
    <span v-if="loading" class="u-button__spinner" aria-hidden="true" />
    <UIcon v-else-if="icon" :name="icon" class="u-button__icon" />
    <span v-if="$slots.default" class="u-button__label"><slot /></span>
    <UIcon v-if="trailingIcon" :name="trailingIcon" class="u-button__icon" />
  </component>
</template>

<style scoped>
.u-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: var(--ui-control-h-md);
  padding-inline: var(--ui-control-px);
  border: 1px solid transparent;
  border-radius: var(--ui-control-radius);
  font-family: inherit;
  font-size: var(--ui-control-font);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--ui-transition), border-color var(--ui-transition), color var(--ui-transition), opacity var(--ui-transition);
}
.u-button:disabled,
.u-button[aria-disabled="true"] { opacity: 0.55; cursor: not-allowed; }
/* Grid items stretch by default; a button should hug its label unless it asked
   to be full width. Only affects grid/flex parents that would stretch it. */

/* solid */

/* outline */

/* ghost / link */

/* soft */

.u-button__icon { font-size: 1.05em; }
.u-button__label { display: inline-block; }

.u-button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: u-button-spin 0.6s linear infinite;
}
@keyframes u-button-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .u-button__spinner { animation-duration: 2s; }
}
</style>
