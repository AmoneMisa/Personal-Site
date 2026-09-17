<script setup lang="ts">
// Tab bar at the top of the listing popup: the listing itself, and the same
// contact's other listings when there are any.
const model = defineModel<"details" | "contact">({ required: true });
defineProps<{ count: number }>();
const { t } = useI18n();
</script>

<template>
  <div class="flat-modal-tabs" role="tablist">
    <button type="button" role="tab" class="flat-modal-tabs__tab" :aria-selected="model === 'details'" @click="model = 'details'">
      {{ t("flats.listingDetailsTab") }}
    </button>
    <button type="button" role="tab" class="flat-modal-tabs__tab" :aria-selected="model === 'contact'" @click="model = 'contact'">
      <span class="flat-modal-tabs__swatch" aria-hidden="true" />
      {{ t("flats.contactListingsTab", { n: count }) }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.flat-modal-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.flat-modal-tabs__tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
}
.flat-modal-tabs__tab[aria-selected="true"] {
  border-color: var(--accent-pink);
  color: var(--text-primary);
}
.flat-modal-tabs__swatch {
  width: 14px;
  height: 3px;
  border-radius: 3px;
  background: var(--flat-line-multi);
}
</style>
