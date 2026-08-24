<script setup lang="ts">
import type { SearchPreset } from "~/composables/useSearchPresets";

defineProps<{
  presets: SearchPreset[];
  label: string;
  deleteLabel: string;
  saveLabel: string;
  shareLabel: string;
}>();

defineEmits<{
  apply: [preset: SearchPreset];
  remove: [name: string];
  save: [];
  share: [];
}>();
</script>

<template>
  <div class="search-presets">
    <span class="search-presets__label">{{ label }}</span>
    <div
      v-for="preset in presets"
      :key="preset.name"
      class="search-presets__preset"
    >
      <button type="button" class="search-presets__apply" @click="$emit('apply', preset)">
        {{ preset.name }}
      </button>
      <button
        type="button"
        class="search-presets__remove"
        :aria-label="deleteLabel"
        @click="$emit('remove', preset.name)"
      >×</button>
    </div>
    <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-bookmark-plus" @click="$emit('save')">
      {{ saveLabel }}
    </u-button>
    <u-button type="button" variant="outline" color="neutral" size="sm" icon="i-lucide-share-2" @click="$emit('share')">
      {{ shareLabel }}
    </u-button>
  </div>
</template>

<style scoped>
.search-presets {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  grid-column: 1 / -1;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.search-presets__label {
  margin-right: 4px;
  color: var(--ui-text-muted);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
}
.search-presets__preset {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;
  min-height: 32px;
  padding: 5px 8px 5px 10px;
  border: 1px solid rgba(113, 137, 217, 0.3);
  border-radius: 7px;
  color: var(--text-primary);
  font-size: 12px;
}
.search-presets__apply {
  min-width: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.search-presets__remove { border: 0; background: transparent; color: var(--ui-text-muted); font-size: 15px; line-height: 1; cursor: pointer; }
.search-presets__remove:hover { color: var(--accent-pink); }

@media (max-width: 640px) {
  .search-presets { align-items: stretch; }
  .search-presets__label { flex: 0 0 100%; }
  .search-presets__preset { max-width: 100%; }
  .search-presets :deep(button) { min-height: var(--ui-control-h-md); }
}
</style>
