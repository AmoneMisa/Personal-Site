<script setup lang="ts">
import ModalShell from "~/components/mergeJson/ModalShell.vue";
import CustomInput from "~/components/common/CustomInput.vue";

type Props = { modelValue: boolean };
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "submit", payload: { key: string; value: string }): void;
  (e: "close"): void;
}>();

const { t } = useI18n();

const keyInput = ref("");
const valueInput = ref("");

watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;
      keyInput.value = "";
      valueInput.value = "";
    }
);

const disableConfirm = computed(() => !keyInput.value.trim());

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function confirm() {
  const key = keyInput.value.trim();
  if (!key) return;
  emit("submit", { key, value: valueInput.value });
  close();
}
</script>

<template>
  <ModalShell
      :model-value="modelValue"
      @update:modelValue="(v) => emit('update:modelValue', v)"
      @close="close"
      @confirm="confirm"
      :title="t('services.mergeJson.modals.addKey.title')"
      :confirm-text="t('services.mergeJson.modals.addKey.confirm')"
      :cancel-text="t('services.mergeJson.modals.addKey.cancel')"
      :disable-confirm="disableConfirm"
  >
    <CustomInput
        v-model="keyInput"
        :label="t('services.mergeJson.modals.addKey.keyLabel')"
        :placeholder="t('services.mergeJson.modals.addKey.keyPh')"
    />

    <label class="akm__label">
      {{ t('services.mergeJson.modals.addKey.valueLabel') }}
      <textarea v-model="valueInput" class="akm__ta" rows="6" />
    </label>
  </ModalShell>
</template>

<style scoped>
.akm__label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 600;
  font-size: 12px;
  opacity: 0.95;
}

.akm__ta {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--ui-text);
  padding: 10px 12px;
  font-size: 12px;
  outline: none;
}
</style>
