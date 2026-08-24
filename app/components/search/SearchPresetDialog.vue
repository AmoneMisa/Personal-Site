<script setup lang="ts">
defineProps<{ title: string; nameLabel: string; cancelLabel: string; saveLabel: string }>();
const open = defineModel<boolean>("open", { required: true });
const name = defineModel<string>("name", { required: true });
defineEmits<{ save: [] }>();
</script>

<template>
  <u-modal v-model:open="open" :title="title">
    <template #body><u-input v-model="name" autofocus :label="nameLabel" @keyup.enter="$emit('save')" /></template>
    <template #footer>
      <u-button color="neutral" variant="ghost" @click="open = false">{{ cancelLabel }}</u-button>
      <u-button @click="$emit('save')">{{ saveLabel }}</u-button>
    </template>
  </u-modal>
</template>
