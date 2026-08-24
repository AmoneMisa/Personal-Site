<script setup lang="ts">
import {formatFileSize} from "~/utils/files";

type Props = {
  labelKey: string
  accept?: string
  multiple?: boolean
  error?: string | null
  hintKey?: string
  maxBytes?: number
  maxBytesErrorKey?: string
  pickFileKey?: string
  noFileKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  accept: ".json,.csv,.xml",
  multiple: false,
  error: null,
  maxBytes: 50 * 1024 * 1024,
  maxBytesErrorKey: "common.filePicker.fileTooLarge",
  pickFileKey: "common.filePicker.pickFile",
  noFileKey: "common.filePicker.noFile",
})

const emit = defineEmits<{
  (e: "files", files: File[]): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const fileNames = ref("")
const localError = ref<string | null>(null)

const shownError = computed(() => props.error ?? localError.value)

function openPicker() {
  inputRef.value?.click()
}

function validateFiles(files: File[]) {
  const tooLarge = files.find((f) => f.size > props.maxBytes)
  if (!tooLarge) return { ok: true as const }

  return {
    ok: false as const,
    message: (key: string) =>
        `${key} (${formatFileSize(tooLarge.size)} > ${formatFileSize(props.maxBytes)})`,
    file: tooLarge,
  }
}

function onChange(e: Event) {
  localError.value = null

  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ""

  if (!files.length) {
    fileNames.value = ""
    return
  }

  const res = validateFiles(files)
  if (!res.ok) {
    fileNames.value = ""
    localError.value = `${(useI18n().t as any)(props.maxBytesErrorKey)} (${formatFileSize(res.file.size)} > ${formatFileSize(props.maxBytes)})`
    emit("files", [])
    return
  }

  fileNames.value = files.map((f) => f.name).join(", ")
  emit("files", files)
}
</script>

<template>
  <div class="fi">
    <div class="fi__label">{{ $t(labelKey) }}</div>

    <div class="fi__box" :class="{ fi__box_error: !!shownError }">
      <input
          ref="inputRef"
          class="fi__input"
          type="file"
          :accept="accept"
          :multiple="multiple"
          @change="onChange"
      />

      <div class="fi__row">
        <button class="fi__btn" type="button" @click="openPicker">
          <u-icon name="i-lucide-upload" class="fi__icon" />
          <span>{{ $t(pickFileKey) }}</span>
        </button>

        <div class="fi__name" :title="fileNames || $t(noFileKey)">
          <span v-if="fileNames">{{ fileNames }}</span>
          <span v-else class="fi__muted">{{ $t(noFileKey) }}</span>
        </div>
      </div>
    </div>

    <div v-if="hintKey" class="fi__hint">{{ $t(hintKey) }}</div>
    <div v-if="shownError" class="fi__error">{{ shownError }}</div>
  </div>
</template>

<style scoped>
.fi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 240px;
}

.fi__label {
  font-weight: 900;
  font-size: 12px;
  color: var(--ui-text-muted);
}

.fi__box {
  border-radius: 14px;
  border: 1px dashed var(--ui-border);
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
}

.fi__box_error {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.06);
}

.fi__input {
  display: none;
}

.fi__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fi__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--ui-border);
  background: rgba(0, 0, 0, 0.12);
  color: var(--ui-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.fi__icon {
  width: 16px;
  height: 16px;
  opacity: 0.9;
}

.fi__name {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 12px;
  font-weight: 900;
  color: var(--ui-text);
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fi__muted {
  color: var(--ui-text-muted);
  opacity: 0.9;
}

.fi__hint {
  font-size: 11px;
  color: var(--ui-text-muted);
}

.fi__error {
  font-size: 12px;
  font-weight: 900;
  color: var(--color-error, #ef4444);
}

@media (max-width: 1100px) {
  .fi {
    min-width: 200px;
  }
}
</style>
