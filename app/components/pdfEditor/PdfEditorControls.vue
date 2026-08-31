<script setup lang="ts">
import type {PdfEditorMode, PdfEditorState, PdfSelectedObjectState, PdfTextAlign} from "~/types/pdfEditor";

defineProps<{editor: PdfEditorState; selected: PdfSelectedObjectState; fontFamilies: string[]; busy: boolean; canUndo: boolean; canRedo: boolean}>();
defineEmits<{
  "toggle-full": [];
  "set-mode": [mode: PdfEditorMode];
  "add-rect": [];
  "add-circle": [];
  "add-text": [];
  "add-image": [];
  undo: [];
  redo: [];
  remove: [];
  clear: [];
  "load-text": [];
  "replace-image": [];
  "apply-font": [];
  "apply-font-size": [];
  "apply-color": [];
  "apply-opacity": [];
  "apply-geometry": [];
  "toggle-style": [style: "bold" | "italic" | "underline"];
  align: [alignment: PdfTextAlign];
}>();
const {t} = useI18n();
const drawingTools: {mode: PdfEditorMode; icon: string}[] = [
  {mode: "move", icon: "i-lucide-move"},
  {mode: "pen", icon: "i-lucide-pencil"},
  {mode: "highlighter", icon: "i-lucide-highlighter"},
  {mode: "signature", icon: "i-lucide-signature"},
];
const textStyles = ["bold", "italic", "underline"] as const;
const textAlignments: PdfTextAlign[] = ["left", "center", "right", "justify"];
</script>

<template>
  <div class="pdf-controls__toolstrip">
    <button type="button" class="pdf-controls__pill" :class="{'pdf-controls__pill_active': editor.fullMode}" :disabled="busy" @click="$emit('toggle-full')"><u-icon name="i-lucide-square-pen" />{{ t("services.pdfEditor.toolstrip.fullMode") }}</button>
    <div class="pdf-controls__separator" />
    <button
        v-for="tool in drawingTools"
        :key="tool.mode"
        type="button"
        class="pdf-controls__pill"
        :class="{'pdf-controls__pill_active': editor.mode === tool.mode}"
        :disabled="busy"
        @click="$emit('set-mode', tool.mode)"
    ><u-icon :name="tool.icon" />{{ t(`services.pdfEditor.toolstrip.${tool.mode}`) }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('add-rect')"><u-icon name="i-lucide-square" />{{ t("services.pdfEditor.toolstrip.rect") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('add-circle')"><u-icon name="i-lucide-circle" />{{ t("services.pdfEditor.toolstrip.circle") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('add-text')"><u-icon name="i-lucide-type" />{{ t("services.pdfEditor.toolstrip.text") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('add-image')"><u-icon name="i-lucide-image" />{{ t("services.pdfEditor.toolstrip.image") }}</button>
    <div class="pdf-controls__separator" />
    <button type="button" class="pdf-controls__pill" :disabled="busy || !canUndo" @click="$emit('undo')"><u-icon name="i-lucide-undo-2" />{{ t("services.pdfEditor.toolstrip.undo") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy || !canRedo" @click="$emit('redo')"><u-icon name="i-lucide-redo-2" />{{ t("services.pdfEditor.toolstrip.redo") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('remove')"><u-icon name="i-lucide-trash-2" />{{ t("services.pdfEditor.toolstrip.remove") }}</button>
    <button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('clear')"><u-icon name="i-lucide-eraser" />{{ t("services.pdfEditor.toolstrip.clearPage") }}</button>
  </div>

  <div class="pdf-controls__section">
    <div class="pdf-controls__title">{{ t("services.pdfEditor.editor.toolSettings") }}</div>
    <div class="pdf-controls__grid">
      <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.fields.color") }}</span><u-input v-model="editor.color" type="color" class="pdf-controls__color" /></label>
      <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.fields.opacity") }}</span><u-input v-model.number="editor.opacity" type="number" min="5" max="100" /></label>
      <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.fields.size") }}</span><u-input v-model.number="editor.size" type="number" min="1" max="40" /></label>
      <label class="pdf-controls__field"><span :title="t('services.pdfEditor.fields.shapeHelp')">{{ t("services.pdfEditor.fields.shape") }}</span><u-select v-model="editor.brushShape" :title="t('services.pdfEditor.fields.shapeHelp')" :items="[{label: t('services.pdfEditor.fields.shapeRound'), value: 'round'}, {label: t('services.pdfEditor.fields.shapeSquare'), value: 'square'}]" /></label>
      <div class="pdf-controls__field pdf-controls__field_row">
        <span>{{ t("services.pdfEditor.fields.textDefaults") }}</span>
        <div class="pdf-controls__style-row">
          <u-input v-model="editor.textValue" :placeholder="t('services.pdfEditor.fields.textPlaceholder')" style="min-width: 220px" />
          <u-input v-model.number="editor.textSize" type="number" min="8" max="120" style="width: 120px" />
          <u-input v-model="editor.textFont" :placeholder="t('services.pdfEditor.fields.fontPlaceholder')" style="min-width: 200px" />
          <button type="button" class="pdf-controls__chip" :class="{'pdf-controls__chip_active': editor.textBold}" @click="editor.textBold = !editor.textBold">B</button>
          <button type="button" class="pdf-controls__chip" :class="{'pdf-controls__chip_active': editor.textItalic}" @click="editor.textItalic = !editor.textItalic">I</button>
          <button type="button" class="pdf-controls__chip" :class="{'pdf-controls__chip_active': editor.textUnderline}" @click="editor.textUnderline = !editor.textUnderline">U</button>
        </div>
      </div>
      <label class="pdf-controls__field pdf-controls__field_row"><span>{{ t("services.pdfEditor.fields.signatureThickness") }}</span><u-input v-model.number="editor.signatureSize" type="number" min="1" max="12" style="width: 140px" /></label>
    </div>
    <div class="pdf-controls__help text-muted">{{ t("services.pdfEditor.editor.moveModeHelp") }}</div>
  </div>

  <div v-if="editor.fullMode" class="pdf-controls__section pdf-controls__inspector">
    <div class="pdf-controls__inspector-head"><div class="pdf-controls__title">{{ t("services.pdfEditor.full.title") }}</div><button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('load-text')"><u-icon name="i-lucide-scan-text" />{{ t("services.pdfEditor.full.loadText") }}</button></div>
    <div v-if="!selected.exists" class="pdf-controls__help text-muted">{{ t("services.pdfEditor.full.selectHint") }}</div>
    <div v-else class="pdf-controls__inspector-body">
      <div v-if="!selected.isText" class="pdf-controls__field pdf-controls__field_row"><button type="button" class="pdf-controls__pill" :disabled="busy" @click="$emit('replace-image')"><u-icon name="i-lucide-image-plus" />{{ t("services.pdfEditor.full.replaceImage") }}</button></div>
      <div class="pdf-controls__grid">
        <label v-if="selected.isText" class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.font") }}</span><u-select v-model="selected.fontFamily" :items="fontFamilies.map((font) => ({label: font, value: font}))" @update:model-value="$emit('apply-font')" /></label>
        <label v-if="selected.isText" class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.fontSize") }}</span><u-input v-model.number="selected.fontSize" type="number" min="4" max="400" @change="$emit('apply-font-size')" /></label>
        <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.color") }}</span><u-input v-model="selected.color" type="color" @update:model-value="$emit('apply-color')" /></label>
        <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.opacity") }}</span><u-input v-model.number="selected.opacity" type="number" min="0" max="100" @change="$emit('apply-opacity')" /></label>
      </div>
      <div v-if="selected.isText" class="pdf-controls__field pdf-controls__field_row">
        <span>{{ t("services.pdfEditor.full.style") }}</span>
        <div class="pdf-controls__style-row">
          <button v-for="style in textStyles" :key="style" type="button" class="pdf-controls__chip" :class="{'pdf-controls__chip_active': selected[style]}" @click="$emit('toggle-style', style)">{{ style[0]?.toUpperCase() }}</button>
          <div class="pdf-controls__separator" />
          <button v-for="align in textAlignments" :key="align" type="button" class="pdf-controls__chip" :class="{'pdf-controls__chip_active': selected.align === align}" @click="$emit('align', align)"><u-icon :name="`i-lucide-align-${align}`" /></button>
        </div>
      </div>
      <div class="pdf-controls__grid">
        <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.posX") }}</span><u-input v-model.number="selected.x" type="number" @change="$emit('apply-geometry')" /></label>
        <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.posY") }}</span><u-input v-model.number="selected.y" type="number" @change="$emit('apply-geometry')" /></label>
        <label class="pdf-controls__field"><span>{{ t("services.pdfEditor.full.width") }}</span><u-input v-model.number="selected.w" type="number" min="1" @change="$emit('apply-geometry')" /></label>
        <label class="pdf-controls__field"><span>{{ selected.isText ? t("services.pdfEditor.full.rotation") : t("services.pdfEditor.full.height") }}</span><u-input v-if="selected.isText" v-model.number="selected.angle" type="number" min="-180" max="180" @change="$emit('apply-geometry')" /><u-input v-else v-model.number="selected.h" type="number" min="1" @change="$emit('apply-geometry')" /></label>
      </div>
      <div class="pdf-controls__help text-muted">{{ t("services.pdfEditor.full.help") }}</div>
    </div>
  </div>
</template>

<style scoped>
.pdf-controls__toolstrip { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.pdf-controls__pill { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03); color: var(--ui-text-muted); font-weight: 700; font-size: 13px; cursor: pointer; transition: filter 180ms ease, transform 140ms ease, color 180ms ease; }
.pdf-controls__pill:hover { filter: brightness(1.06); color: var(--text-white); }
.pdf-controls__pill:active { transform: translateY(1px); }
.pdf-controls__pill:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(224, 103, 154, 0.3), 0 0 0 6px rgba(224, 103, 154, 0.14); }
.pdf-controls__pill:disabled { opacity: 0.45; cursor: not-allowed; }
.pdf-controls__pill_active { color: var(--text-white); border-color: rgba(224, 103, 154, 0.4); background: rgba(224, 103, 154, 0.18); }
.pdf-controls__separator { width: 1px; height: 22px; background: rgba(255, 255, 255, 0.08); margin: 0 2px; opacity: 0.7; }
.pdf-controls__section { margin-top: 12px; padding: 12px; border-radius: 10px; background: var(--ocean-form-surface-soft); border: 1px solid rgba(255, 255, 255, 0.06); }
.pdf-controls__title { font-weight: 600; margin-bottom: 10px; color: rgba(255, 255, 255, 0.9); }
.pdf-controls__inspector { border-color: rgba(224, 103, 154, 0.28); background: rgba(224, 103, 154, 0.06); }
.pdf-controls__inspector-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.pdf-controls__inspector-head .pdf-controls__title { margin-bottom: 0; }
.pdf-controls__inspector-body { display: grid; gap: 10px; }
.pdf-controls__grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 10px; align-items: start; }
.pdf-controls__field { display: grid; gap: 6px; }
.pdf-controls__field > span { font-weight: 600; font-size: 12px; color: rgba(255, 255, 255, 0.88); }
.pdf-controls__field_row { grid-column: 1 / -1; }
.pdf-controls__help { font-size: 12px; line-height: 1.35; }
.pdf-controls__style-row { display: inline-flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pdf-controls__chip { width: 38px; height: 34px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.9); font-weight: 600; }
.pdf-controls__chip_active { border-color: rgba(224, 103, 154, 0.35); background: rgba(224, 103, 154, 0.18); }
.pdf-controls__color { max-width: 120px; }
@media (min-width: 860px) { .pdf-controls__grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
</style>
