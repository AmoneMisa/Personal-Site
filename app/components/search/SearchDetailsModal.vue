<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string;
  ui?: Record<string, string>;
  dismissible?: boolean;
}>(), {
  dismissible: true,
});

const open = defineModel<boolean>("open", { required: true });
const route = useRoute();
const isFlatFinder = computed(() => route.path.endsWith("/flat-finder"));

// Detail dialogs must sit above page-level fullscreen surfaces (the Flat Finder
// map uses z-index 3000, and its cluster browser uses 9000). Keep this ownership
// in the shared modal instead of adding page-specific z-index overrides.
const modalUi = computed(() => {
  const requestedContent = String(props.ui?.content || "");
  const content = isFlatFinder.value
    ? requestedContent.replace(/\bmax-w-[^\s]+/g, "").trim()
    : requestedContent;

  return {
    ...props.ui,
    overlay: ["z-[12000]", props.ui?.overlay].filter(Boolean).join(" "),
    content: [
      "z-[12001]",
      content,
      isFlatFinder.value ? "flat-finder-details w-[calc(100vw-24px)] max-w-[800px]" : "",
    ].filter(Boolean).join(" "),
  };
});
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

<style>
/* Flat Finder deliberately keeps every fact in one place: the specification
   grid. Deal/room badges beside the price were duplicates of those rows. */
.flat-finder-details .flat-modal__deal {
  display: none !important;
}

.flat-finder-details [data-slot="header"] {
  padding-bottom: 10px;
}

.flat-finder-details [data-slot="body"] {
  padding-top: 8px;
  padding-bottom: 10px;
}

.flat-finder-details [data-slot="footer"] {
  padding-top: 10px;
}
</style>
