<script setup lang="ts">
import MonacoJsonView from "~/components/mergeJson/MonacoJsonView.client.vue";
import type {MergeJsonDecoration, MergeJsonEditorMode} from "~/types/mergeJson";

type Props = {
  title: string;
  mode: MergeJsonEditorMode;
  modelValue?: string;
  text?: string;
  selectedKey?: string;
  hiddenKeys?: string[];
  decorations?: MergeJsonDecoration[];
  revealPath?: string | null;
  readonly?: boolean;
  center?: boolean;
  error?: string | null;
};

withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  text: "",
  selectedKey: "",
  hiddenKeys: () => [],
  decorations: () => [],
  revealPath: null,
  readonly: true,
  center: false,
  error: null,
});

defineEmits<{
  "update:modelValue": [value: string];
  select: [key: string];
  nav: [direction: 1 | -1];
}>();
</script>

<template>
  <div class="merge-pane" :class="{'merge-pane_center': center}">
    <div class="merge-pane__head">
      <div class="merge-pane__title">{{ title }}</div>
      <div v-if="selectedKey" class="merge-pane__sub">
        <span class="merge-pane__selection">{{ selectedKey }}</span>
      </div>
    </div>

    <div class="merge-pane__body">
      <ClientOnly>
        <monaco-json-view
            :mode="mode"
            :model-value="modelValue"
            :text="text"
            :selected-key="selectedKey"
            :hidden-keys="hiddenKeys"
            :decorations="decorations"
            :reveal-path="revealPath"
            :readonly="readonly"
            @update:modelValue="$emit('update:modelValue', $event)"
            @select="$emit('select', $event)"
            @nav="$emit('nav', $event)"
        />
      </ClientOnly>

      <div v-if="error" class="merge-pane__error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.merge-pane {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.12);
  padding: 10px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.merge-pane_center {
  box-shadow: 0 0 0 1px rgba(224, 103, 154, 0.18) inset;
}

.merge-pane__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.merge-pane__title {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.merge-pane__sub {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.75;
  min-width: 0;
}

.merge-pane__selection {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.merge-pane__body {
  min-height: 420px;
  height: 420px;
}

.merge-pane__error {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-error);
  opacity: 0.95;
}

@media (max-width: 1100px) {
  .merge-pane__body {
    min-height: 360px;
    height: 360px;
  }
}
</style>
