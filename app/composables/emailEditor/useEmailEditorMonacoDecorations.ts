import type { editor as E } from "monaco-editor";
import type { DiagnosticItem, DiagnosticSeverity } from "~/utils/emailEditor/diagnostics/types";

type Ctx = {
getMonaco: () => typeof import("monaco-editor") | null;
getEditor: () => E.IStandaloneCodeEditor | null;
onRequestColorPicker: (p: { clientX: number; clientY: number; startOffset: number; endOffset: number; current: string }) => void;
};

export function useEmailEditorMonacoDecorations(ctx: Ctx) {
const { t } = useI18n();
let diagnosticCollection: E.IEditorDecorationsCollection | null = null;
let colorCollection: E.IEditorDecorationsCollection | null = null;

function ensureCollections() {
const editor = ctx.getEditor();
if (!editor) return;
if (!diagnosticCollection) diagnosticCollection = editor.createDecorationsCollection();
if (!colorCollection) colorCollection = editor.createDecorationsCollection();
}

function rangeFromOffsets(startOffset: number, endOffset: number) {
const monaco = ctx.getMonaco();
const editor = ctx.getEditor();
if (!monaco || !editor) return null;
const model = editor.getModel();
if (!model) return null;

const a = model.getPositionAt(startOffset);
const b = model.getPositionAt(endOffset);
return new monaco.Range(a.lineNumber, 1, b.lineNumber, 1);
}

function classForSeverity(sev: DiagnosticSeverity) {
if (sev === "error") return "email-editor-monaco__line_error";
return "email-editor-monaco__line_warning";
}

function applyDiagnosticsDecorations(list: DiagnosticItem[], activeId: string | null) {
ensureCollections();
const monaco = ctx.getMonaco();
const editor = ctx.getEditor();
if (!monaco || !editor || !diagnosticCollection) return;

const items = list
.map((d) => {
const range = rangeFromOffsets(d.startOffset, d.endOffset);
if (!range) return null;
const isActive = activeId && d.id === activeId;

return {
range,
options: {
isWholeLine: true,
className: [classForSeverity(d.severity), isActive ? "email-editor-monaco__line_active" : ""]
.filter(Boolean)
.join(" "),
hoverMessage: { value: `${d.severity.toUpperCase()}: ${d.messageKey ? t(d.messageKey, d.messageParams || {}) : d.message}` },
},
};
})
.filter(Boolean) as any[];

diagnosticCollection.set(items);
}

// Color highlights: find `#RRGGBB`, `#RGB`, `rgb(...)`, `rgba(...)` and decorate inline
function applyColorDecorations(text: string) {
ensureCollections();
const monaco = ctx.getMonaco();
const editor = ctx.getEditor();
if (!monaco || !editor || !colorCollection) return;

const model = editor.getModel();
if (!model) return;

const regex = /(#(?:[0-9a-fA-F]{3}){1,2}\b|rgba?\(\s*[^)]+\))/g;
const decs: any[] = [];

let match: RegExpExecArray | null;
while ((match = regex.exec(text))) {
const start = match.index;
const end = match.index + match[0].length;
const a = model.getPositionAt(start);
const b = model.getPositionAt(end);

// Monaco “before” content — маленький квадратик
decs.push({
range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
options: {
inlineClassName: "",
beforeContentClassName: "email-editor-monaco__inline_color_chip",
},
});
}

colorCollection.set(decs);
}

function onEditorMouseDown(e: any) {
const editor = ctx.getEditor();
if (!editor) return;

const model = editor.getModel();
const pos = e?.target?.position;
if (!model || !pos) return;

const offset = model.getOffsetAt(pos);
const text = model.getValue();

// попробуем найти “цветовой токен” вокруг курсора
const around = text.slice(Math.max(0, offset - 40), Math.min(text.length, offset + 40));
const localOffset = offset - Math.max(0, offset - 40);

const regex = /(#(?:[0-9a-fA-F]{3}){1,2}\b|rgba?\(\s*[^)]+\))/g;
let match: RegExpExecArray | null;

while ((match = regex.exec(around))) {
const start = match.index;
const end = match.index + match[0].length;
if (localOffset >= start && localOffset <= end) {
const globalStart = offset - localOffset + start;
const globalEnd = offset - localOffset + end;

// открываем колорпикер по координатам мыши
const evt = e?.event?.browserEvent;
ctx.onRequestColorPicker({
clientX: evt?.clientX ?? 0,
clientY: evt?.clientY ?? 0,
startOffset: globalStart,
endOffset: globalEnd,
current: match[0],
});
return;
}
}
}

function applyAll(diagnostics: DiagnosticItem[], activeId: string | null) {
const editor = ctx.getEditor();
if (!editor) return;
const model = editor.getModel();
const text = model?.getValue() ?? "";
applyDiagnosticsDecorations(diagnostics, activeId);
applyColorDecorations(text);
}

function dispose() {
diagnosticCollection?.clear();
colorCollection?.clear();
diagnosticCollection = null;
colorCollection = null;
}

return { applyAll, dispose, onEditorMouseDown };
}
