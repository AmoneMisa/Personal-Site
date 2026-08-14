<script setup lang="ts">
import type {editor as E} from "monaco-editor";
import {parseTree} from "jsonc-parser";
import {buildJsonIndex} from "~/utils/mergeJson/monacoIndex";

type ViewMode = "json" | "flat";
type DecoKind = "new" | "conflict" | "added" | "edited" | "find";
type Deco = { path: string; kind: DecoKind };

type Props = {
  modelValue?: string;
  text?: string;
  mode: ViewMode;
  selectedKey?: string;
  hiddenKeys?: string[];
  decorations?: Deco[];
  revealPath?: string | null;
  readonly?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  text: "",
  selectedKey: "",
  hiddenKeys: () => [],
  readonly: true,
  decorations: () => [],
  revealPath: null
});
let index = buildJsonIndex(currentText() || "{}");

function classFor(k: DecoKind) {
  if (k === "new") return "jm__hl_new";
  if (k === "conflict") return "jm__hl_conflict";
  if (k === "added") return "jm__hl_added";
  if (k === "edited") return "jm__hl_edited";
  return "jm__findRing";
}

function rgForPath(path: string) {
  if (!editor || !monaco) return null;

  if (props.mode === "flat") return getFlatRangeByPath(path);

  const m = editor.getModel();
  if (!m) return null;

  const r = index.leaf.get(path) ?? index.node.get(path);
  if (!r) return null;

  const a = m.getPositionAt(r.start);
  const b = m.getPositionAt(r.end);
  return new monaco.Range(a.lineNumber, 1, b.lineNumber, 1);
}

function applyDecorations() {
  if (!editor || !monaco) return;
  ensureDecs();

  const list = (props.decorations ?? [])
      .map((d) => {
        const range = rgForPath(d.path);
        if (!range) return null;
        return { range, options: { isWholeLine: true, className: classFor(d.kind) } };
      })
      .filter(Boolean) as any[];

  decMarks!.set(list);
}

watch(() => currentText(), (t) => {
  index = buildJsonIndex(t || "{}");
  applySelected();
  applyDecorations();
});

watch(() => props.decorations, applyDecorations, {deep: true});

watch(() => props.revealPath, (p) => {
  if (!p || !editor) return;
  const r = rgForPath(p);
  if (r) editor.revealRangeInCenter(r);
});
const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "select", key: string): void;
  (e: "ready", api: { openFind: () => void; revealKey: (k: string) => void }): void;
  (e: "nav", dir: 1 | -1): void;
}>();

const el = ref<HTMLDivElement | null>(null);

let monaco: typeof import("monaco-editor") | null = null;
let editor: E.IStandaloneCodeEditor | null = null;

let isProgrammatic = false;

let decSel: E.IEditorDecorationsCollection | null = null;
let decMarks: E.IEditorDecorationsCollection | null = null;

function ensureDecs() {
  if (!editor) return;
  if (!decSel) decSel = editor.createDecorationsCollection();
  if (!decMarks) decMarks = editor.createDecorationsCollection();
}

function model() {
  return editor?.getModel() ?? null;
}

function currentText(): string {
  return props.modelValue ?? props.text ?? "";
}

function posAt(offset: number) {
  const m = model();
  if (!m) return null;
  return m.getPositionAt(offset);
}

function rangeFromOffsets(start: number, end: number) {
  if (!monaco) return null;
  const a = posAt(start);
  const b = posAt(end);
  if (!a || !b) return null;
  return new monaco.Range(a.lineNumber, 1, b.lineNumber, 1);
}

function getFlatRangeByPath(path: string) {
  if (!editor || props.mode !== "flat") return null;
  const m = model();
  if (!m) return null;

  const text = m.getValue();
  const needle = `${path} =`;
  let idx = text.indexOf(needle);
  if (idx === -1) {
    idx = text.indexOf(path);
    if (idx === -1) return null;
  }

  const start = idx;
  const end = text.indexOf("\n", idx);
  return rangeFromOffsets(start, end === -1 ? text.length : end);
}

function getJsonPathAtOffset(offset: number): string | null {
  const m = model();
  if (!m) return null;

  const tree = parseTree(m.getValue());
  if (!tree) return null;

  const contains = (n: any) => offset >= n.offset && offset <= n.offset + n.length;
  let hit: any = null;

  const walk = (n: any) => {
    if (!n || !contains(n)) return;
    hit = n;
    const kids = n.children ?? [];
    for (const k of kids) walk(k);
  };
  walk(tree);

  if (!hit) return null;

  const segs: (string | number)[] = [];
  let cur: any = hit;

  while (cur && cur.parent) {
    const parent = cur.parent;

    if (parent.type === "property") {
      const keyNode = parent.children?.[0];
      const key = keyNode?.value;
      if (typeof key === "string") segs.push(key);
      cur = parent.parent;
      continue;
    }

    if (parent.type === "array") {
      const idx = (parent.children ?? []).indexOf(cur);
      if (idx >= 0) segs.push(idx);
      cur = parent.parent;
      continue;
    }

    cur = parent;
  }

  if (!segs.length) return null;
  return segs.reverse().join(".");
}

function applySelected() {
  if (!editor || !monaco) return;
  ensureDecs();

  const key = props.selectedKey?.trim();
  if (!key) {
    decSel!.clear();
    return;
  }

  const rg = rgForPath(key);
  if (!rg) {
    decSel!.clear();
    return;
  }

  decSel!.set([
    {
      range: rg,
      options: { isWholeLine: true, className: "jm__hlLine" },
    },
  ]);

  editor.revealRangeInCenter(rg);
}

onMounted(async () => {
  if (!el.value) return;

  monaco = await import("monaco-editor");

  editor = monaco.editor.create(el.value, {
    value: currentText(),
    language: props.mode === "json" ? "json" : "plaintext",
    readOnly: props.readonly,
    minimap: {enabled: false},
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: "on",
    folding: true,
    renderLineHighlight: "none",
    fontSize: 12,
    lineNumbersMinChars: 3,
    padding: {top: 10, bottom: 10},
  });

  editor.onDidChangeModelContent((e) => {
    if (!editor || props.readonly) return;
    if (e.isFlush || isProgrammatic) return;
    emit("update:modelValue", editor.getValue());
  });

  editor.onMouseDown((e) => {
    if (!editor) return;
    const pos = e.target.position;
    if (!pos) return;

    const m = model();
    if (!m) return;

    if (props.mode === "flat") {
      const line = m.getLineContent(pos.lineNumber);
      const key = line.split("=")[0]?.trim();
      if (key) emit("select", key);
      return;
    }

    const offset = m.getOffsetAt(pos);
    const path = getJsonPathAtOffset(offset);
    if (path) emit("select", path);
  });

  emit("ready", {revealKey: (k) => emit("select", k)});
  editor.addCommand(monaco.KeyCode.UpArrow, () => emit("nav", -1));
  editor.addCommand(monaco.KeyCode.DownArrow, () => emit("nav", 1));
  editor.addCommand(monaco.KeyCode.Enter, () => emit("nav", 1));
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => emit("nav", -1));
  applySelected();
  applyDecorations();
});

watch(
    () => props.readonly,
    (ro) => editor?.updateOptions({readOnly: ro})
);

watch(
    () => props.mode,
    (mode) => {
      editor?.updateOptions({language: mode === "json" ? "json" : "plaintext"} as any);
    }
);

watch(
    () => currentText(),
    (v) => {
      if (!editor) return;
      const cur = editor.getValue();
      if (cur === v) return;

      isProgrammatic = true;
      editor.setValue(v);
      isProgrammatic = false;

      index = buildJsonIndex(v || "{}");
      applyDecorations();
      applySelected();
    }
);

watch(
    () => [props.selectedKey, props.hiddenKeys, props.mode],
    () => applySelected(),
    {deep: true}
);

onBeforeUnmount(() => {
  editor?.dispose();
  editor = null;
  monaco = null;
  decSel?.clear();
  decMarks?.clear();
  decSel = null;
  decMarks = null;
});
</script>

<template>
  <div class="jm" ref="el"/>
</template>

<style scoped>
.jm {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.12);
}
</style>
