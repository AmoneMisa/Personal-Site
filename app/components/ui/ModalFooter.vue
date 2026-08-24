<script setup lang="ts">
// Shared action row for flat, vacancy and candidate detail popups.
// Secondary icon actions stay compact on every breakpoint; the primary
// navigation/apply action keeps the available width and remains text-first.
</script>

<template>
  <div class="modal-footer">
    <slot />
  </div>
</template>

<style scoped>
.modal-footer {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: stretch;
}

/* Favorite / hide / share are utility actions, not competing CTAs. Keep them
   square on desktop too; their labels remain in the DOM for accessibility while
   only the icon is shown visually. */
.modal-footer :deep(> button) {
  flex: 0 0 40px;
  width: 40px;
  min-width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0;
  white-space: nowrap;
  overflow-wrap: normal;
}

.modal-footer :deep(> button svg),
.modal-footer :deep(> button [class*="icon"]) {
  display: block;
  margin: auto;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  font-size: 18px;
}

/* The confirming action (Open / Apply) remains the visual anchor. Pin the
   default accent to the site's pink instead of inheriting Nuxt UI's blue
   primary colour on vacancy pages. Pages may still intentionally override the
   two variables (the candidate popup currently does). */
.modal-footer :deep(.modal-footer__primary) {
  flex: 1 1 220px;
  width: auto;
  min-width: 180px;
  min-height: 40px;
  height: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border: 1px solid var(--modal-footer-accent, var(--accent-pink, #e0679a));
  border-radius: var(--ui-control-radius, 8px);
  background: var(--modal-footer-accent, var(--accent-pink, #e0679a));
  color: var(--modal-footer-accent-text, #1a0e14);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  text-decoration: none;
  white-space: normal;
}
.modal-footer :deep(.modal-footer__primary:hover) { filter: brightness(1.06); }

/* A second text link, when present (for example "view at source"), stays
   secondary and compact rather than taking the same weight as the main CTA. */
.modal-footer :deep(.modal-footer__secondary) {
  flex: 0 1 auto;
  width: auto;
  min-width: 0;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: var(--ui-control-radius, 8px);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  text-decoration: none;
  white-space: normal;
}
.modal-footer :deep(.modal-footer__secondary:hover) {
  border-color: rgba(224, 103, 154, 0.45);
  color: var(--accent-pink, #e0679a);
}

@media (max-width: 520px) {
  .modal-footer {
    display: grid;
    grid-template-columns: repeat(3, 40px) minmax(0, 1fr);
    gap: 6px;
  }

  .modal-footer :deep(> button) {
    width: 40px;
    min-width: 40px;
    min-height: 40px;
    height: 40px;
  }

  .modal-footer :deep(> button:nth-of-type(1)) { grid-column: 1; grid-row: 1; }
  .modal-footer :deep(> button:nth-of-type(2)) { grid-column: 2; grid-row: 1; }
  .modal-footer :deep(> button:nth-of-type(3)) { grid-column: 3; grid-row: 1; }

  .modal-footer :deep(> button svg),
  .modal-footer :deep(> button [class*="icon"]) {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    font-size: 18px;
  }

  .modal-footer :deep(> .modal-footer__primary),
  .modal-footer :deep(> .modal-footer__secondary) {
    min-height: 44px;
  }

  .modal-footer :deep(> .modal-footer__primary) {
    grid-column: 4;
    grid-row: 1;
    min-width: 0;
    min-height: 40px;
    padding-inline: 8px;
    font-size: 12px;
    white-space: nowrap;
  }

  .modal-footer :deep(> .modal-footer__secondary) {
    grid-column: 1 / -1;
    grid-row: 2;
    min-height: 36px;
    padding-block: 6px;
    font-size: 12px;
  }
}
</style>
