<script setup lang="ts">
withDefaults(
    defineProps<{
      modelValue?: string;
      labelKey: string;
      placeholderKey: string;
      error?: string | null;
      rows?: number;
    }>(),
    {
      modelValue: "",
      error: null,
      rows: 12,
    }
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

const id = `ta_${Math.random().toString(16).slice(2)}`;

function onInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div class="svg-textarea" :class="{ 'svg-textarea_error': !!error }">
    <div class="svg-textarea__label">
      <label :for="id">{{ $t(labelKey) }}</label>
    </div>

    <div class="svg-textarea__box">
      <textarea
          :id="id"
          class="svg-textarea__input"
          :value="modelValue"
          :placeholder="$t(placeholderKey)"
          :rows="rows"
          @input="onInput"
      />
    </div>

    <div v-if="error" class="svg-textarea__error">{{ error }}</div>
  </div>
</template>

<style scoped lang="scss">
.svg-textarea {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.svg-textarea__label {
  font-weight: 600;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.svg-textarea__box {
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.svg-textarea__input {
  width: 100%;
  min-height: 220px;
  resize: vertical;
  background: transparent;
  border: 0;
  outline: none;
  font-size: 12px;
  color: var(--ui-text);
  line-height: 1.45;
}

.svg-textarea__error {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-error, #ef4444);
}

.svg-textarea_error .svg-textarea__box {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}
</style>
