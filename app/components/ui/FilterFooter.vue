<script setup lang="ts">
defineProps<{
  resetLabel: string;
  summary?: string;
}>();

defineEmits<{ reset: [] }>();
</script>

<template>
  <div class="filter-footer">
    <span v-if="summary" class="filter-footer__summary text-muted">{{ summary }}</span>
    <slot />
    <u-button
      type="button"
      variant="ghost"
      color="neutral"
      size="sm"
      icon="i-lucide-rotate-ccw"
      class="filter-footer__reset"
      @click="$emit('reset')"
    >{{ resetLabel }}</u-button>
  </div>
</template>

<style scoped>
.filter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filter-footer__summary { font-size: 13px; }
.filter-footer__reset { margin-left: auto; }
</style>
