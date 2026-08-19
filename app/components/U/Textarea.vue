<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UTextarea>.
defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{
  modelValue?: string;
  rows?: number;
  disabled?: boolean;
  ui?: unknown;
}>(), { rows: 4 });

const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();
</script>

<template>
  <textarea
      class="u-textarea ui-control ui-focusable"
      :class="$attrs.class"
      :value="modelValue ?? ''"
      :rows="rows"
      :disabled="disabled"
      v-bind="{ ...$attrs, class: undefined }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
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
</style>
