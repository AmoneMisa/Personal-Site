<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  ui?: Record<string, string>;
  dismissible?: boolean;
}>(), {
  dismissible: true,
});

const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <u-modal
    v-model:open="open"
    :title="title"
    :ui="ui"
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
