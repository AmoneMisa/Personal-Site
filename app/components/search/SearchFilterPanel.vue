<script setup lang="ts">
defineProps<{ title?: string; resetLabel?: string; advanced?: boolean; advancedLabel?: string }>();
const emit = defineEmits<{ reset: []; "update:advanced": [value: boolean] }>();
</script>

<template>
  <section class="search-filter-panel">
    <div v-if="title || resetLabel" class="search-filter-panel__header">
      <h2 v-if="title">{{ title }}</h2>
      <button v-if="resetLabel" type="button" @click="emit('reset')">{{ resetLabel }}</button>
    </div>
    <slot />
    <button
      v-if="advancedLabel"
      type="button"
      class="search-filter-panel__advanced"
      @click="emit('update:advanced', !advanced)"
    >
      {{ advancedLabel }}
    </button>
    <slot v-if="advanced" name="advanced" />
  </section>
</template>
