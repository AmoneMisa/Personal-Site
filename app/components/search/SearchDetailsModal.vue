<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  ui?: Record<string, string>;
  dismissible?: boolean;
}>(), {
  dismissible: true,
});

const open = defineModel<boolean>("open", { required: true });

// Detail dialogs must sit above page-level fullscreen surfaces (the Flat Finder
// map uses z-index 3000, and its cluster browser uses 9000). Keep this ownership
// in the shared modal instead of adding page-specific z-index overrides.
const modalUi = computed(() => ({
  ...props.ui,
  overlay: ["z-[12000]", props.ui?.overlay].filter(Boolean).join(" "),
  content: ["z-[12001]", props.ui?.content].filter(Boolean).join(" "),
}));
</script>

<template>
  <u-modal
    v-model:open="open"
    :title="title"
    :ui="modalUi"
    :dismissible="dismissible"
  >
    <template v-if="$slots.title" #title>
      <slot name="title" />
    </template>
    <template #body>
      <slot name="body" />
    </template>
    <template #footer>
      <slot name="footer" />
    </template>
  </u-modal>
</template>
