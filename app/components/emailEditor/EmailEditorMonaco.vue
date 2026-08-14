<script setup lang="ts">
import type { editor as E } from "monaco-editor";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DiagnosticItem } from "~/utils/emailEditor/diagnostics/types";
import type { TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";
import { useEmailEditorMonacoDecorations } from "~/composables/emailEditor/useEmailEditorMonacoDecorations";

type Props = {
  modelValue: string;
  templateEngine: TemplateEngine;
  diagnostics: DiagnosticItem[];
  activeDiagnosticId: string | null;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "ready", api: {
    insertSnippet: (snippet: string) => void;
    replaceRange: (startOffset: number, endOffset: number, text: string) => void;
    revealOffsets: (startOffset: number, endOffset: number) => void;
    getText: () => string;
  }): void;
  (e: "request-color-picker", payload: { clientX: number; clientY: number; startOffset: number; endOffset: number; current: string }): void;
}>();

const rootElement = ref<HTMLDivElement | null>(null);

let monaco: typeof import("monaco-editor") | null = null;
let editor: E.IStandaloneCodeEditor | null = null;
let isProgrammatic = false;

const decorationsApi = useEmailEditorMonacoDecorations({
  getMonaco: () => monaco,
  getEditor: () => editor,
  onRequestColorPicker: (p) => emit("request-color-picker", p),
});

function languageFor(engine: TemplateEngine) {
  return "html";
}

function model() {
  return editor?.getModel() ?? null;
}

function offsetToPosition(offset: number) {
  const m = model();
  if (!m) return null;
  return m.getPositionAt(Math.max(0, offset));
}

function revealOffsets(startOffset: number, endOffset: number) {
  if (!editor || !monaco) return;
  const m = model();
  if (!m) return;

  const a = offsetToPosition(startOffset);
  const b = offsetToPosition(endOffset);
  if (!a || !b) return;

  const range = new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column);
  editor.revealRangeInCenter(range);
  editor.setSelection(range);
  editor.focus();
}

function replaceRange(startOffset: number, endOffset: number, text: string) {
  if (!editor || !monaco) return;
  const m = model();
  if (!m) return;

  const a = offsetToPosition(startOffset);
  const b = offsetToPosition(endOffset);
  if (!a || !b) return;

  const range = new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column);

  editor.executeEdits("email-editor", [
    { range, text, forceMoveMarkers: true }
  ]);

  const v = m.getValue();
  emit("update:modelValue", v);
}

function insertSnippet(snippet: string) {
  if (!editor || !monaco) return;
  const m = model();
  if (!m) return;

  const sel = editor.getSelection();
  const range = sel ?? new monaco.Range(1, 1, 1, 1);

  editor.executeEdits("email-editor", [
    { range, text: snippet, forceMoveMarkers: true }
  ]);

  const v = m.getValue();
  emit("update:modelValue", v);
}

onMounted(async () => {
  if (!rootElement.value) return;
  monaco = await import("monaco-editor");

  editor = monaco.editor.create(rootElement.value, {
    value: props.modelValue,
    language: languageFor(props.templateEngine),
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: "on",
    folding: true,
    renderLineHighlight: "none",
    fontSize: 12,
    lineNumbersMinChars: 3,
    padding: { top: 10, bottom: 10 },
  });

  editor.onDidChangeModelContent((e) => {
    if (!editor) return;
    if (e.isFlush || isProgrammatic) return;
    emit("update:modelValue", editor.getValue());
  });

  editor.onMouseDown((e) => {
    decorationsApi.onEditorMouseDown(e);
  });

  emit("ready", {
    insertSnippet,
    replaceRange,
    revealOffsets,
    getText: () => model()?.getValue() ?? "",
  });

  decorationsApi.applyAll(props.diagnostics, props.activeDiagnosticId);
});

watch(
    () => props.templateEngine,
    (engine) => {
      if (!editor) return;
      editor.updateOptions({ language: languageFor(engine) } as any);
    }
);

watch(
    () => props.modelValue,
    (v) => {
      if (!editor) return;
      const cur = editor.getValue();
      if (cur === v) return;
      isProgrammatic = true;
      editor.setValue(v);
      isProgrammatic = false;
    }
);

watch(
    () => [props.diagnostics, props.activeDiagnosticId],
    () => decorationsApi.applyAll(props.diagnostics, props.activeDiagnosticId),
    { deep: true }
);

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
  monaco = null;
  decorationsApi.dispose();
});
</script>

<template>
  <div class="email-editor-monaco" ref="rootElement" />
</template>

<style scoped lang="scss">
.email-editor-monaco {
  width: 100%;
  height: 520px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.12);
}

:global(.email-editor-monaco__line_error) {
  background: rgba(255, 80, 120, 0.14);
}
:global(.email-editor-monaco__line_warning) {
  background: rgba(255, 190, 90, 0.14);
}
:global(.email-editor-monaco__line_active) {
  outline: 1px solid rgba(224, 103, 154, 0.55);
}

:global(.email-editor-monaco__inline_color_chip) {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 6px;
  border: 1px solid rgba(0,0,0,0.25);
  transform: translateY(1px);
}
</style>
