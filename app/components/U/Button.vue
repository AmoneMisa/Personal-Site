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
.u-button:not(.u-button_block) { justify-self: start; align-self: center; }

.u-button_xs { min-height: 26px; padding-inline: 8px; font-size: 11.5px; gap: 5px; }
.u-button_sm { min-height: var(--ui-control-h-sm); padding-inline: 10px; font-size: 12.5px; }
.u-button_lg { min-height: var(--ui-control-h-lg); padding-inline: 18px; font-size: 14px; }
.u-button_block { width: 100%; }
.u-button_square { padding-inline: 0; aspect-ratio: 1; }

/* solid */
.u-button_solid.u-button_primary { background: var(--accent-pink, #e0679a); color: #fff; }
.u-button_solid.u-button_primary:hover:not(:disabled) { filter: brightness(1.08); }
.u-button_solid.u-button_neutral { background: var(--bg-panel-2); color: var(--text-primary); border-color: var(--line); }
.u-button_solid.u-button_error { background: #dc4b5a; color: #fff; }
.u-button_solid.u-button_success { background: #2f9e6b; color: #fff; }

/* outline */
.u-button_outline { background: transparent; border-color: var(--line); color: var(--text-primary); }
.u-button_outline.u-button_primary { border-color: var(--accent-pink); color: var(--accent-pink); }
.u-button_outline:hover:not(:disabled) { background: rgba(255, 255, 255, 0.04); }

/* ghost / link */
.u-button_ghost { background: transparent; color: var(--text-primary); }
.u-button_ghost:hover:not(:disabled) { background: rgba(255, 255, 255, 0.06); }
.u-button_link { background: transparent; padding-inline: 0; min-height: auto; color: var(--accent-pink); text-decoration: underline; }

/* soft */
.u-button_soft { background: rgba(255, 255, 255, 0.06); color: var(--text-primary); }
.u-button_soft.u-button_primary { background: rgba(224, 103, 154, 0.15); color: var(--accent-pink); }

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
