<script setup lang="ts">
import UInput from "~/components/U/Input.vue";
import USelectMenu from "~/components/U/SelectMenu.vue";
import type { SearchFilterField, SearchFilterValue } from "~/types/search";

const props = defineProps<{ field: SearchFilterField }>();
const inputValue = computed(() => props.field.value as string | number | null | undefined);

function update(value: SearchFilterValue) {
  if (props.field.control === "number") {
    props.field.onUpdate?.(value === "" || value == null ? undefined : Number(value));
    return;
  }
  props.field.onUpdate?.(value);
}

function updateAndCommit(value: SearchFilterValue) {
  update(value);
  props.field.onCommit?.();
}
</script>

<template>
  <div v-if="!field.hidden" class="search-filter-control" :class="field.class">
    <UInput
      v-if="field.control === 'text' || field.control === 'number'"
      :model-value="inputValue"
      :type="field.control === 'number' ? 'number' : 'text'"
      :label="field.label"
      :placeholder="field.placeholder"
      :icon="field.icon"
      :min="field.min"
      :max="field.max"
      :step="field.step"
      :inputmode="field.inputmode"
      :disabled="field.disabled"
      @update:model-value="update"
      @change="field.onCommit?.()"
      @keyup.enter="field.onEnter?.()"
    />

    <USelectMenu
      v-else-if="field.control === 'select' || field.control === 'multi-select'"
      :model-value="field.value"
      :label="field.label"
      :items="field.options"
      value-key="value"
      label-key="label"
      :multiple="field.control === 'multi-select'"
      :placeholder="field.placeholder"
      :search-input="field.searchable"
      :disabled="field.disabled"
      @update:model-value="updateAndCommit($event as SearchFilterValue)"
    />

    <label
      v-else-if="field.control === 'checkbox'"
      class="search-filter-control__switch"
      :title="field.title"
    >
      <u-switch
        :model-value="Boolean(field.value)"
        :disabled="field.disabled"
        :aria-label="field.label"
        @update:model-value="updateAndCommit"
      />
      <span>{{ field.label }}</span>
    </label>

    <slot v-else :field="field" />
  </div>
</template>

<style scoped>
.search-filter-control { min-width: 0; }
.search-filter-control__switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ui-control-h-md);
  color: var(--ui-text-muted);
  font-size: var(--ui-control-font);
  font-weight: 700;
  cursor: pointer;
  user-select: none;
}
.search-filter-control__switch:has(input:checked) { color: var(--ui-text); }
.search-filter-control__switch:has(input:disabled) { opacity: 0.6; cursor: not-allowed; }
</style>
