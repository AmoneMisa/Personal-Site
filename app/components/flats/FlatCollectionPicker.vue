<script setup lang="ts">
// Pick which collections a listing belongs to. Toggles apply immediately —
// collections are local, so there is nothing to commit and no failure state.
import type { FlatCollection } from "~/composables/flats/useFlatCollections";

defineProps<{
  title: string;
  collections: FlatCollection[];
  selectedIds: Set<string>;
  isFull: boolean;
  fullLabel: string;
  emptyLabel: string;
  newLabel: string;
  namePlaceholder: string;
  createLabel: string;
  closeLabel: string;
}>();

const open = defineModel<boolean>("open", { required: true });
const name = defineModel<string>("name", { required: true });
defineEmits<{ toggle: [id: string]; create: [] }>();
</script>

<template>
  <u-modal v-model:open="open" :title="title">
    <template #body>
      <p v-if="!collections.length" class="collection-picker__empty text-muted">{{ emptyLabel }}</p>
      <ul v-else class="collection-picker__list">
        <li v-for="collection in collections" :key="collection.id">
          <button
            type="button"
            class="collection-picker__row"
            :aria-pressed="selectedIds.has(collection.id)"
            @click="$emit('toggle', collection.id)"
          >
            <u-icon :name="selectedIds.has(collection.id) ? 'i-lucide-check-square' : 'i-lucide-square'" />
            <span class="collection-picker__title">{{ collection.title }}</span>
          </button>
        </li>
      </ul>

      <form class="collection-picker__new" @submit.prevent="$emit('create')">
        <u-input v-model="name" :placeholder="namePlaceholder" :disabled="isFull" :aria-label="newLabel" />
        <u-button type="submit" icon="i-lucide-plus" :disabled="isFull">{{ createLabel }}</u-button>
      </form>
      <p v-if="isFull" class="collection-picker__full text-muted">{{ fullLabel }}</p>
    </template>
    <template #footer>
      <u-button color="neutral" variant="ghost" @click="open = false">{{ closeLabel }}</u-button>
    </template>
  </u-modal>
</template>

<style scoped lang="scss">
.collection-picker__list { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 4px; max-height: 40vh; overflow: auto; }
.collection-picker__row { display: flex; align-items: center; gap: 9px; width: 100%; padding: 9px 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--text-primary); text-align: left; cursor: pointer; }
.collection-picker__row:hover { background: rgba(255, 255, 255, .05); }
.collection-picker__row[aria-pressed="true"] { border-color: rgba(224, 103, 154, .45); }
.collection-picker__title { min-width: 0; overflow-wrap: anywhere; }
.collection-picker__new { display: flex; gap: 8px; }
.collection-picker__empty, .collection-picker__full { margin: 0 0 10px; font-size: 13px; }
</style>
