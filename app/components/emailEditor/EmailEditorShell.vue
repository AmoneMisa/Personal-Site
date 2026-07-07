<script setup lang="ts">
import EmailEditorToolbar from "./EmailEditorToolbar.vue";
import EmailEditorLayout from "./EmailEditorLayout.vue";

import ColorPickerPopover from "./modals/ColorPickerPopover.vue";

import { useEmailEditorState } from "~/composables/emailEditor/useEmailEditorState";
import { useEmailEditorActions } from "~/composables/emailEditor/useEmailEditorActions";

import InsertImageModal from "~/components/emailEditor/modals/InsertImageModal.vue";
import InsertLinkModal from "~/components/emailEditor/modals/InsertLinkModal.vue";
import InsertTemplateModal from "~/components/emailEditor/modals/InsertTemplateModal.vue";
import FakeDataPanel from "~/components/emailEditor/modals/FakeDataPanel.vue";

const { t } = useI18n();

const state = useEmailEditorState();
const actions = useEmailEditorActions(state);
</script>

<template>
  <section class="email-editor">
    <div class="email-editor__inner">
      <div class="email-editor__header">
        <div class="email-editor__title">
          <u-icon name="i-lucide-mail" />
          <span>{{ t("services.emailEditor.title") }}</span>
        </div>
      </div>

      <email-editor-toolbar
          :template-engine="state.templateEngine.value"
          :preview-client="state.previewClient.value"
          :is-busy="state.isBusy.value"
          :fake-data-enabled="state.fakeData.enabled"
          @update:template-engine="state.templateEngine.value = $event"
          @update:preview-client="state.previewClient.value = $event"
          @update:fake-data-enabled="state.fakeData.enabled = $event"
          @action="actions.onToolbarAction"
      />

      <email-editor-layout
          :code="state.code.value"
          :template-engine="state.templateEngine.value"
          :preview-client="state.previewClient.value"
          :diagnostics="state.diagnostics.value"
          :active-diagnostic-id="state.activeDiagnosticId.value"
          :fake-data="state.fakeData"
          @update:code="state.code.value = $event"
          @jump-to-diagnostic="actions.jumpToDiagnostic"
          @select-diagnostic="state.activeDiagnosticId.value = $event"
          @request-color-picker="actions.openColorPickerAt"
          @monaco-ready="state.monacoApi.value = $event"
      />

      <insert-image-modal
          v-model:open="state.modals.insertImage"
          @insert="actions.insertImage"
      />

      <insert-link-modal
          v-model:open="state.modals.insertLink"
          @insert="actions.insertLink"
      />

      <insert-template-modal
          v-model:open="state.modals.insertTemplate"
          :template-engine="state.templateEngine.value"
          @insert="actions.insertTemplate"
      />

      <fake-data-panel
          v-model:open="state.fakeData.open"
          :detected-paths="actions.detectedVariablePaths.value"
          :values="state.fakeData.values"
          @update:value="actions.setFakeValue($event.path, $event.value)"
          @add="actions.addFakePath"
          @remove="actions.removeFakePath"
      />

      <color-picker-popover
          v-model:open="state.colorPicker.open"
          v-model:color="state.colorPicker.color"
          v-model:prefer-hex="state.colorPicker.preferHex"
          :anchor-client-x="state.colorPicker.anchorClientX"
          :anchor-client-y="state.colorPicker.anchorClientY"
          @apply="actions.applyColorFromPicker"
          @close="actions.closeColorPicker"
      />
    </div>
  </section>
</template>

<style lang="scss">
.email-editor {
  border-radius: 18px;
}

.email-editor__inner {
  border-radius: 16px;
  padding: 16px;
}

.email-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.email-editor__title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.9);
}

.light .email-editor__title {
  color: rgba(21, 22, 42, 0.85);
}
</style>
