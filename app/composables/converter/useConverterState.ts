import {downloadBlob} from "~/utils/files";
import {useFileCollection} from "~/composables/ui/useFileCollection";

export type ConverterMode = "media" | "data" | "document";

const MODE_CONFIG = {
  media: {
    targets: ["png", "jpeg", "jpg", "webp", "gif", "bmp", "tiff", "avif"],
    extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "avif"],
    accept: ".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.avif",
    defaultTarget: "webp",
    endpoint: "/convert/media",
    maxFiles: 20,
    multiple: true,
  },
  data: {
    targets: ["csv", "json", "xml", "xlsx", "yaml", "tsv"],
    extensions: ["csv", "json", "xml", "xlsx", "yaml", "yml", "tsv"],
    accept: ".csv,.json,.xml,.xlsx,.yaml,.yml,.tsv",
    defaultTarget: "json",
    endpoint: "/convert/data",
    maxFiles: 1,
    multiple: false,
  },
  document: {
    targets: ["pdf", "docx", "txt", "html", "md", "odt", "rtf"],
    extensions: ["docx", "pdf", "txt", "html", "htm", "md", "odt", "rtf"],
    accept: ".docx,.pdf,.txt,.html,.htm,.md,.odt,.rtf",
    defaultTarget: "pdf",
    endpoint: "/convert/document",
    maxFiles: 1,
    multiple: false,
  },
} as const;

function fileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function filenameFromContentDisposition(value: string | null) {
  if (!value) return null;

  const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/"/g, ""));
    } catch {
      return encoded.replace(/"/g, "");
    }
  }

  const plain = value.match(/filename\s*=\s*"([^"]+)"/i) || value.match(/filename\s*=\s*([^;]+)/i);
  return plain?.[1]?.trim().replace(/(^"|"$)/g, "") ?? null;
}

export function useConverterState() {
  const {t} = useI18n();
  const runtime = useRuntimeConfig();
  const mode = ref<ConverterMode>("media");
  const currentMode = computed(() => MODE_CONFIG[mode.value]);
  const target = ref<string>(MODE_CONFIG.media.defaultTarget);
  const accept = computed(() => currentMode.value.accept);
  const maxFiles = computed(() => currentMode.value.maxFiles);
  const isMultiple = computed(() => currentMode.value.multiple);
  const isLoading = ref(false);
  const errorMessage = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  const {
    files,
    inputRef: fileInputRef,
    isDragging,
    pickFromInput,
    openPicker: openFilePicker,
    clearFiles: clearSelectedFiles,
    removeFile,
    onDrop: addDroppedFiles,
    onDragOver,
    onDragLeave,
  } = useFileCollection({
    multiple: isMultiple,
    maxFiles,
    onLimit: (limit) => {
      successMessage.value = t("services.converter.messages.tookFirst", {count: limit});
    },
  });

  function clearMessages() {
    errorMessage.value = null;
    successMessage.value = null;
  }

  function clearFiles() {
    clearSelectedFiles();
    clearMessages();
  }

  watch(mode, () => {
    target.value = currentMode.value.defaultTarget;
    clearFiles();
  });

  function openPicker() {
    clearMessages();
    openFilePicker();
  }

  function pickFilesFromInput(event: Event) {
    clearMessages();
    pickFromInput(event);
  }

  function onDrop(event: DragEvent) {
    clearMessages();
    addDroppedFiles(event);
  }

  function validate() {
    clearMessages();
    if (!files.value.length) {
      errorMessage.value = t("services.converter.messages.noFiles");
      return false;
    }
    if (!currentMode.value.multiple && files.value.length !== 1) {
      errorMessage.value = t("services.converter.messages.singleOnly");
      return false;
    }
    if (files.value.length > currentMode.value.maxFiles) {
      errorMessage.value = t("services.converter.messages.mediaMax");
      return false;
    }

    const extensions: readonly string[] = currentMode.value.extensions;
    const invalid = files.value.find(file => !extensions.includes(fileExtension(file.name)));
    if (invalid) {
      errorMessage.value = t("services.converter.messages.unsupported", {name: invalid.name});
      return false;
    }
    return true;
  }

  async function convert() {
    if (!validate()) return;
    isLoading.value = true;
    clearMessages();

    try {
      const form = new FormData();
      if (currentMode.value.multiple) {
        files.value.forEach(file => form.append("files", file));
      } else {
        form.append("file", files.value[0]);
      }
      form.append("target", target.value);

      const response = await fetch(`${runtime.public.apiBase}${currentMode.value.endpoint}`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!response.ok) {
        let payload: any = null;
        try {
          payload = await response.json();
        } catch {
          // The HTTP status remains useful when the server has no JSON body.
        }
        errorMessage.value = payload?.detail?.message
          || payload?.message
          || t("services.converter.messages.httpError", {status: response.status});
        return;
      }

      const normalizedTarget = target.value === "jpeg" ? "jpg" : target.value;
      const fallback = currentMode.value.multiple && files.value.length > 1
        ? "converted_media.zip"
        : `${files.value[0].name.replace(/\.[^.]+$/, "")}.${normalizedTarget}`;
      downloadBlob(
        await response.blob(),
        filenameFromContentDisposition(response.headers.get("content-disposition")) || fallback,
      );
      successMessage.value = t("services.converter.messages.success");
    } catch (error: any) {
      errorMessage.value = error?.message || t("services.converter.messages.failed");
    } finally {
      isLoading.value = false;
    }
  }

  const modeCards = computed(() => ([
    {key: "media" as const, title: t("services.converter.modes.media.title"), desc: t("services.converter.modes.media.desc"), icon: "i-lucide-image"},
    {key: "data" as const, title: t("services.converter.modes.data.title"), desc: t("services.converter.modes.data.desc"), icon: "i-lucide-database"},
    {key: "document" as const, title: t("services.converter.modes.docs.title"), desc: t("services.converter.modes.docs.desc"), icon: "i-lucide-file-text"},
  ]));
  const targetItems = computed(() => currentMode.value.targets.map(value => ({
    label: value.toUpperCase(),
    value,
  })));

  return {
    mode,
    target,
    accept,
    maxFiles,
    isMultiple,
    isLoading,
    errorMessage,
    successMessage,
    files,
    fileInputRef,
    isDragging,
    removeFile,
    onDragOver,
    onDragLeave,
    clearFiles,
    openPicker,
    pickFilesFromInput,
    onDrop,
    convert,
    modeCards,
    targetItems,
  };
}
