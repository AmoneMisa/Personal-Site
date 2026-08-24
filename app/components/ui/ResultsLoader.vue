<script setup lang="ts">
withDefaults(defineProps<{
  loading: boolean;
  label?: string;
  minHeight?: string;
}>(), {
  label: "Loading results",
  minHeight: "180px",
});
</script>

<template>
  <div
    class="results-loader"
    :class="{ 'results-loader_loading': loading }"
    :style="{ '--results-loader-min-height': minHeight }"
    :aria-busy="loading"
  >
    <div class="results-loader__content" :inert="loading || undefined" :aria-disabled="loading || undefined">
      <slot />
    </div>

    <div v-if="loading" class="results-loader__overlay" role="status" aria-live="polite">
      <u-icon name="i-lucide-loader-circle" class="results-loader__spinner" aria-hidden="true" />
      <span class="results-loader__sr-only">{{ label }}</span>
    </div>
  </div>
</template>

<style scoped>
.results-loader {
  position: relative;
  isolation: isolate;
}

.results-loader_loading {
  min-height: var(--results-loader-min-height);
}

.results-loader__content {
  transition: opacity 140ms ease;
}

.results-loader_loading .results-loader__content {
  opacity: 0.35;
  pointer-events: none;
  user-select: none;
}

.results-loader__overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 72px;
  pointer-events: auto;
  cursor: wait;
}

.results-loader__spinner {
  width: 28px;
  height: 28px;
  color: var(--accent-pink, #e0679a);
  animation: results-loader-spin 0.7s linear infinite;
}

.results-loader__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes results-loader-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .results-loader__spinner { animation-duration: 1.4s; }
}
</style>
