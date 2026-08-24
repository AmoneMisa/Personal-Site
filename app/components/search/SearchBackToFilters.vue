<script setup lang="ts">
defineProps<{ label: string }>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button type="button" class="search-back-to-filters" @click="emit('click')">{{ label }}</button>
</template>
