import {ref, toValue, type MaybeRefOrGetter} from "vue";

type FileCollectionOptions = {
  multiple?: MaybeRefOrGetter<boolean>;
  maxFiles?: MaybeRefOrGetter<number>;
  validate?: (file: File) => boolean;
  onRejected?: (file: File) => void;
  onLimit?: (limit: number) => void;
};

export function useFileCollection(options: FileCollectionOptions = {}) {
  const files = ref<File[]>([]);
  const inputRef = ref<HTMLInputElement | null>(null);
  const isDragging = ref(false);

  function addFiles(incoming: File[]) {
    if (!incoming.length) return;

    const accepted = options.validate
      ? incoming.filter((file) => {
          const valid = options.validate?.(file) ?? true;
          if (!valid) options.onRejected?.(file);
          return valid;
        })
      : incoming;
    if (!accepted.length) return;

    if (!toValue(options.multiple ?? false)) {
      files.value = [accepted[0]];
      return;
    }

    const limit = Math.max(1, toValue(options.maxFiles ?? Number.MAX_SAFE_INTEGER));
    const combined = [...files.value, ...accepted];
    files.value = combined.slice(0, limit);
    if (combined.length > limit) options.onLimit?.(limit);
  }

  function pickFromInput(event: Event) {
    const input = event.target as HTMLInputElement;
    addFiles(Array.from(input.files ?? []));
    input.value = "";
  }

  function openPicker() {
    inputRef.value?.click();
  }

  function clearFiles() {
    files.value = [];
  }

  function removeFile(index: number) {
    files.value = files.value.filter((_, current) => current !== index);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    isDragging.value = false;
    addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging.value = true;
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging.value = false;
  }

  return {
    files,
    inputRef,
    isDragging,
    addFiles,
    pickFromInput,
    openPicker,
    clearFiles,
    removeFile,
    onDrop,
    onDragOver,
    onDragLeave,
  };
}
