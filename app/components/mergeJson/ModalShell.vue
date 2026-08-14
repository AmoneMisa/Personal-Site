<script setup lang="ts">
type Props = {
  modelValue: boolean;
  title: string;
  subtitle?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  disableConfirm?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  subtitle: "",
  confirmText: "OK",
  cancelText: "Cancel",
  danger: false,
  disableConfirm: false,
});

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "confirm"): void;
  (e: "close"): void;
}>();

function close() {
  emit("update:modelValue", false);
  emit("close");
}

function confirm() {
  emit("confirm");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="ms">
      <div class="ms__backdrop" @click="close"/>
      <div class="ms__card" role="dialog" aria-modal="true">
        <div class="ms__head">
          <div class="ms__title">{{ title }}</div>
          <div v-if="subtitle" class="ms__sub">{{ subtitle }}</div>
        </div>

        <div class="ms__body">
          <slot/>
        </div>

        <div class="ms__actions">
          <button class="ms__btn ms__btn_ghost" type="button" @click="close">
            {{ cancelText }}
          </button>

          <button
              class="ms__btn"
              :class="danger ? 'ms__btn_danger' : 'ms__btn_primary'"
              type="button"
              :disabled="disableConfirm"
              @click="confirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ms {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.ms__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, .55);
}

.ms__card {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(560px, calc(100vw - 24px));
  border-radius: 18px;
  border: 1px solid var(--ui-border);
  background: rgba(20, 20, 22, .95);
  box-shadow: 0 20px 80px rgba(0, 0, 0, .5);
  padding: 14px;
}

.ms__head {
  padding: 6px 6px 10px;
}

.ms__title {
  font-weight: 900;
  font-size: 14px;
}

.ms__sub {
  margin-top: 6px;
  opacity: .75;
  font-size: 12px;
}

.ms__body {
  padding: 6px;
}

.ms__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 10px 6px 6px;
}

.ms__btn {
  height: 34px;
  border-radius: 12px;
  padding: 0 12px;
  border: 1px solid var(--ui-border);
  background: rgba(255, 255, 255, .06);
  color: var(--ui-text);
  font-weight: 900;
  font-size: 12px;
}

.ms__btn_ghost {
  background: transparent;
}

.ms__btn_primary {
  background: rgba(224, 103, 154, .25);
  border-color: rgba(224, 103, 154, .45);
}

.ms__btn_danger {
  background: rgba(239, 68, 68, .18);
  border-color: rgba(239, 68, 68, .35);
}

.ms__btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}
</style>
