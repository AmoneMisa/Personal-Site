<script setup lang="ts">
import EmailEditorMonaco from "~/components/emailEditor/EmailEditorMonaco.vue";
import EmailEditorPreview from "~/components/emailEditor/EmailEditorPreview.vue";
import EmailEditorDiagnosticsPanel from "~/components/emailEditor/EmailEditorDiagnosticsPanel.vue";

import type { DiagnosticItem } from "~/utils/emailEditor/diagnostics/types";
import type { PreviewClient, TemplateEngine } from "~/utils/emailEditor/preview/clientProfiles";

type Props = {
  code: string;
  templateEngine: TemplateEngine;
  previewClient: PreviewClient;
  diagnostics: DiagnosticItem[];
  activeDiagnosticId: string | null;
  fakeData: { enabled: boolean; values: Record<string, string> };
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:code", v: string): void;
  (e: "jump-to-diagnostic", id: string): void;
  (e: "select-diagnostic", id: string | null): void;
  (e: "request-color-picker", payload: { clientX: number; clientY: number; startOffset: number; endOffset: number; current: string }): void;
  (e: "monaco-ready", api: any): void;
}>();
</script>

<template>
  <div class="email-editor-layout">
    <div class="email-editor-layout__column email-editor-layout__column_editor">
      <div class="email-editor-layout__panel ui-anim-border">
        <div class="ui-anim-border__inner email-editor-layout__panel-inner">
          <div class="email-editor-layout__panel-title">
            <u-icon name="i-lucide-code" />
            <span>HTML</span>
          </div>

          <EmailEditorMonaco
              :model-value="props.code"
              :template-engine="props.templateEngine"
              :diagnostics="props.diagnostics"
              :active-diagnostic-id="props.activeDiagnosticId"
              @update:model-value="emit('update:code', $event)"
              @ready="emit('monaco-ready', $event)"
              @request-color-picker="emit('request-color-picker', $event)"
          />
        </div>
      </div>

      <EmailEditorDiagnosticsPanel
          class="email-editor-layout__diagnostics"
          :diagnostics="props.diagnostics"
          :active-id="props.activeDiagnosticId"
          @select="emit('select-diagnostic', $event)"
          @jump="emit('jump-to-diagnostic', $event)"
      />
    </div>

    <div class="email-editor-layout__column email-editor-layout__column_preview">
      <div class="email-editor-layout__panel ui-anim-border">
        <div class="ui-anim-border__inner email-editor-layout__panel-inner">
          <div class="email-editor-layout__panel-title">
            <u-icon name="i-lucide-monitor" />
            <span>Preview</span>
          </div>

          <EmailEditorPreview
              :code="props.code"
              :template-engine="props.templateEngine"
              :preview-client="props.previewClient"
              :fake-data="props.fakeData"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.email-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 1024px) {
  .email-editor-layout {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    align-items: start;
  }
}

.email-editor-layout__panel {
  border-radius: 18px;
}

.email-editor-layout__panel-inner {
  border-radius: 16px;
  padding: 12px;
}

.email-editor-layout__panel-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.9);
}

.light .email-editor-layout__panel-title {
  color: rgba(21, 22, 42, 0.85);
}

.email-editor-layout__diagnostics {
  margin-top: 12px;
}
</style>

