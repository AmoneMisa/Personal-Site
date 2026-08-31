<script setup lang="ts">
import { computed } from "vue";
import type { FlatTransportStop } from "~/types/flats";
import FlatTransportTable from "~/components/flats/FlatTransportTable.vue";

const props = withDefaults(defineProps<{
  stops?: FlatTransportStop[];
}>(), {
  stops: () => [],
});

const { t, locale } = useI18n();

const transportTitle = computed(() => String(locale.value).toLowerCase().startsWith("en")
  ? "Transport nearby"
  : "Транспорт рядом");

const sections = computed(() => [
  { mode: "bus", title: t("flats.specBus"), icon: "i-lucide-bus-front" },
  { mode: "trolleybus", title: t("flats.specTrolleybus"), icon: "i-lucide-bus" },
  { mode: "tram", title: t("flats.specTram"), icon: "i-lucide-tram-front" },
].map((section) => ({
  ...section,
  stops: props.stops.filter((stop) => String(stop.mode || "").trim().toLowerCase() === section.mode),
})).filter((section) => section.stops.length > 0));
</script>

<template>
  <section v-if="sections.length" class="flat-transport-tables">
    <h3 class="flat-transport-tables__title">
      <u-icon name="i-lucide-map-pin" aria-hidden="true" />
      <span>{{ transportTitle }}</span>
    </h3>

    <div class="flat-transport-tables__grid">
      <FlatTransportTable
        v-for="section in sections"
        :key="section.mode"
        :title="section.title"
        :icon="section.icon"
        :stops="section.stops"
      />
    </div>
  </section>
</template>

<style scoped>
.flat-transport-tables {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-top: 2px;
}
.flat-transport-tables__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--text-primary, #e4e5f0);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
}
.flat-transport-tables__title :deep(svg) {
  width: 16px;
  height: 16px;
  color: var(--accent-pink, #e0679a);
}
.flat-transport-tables__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 8px;
  min-width: 0;
}

@media (max-width: 768px) {
  .flat-transport-tables__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
