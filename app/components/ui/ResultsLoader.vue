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
      <div class="results-loader__card">
        <u-icon name="i-lucide-loader-circle" class="results-loader__spinner" aria-hidden="true" />
        <span class="results-loader__label">{{ label }}</span>
      </div>
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
  transition: opacity 140ms ease, filter 140ms ease;
}

.results-loader_loading .results-loader__content {
  opacity: 0.4;
  filter: saturate(.72);
  pointer-events: none;
  user-select: none;
}

.results-loader__overlay {
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  min-height: var(--results-loader-min-height);
  padding: 24px;
  background: color-mix(in srgb, var(--bg-primary, #0b0f2a) 54%, transparent);
  backdrop-filter: blur(2px);
  pointer-events: auto;
  cursor: wait;
}

.results-loader__card {
  display: inline-flex;
  align-items: center;
  gap: 11px;
  max-width: min(420px, calc(100vw - 48px));
  min-height: 54px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--accent-pink, #e0679a) 38%, var(--line, #252a4a));
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-panel, #11162f) 94%, transparent);
  color: var(--text-primary, #fff);
  box-shadow: 0 16px 44px rgba(0, 0, 0, .32);
}

.results-loader__spinner {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  color: var(--accent-pink, #e0679a);
  animation: results-loader-spin 0.7s linear infinite;
}

.results-loader__label {
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

@keyframes results-loader-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .results-loader__spinner { animation-duration: 1.4s; }
}
</style>
