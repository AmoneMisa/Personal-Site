<script setup lang="ts">
// Breadcrumbs above one owner's collection: All listings › Owners › owner.
import { type FlatOwner, ownerLabel } from "~/utils/flats/owners";

const props = defineProps<{ ownerKey: string }>();
const emit = defineEmits<{ all: []; owners: [] }>();

const { t } = useI18n();
const owner = ref<FlatOwner | null>(null);

watch(() => props.ownerKey, async (key) => {
  owner.value = null;
  try {
    const data = await $fetch<{ owner: FlatOwner | null }>("/flats-owner", { params: { key } });
    if (key === props.ownerKey) owner.value = data.owner;
  } catch {
    // The collection still works without a label; the crumb falls back below.
  }
}, { immediate: true });
</script>

<template>
  <nav class="flat-owner-crumbs" :aria-label="t('flats.breadcrumbs')">
    <ol>
      <li><button type="button" class="flat-owner-crumbs__link" @click="emit('all')">{{ t("flats.allListings") }}</button></li>
      <li aria-hidden="true" class="flat-owner-crumbs__sep">›</li>
      <li><button type="button" class="flat-owner-crumbs__link" @click="emit('owners')">{{ t("flats.ownersTab") }}</button></li>
      <li aria-hidden="true" class="flat-owner-crumbs__sep">›</li>
      <li aria-current="page" class="flat-owner-crumbs__current">
        {{ owner ? ownerLabel(owner.contact) : t("flats.ownerFallback") }}
        <span v-if="owner" class="text-muted"> · {{ t("flats.ownerListings", { n: owner.properties }) }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped lang="scss">
.flat-owner-crumbs ol {
  list-style: none;
  margin: 4px 0 10px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
}
.flat-owner-crumbs__link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.flat-owner-crumbs__link:hover,
.flat-owner-crumbs__link:focus-visible { color: var(--accent-pink); }
.flat-owner-crumbs__sep { color: var(--text-muted); }
.flat-owner-crumbs__current { color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
