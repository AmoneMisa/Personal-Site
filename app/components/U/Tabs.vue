<script setup lang="ts">
// Drop-in replacement for Nuxt UI's <UTabs>.
//
// Matches how the app uses it: an `items` array, a #default scoped slot for the
// trigger label ({ item, index }) and a #content scoped slot for each panel,
// plus `update:modelValue` when the active tab changes.
import { ref, watch } from "vue";

const props = withDefaults(defineProps<{
  items?: any[];
  modelValue?: number;
  defaultIndex?: number;
  ui?: unknown;
}>(), { items: () => [], defaultIndex: 0 });

const emit = defineEmits<{ (e: "update:modelValue", value: number): void }>();

const active = ref(props.modelValue ?? props.defaultIndex ?? 0);
watch(() => props.modelValue, (value) => {
  if (value !== active.value) active.value = value;
});

function select(index: number) {
  active.value = index;
  emit("update:modelValue", index);
}
</script>

<template>
  <div class="u-tabs">
    <div class="u-tabs__list" role="tablist">
      <button
          v-for="(item, index) in items"
          :key="index"
          type="button"
          role="tab"
          class="u-tabs__trigger ui-focusable"
          :class="{ 'u-tabs__trigger_active': index === active }"
          :aria-selected="index === active"
          @click="select(index)"
      >
        <slot :item="item" :index="index">{{ item?.label ?? item }}</slot>
      </button>
    </div>
    <div class="u-tabs__panel" role="tabpanel">
      <template v-for="(item, index) in items" :key="'panel-' + index">
        <slot v-if="index === active" name="content" :item="item" :index="index" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.u-tabs { display: flex; flex-direction: column; gap: 14px; }
.u-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 2px;
}
/* Narrow screens: scroll the strip sideways rather than stacking triggers into
   several rows, which pushed the panel far down the page. */
@media (max-width: 640px) {
  .u-tabs__list {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
  }
  .u-tabs__list::-webkit-scrollbar { display: none; }
  .u-tabs__trigger { flex: none; scroll-snap-align: start; }
}
.u-tabs__trigger {
  min-height: var(--ui-control-h-sm);
  padding-inline: 12px;
  border: 1px solid var(--line, #252a4a);
  border-radius: 999px;
  background: transparent;
  color: var(--text-soft, #c8ccdf);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--ui-transition), border-color var(--ui-transition), background-color var(--ui-transition);
}
.u-tabs__trigger:hover { background: rgba(255, 255, 255, 0.05); }
.u-tabs__trigger_active {
  border-color: var(--accent-pink, #e0679a);
  color: var(--accent-pink, #e0679a);
  background: rgba(224, 103, 154, 0.12);
}
</style>
