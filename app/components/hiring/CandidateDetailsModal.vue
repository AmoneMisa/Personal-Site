<script setup lang="ts">
defineProps<{ title: string; ui?: Record<string, string> }>();
const open = defineModel<boolean>("open", { required: true });
</script>
<template>
  <u-modal v-model:open="open" :title="title" :ui="ui">
    <template v-if="$slots.title" #title><slot name="title" /></template>
    <template #body><slot name="body" /></template>
    <template #footer><slot name="footer" /></template>
  </u-modal>
</template>
