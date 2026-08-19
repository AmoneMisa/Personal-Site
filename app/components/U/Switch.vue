<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <USwitch>. A real checkbox underneath, so
// it is keyboard accessible and works inside a <label> exactly as before.
defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue?: boolean;
  disabled?: boolean;
  ui?: unknown;
}>();

const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();
</script>

<template>
  <span class="u-switch" :class="[{ 'u-switch_on': modelValue, 'u-switch_disabled': disabled }, $attrs.class]">
    <input
        type="checkbox"
        class="u-switch__input"
        role="switch"
        :checked="!!modelValue"
        :disabled="disabled"
        v-bind="{ ...$attrs, class: undefined }"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="u-switch__track" aria-hidden="true"><span class="u-switch__thumb" /></span>
  </span>
</template>

<style scoped>
.u-switch { position: relative; display: inline-flex; align-items: center; flex: none; }
.u-switch_disabled { opacity: 0.55; }

/* The input covers the control so clicks and focus land on it, while the track
   below provides the appearance. */
.u-switch__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.u-switch_disabled .u-switch__input { cursor: not-allowed; }

.u-switch__track {
  width: 34px;
  height: 20px;
  padding: 2px;
  border-radius: 999px;
  background: var(--line, #252a4a);
  transition: background-color var(--ui-transition);
}
.u-switch_on .u-switch__track { background: var(--accent-pink, #e0679a); }
.u-switch__input:focus-visible + .u-switch__track { box-shadow: var(--ui-focus-ring); }

.u-switch__thumb {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--ui-transition);
}
.u-switch_on .u-switch__thumb { transform: translateX(14px); }
@media (prefers-reduced-motion: reduce) {
  .u-switch__track, .u-switch__thumb { transition: none; }
}
</style>
