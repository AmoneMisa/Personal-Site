<script setup lang="ts">
import ModalShell from "~/components/mergeJson/ModalShell.vue";

type Props = {
  modelValue: boolean;
  path: string;
};
defineProps<Props>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  close: [];
}>();

const { t } = useI18n();
</script>

<template>
  <ModalShell
      :model-value="modelValue"
      @update:modelValue="(v) => emit('update:modelValue', v)"
      @close="emit('close')"
      @confirm="emit('confirm')"
      :title="t('services.mergeJson.modals.delete.title')"
      :subtitle="t('services.mergeJson.modals.delete.subtitle', { path })"
      :confirm-text="t('services.mergeJson.modals.delete.confirm')"
      :cancel-text="t('services.mergeJson.modals.delete.cancel')"
      danger
  />
</template>
