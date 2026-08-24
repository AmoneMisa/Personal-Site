<script setup lang="ts">
import type { SelectOption } from "~/types/search";

defineProps<{ modelValue: string; items: SelectOption[]; ariaLabel?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <UiSearchViewTabs
    :model-value="modelValue"
    :items="items"
    :aria-label="ariaLabel"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
