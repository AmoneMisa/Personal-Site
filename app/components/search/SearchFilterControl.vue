<script setup lang="ts">
import CustomCheckbox from "~/components/common/CustomCheckbox.vue";
import UInput from "~/components/U/Input.vue";
import USelectMenu from "~/components/U/SelectMenu.vue";
import type { SearchFilterField, SearchFilterValue } from "~/types/search";

const props = defineProps<{ field: SearchFilterField }>();

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
      :model-value="field.value as string | number | null | undefined"
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

    <CustomCheckbox
      v-else-if="field.control === 'checkbox'"
      :model-value="Boolean(field.value)"
      :label="field.label"
      :disabled="field.disabled"
      :title="field.title"
      @update:model-value="updateAndCommit"
    />

    <slot v-else :field="field" />
  </div>
</template>

<style scoped>
.search-filter-control { min-width: 0; }
</style>
