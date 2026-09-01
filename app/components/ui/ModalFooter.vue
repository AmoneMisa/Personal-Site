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

/* Favorite / hide / share are utility actions, not competing CTAs. Nuxt UI's
   button component keeps a gap for its visually hidden label; zero that gap and
   center the icon wrapper itself so every glyph is optically centered. */
.modal-footer :deep(> button) {
  flex: 0 0 40px;
  width: 40px;
  min-width: 40px;
  min-height: 40px;
  height: 40px;
  padding: 0;
  gap: 0 !important;
  display: inline-grid !important;
  grid-template: 1fr / 1fr;
  place-items: center !important;
  line-height: 0;
  font-size: 0;
  white-space: nowrap;
  overflow-wrap: normal;
}

.modal-footer :deep(> button svg),
.modal-footer :deep(> button [class*="icon"]) {
  grid-area: 1 / 1;
  justify-self: center;
  align-self: center;
}

.modal-footer :deep(> button svg),
.modal-footer :deep(> button [class*="icon"]) {
  display: block;
  margin: 0 !important;
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
  font-size: 18px;
  line-height: 18px;
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

}
</style>
