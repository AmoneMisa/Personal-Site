<script setup lang="ts">
withDefaults(defineProps<{ tag?: "form" | "section" | "div" }>(), { tag: "section" });
const emit = defineEmits<{ submit: [] }>();
</script>

<template>
  <component :is="tag" class="search-filter-panel" @submit.prevent="emit('submit')">
    <slot />
  </component>
</template>
