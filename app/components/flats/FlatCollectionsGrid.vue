<script setup lang="ts">
// The collections tab: one tile per collection, each linking to its own page.
// Creating and deleting live here; adding listings happens from a card.
import type { FlatCollection } from "~/composables/flats/useFlatCollections";

defineProps<{
  collections: FlatCollection[];
  isFull: boolean;
  emptyLabel: string;
  createLabel: string;
  namePlaceholder: string;
  fullLabel: string;
  deleteLabel: string;
  countLabel: (n: number) => string;
  hrefFor: (collection: FlatCollection) => string;
}>();

const emit = defineEmits<{ create: [name: string]; remove: [id: string] }>();

const draftName = ref("");
function submit() {
  emit("create", draftName.value);
  draftName.value = "";
}
</script>

<template>
  <section class="flat-collections">
    <form class="flat-collections__new" @submit.prevent="submit">
      <u-input v-model="draftName" :placeholder="namePlaceholder" :disabled="isFull" class="flat-collections__name" />
      <u-button type="submit" icon="i-lucide-plus" :disabled="isFull">{{ createLabel }}</u-button>
    </form>
    <p v-if="isFull" class="flat-collections__full text-muted">{{ fullLabel }}</p>

    <p v-if="!collections.length" class="flat-collections__empty text-muted">{{ emptyLabel }}</p>

    <ul v-else class="flat-collections__list">
      <li v-for="collection in collections" :key="collection.id" class="flat-collections__item">
        <NuxtLink :to="hrefFor(collection)" class="flat-collections__link">
          <span class="flat-collections__title">{{ collection.title }}</span>
          <span class="flat-collections__count text-muted">{{ countLabel(collection.items.length) }}</span>
        </NuxtLink>
        <button
          type="button"
          class="flat-collections__remove"
          :aria-label="`${deleteLabel}: ${collection.title}`"
          :title="deleteLabel"
          @click="emit('remove', collection.id)"
        >
          <u-icon name="i-lucide-trash-2" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped lang="scss">
.flat-collections__new { display: flex; gap: 8px; margin-bottom: 12px; }
.flat-collections__name { flex: 1 1 auto; min-width: 0; }
.flat-collections__full, .flat-collections__empty { margin: 8px 0 0; font-size: 13px; }
.flat-collections__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
.flat-collections__item { display: flex; align-items: stretch; gap: 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-panel); overflow: hidden; }
.flat-collections__item:hover { border-color: rgba(224, 103, 154, .4); }
.flat-collections__link { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; color: var(--text-primary); text-decoration: none; }
.flat-collections__title { font-weight: 650; overflow-wrap: anywhere; }
.flat-collections__count { font-size: 12px; }
.flat-collections__remove { flex: 0 0 auto; width: 44px; display: grid; place-items: center; border: 0; border-left: 1px solid var(--line); background: transparent; color: var(--text-muted); cursor: pointer; }
.flat-collections__remove:hover { color: #f29ab6; }
</style>
