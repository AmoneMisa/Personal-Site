<script setup lang="ts">
defineProps<{
  title: string;
  icon?: string;
}>();
</script>

<template>
  <section class="filter-section">
    <div class="filter-section__title">
      <u-icon v-if="icon" :name="icon" />
      {{ title }}
    </div>
    <slot />
  </section>
</template>

<style scoped>
.filter-section {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--ocean-form-surface-soft);
}

.filter-section__title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 12px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.filter-section__title :deep(svg) { color: var(--accent-pink); }
</style>
