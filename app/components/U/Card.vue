<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UCard>, with the #header / #footer slots.
defineProps<{ ui?: unknown }>();
</script>

<template>
  <div class="u-card">
    <div v-if="$slots.header" class="u-card__header"><slot name="header" /></div>
    <div class="u-card__body"><slot /></div>
    <div v-if="$slots.footer" class="u-card__footer"><slot name="footer" /></div>
  </div>
</template>

<style scoped>
.u-card {
  border: 1px solid var(--line, #252a4a);
  border-radius: var(--radius, 10px);
  background: var(--bg-panel, #131730);
  color: var(--text-primary, #eef0f7);
}
.u-card__header { padding: 14px 16px; border-bottom: 1px solid var(--line); }
.u-card__body { padding: 16px; }
.u-card__footer { padding: 12px 16px; border-top: 1px solid var(--line); }
</style>
