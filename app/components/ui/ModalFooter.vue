<script setup lang="ts">
// Action row for the details popups (flat, vacancy, candidate).
//
// All three had their own copy of this grid, which is why the same defect kept
// reappearing: a fixed four-column track list squeezes the longest label onto
// two lines at narrower widths, so one button ends up taller than its
// neighbours. It was fixed separately in two pages and was still present in the
// third. One implementation now, so a fix lands everywhere.
//
// Buttons are passed in as the default slot; this owns only the layout.
</script>

<template>
  <div class="modal-footer">
    <slot />
  </div>
</template>

<style scoped>
.modal-footer {
  width: 100%;
  display: grid;
  /* auto-fit, not a fixed count: the actions reflow onto a second row instead of
     compressing until a label wraps. */
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
  align-items: stretch;
}

/* Every action is the same size whatever element it is — some are buttons, some
   are links — and long labels wrap inside the button rather than overflowing. */
.modal-footer :deep(> *) {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  height: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.25;
}

/* The confirming action ("Open", "Apply") is a plain <a>, not a UButton, so it
   needs its own appearance. Each page keeps its own accent — the candidate popup
   is blue where the others are pink — by setting the two variables below on the
   footer; only the colour differs, so only the colour is overridable. */
.modal-footer :deep(.modal-footer__primary) {
  padding: 8px 11px;
  border: 1px solid var(--modal-footer-accent, var(--accent-pink, #e0679a));
  border-radius: var(--ui-control-radius, 8px);
  background: var(--modal-footer-accent, var(--accent-pink, #e0679a));
  color: var(--modal-footer-accent-text, #1a0e14);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
}
.modal-footer :deep(.modal-footer__primary:hover) { filter: brightness(1.06); }

/* A second, non-confirming link action — the vacancy popup's "view at source". */
.modal-footer :deep(.modal-footer__secondary) {
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: var(--ui-control-radius, 8px);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}
.modal-footer :deep(.modal-footer__secondary:hover) {
  border-color: rgba(224, 103, 154, 0.45);
  color: var(--accent-pink, #e0679a);
}

@media (max-width: 520px) {
  /* Mobile popups are height-constrained. Keep icon actions as proper 44px touch
     targets in one compact row and give text links/primary CTA the remaining
     width. Button labels stay in the DOM for accessibility, but are visually
     suppressed on this breakpoint. */
  .modal-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: stretch;
  }

  .modal-footer :deep(> button) {
    flex: 0 0 44px;
    width: 44px;
    min-width: 44px;
    min-height: 44px;
    height: 44px;
    padding: 0;
    font-size: 0;
    white-space: nowrap;
    overflow-wrap: normal;
  }

  /* Nuxt UI/Lucide icons can size through either explicit dimensions or em, so
     restore a readable icon size after zeroing the visual label text. */
  .modal-footer :deep(> button svg),
  .modal-footer :deep(> button [class*="icon"]) {
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    font-size: 20px;
  }

  .modal-footer :deep(> .modal-footer__primary),
  .modal-footer :deep(> .modal-footer__secondary) {
    flex: 1 1 180px;
    width: auto;
    min-width: 0;
    min-height: 44px;
  }
}
</style>
