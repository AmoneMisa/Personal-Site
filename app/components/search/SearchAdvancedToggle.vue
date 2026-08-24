<script setup lang="ts">
defineProps<{ modelValue: boolean; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <button type="button" class="search-advanced-toggle" :aria-expanded="modelValue" @click="emit('update:modelValue', !modelValue)">
    {{ label }}
  </button>
</template>
