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
      class="u-textarea ui-focusable"
      :class="$attrs.class"
      :value="modelValue ?? ''"
      :rows="rows"
      :disabled="disabled"
      v-bind="{ ...$attrs, class: undefined }"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<style scoped>
.u-textarea {
  display: block;
  width: 100%;
  padding: 9px var(--ui-control-px);
  border: 1px solid var(--ui-control-border);
  border-radius: var(--ui-control-radius);
  background: var(--ui-control-bg);
  color: var(--ui-control-text);
  font-family: inherit;
  font-size: var(--ui-control-font);
  line-height: 1.5;
  resize: vertical;
  outline: none;
}
.u-textarea::placeholder { color: var(--ui-control-placeholder); }
.u-textarea:disabled { opacity: 0.6; }
</style>
