<script setup lang="ts">
defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="search-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <button class="search-dialog__backdrop" type="button" aria-label="Close" @click="emit('update:open', false)" />
      <section class="search-dialog__content">
        <header class="search-dialog__header">
          <h2>{{ title }}</h2>
          <button type="button" aria-label="Close" @click="emit('update:open', false)">×</button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
